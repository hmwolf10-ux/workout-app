import { $, esc, fmtNum, fmtDur, fmtK, cap } from '../util.js';
import { actions, ui, openSheet, closeSheet, toast } from '../ui.js';
import { getState, commit } from '../store.js';
import { historyFor, platesPerSide } from '../engine.js';
import * as S from '../session.js';
import { openExercisePicker } from '../pickers.js';

const isHeavy = ex => ex.type !== 'bodyweight';

function lastLine(s, ex) {
  const h = historyFor(s.sessions, ex.exId).slice(-1)[0];
  if (!h) return '';
  const txt = h.sets.map(x => `${x.w ? fmtNum(x.w) + '×' : ''}${x.r}`).join(', ');
  return `<p class="last">Last (${esc(h.date.slice(5))}): ${esc(txt)}</p>`;
}

function setRow(ex, set, i, sug, unit, n) {
  const wVal = set.w ?? '';
  const rVal = set.r ?? '';
  const rirOpts = ['', 0, 1, 2, 3, 4].map(v => `<option value="${v}" ${set.rir === v && v !== '' ? 'selected' : ''}>${v === '' ? '–' : v === 4 ? '4+' : v}</option>`).join('');
  const label = set.warmup ? '<span class="tag">W</span>' : n;
  return `<div class="set ${set.done ? 'done' : ''} ${set.warmup ? 'warm' : ''}" data-ex="${ex.uid}" data-i="${i}">
    <span class="idx">${label}</span>
    <input data-f="w" inputmode="decimal" aria-label="Weight ${unit}" placeholder="${set.warmup ? '' : esc(sug.w == null ? unit : fmtNum(sug.w))}" value="${esc(wVal)}">
    <input data-f="r" inputmode="numeric" aria-label="Reps" placeholder="${set.warmup ? '' : esc(sug.r)}" value="${esc(rVal)}">
    ${set.warmup ? '<span></span>' : `<select data-f="rir" aria-label="Reps in reserve">${rirOpts}</select>`}
    <button class="check" data-act="toggle-set" aria-label="${set.done ? 'Undo set' : 'Complete set'}">${set.done ? '✓' : '○'}</button>
    ${set.pr ? `<span class="pr">${esc(set.pr)}</span>` : ''}
  </div>`;
}

function exerciseCard(s, ex, ei, total, tail) {
  const unit = s.settings.unit;
  const sug = S.suggested(ex);
  let n = 0;
  const rx = ex.rx;
  const target = rx.w == null
    ? `Find a load for ${rx.lo}–${rx.hi} reps`
    : `${rx.w > 0 ? fmtNum(rx.w) + ' ' + unit + ' × ' : ''}${rx.r} reps · ${rx.rir} RIR`;
  const rows = ex.sets.map((set, i) => setRow(ex, set, i, sug, unit, set.warmup ? 0 : ++n)).join('');
  const pl = ex.equipment === 'barbell' && rx.w > 0 ? platesPerSide(rx.w, unit) : null;
  const plates = pl?.length ? `<p class="muted small">Per side: ${pl.join(' + ')}</p>` : '';
  const anyDone = ex.sets.some(x => x.done);
  return `<section class="card ex${ex.ss ? " ss" : ""}${tail ? " ss-tail" : ""}" data-ex="${ex.uid}">
    <div class="row between top">
      <div><h3><button class="name-btn" data-act="ex-detail" data-id="${esc(ex.exId)}">${esc(ex.name)}</button></h3><p class="muted small">${esc(cap(ex.primary) || 'Custom')}</p></div>
      <div class="row tools">
        <button class="icon-btn" data-act="move-ex" data-dir="-1" data-ex="${ex.uid}" ${ei === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button class="icon-btn" data-act="move-ex" data-dir="1" data-ex="${ex.uid}" ${ei === total - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        <button class="icon-btn" data-act="swap-ex" data-ex="${ex.uid}" ${anyDone ? 'disabled' : ''} aria-label="Swap exercise">⇄</button>
        <button class="icon-btn" data-act="remove-ex" data-ex="${ex.uid}" aria-label="Remove exercise">✕</button>
      </div>
    </div>
    <div class="target"><strong>${esc(target)}</strong><span class="muted small">${esc(rx.reason)}</span></div>
    ${plates}
    ${lastLine(s, ex)}
    ${ex.hint ? `<div class="hint">${esc(ex.hint.msg)}</div>` : ''}
    <div class="set head"><span>Set</span><span>${isHeavy(ex) ? unit : 'Added ' + unit}</span><span>Reps</span><span>RIR</span><span></span></div>
    ${rows}
    <div class="row gap">
      <button class="btn small" data-act="add-set" data-ex="${ex.uid}">＋ Set</button>
      <button class="btn small" data-act="remove-set" data-ex="${ex.uid}" ${ex.sets.length <= 1 ? 'disabled' : ''}>− Set</button>
      ${ei < total - 1 ? `<button class="btn small ${ex.ss ? "on" : ""}" data-act="superset" data-ex="${ex.uid}" aria-pressed="${!!ex.ss}">Superset</button>` : ""}
    </div>
    <div class="row note-row"><input class="note" data-note="${ex.uid}" placeholder="Note" maxlength="200" value="${esc(ex.note || "")}">
    </div>
  </section>`;
}

export function renderWorkout(s) {
  const a = s.active;
  if (!a) return '<p class="muted pad">No workout in progress.</p>';
  const cards = a.exercises.map((ex, i) => exerciseCard(s, ex, i, a.exercises.length, i > 0 && a.exercises[i - 1].ss)).join('');
  return `<header class="wk-head">
      <button class="icon-btn" data-act="minimize" aria-label="Minimize workout">‹</button>
      <div class="grow"><strong>${esc(a.name)}</strong><span class="muted small">${esc(a.planLabel || '')}</span></div>
      <span id="elapsed" class="elapsed">0:00</span>
      <button class="btn small primary" data-act="finish">Finish</button>
    </header>
    ${cards || '<p class="muted pad">Empty workout. Add your first exercise.</p>'}
    <button class="btn block" data-act="add-ex">＋ Add exercise</button>
    <button class="btn block danger" data-act="discard">Discard workout</button>`;
}

const rowOf = el => el.closest('.set');
const readVals = row => ({ w: $('[data-f=w]', row)?.value, r: $('[data-f=r]', row)?.value, rir: $('[data-f=rir]', row)?.value });

actions['toggle-set'] = el => {
  const row = rowOf(el);
  const res = S.toggleSet(row.dataset.ex, Number(row.dataset.i), readVals(row));
  if (!res.ok) toast(res.msg || 'Enter the reps first');
  else if (res.pr) toast('🏆 ' + res.pr);
};
document.addEventListener('change', e => {
  const f = e.target.dataset?.f;
  const row = e.target.closest?.('.set');
  if (f && row?.dataset.ex) S.setField(row.dataset.ex, Number(row.dataset.i), f, e.target.value);
  if (e.target.dataset?.note) S.setNote(e.target.dataset.note, e.target.value);
});
actions['add-set'] = el => S.addSet(el.dataset.ex);
actions['remove-set'] = el => {
  const ex = getState().active.exercises.find(x => x.uid === el.dataset.ex);
  const last = ex.sets.map(x => x.done).lastIndexOf(false);
  S.removeSet(el.dataset.ex, last < 0 ? ex.sets.length - 1 : last);
};
actions['move-ex'] = el => S.moveExercise(el.dataset.ex, Number(el.dataset.dir));
actions['remove-ex'] = el => { if (confirm('Remove this exercise from the workout?')) S.removeExercise(el.dataset.ex); };
actions['add-ex'] = () => openExercisePicker({ title: 'Add exercise', onPick: S.addExerciseToActive });
actions['swap-ex'] = el => {
  const ex = getState().active.exercises.find(x => x.uid === el.dataset.ex);
  openExercisePicker({ title: `Swap ${ex.name}`, onPick: def => S.swapExercise(el.dataset.ex, def) });
  const muscle = Object.values(getState().exercises).find(x => x.id === ex.exId)?.primary;
  if (muscle) { $('#pickMuscle').value = muscle; $('#pickQ').dispatchEvent(new Event('input', { bubbles: true })); }
};
actions['minimize'] = () => commit(() => { ui.tab = 'today'; });
actions['discard'] = () => {
  if (!confirm('Discard this workout? Logged sets will be lost.')) return;
  ui.tab = 'today';
  S.discardWorkout();
};
actions['finish'] = () => {
  const a = getState().active;
  const done = a.exercises.flatMap(e => e.sets.filter(x => x.done && !x.warmup)).length;
  if (!done) {
    if (confirm('No sets logged. Discard this workout?')) { ui.tab = 'today'; S.discardWorkout(); }
    return;
  }
  openSheet(`<div class="sheet-head"><h2>Finish workout?</h2></div>
    <p>${done} working set${done === 1 ? '' : 's'} logged. Unfinished sets are dropped.</p>
    <div class="row gap"><button class="btn" data-act="close-sheet">Keep training</button><button class="btn primary" data-act="confirm-finish">Save workout</button></div>`);
};
actions['confirm-finish'] = () => {
  ui.tab = 'today';
  const r = S.finishWorkout();
  closeSheet();
  if (!r) return;
  const prs = r.session.exercises.flatMap(e => e.sets.filter(x => x.pr).map(x => `${e.name}: ${x.pr}`));
  openSheet(`<div class="sheet-head"><h2>Nice work 💪</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
    <div class="stats3"><div><strong>${r.stats.sets}</strong><span>sets</span></div><div><strong>${fmtK(r.stats.volume)}</strong><span>${getState().settings.unit} volume</span></div><div><strong>${fmtDur(r.stats.duration)}</strong><span>time</span></div></div>
    ${prs.length ? `<h3>Records</h3><ul class="plain">${prs.map(p => `<li>🏆 ${esc(p)}</li>`).join('')}</ul>` : ''}
    <button class="btn primary block" data-act="close-sheet">Done</button>`);
};
actions['superset'] = el => S.toggleSuperset(el.dataset.ex);
