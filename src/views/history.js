import { esc, fmtDate, fmtDur, fmtK, num } from '../util.js';
import { actions, ui, openSheet, closeSheet, toast } from '../ui.js';
import { getState, commit, mutate } from '../store.js';
import { sessionStats } from '../engine.js';
import { startFromSession } from '../session.js';

export function renderHistory(s) {
  const list = [...s.sessions].reverse();
  let html = `<header class="page-head"><div><p class="eyebrow">${list.length} workout${list.length === 1 ? '' : 's'}</p></div></header>`;
  if (!list.length) return html + '<p class="muted pad">Completed workouts show up here. Tap one to edit or repeat it.</p>';
  let month = '';
  for (const x of list) {
    const m = fmtDate(x.date, { month: 'long', year: 'numeric' });
    if (m !== month) { html += `<h3 class="month">${esc(m)}</h3>`; month = m; }
    const st = sessionStats(x);
    const prs = x.exercises.reduce((n, e) => n + e.sets.filter(t => t.pr).length, 0);
    html += `<button class="card hcard" data-act="open-session" data-id="${x.id}">
      <div class="row between"><strong>${esc(x.name)}</strong><span class="muted">${esc(fmtDate(x.date))}</span></div>
      <div class="chips"><span class="chip">${st.sets} sets</span><span class="chip">${fmtK(st.volume)} ${s.settings.unit}</span>${st.duration ? `<span class="chip">${fmtDur(st.duration)}</span>` : ''}${prs ? `<span class="chip">${prs} PR${prs === 1 ? "" : "s"}</span>` : ''}</div>
      <p class="muted small">${esc(x.exercises.map(e => e.name).join(' · '))}</p></button>`;
  }
  return html;
}

function openSession(id) {
  const s = getState();
  const x = s.sessions.find(t => t.id === id);
  if (!x) return closeSheet();
  const st = sessionStats(x);
  const exs = x.exercises.map(e => {
    const rows = e.sets.map((t, i) => `<div class="hset ${t.warmup ? 'warm' : ''}" data-s="${x.id}" data-e="${e.uid}" data-i="${i}">
      <span class="idx">${t.warmup ? 'W' : i + 1}</span>
      <input data-h="w" inputmode="decimal" value="${esc(t.w ?? '')}" aria-label="Weight">
      <input data-h="r" inputmode="numeric" value="${esc(t.r ?? '')}" aria-label="Reps">
      <input data-h="rir" inputmode="numeric" value="${esc(t.rir ?? '')}" placeholder="RIR" aria-label="Reps in reserve">
      <button class="icon-btn" data-act="hist-del-set" aria-label="Delete set">✕</button></div>`).join('');
    return `<h3>${esc(e.name)}</h3>${rows}${e.note ? `<p class="muted small">${esc(e.note)}</p>` : ''}`;
  }).join('');
  openSheet(`<div class="sheet-head"><div><h2>${esc(x.name)}</h2><p class="muted small">${esc(fmtDate(x.date))} · ${st.sets} sets · ${fmtK(st.volume)} ${s.settings.unit}${st.duration ? ' · ' + fmtDur(st.duration) : ''}</p></div>
      <button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
    ${exs}
    <div class="row gap"><button class="btn primary" data-act="hist-repeat" data-id="${x.id}" ${s.active ? 'disabled' : ''}>Repeat workout</button>
    <button class="btn danger" data-act="hist-delete" data-id="${x.id}">Delete</button></div>`, 'tall');
}

actions['open-session'] = el => openSession(el.dataset.id);
actions['hist-repeat'] = el => { closeSheet(); ui.tab = 'workout'; startFromSession(el.dataset.id); };
actions['hist-delete'] = el => {
  if (!confirm('Delete this workout permanently?')) return;
  closeSheet();
  commit(s => { s.sessions = s.sessions.filter(x => x.id !== el.dataset.id); });
  toast('Workout deleted');
};
actions['hist-del-set'] = el => {
  const row = el.closest('.hset');
  commit(s => {
    const x = s.sessions.find(t => t.id === row.dataset.s);
    const e = x?.exercises.find(t => t.uid === row.dataset.e);
    if (!e) return;
    e.sets.splice(Number(row.dataset.i), 1);
    if (!e.sets.some(t => !t.warmup)) x.exercises = x.exercises.filter(t => t !== e);
    if (!x.exercises.length) s.sessions = s.sessions.filter(t => t !== x);
  });
  openSession(row.dataset.s);
};
document.addEventListener('change', e => {
  const f = e.target.dataset?.h;
  const row = e.target.closest?.('.hset');
  if (!f || !row) return;
  mutate(s => {
    const set = s.sessions.find(t => t.id === row.dataset.s)?.exercises.find(t => t.uid === row.dataset.e)?.sets[Number(row.dataset.i)];
    if (!set) return;
    const v = num(e.target.value);
    if (f === 'r' && !v) { e.target.value = set.r; return; }
    set[f] = f === 'w' ? v ?? 0 : v;
  });
});
