import { $, esc, num, isoDate, startOfWeek } from '../util.js';
import { actions, toast } from '../ui.js';
import { getState, commit, mutate, exportJSON, importJSON, resetAll } from '../store.js';
import { DEFAULT_INCREMENTS, GOALS, INC_CLASSES } from '../defaults.js';
import { planFor } from '../engine.js';

const opt = (list, cur) => Object.entries(list).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
const check = (key, on, label, help = '') => `<label class="check-row"><input type="checkbox" data-st="${key}" ${on ? 'checked' : ''}><span>${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}</span></label>`;

export function renderSettings(s) {
  const st = s.settings;
  const plan = planFor(st, isoDate());
  const peaking = st.goal === 'peaking';
  return `<header class="page-head"><div><p class="eyebrow">Training model &amp; data</p></div></header>
    <section class="card"><h3>Appearance</h3>
      <p class="muted small">Choose how the app looks on this device.</p>
      <div class="chips">${[['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button class="chip" data-act="theme" data-v="${v}" aria-pressed="${currentTheme() === v}">${l}</button>`).join('')}</div>
    </section>
    <section class="card"><h3>Goal</h3>
      <label class="field">Training goal<select data-st="goal">${opt(GOALS, st.goal)}</select></label>
      <p class="muted small">${{
        hypertrophy: 'Uses each exercise’s rep range, ramps effort from 3 to 1 RIR across the block, adds sets over time and ends with a deload.',
        strength: 'Main barbell lifts move to 3–6 reps with longer rests; accessories keep hypertrophy ranges.',
        peaking: 'Counts down to your event: accumulation, intensification, realization, then a taper. Main lifts drop to low reps.',
      }[st.goal]}</p>
      ${peaking ? `<label class="field">Event date<input type="date" data-st="peakDate" value="${esc(st.peakDate || '')}"></label>` : ''}
      <p class="muted small">Right now: <strong>${esc(plan.label)}</strong> · target ${plan.rir} RIR</p>
    </section>
    ${peaking ? '' : `<section class="card"><h3>Training block</h3>
      <label class="field">Build weeks before deload<input type="number" min="2" max="8" data-st="mesoLength" value="${st.mesoLength}"></label>
      ${check('deload', st.deload, 'Deload week after each block', 'Half the sets at easy effort.')}
      ${st.goal === 'hypertrophy' ? check('rampVolume', st.rampVolume, 'Add sets as the block progresses', 'Up to +2 sets per exercise.') : ''}
      <button class="btn" data-act="restart-block">Restart block this week</button>
    </section>`}
    <section class="card"><h3>Units &amp; loading</h3>
      <label class="field">Units<select data-st="unit"><option value="lb" ${st.unit === 'lb' ? 'selected' : ''}>Pounds (lb)</option><option value="kg" ${st.unit === 'kg' ? 'selected' : ''}>Kilograms (kg)</option></select></label>
      <label class="field">Body weight (${st.unit})<input type="number" step="0.1" data-st="bodyWeight" value="${st.bodyWeight}"></label>
      <p class="muted small">Smallest jump you can make for each kind of equipment. Load targets are rounded to these.</p>
      <div class="two">${Object.entries(INC_CLASSES).map(([k, label]) => `<label class="field">${esc(label)}<input type="number" step="0.25" min="0.25" data-inc="${k}" value="${st.increments[k]}"></label>`).join('')}</div>
      ${check('showWarmups', st.showWarmups, 'Suggest warm-up sets', 'For compound lifts at working weights.')}
      ${check('restAlert', st.restAlert, 'Sound and vibrate when rest ends')}
    </section>
    <section class="card"><h3>Your data</h3>
      <p class="muted small">Everything is stored on this device only. Export a backup now and then — browsers can clear site data.</p>
      <div class="row gap"><button class="btn primary" data-act="export">Export backup</button><button class="btn" data-act="import">Import backup</button></div>
      <input id="importFile" type="file" accept=".json,application/json" hidden>
      <button class="btn danger block" data-act="reset-all">Erase all data</button>
    </section>
    <p class="muted small center">Workout Tracker · v4 · works offline once loaded</p>`;
}

const currentTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
actions['theme'] = el => {
  const v = el.dataset.v;
  try { localStorage.setItem('wk.theme', v); } catch { /* storage blocked */ }
  document.documentElement.dataset.theme = v;
  document.querySelector('meta[name=theme-color]').content = v === 'dark' ? '#0e131b' : '#f3f5f9';
  document.querySelectorAll('[data-act=theme]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
};

const LB_PER_KG = 2.20462;
function convertWeights(s, factor) {
  const conv = v => (v ? Math.round(v * factor * 10) / 10 : v);
  const sets = [...s.sessions, ...(s.active ? [s.active] : [])].flatMap(x => x.exercises.flatMap(e => e.sets));
  sets.forEach(set => { set.w = conv(set.w); });
  s.active?.exercises.forEach(e => { e.inc = conv(e.inc); if (e.rx?.w) { e.rx.w = conv(e.rx.w); } if (e.hint?.w) e.hint.w = conv(e.hint.w); });
  s.bodyLog.forEach(b => { b.w = conv(b.w); });
  s.settings.bodyWeight = conv(s.settings.bodyWeight);
}

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset?.inc) return mutate(s => { s.settings.increments[t.dataset.inc] = Math.max(0.25, num(t.value) || DEFAULT_INCREMENTS[s.settings.unit][t.dataset.inc]); });
  const key = t.dataset?.st;
  if (!key) return;
  if (key === 'bodyWeight') return mutate(s => { s.settings.bodyWeight = num(t.value) || s.settings.bodyWeight; });
  if (key === 'mesoLength') return mutate(s => { s.settings.mesoLength = Math.min(8, Math.max(2, Math.round(num(t.value) || 4))); });
  commit(s => {
    if (t.type === 'checkbox') s.settings[key] = t.checked;
    else if (key === 'unit') {
      if (t.value === s.settings.unit) return;
      const convert = confirm(`Convert your existing weights to ${t.value} too?\n\nOK = convert history, body weight and any workout in progress.\nCancel = just change the label.`);
      if (convert) convertWeights(s, t.value === 'kg' ? 1 / LB_PER_KG : LB_PER_KG);
      s.settings.unit = t.value;
      s.settings.increments = { ...DEFAULT_INCREMENTS[t.value] };
      toast(convert ? 'Converted to ' + t.value : 'Unit label changed. Numbers left as they were.', 3500);
    } else s.settings[key] = t.value || null;
  });
});

actions['restart-block'] = () => { commit(s => { s.settings.mesoStart = startOfWeek(isoDate()); }); toast('Block restarted at week 1'); };
actions['export'] = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([exportJSON()], { type: 'application/json' }));
  a.download = `workout-backup-${isoDate()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
actions['import'] = () => $('#importFile').click();
document.addEventListener('change', async e => {
  if (e.target.id !== 'importFile' || !e.target.files[0]) return;
  try {
    const text = await e.target.files[0].text();
    if (!confirm('Importing replaces data of the same kind on this device. Continue?')) return;
    toast(importJSON(text), 3500);
  } catch (err) { toast('Import failed: ' + err.message, 4000); }
});
actions['reset-all'] = () => {
  if (getState().sessions.length && !confirm('Erase every workout, program and setting on this device? Export a backup first.')) return;
  if (!confirm('This cannot be undone. Erase everything?')) return;
  resetAll();
};
