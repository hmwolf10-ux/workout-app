import { $, esc, isoDate, addDays, startOfWeek, fmtDate, fmtNum, fmtK, num, sum } from '../util.js';
import { actions, ui, toast } from '../ui.js';
import { getState, commit } from '../store.js';
import { historyFor, topSet, weeklyVolume, sessionStats, e1rm } from '../engine.js';
import { lineChart, barChart } from '../charts.js';
import { volumeRows } from './volume.js';

const bwFor = (s, id) => (s.exercises[id]?.type === 'bodyweight' ? s.settings.bodyWeight : 0);

function trainedExercises(s) {
  const counts = new Map();
  for (const x of s.sessions) for (const e of x.exercises) {
    if (e.sets.some(t => t.done && !t.warmup)) counts.set(e.exId, { name: e.name, n: (counts.get(e.exId)?.n || 0) + 1 });
  }
  return [...counts].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.n - a.n);
}

function streakWeeks(s) {
  const weeks = new Set(s.sessions.map(x => startOfWeek(x.date)));
  let w = startOfWeek(isoDate());
  if (!weeks.has(w)) w = addDays(w, -7); // this week may not have started yet
  let n = 0;
  while (weeks.has(w)) { n++; w = addDays(w, -7); }
  return n;
}

export function renderProgress(s) {
  const unit = s.settings.unit;
  const today = isoDate();
  if (!s.sessions.length) {
    return `<header class="page-head"><div><p class="eyebrow">Trends &amp; records</p></div></header>
      <p class="muted pad">Finish a workout and your strength trends, volume and records will show up here.</p>${bodyWeightCard(s)}`;
  }

  const last30 = s.sessions.filter(x => x.date >= addDays(today, -30));
  const stats = last30.map(sessionStats);
  let html = `<header class="page-head"><div><p class="eyebrow">Trends &amp; records</p></div></header>
    <div class="stats4">
      <div><strong>${last30.length}</strong><span>workouts / 30d</span></div>
      <div><strong>${sum(stats.map(x => x.sets))}</strong><span>sets / 30d</span></div>
      <div><strong>${fmtK(sum(stats.map(x => x.volume)))}</strong><span>${unit} lifted / 30d</span></div>
      <div><strong>${streakWeeks(s)}</strong><span>week streak</span></div>
    </div>`;

  html += heatCard(s, today);

  const ws = addDays(startOfWeek(today), -7 * ui.volWeek);
  html += `<section class="card"><div class="row between"><h3>Weekly volume</h3>
      <div class="seg"><button class="${ui.volWeek === 0 ? 'on' : ''}" data-act="vol-week" data-w="0">This week</button><button class="${ui.volWeek === 1 ? 'on' : ''}" data-act="vol-week" data-w="1">Last week</button></div></div>
    <p class="muted small">Week of ${esc(fmtDate(ws))}${ui.volWeek === 0 ? '. Totals build up as the week goes on.' : ''}</p>${volumeRows(weeklyVolume(s.sessions, ws))}</section>`;

  const list = trainedExercises(s);
  const id = list.some(x => x.id === ui.progressEx) ? ui.progressEx : list[0]?.id;
  if (id) {
    const hist = historyFor(s.sessions, id);
    const bw = bwFor(s, id);
    const points = hist.map(h => ({ x: h.date, y: topSet(h.sets, bw).e - bw }));
    const all = hist.flatMap(h => h.sets);
    const heaviest = all.reduce((m, x) => ((x.w || 0) > (m.w || 0) || (x.w === m.w && x.r > m.r) ? x : m), all[0]);
    const bestE = Math.max(...points.map(p => p.y));
    const bestReps = all.reduce((m, x) => Math.max(m, x.r), 0);
    html += `<section class="card"><div class="row between"><h3>Strength trend</h3>
        <select id="progEx" aria-label="Exercise">${list.map(x => `<option value="${esc(x.id)}" ${x.id === id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <p class="muted small">Estimated 1RM per session, adjusted for reps left in reserve.</p>
      ${lineChart(points, { unit })}
      <div class="stats3"><div><strong>${fmtNum(Math.round(bestE))}</strong><span>best e1RM (${unit})</span></div>
        <div><strong>${heaviest.w ? fmtNum(heaviest.w) + '×' : ''}${heaviest.r}</strong><span>heaviest set</span></div>
        <div><strong>${bestReps}</strong><span>most reps</span></div></div></section>`;
  }

  const weeks = Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(today), -7 * (7 - i)));
  const perWeek = weeks.map(w => {
    const st = s.sessions.filter(x => x.date >= w && x.date <= addDays(w, 6)).map(sessionStats);
    return { label: fmtDate(w, { month: 'numeric', day: 'numeric' }), sets: sum(st.map(x => x.sets)), vol: sum(st.map(x => x.volume)) };
  });
  html += `<section class="card"><h3>Sets per week</h3>${barChart(perWeek.map(w => ({ label: w.label, value: w.sets })))}</section>
    <section class="card"><h3>Training volume (${unit})</h3>${barChart(perWeek.map(w => ({ label: w.label, value: w.vol, text: fmtK(w.vol) })))}</section>`;

  const recent = list.slice(0, 8).map(x => {
    const hist = historyFor(s.sessions, x.id);
    const bw = bwFor(s, x.id);
    const best = hist.map(h => topSet(h.sets, bw)).reduce((m, t) => (t.e > m.e ? t : m));
    return `<button class="rowbtn" data-act="ex-detail" data-id="${esc(x.id)}"><span>${esc(x.name)}</span><span class="muted">${best.set.w ? fmtNum(best.set.w) + ' × ' : ''}${best.set.r} · e1RM ${Math.round(best.e - bw)}</span></button>`;
  }).join('');
  html += `<section class="card"><h3>Records</h3><p class="muted small">Tap an exercise for its full history.</p>${recent}</section>`;
  return html + bodyWeightCard(s);
}

function heatCard(s, today) {
  const start = addDays(startOfWeek(today), -7 * 11);
  const sets = new Map();
  for (const x of s.sessions) if (x.date >= start) sets.set(x.date, (sets.get(x.date) || 0) + sessionStats(x).sets);
  let cells = '';
  for (let i = 0; i < 84; i++) {
    const d = addDays(start, i);
    if (d > today) { cells += '<i style="visibility:hidden"></i>'; continue; }
    const n = sets.get(d) || 0;
    cells += `<i class="${n ? 'l' + (n >= 20 ? 3 : n >= 12 ? 2 : 1) : ''} ${d === today ? 'today' : ''}" title="${esc(fmtDate(d))}: ${n} sets"></i>`;
  }
  const days = [...sets.keys()].length;
  return `<section class="card"><div class="row between"><h3>Consistency</h3><span class="muted small">${days} training day${days === 1 ? '' : 's'} in 12 weeks</span></div>
    <div class="heat" role="img" aria-label="Training days over the last 12 weeks">${cells}</div>
    <p class="muted small">Columns are weeks, top row is Monday. Darker means more sets.</p></section>`;
}

function bodyWeightCard(s) {
  const pts = s.bodyLog.map(b => ({ x: b.date, y: b.w }));
  return `<section class="card"><h3>Body weight</h3>
    <div class="row gap"><input id="bwInput" inputmode="decimal" placeholder="${esc(s.settings.bodyWeight)} ${s.settings.unit}" aria-label="Body weight"><button class="btn" data-act="log-bw">Log today</button></div>
    ${pts.length >= 2 ? lineChart(pts, { height: 130, unit: s.settings.unit }) : '<p class="muted small">Log a few weigh-ins to see the trend. Bodyweight lifts use your latest value to estimate strength.</p>'}</section>`;
}

actions['vol-week'] = el => commit(() => { ui.volWeek = Number(el.dataset.w); });
actions['log-bw'] = () => {
  const v = num($('#bwInput').value);
  if (!v || v < 20 || v > 700) return toast('Enter a valid weight');
  commit(s => {
    const d = isoDate();
    s.bodyLog = s.bodyLog.filter(b => b.date !== d).concat({ date: d, w: v }).sort((a, b) => a.date.localeCompare(b.date));
    s.settings.bodyWeight = v;
  });
  toast('Logged');
};
document.addEventListener('change', e => {
  if (e.target.id === 'progEx') commit(() => { ui.progressEx = e.target.value; });
});
