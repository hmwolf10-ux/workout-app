import { esc, uid, isoDate, fmtDate, startOfWeek, addDays, fmtNum } from '../util.js';
import { actions, ui } from '../ui.js';
import { getState, commit, activeProgram, programFromTemplate } from '../store.js';
import { getExercise } from '../catalog.js';
import { TEMPLATES } from '../defaults.js';
import { nextDayIndex, stalledExercises } from '../engine.js';
import { buildEntry, currentPlan, startWorkout, startQuick, setReadiness } from '../session.js';

const rxText = (rx, unit) => (rx.w == null ? `find ${rx.lo}–${rx.hi} rep load` : `${rx.w > 0 ? fmtNum(rx.w) + ' ' + unit + ' × ' : ''}${rx.r}`);

function onboarding() {
  return `<section class="card">
    <h2>Pick a starting program</h2>
    <p class="muted">You can change every exercise, set and rep range later, or build your own from scratch.</p>
    <div class="stack">${TEMPLATES.map(t => `
      <button class="tpl" data-act="pick-template" data-tpl="${t.id}"><strong>${esc(t.name)}</strong><span>${esc(t.blurb)}</span></button>`).join('')}
    </div>
    <div class="row gap"><button class="btn" data-act="blank-program">Build my own</button><button class="btn" data-act="start-quick">Just start a workout</button></div>
  </section>`;
}

function weekStrip(s, today) {
  const start = startOfWeek(today);
  const trained = new Set(s.sessions.map(x => x.date));
  const cells = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const label = fmtDate(d, { weekday: 'short' }).slice(0, 3);
    return `<div class="wd ${d === today ? 'today' : ''} ${trained.has(d) ? 'done' : ''}" aria-label="${esc(fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric' }))}${trained.has(d) ? ', trained' : ''}">
      <span>${esc(label)}</span><b>${Number(d.slice(8))}</b><i></i></div>`;
  }).join('');
  return `<div class="week" role="group" aria-label="This week">${cells}</div>`;
}

export function renderToday(s) {
  const plan = currentPlan(s);
  const prog = activeProgram(s);
  const unit = s.settings.unit;
  const today = isoDate();
  let html = `<header class="page-head"><div><p class="eyebrow">${esc(fmtDate(today, { weekday: 'long', month: 'long', day: 'numeric' }))}</p></div></header>${weekStrip(s, today)}`;

  if (s.active) {
    const all = s.active.exercises.flatMap(e => e.sets.filter(x => !x.warmup));
    html += `<section class="card accent"><p class="eyebrow">In progress</p><h2>${esc(s.active.name)}</h2>
      <p class="muted">${all.filter(x => x.done).length} of ${all.length} sets logged</p>
      <button class="btn primary block" data-act="resume">Resume workout</button></section>`;
  }

  html += `<section class="card phase ${plan.isDeload ? 'deload' : ''}">
    <div class="row between"><span class="pill">${esc(plan.phase)}</span><strong>${esc(plan.label)}</strong></div>
    <p class="muted">${esc(plan.note)}</p>
    <div class="chips"><span class="chip">${plan.rir} RIR</span>${plan.isDeload ? "<span class=\"chip\">Half volume</span>" : plan.ramp ? `<span class="chip">+${plan.ramp} set${plan.ramp > 1 ? "s" : ""} per exercise</span>` : ""}</div>
  </section>`;

  if (!prog) return html + onboarding();

  if (!plan.isDeload && !s.active) {
    const low = plan.easy;
    html += `<section class="card slim"><div class="row between"><h3>Feeling today</h3>
      <div class="seg"><button class="${low ? "" : "on"}" data-act="readiness" data-v="ok">Good</button><button class="${low ? "on" : ""}" data-act="readiness" data-v="low">Run down</button></div></div></section>`;
  }

  if (plan.goal !== 'peaking' && !plan.isDeload) {
    const stalled = stalledExercises(s.sessions, today, id => (s.exercises[id]?.type === 'bodyweight' ? s.settings.bodyWeight : 0));
    if (stalled.length >= 2) {
      html += `<section class="card warn"><strong>Progress has flattened</strong>
        <p class="muted">No estimated-1RM gain over your last three sessions on ${esc(stalled.slice(0, 3).join(', '))}${stalled.length > 3 ? ` and ${stalled.length - 3} more` : ''}.
        Check sleep and food first; if it persists, a deload week can help.</p>
        <button class="btn" data-act="deload-now">Start a deload week now</button></section>`;
    }
  }

  const idx = nextDayIndex(prog, s.sessions);
  const day = prog.days[idx];
  if (day) {
    const rows = day.exercises.map(e => {
      const ex = getExercise(s, e.exId);
      if (!ex) return '';
      const en = buildEntry(s, ex, e, plan);
      const n = en.sets.filter(x => !x.warmup).length;
      return `<li><span>${esc(ex.name)}</span><span class="muted">${n} × ${esc(rxText(en.rx, unit))}</span></li>`;
    }).join('');
    html += `<section class="card"><p class="eyebrow">Up next · ${esc(prog.name)}</p><h2>${esc(day.name)}</h2>
      <ul class="plain">${rows || '<li class="muted">No exercises yet. Add some in Plan.</li>'}</ul>
      <button class="btn primary block" data-act="start-day" data-prog="${prog.id}" data-day="${day.id}" ${s.active ? 'disabled' : ''}>Start ${esc(day.name)}</button></section>`;
    const others = prog.days.filter((_, i) => i !== idx);
    if (others.length) {
      html += `<section class="card"><h3>Or train a different day</h3><div class="chips">${others.map(d =>
        `<button class="chip btn-chip" data-act="start-day" data-prog="${prog.id}" data-day="${d.id}" ${s.active ? 'disabled' : ''}>${esc(d.name)}</button>`).join('')}</div></section>`;
    }
  }
  html += `<button class="btn block" data-act="start-quick" ${s.active ? 'disabled' : ''}>＋ Quick workout (build as you go)</button>`;

  const week = s.sessions.filter(x => x.date >= startOfWeek(today)).length;
  html += `<p class="muted center">${week} workout${week === 1 ? '' : 's'} this week · ${s.sessions.length} total</p>`;
  return html;
}

const begin = () => { ui.tab = 'workout'; };
actions['resume'] = () => commit(() => begin());
actions['start-day'] = el => { begin(); startWorkout(el.dataset.prog, el.dataset.day); };
actions['start-quick'] = () => { begin(); startQuick(); };
actions['pick-template'] = el => commit(s => {
  const p = programFromTemplate(TEMPLATES.find(t => t.id === el.dataset.tpl));
  s.programs.push(p);
  s.activeProgramId = p.id;
});
actions['blank-program'] = () => commit(s => {
  const p = { id: uid(), name: 'My program', days: [{ id: uid(), name: 'Day 1', exercises: [] }] };
  s.programs.push(p);
  s.activeProgramId = p.id;
  ui.tab = 'plan';
  ui.planEdit = p.id;
});
actions['deload-now'] = () => commit(s => {
  const st = s.settings;
  // shift the block start so the current week lands on the deload slot
  const L = Math.max(2, Math.floor(st.mesoLength) || 4);
  const d = new Date(startOfWeek(isoDate()) + 'T00:00:00');
  d.setDate(d.getDate() - L * 7);
  st.deload = true;
  st.mesoStart = isoDate(d);
});
actions['readiness'] = el => setReadiness(el.dataset.v);
