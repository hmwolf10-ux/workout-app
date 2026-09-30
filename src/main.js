import { $, fmtDur } from './util.js';
import { ui, actions, closeSheet, sheetOpen, toast } from './ui.js';
import { initStore, getState, subscribe, mutate, storageError } from './store.js';
import { loadCatalog } from './catalog.js';
import { skipRest, extendRest } from './session.js';
import './pickers.js';
import { renderToday } from './views/today.js';
import { renderWorkout } from './views/workout.js';
import { renderPlan } from './views/plan.js';
import { renderProgress } from './views/progress.js';
import { renderHistory } from './views/history.js';
import { renderSettings } from './views/settings.js';
import './views/exercise.js';

const TABS = [
  ['today', 'Today', 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  ['plan', 'Plan', 'M4 5h16M4 12h16M4 19h10'],
  ['progress', 'Progress', 'M4 20V10m6 10V4m6 16v-7m4 7H2'],
  ['history', 'History', 'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5'],
  ['settings', 'Settings', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7-3l2-1-2-4-2 .5a7 7 0 0 0-1.5-1L15 4H9l-.5 2.5A7 7 0 0 0 7 7.5L5 7l-2 4 2 1a7 7 0 0 0 0 2l-2 1 2 4 2-.5a7 7 0 0 0 1.5 1L9 20h6l.5-2.5a7 7 0 0 0 1.5-1l2 .5 2-4-2-1a7 7 0 0 0 0-2z'],
];
const VIEWS = { today: renderToday, workout: renderWorkout, plan: renderPlan, progress: renderProgress, history: renderHistory, settings: renderSettings };

let lastTab = null;
const savedScroll = {};

function render() {
  const s = getState();
  if (ui.tab === 'workout' && !s.active) ui.tab = 'today';
  const switched = lastTab !== null && ui.tab !== lastTab;
  if (switched) {
    if (lastTab === 'workout') savedScroll.workout = window.scrollY;
    document.activeElement?.blur?.();
  }
  lastTab = ui.tab;
  document.body.dataset.tab = ui.tab;
  $('#view').innerHTML = VIEWS[ui.tab](s);
  if (switched) window.scrollTo(0, ui.tab === 'workout' ? savedScroll.workout || 0 : 0);
  $('#barin').innerHTML = `<h1>${TABS.find(t => t[0] === ui.tab)?.[1] ?? 'Workout'}</h1>`;
  $('#nav').innerHTML = TABS.map(([id, label, d]) => `<button data-act="nav" data-tab="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg><span>${label}</span></button>`).join('');
  const bar = $('#resumeBar');
  bar.hidden = !(s.active && ui.tab !== 'workout' && ui.tab !== 'today');
  document.body.classList.toggle('has-resume', !bar.hidden);
  if (!bar.hidden) bar.textContent = `Workout in progress · ${s.active.name} · tap to resume`;
  if (storageError) toast('Could not save. Storage may be full or blocked; export a backup.', 6000);
  syncWakeLock();
  tick();
}

/* ---------- rest timer, elapsed clock ---------- */
let audio = null;
function alertRestOver() {
  if (!getState().settings.restAlert) return;
  navigator.vibrate?.([200, 100, 200]);
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.value = 0.15;
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.25);
  } catch { /* audio unavailable */ }
}

function tick() {
  const a = getState().active;
  const el = $('#elapsed');
  if (el && a) el.textContent = a.startedAt ? fmtDur((Date.now() - a.startedAt) / 1000) : '0:00';
  const rest = $('#rest');
  if (!a?.restEnd || ui.tab !== 'workout') { rest.hidden = true; return; }
  const ms = a.restEnd - Date.now();
  if (ms > 0) {
    rest.hidden = false;
    $('#restTime').textContent = fmtDur(Math.ceil(ms / 1000));
  } else {
    rest.hidden = true;
    mutate(s => { if (s.active) s.active.restEnd = null; });
    if (ms > -5000) alertRestOver();
  }
}

let wakeLock = null;
async function syncWakeLock() {
  try {
    if (ui.tab === 'workout' && !wakeLock && 'wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (ui.tab !== 'workout' && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* not allowed or unsupported */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncWakeLock(); });

/* ---------- events ---------- */
actions['nav'] = el => {
  ui.tab = el.dataset.tab;
  if (ui.tab !== 'plan') ui.planEdit = null;
  render();
};
actions['rest-add'] = () => { extendRest(30); tick(); };
actions['rest-skip'] = () => { skipRest(); tick(); };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetOpen()) closeSheet(); });

/* ---------- boot ---------- */
const state = initStore();
// reopen straight into a workout that is still fresh; an abandoned one waits behind the resume card
if (state.active && Date.now() - (state.active.lastSetAt || state.active.startedAt || state.active.created || 0) < 12 * 3600e3) ui.tab = 'workout';
subscribe(render);
render();
if (state.meta?.migrated) {
  const n = state.sessions.length;
  toast(`Brought over ${n} workout${n === 1 ? '' : 's'} from the previous version.`, 4500);
  mutate(s => { delete s.meta; });
}
loadCatalog();
setInterval(tick, 500);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// hide the fixed bars while a field is focused so the on-screen keyboard can't push them over the form
const typingField = t => t?.matches?.('input:not([type=checkbox]):not([type=file]), textarea, select');
let typingTimer = null;
document.addEventListener('focusin', e => {
  if (!typingField(e.target)) return;
  clearTimeout(typingTimer);
  document.body.classList.add('typing');
});
document.addEventListener('focusout', () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { if (!typingField(document.activeElement)) document.body.classList.remove('typing'); }, 150);
});
