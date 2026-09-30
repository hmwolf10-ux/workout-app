// Starting, logging and finishing workouts. All state changes go through the store.
import { getState, commit, mutate, registerExercise, getProgram, sortSessions } from './store.js';
import { getExercise } from './catalog.js';
import { planFor, prescribe, repRange, setsFor, historyFor, warmups, prCheck, nextSetHint, isMain, sessionStats } from './engine.js';
import { isoDate, uid, num } from './util.js';

export const incFor = (s, ex) => ex.increment ?? s.settings.increments[ex.incClass] ?? 2.5;
export const currentPlan = (s = getState()) => planFor(s.settings, isoDate());
export const bodyWeightFor = (s, ex) => (ex.type === 'bodyweight' ? s.settings.bodyWeight : 0);

export function buildEntry(s, ex, opts = {}, plan = currentPlan(s)) {
  const hist = historyFor(s.sessions, ex.id);
  const inc = incFor(s, ex);
  const range = repRange(ex, opts, plan);
  const rx = prescribe(ex, hist, plan, { range, inc, bodyWeight: s.settings.bodyWeight, today: isoDate() });
  const count = setsFor(opts.sets || 3, plan);
  const work = Array.from({ length: count }, () => ({ w: null, r: null, rir: null, done: false }));
  const warm = s.settings.showWarmups ? warmups(ex, rx.w, { unit: s.settings.unit, inc }).map(x => ({ w: x.w, r: x.r, rir: null, done: false, warmup: true })) : [];
  return {
    uid: uid(), exId: ex.id, name: ex.name, primary: ex.primary, secondary: ex.secondary || [], type: ex.type, equipment: ex.equipment, inc,
    rest: (opts.rest || ex.rest || 90) + (isMain(ex) ? plan.restBonus : 0), rx, hint: null, note: '', sets: [...warm, ...work],
  };
}

function newActive(name, extra = {}) {
  const plan = currentPlan();
  return { id: uid(), date: isoDate(), name, startedAt: Date.now(), restEnd: null, planLabel: plan.label, exercises: [], ...extra };
}

export function startWorkout(programId, dayId) {
  commit(s => {
    const day = getProgram(s, programId)?.days.find(d => d.id === dayId);
    if (!day) return;
    const plan = currentPlan(s);
    s.active = newActive(day.name, { programId, dayId });
    s.active.exercises = day.exercises.map(e => {
      const ex = getExercise(s, e.exId);
      return ex ? buildEntry(s, registerExercise(s, ex), e, plan) : null;
    }).filter(Boolean);
  });
}

export function startQuick() {
  commit(s => { s.active = newActive('Quick workout'); });
}

export function startFromSession(sessionId) {
  commit(s => {
    const src = s.sessions.find(x => x.id === sessionId);
    if (!src) return;
    const plan = currentPlan(s);
    s.active = newActive(src.name, { programId: src.programId, dayId: src.dayId });
    s.active.exercises = src.exercises.map(e => {
      const ex = getExercise(s, e.exId);
      return ex ? buildEntry(s, ex, { sets: e.sets.filter(x => !x.warmup).length }, plan) : null;
    }).filter(Boolean);
  });
}

const findEx = (s, exUid) => s.active?.exercises.find(e => e.uid === exUid);

export function suggested(ex) {
  const done = ex.sets.filter(x => x.done && !x.warmup);
  const lastW = done.length ? done[done.length - 1].w : null;
  return { w: ex.hint?.w ?? lastW ?? ex.rx.w, r: ex.rx.r };
}

// Returns { ok, pr } . `vals` are the raw input strings from the row.
export function toggleSet(exUid, idx, vals) {
  let result = { ok: false };
  commit(s => {
    const ex = findEx(s, exUid);
    const set = ex?.sets[idx];
    if (!set) return;
    if (set.done) {
      set.done = false; set.pr = null; ex.hint = null; s.active.restEnd = null;
      result = { ok: true };
      return;
    }
    const sug = suggested(ex);
    const w = num(vals.w) ?? set.w ?? (set.warmup ? set.w : sug.w);
    const r = num(vals.r) ?? set.r ?? (set.warmup ? set.r : sug.r);
    if (!r || r <= 0) { result = { ok: false, msg: 'Enter the reps first' }; return; }
    if (ex.type !== 'bodyweight' && (w == null || w < 0)) { result = { ok: false, msg: 'Enter the weight first' }; return; }
    set.w = w ?? 0; set.r = r;
    if (!set.warmup) set.rir = num(vals.rir) ?? set.rir ?? ex.rx.rir;
    set.done = true;
    if (!set.warmup) {
      const bw = ex.type === 'bodyweight' ? s.settings.bodyWeight : 0;
      set.pr = prCheck(historyFor(s.sessions, ex.exId), set, bw);
      ex.hint = nextSetHint(set, ex.rx, ex.inc);
    }
    s.active.restEnd = Date.now() + (set.warmup ? 45 : ex.rest) * 1000;
    result = { ok: true, pr: set.pr, hint: ex.hint?.msg };
  });
  return result;
}

export function setField(exUid, idx, field, value) {
  mutate(s => {
    const set = findEx(s, exUid)?.sets[idx];
    if (set) set[field] = num(value);
  });
}
export function setNote(exUid, value) { mutate(s => { const ex = findEx(s, exUid); if (ex) ex.note = value; }); }

export function addSet(exUid) {
  commit(s => { findEx(s, exUid)?.sets.push({ w: null, r: null, rir: null, done: false }); });
}
export function removeSet(exUid, idx) {
  commit(s => {
    const ex = findEx(s, exUid);
    if (ex && ex.sets.length > 1) ex.sets.splice(idx, 1);
  });
}
export function moveExercise(exUid, dir) {
  commit(s => {
    const list = s.active.exercises;
    const i = list.findIndex(e => e.uid === exUid), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  });
}
export function removeExercise(exUid) {
  commit(s => { s.active.exercises = s.active.exercises.filter(e => e.uid !== exUid); });
}
export function addExerciseToActive(def) {
  commit(s => { s.active.exercises.push(buildEntry(s, registerExercise(s, def), { sets: 3 })); });
}
export function swapExercise(exUid, def) {
  commit(s => {
    const list = s.active.exercises;
    const i = list.findIndex(e => e.uid === exUid);
    if (i < 0) return;
    const count = list[i].sets.filter(x => !x.warmup).length;
    list[i] = buildEntry(s, registerExercise(s, def), { sets: count }, { ...currentPlan(s), isDeload: false, volMult: 1, ramp: 0 });
  });
}
export function skipRest() { mutate(s => { if (s.active) s.active.restEnd = null; }); }
export function extendRest(sec) {
  mutate(s => {
    if (!s.active) return;
    s.active.restEnd = Math.max(Date.now(), s.active.restEnd || Date.now()) + sec * 1000;
  });
}

export function discardWorkout() { commit(s => { s.active = null; }); }

export function finishWorkout() {
  let session = null;
  commit(s => {
    const a = s.active;
    if (!a) return;
    const exercises = a.exercises.map(e => ({
      uid: e.uid, exId: e.exId, name: e.name, primary: e.primary, secondary: e.secondary, note: e.note || '',
      sets: e.sets.filter(x => x.done).map(x => ({ w: x.w, r: x.r, rir: x.rir, done: true, warmup: !!x.warmup, pr: x.pr || null })),
    })).filter(e => e.sets.some(x => !x.warmup));
    if (exercises.length) {
      session = { id: a.id, date: a.date, name: a.name, programId: a.programId, dayId: a.dayId, startedAt: a.startedAt, endedAt: Date.now(), planLabel: a.planLabel, exercises };
      s.sessions.push(session);
      sortSessions(s);
    }
    s.active = null;
  });
  return session && { session, stats: sessionStats(session) };
}
