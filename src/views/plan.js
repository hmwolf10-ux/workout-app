import { esc, cap, uid, num } from '../util.js';
import { actions, ui, openSheet, closeSheet } from '../ui.js';
import { getState, commit, mutate, getProgram, programFromTemplate, registerExercise } from '../store.js';
import { getExercise } from '../catalog.js';
import { TEMPLATES } from '../defaults.js';
import { volumeFromExercises } from '../engine.js';
import { openExercisePicker } from '../pickers.js';
import { volumeRows } from './volume.js';

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
  const days = p.days.map((d, di) => {
    const rows = d.exercises.map((e, ei) => {
      const ex = getExercise(s, e.exId);
      if (ex) entries.push({ primary: ex.primary, secondary: ex.secondary, sets: e.sets });
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
    <p class="muted small">Rep boxes are optional: leave blank to use each exercise's default range (and the goal's range in Strength / Peaking).</p>
    ${days}
    <button class="btn block" data-act="plan-add-day">＋ Add day</button>
    <section class="card"><h3>Weekly volume if each day is trained once</h3>${volumeRows(volumeFromExercises(entries))}</section>`;
}

const prog = () => getProgram(getState(), ui.planEdit);
const dayOf = id => prog().days.find(d => d.id === id);

actions['plan-edit'] = el => commit(() => { ui.planEdit = el.dataset.prog; });
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
  <div class="stack">${TEMPLATES.map(t => `<button class="tpl" data-act="plan-from-template" data-tpl="${t.id}"><strong>${esc(t.name)}</strong><span>${esc(t.blurb)}</span></button>`).join('')}
  <button class="tpl" data-act="plan-blank"><strong>Blank program</strong><span>Start empty and add your own days and exercises.</span></button></div>`);
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

actions['plan-add-day'] = () => commit(() => { const p = prog(); p.days.push({ id: uid(), name: `Day ${p.days.length + 1}`, exercises: [] }); });
actions['plan-del-day'] = el => {
  if (prog().days.length === 1) return;
  if (confirm('Delete this day?')) commit(() => { const p = prog(); p.days = p.days.filter(d => d.id !== el.dataset.day); });
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
