import { esc, cap, fmtDate, fmtNum } from '../util.js';
import { actions, openSheet } from '../ui.js';
import { getState } from '../store.js';
import { getExercise } from '../catalog.js';
import { historyFor, topSet } from '../engine.js';
import { lineChart } from '../charts.js';
import { openExerciseInfo } from '../pickers.js';

const setText = x => `${x.w ? fmtNum(x.w) + ' × ' : ''}${x.r}${x.rir != null ? ` @${x.rir}` : ''}`;

export function openExerciseDetail(id) {
  const s = getState();
  const def = getExercise(s, id);
  const hist = historyFor(s.sessions, id);
  const bw = def?.type === 'bodyweight' ? s.settings.bodyWeight : 0;
  const unit = s.settings.unit;
  const name = def?.name || s.sessions.flatMap(x => x.exercises).find(e => e.exId === id)?.name || 'Exercise';
  let body;
  if (!hist.length) {
    body = '<p class="muted">No logged sets yet. Finish a workout with this exercise and its trend, records and history will appear here.</p>';
  } else {
    const points = hist.map(h => ({ x: h.date, y: topSet(h.sets, bw).e - bw }));
    const all = hist.flatMap(h => h.sets);
    const bestE = Math.max(...points.map(p => p.y));
    const heaviest = all.reduce((m, x) => ((x.w || 0) > (m.w || 0) || (x.w === m.w && x.r > m.r) ? x : m), all[0]);
    // best reps achieved at each load
    const byLoad = new Map();
    for (const x of all) byLoad.set(x.w || 0, Math.max(byLoad.get(x.w || 0) || 0, x.r));
    const loads = [...byLoad].sort((a, b) => b[0] - a[0]).slice(0, 5);
    body = `<p class="muted small">Estimated 1RM per session, adjusted for reps left in reserve.</p>
      ${lineChart(points, { unit })}
      <div class="stats3"><div><strong>${Math.round(bestE)}</strong><span>best e1RM (${unit})</span></div>
        <div><strong>${heaviest.w ? fmtNum(heaviest.w) + '×' : ''}${heaviest.r}</strong><span>heaviest set</span></div>
        <div><strong>${hist.length}</strong><span>sessions</span></div></div>
      <h3>Best reps at each load</h3>
      <div>${loads.map(([w, r]) => `<div class="hrow"><span>${w ? fmtNum(w) + ' ' + unit : 'Bodyweight'}</span><strong>${r} rep${r === 1 ? '' : 's'}</strong></div>`).join('')}</div>
      <h3 style="margin-top:16px">Recent sessions</h3>
      <div>${hist.slice(-6).reverse().map(h => `<div class="hrow"><span>${esc(fmtDate(h.date))}</span><span class="muted">${esc(h.sets.map(setText).join(', '))}</span></div>`).join('')}</div>`;
  }
  openSheet(`<div class="sheet-head"><div><h2>${esc(name)}</h2><p class="muted small">${esc(cap(def?.primary) || 'Custom')}${def ? ' · ' + esc(cap(def.equipment)) : ''}</p></div>
      <button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
    ${body}
    ${def ? `<button class="btn block" data-act="ex-info" data-id="${esc(id)}">How to perform it</button>` : ''}`, 'tall');
}

actions['ex-detail'] = el => openExerciseDetail(el.dataset.id);
actions['ex-info'] = el => openExerciseInfo(el.dataset.id);
