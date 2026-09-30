import { esc, cap, uid, num } from '../util.js';
import { actions, ui, openSheet, closeSheet } from '../ui.js';
import { getState, commit, mutate, getProgram, programFromTemplate, registerExercise } from '../store.js';
import { getExercise } from '../catalog.js';
import { TEMPLATES } from '../defaults.js';
import { volumeFromExercises } from '../engine.js';
import { openExercisePicker } from '../pickers.js';
import { volumeRows } from './volume.js';

const tplRow = (t, act) => `<button class="trow" data-act="${act}" data-tpl="${t.id}"><span><strong>${esc(t.name)}</strong><small>${t.days.length} days · ${esc(t.blurb)}</small></span><i aria-hidden="true">›</i></button>`;

// Three common programs up front; the rest sit behind "More programs".
export function templateList(act, extra = '') {
  const more = TEMPLATES.filter(t => t.more);
  return `<div class="group tlist">${TEMPLATES.filter(t => !t.more).map(t => tplRow(t, act)).join('')}
    <details><summary class="trow"><span><strong>More programs</strong><small>${more.length} more options</small></span><i aria-hidden="true">›</i></summary>${more.map(t => tplRow(t, act)).join('')}</details>${extra}</div>`;
}

export function renderPlan(s) {
  const prog = ui.planEdit && getProgram(s, ui.planEdit);
  return prog ? renderEditor(s, prog) : renderList(s);
}

function renderList(s) {
  const cards = s.programs.map(p => `
    <section class="card">
      <div class="row between"><h3>${esc(p.name)}</h3>${p.id === s.activeProgramId ? '<span class="pill">Active</span>' : ''}</div>
      <p class="muted">${p.days.length} day${p.days.length === 1 ? '' : 's'}: ${esc(p.days.map(d => d.name).join(' · '))}</p>
      <div class="row gap">
        <button class="btn primary" data-act="plan-edit" data-prog="${p.id}">Edit</button>
        ${p.id === s.activeProgramId ? '' : `<button class="btn" data-act="plan-activate" data-prog="${p.id}">Make active</button>`}
        <button class="btn danger" data-act="plan-delete" data-prog="${p.id}">Delete</button>
      </div>
    </section>`).join('');
  return `<header class="page-head"><div><p class="eyebrow">Programs &amp; exercises</p></div></header>
    ${cards || '<p class="muted">No programs yet.</p>'}
    <button class="btn block" data-act="plan-new">＋ New program</button>
    <button class="btn block" data-act="open-library">Exercise library</button>
    <p class="muted small">Need a one-off session? Use Quick workout on the Today tab and add any exercise as you go.</p>`;
}

function renderEditor(s, p) {
  const entries = [];
  const sel = p.days.find(d => d.id === ui.planDay) || p.days[0];
  p.days.forEach(d => d.exercises.forEach(e => { const ex = getExercise(s, e.exId); if (ex) entries.push({ primary: ex.primary, secondary: ex.secondary, sets: e.sets }); }));
  const tabs = `<div class="daytabs" role="tablist">${p.days.map(d => `<button role="tab" class="${d.id === sel.id ? 'on' : ''}" aria-selected="${d.id === sel.id}" data-act="plan-day" data-day="${d.id}">${esc(d.name)}</button>`).join('')}<button class="add" data-act="plan-add-day" aria-label="Add day">＋</button></div>`;
  const days = p.days.filter(d => d === sel).map(d => {
    const di = p.days.indexOf(d);
    const rows = d.exercises.map((e, ei) => {
      const ex = getExercise(s, e.exId);
      return `<div class="prow">
        <div class="grow"><strong>${esc(ex?.name || 'Unknown exercise')}</strong>
          <span class="muted small">${esc(cap(ex?.primary) || '')}</span></div>
        <div class="stepper"><button class="icon-btn" data-act="plan-sets" data-day="${d.id}" data-ex="${e.uid}" data-d="-1" aria-label="Fewer sets">−</button><span>${e.sets} sets</span><button class="icon-btn" data-act="plan-sets" data-day="${d.id}" data-ex="${e.uid}" data-d="1" aria-label="More sets">＋</button></div>
        <div class="range"><input data-pn="lo" data-day="${d.id}" data-ex="${e.uid}" inputmode="numeric" placeholder="${ex?.repMin ?? ''}" value="${e.lo ?? ''}" aria-label="Rep min"><span>–</span><input data-pn="hi" data-day="${d.id}" data-ex="${e.uid}" inputmode="numeric" placeholder="${ex?.repMax ?? ''}" value="${e.hi ?? ''}" aria-label="Rep max"></div>
        <div class="row tools">
          <button class="icon-btn" data-act="plan-move-ex" data-day="${d.id}" data-ex="${e.uid}" data-dir="-1" ${ei === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="icon-btn" data-act="plan-move-ex" data-day="${d.id}" data-ex="${e.uid}" data-dir="1" ${ei === d.exercises.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <button class="icon-btn" data-act="plan-del-ex" data-day="${d.id}" data-ex="${e.uid}" aria-label="Remove">✕</button>
        </div>
      </div>`;
    }).join('');
    return `<section class="card">
      <div class="row between"><input class="title-input" data-pn="day" data-day="${d.id}" value="${esc(d.name)}" maxlength="40" aria-label="Day name">
        <div class="row tools">
          <button class="icon-btn" data-act="plan-move-day" data-day="${d.id}" data-dir="-1" ${di === 0 ? 'disabled' : ''} aria-label="Move day up">↑</button>
          <button class="icon-btn" data-act="plan-move-day" data-day="${d.id}" data-dir="1" ${di === p.days.length - 1 ? 'disabled' : ''} aria-label="Move day down">↓</button>
          <button class="icon-btn" data-act="plan-del-day" data-day="${d.id}" aria-label="Delete day">✕</button>
        </div></div>
      ${rows || '<p class="muted">No exercises yet.</p>'}
      <button class="btn small" data-act="plan-add-ex" data-day="${d.id}">＋ Add exercise</button>
    </section>`;
  }).join('');
  return `<header class="page-head row"><button class="icon-btn" data-act="plan-back" aria-label="Back">‹</button>
      <input class="title-input big" data-pn="prog" value="${esc(p.name)}" maxlength="40" aria-label="Program name"></header>
    ${tabs}
    ${days}
    <p class="muted small">Rep boxes are optional. Leave them blank to use each exercise's usual range.</p>
    <details class="card slim"><summary><h3>Weekly volume</h3><span class="muted small">each day trained once</span></summary>${volumeRows(volumeFromExercises(entries))}</details>`;
}

const prog = () => getProgram(getState(), ui.planEdit);
const dayOf = id => prog().days.find(d => d.id === id);

actions['plan-edit'] = el => commit(() => { ui.planEdit = el.dataset.prog; ui.planDay = null; });
actions['plan-day'] = el => commit(() => { ui.planDay = el.dataset.day; });
actions['plan-back'] = () => commit(() => { ui.planEdit = null; });
actions['plan-activate'] = el => commit(s => { s.activeProgramId = el.dataset.prog; });
actions['plan-delete'] = el => {
  if (!confirm('Delete this program? Your logged workouts are kept.')) return;
  commit(s => {
    s.programs = s.programs.filter(p => p.id !== el.dataset.prog);
    if (s.activeProgramId === el.dataset.prog) s.activeProgramId = s.programs[0]?.id || null;
  });
};
actions['plan-new'] = () => openSheet(`
  <div class="sheet-head"><h2>New program</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
  ${templateList('plan-from-template', `<button class="trow" data-act="plan-blank"><span><strong>Blank program</strong><small>Add your own days and exercises</small></span><i aria-hidden="true">›</i></button>`)}`);
actions['plan-from-template'] = el => {
  closeSheet();
  commit(s => {
    const p = programFromTemplate(TEMPLATES.find(t => t.id === el.dataset.tpl));
    s.programs.push(p);
    if (!s.activeProgramId) s.activeProgramId = p.id;
    ui.planEdit = p.id;
  });
};
actions['plan-blank'] = () => {
  closeSheet();
  commit(s => {
    const p = { id: uid(), name: 'My program', days: [{ id: uid(), name: 'Day 1', exercises: [] }] };
    s.programs.push(p);
    if (!s.activeProgramId) s.activeProgramId = p.id;
    ui.planEdit = p.id;
  });
};
actions['open-library'] = () => openExercisePicker({ title: 'Exercise library' });

actions['plan-add-day'] = () => commit(() => {
  const p = prog();
  const d = { id: uid(), name: `Day ${p.days.length + 1}`, exercises: [] };
  p.days.push(d);
  ui.planDay = d.id;
});
actions['plan-del-day'] = el => {
  if (prog().days.length === 1) return;
  if (confirm('Delete this day?')) commit(() => { const p = prog(); p.days = p.days.filter(d => d.id !== el.dataset.day); ui.planDay = null; });
};
const swap = (list, i, dir) => { const j = i + dir; if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]]; };
actions['plan-move-day'] = el => commit(() => { const p = prog(); swap(p.days, p.days.findIndex(d => d.id === el.dataset.day), Number(el.dataset.dir)); });
actions['plan-add-ex'] = el => {
  const dayId = el.dataset.day;
  openExercisePicker({
    title: 'Add to day',
    onPick: def => commit(s => {
      registerExercise(s, def);
      dayOf(dayId)?.exercises.push({ uid: uid(), exId: def.id, sets: 3 });
    }),
  });
};
actions['plan-del-ex'] = el => commit(() => { const d = dayOf(el.dataset.day); d.exercises = d.exercises.filter(e => e.uid !== el.dataset.ex); });
actions['plan-move-ex'] = el => commit(() => { const d = dayOf(el.dataset.day); swap(d.exercises, d.exercises.findIndex(e => e.uid === el.dataset.ex), Number(el.dataset.dir)); });
actions['plan-sets'] = el => commit(() => {
  const e = dayOf(el.dataset.day).exercises.find(x => x.uid === el.dataset.ex);
  e.sets = Math.max(1, Math.min(10, e.sets + Number(el.dataset.d)));
});

document.addEventListener('change', e => {
  const t = e.target;
  const kind = t.dataset?.pn;
  if (!kind || !ui.planEdit) return;
  mutate(() => {
    if (kind === 'prog') prog().name = t.value.trim() || 'My program';
    else if (kind === 'day') dayOf(t.dataset.day).name = t.value.trim() || 'Day';
    else {
      const entry = dayOf(t.dataset.day).exercises.find(x => x.uid === t.dataset.ex);
      const v = num(t.value);
      entry[kind] = v && v > 0 ? Math.round(v) : null;
      if (entry.lo && entry.hi && entry.lo > entry.hi) [entry.lo, entry.hi] = [entry.hi, entry.lo];
    }
  });
});
