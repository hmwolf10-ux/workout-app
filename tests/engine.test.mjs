import test from 'node:test';
import assert from 'node:assert/strict';
import {
  e1rm, loadForReps, prescribe, warmups, prCheck, planFor, setsFor, repRange,
  volumeFromExercises, nextDayIndex, historyFor, stalledExercises, layoffFactor, platesPerSide,
} from '../src/engine.js';

const bench = { id: 'bench', type: 'weighted', compound: true, equipment: 'barbell', primary: 'chest', repMin: 6, repMax: 8 };
const pullup = { id: 'pu', type: 'bodyweight', compound: true, equipment: 'body only', primary: 'lats', repMin: 5, repMax: 8 };
const plan = { rir: 2, isDeload: false };
const cfg = { range: [6, 8], inc: 5, bodyWeight: 180 };
const hist = sets => [{ date: '2026-09-01', sets }];

test('e1RM and load-for-reps are inverses', () => {
  const e = e1rm(185, 6, 2);
  assert.ok(Math.abs(loadForReps(e, 6, 2) - 185) < 1e-9);
});

test('no history asks the lifter to calibrate', () => {
  const rx = prescribe(bench, [], plan, cfg);
  assert.equal(rx.w, null);
  assert.equal(rx.basis, 'none');
});

test('same effort repeats the load and asks for one more rep', () => {
  const rx = prescribe(bench, hist([{ w: 185, r: 6, rir: 2 }, { w: 185, r: 5, rir: 2 }]), plan, cfg);
  assert.equal(rx.w, 185);
  assert.equal(rx.r, 7);
});

test('topping the rep range adds load', () => {
  const rx = prescribe(bench, hist([{ w: 185, r: 8, rir: 2 }]), plan, cfg);
  assert.equal(rx.w, 190);
  assert.ok(rx.r >= 6 && rx.r <= 8);
});

test('falling under the range drops the load', () => {
  const rx = prescribe(bench, hist([{ w: 185, r: 3, rir: 1 }]), plan, cfg);
  assert.ok(rx.w < 185);
  assert.equal(rx.r, 6);
});

test('deload never raises load', () => {
  const rx = prescribe(bench, hist([{ w: 185, r: 8, rir: 2 }]), { rir: 4, isDeload: true }, cfg);
  assert.ok(rx.w <= 185);
});

test('bodyweight lifts add reps first, then load', () => {
  const c = { range: [5, 8], inc: 5, bodyWeight: 180 };
  assert.equal(prescribe(pullup, hist([{ w: 0, r: 6, rir: 2 }]), plan, c).w, 0);
  assert.equal(prescribe(pullup, hist([{ w: 0, r: 9, rir: 2 }]), plan, c).w, 5);
});

test('warm-ups ramp toward the working weight', () => {
  const w = warmups(bench, 225, { unit: 'lb', inc: 5 });
  assert.deepEqual(w.map(x => x.w), [90, 135, 180]);
  assert.deepEqual(warmups({ ...bench, compound: false }, 225, { unit: 'lb', inc: 5 }), []);
});

test('PR detection', () => {
  const h = hist([{ w: 185, r: 6, rir: 2 }]);
  assert.equal(prCheck(h, { w: 185, r: 7, rir: 2 }), 'e1RM PR');
  assert.equal(prCheck(h, { w: 135, r: 5, rir: 3 }), null);
  assert.equal(prCheck([], { w: 135, r: 5, rir: 3 }), null);
});

test('hypertrophy block ramps effort and ends with a deload', () => {
  const s = { goal: 'hypertrophy', mesoLength: 4, deload: true, rampVolume: true, mesoStart: '2026-09-07' };
  const at = d => planFor(s, d);
  assert.equal(at('2026-09-07').rir, 3);
  assert.equal(at('2026-09-28').rir, 1);
  assert.equal(at('2026-10-05').isDeload, true);
  assert.equal(at('2026-10-12').week, 1);
  assert.equal(setsFor(3, at('2026-10-05')), 2);
  assert.equal(setsFor(3, at('2026-09-21')), 4);
});

test('peaking counts down to the event', () => {
  const s = { goal: 'peaking', peakDate: '2026-11-01' };
  assert.equal(planFor(s, '2026-08-01').phase, 'Accumulation');
  assert.equal(planFor(s, '2026-09-25').phase, 'Intensification');
  assert.equal(planFor(s, '2026-10-20').phase, 'Realization');
  assert.equal(planFor(s, '2026-10-28').phase, 'Taper');
  assert.equal(planFor(s, '2026-11-01').phase, 'Event day');
});

test('goal ranges apply to main lifts only and explicit ranges win', () => {
  const p = planFor({ goal: 'strength', mesoLength: 4, deload: true, mesoStart: '2026-09-07' }, '2026-09-07');
  assert.deepEqual(repRange(bench, {}, p), [3, 6]);
  assert.deepEqual(repRange({ ...bench, equipment: 'dumbbell' }, {}, p), [6, 8]);
  assert.deepEqual(repRange(bench, { lo: 4, hi: 5 }, p), [4, 5]);
});

test('secondary muscles count half toward weekly volume', () => {
  const v = volumeFromExercises([{ primary: 'chest', secondary: ['triceps', 'shoulders'], sets: 4 }]);
  assert.equal(v.chest.total, 4);
  assert.equal(v.triceps.total, 2);
});

test('history ignores warm-ups and undone sets', () => {
  const sessions = [{ date: '2026-09-01', exercises: [{ exId: 'bench', sets: [
    { w: 100, r: 5, done: true, warmup: true }, { w: 185, r: 6, done: true }, { w: 185, r: 6, done: false }] }] }];
  assert.equal(historyFor(sessions, 'bench')[0].sets.length, 1);
});

test('next day rotates through the program', () => {
  const program = { id: 'p', days: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
  assert.equal(nextDayIndex(program, []), 0);
  assert.equal(nextDayIndex(program, [{ programId: 'p', dayId: 'a' }]), 1);
  assert.equal(nextDayIndex(program, [{ programId: 'p', dayId: 'c' }]), 0);
});

test('a flat e1RM over three sessions is flagged as stalled', () => {
  const mk = (date, r) => ({ date, exercises: [{ exId: 'bench', name: 'Bench', sets: [{ w: 185, r, rir: 2, done: true }] }] });
  const stalled = stalledExercises([mk('2026-09-08', 6), mk('2026-09-15', 6), mk('2026-09-22', 6)], '2026-09-25');
  assert.deepEqual(stalled, ['Bench']);
  const improving = stalledExercises([mk('2026-09-08', 6), mk('2026-09-15', 7), mk('2026-09-22', 8)], '2026-09-25');
  assert.deepEqual(improving, []);
});

test('layoff discount grows with time away and caps at 15%', () => {
  assert.equal(layoffFactor('2026-09-01', '2026-09-10'), 1);
  assert.ok(Math.abs(layoffFactor('2026-09-01', '2026-09-22') - 0.975) < 1e-9);
  assert.ok(Math.abs(layoffFactor('2026-01-01', '2026-09-22') - 0.85) < 1e-9);
});

test('prescribe lowers the target after a long layoff', () => {
  const h = hist([{ w: 200, r: 6, rir: 2, done: true }]);
  const fresh = prescribe(bench, h, plan, { ...cfg, today: '2026-09-05' });
  const away = prescribe(bench, h, plan, { ...cfg, today: '2026-10-20' });
  assert.ok(away.w < fresh.w || away.r < fresh.r);
  assert.match(away.reason, /layoff/);
});

test('platesPerSide builds loads from the bar', () => {
  assert.deepEqual(platesPerSide(135, 'lb'), [45]);
  assert.deepEqual(platesPerSide(185, 'lb'), [45, 25]);
  assert.deepEqual(platesPerSide(45, 'lb'), []);
  assert.equal(platesPerSide(136, 'lb'), null);
  assert.deepEqual(platesPerSide(100, 'kg'), [25, 15]);
});
