import { $, esc, num, isoDate, startOfWeek } from '../util.js';
import { actions, toast } from '../ui.js';
import { getState, commit, mutate, exportJSON, importJSON, resetAll } from '../store.js';
import { DEFAULT_INCREMENTS, GOALS, INC_CLASSES } from '../defaults.js';
import { planFor } from '../engine.js';

const opt = (list, cur) => Object.entries(list).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
const toggle = (key, on, label, help = '') => `<label class="srow"><span>${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}</span><input type="checkbox" data-st="${key}" ${on ? 'checked' : ''}></label>`;
const row = (label, control, help = '') => `<label class="srow"><span>${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}</span>${control}</label>`;

export function renderSettings(s) {
  const st = s.settings;
  const plan = planFor(st, isoDate());
  const peaking = st.goal === 'peaking';
  const goalHelp = {
    hypertrophy: 'Uses each exercise’s rep range at about 2 reps in reserve. Turn on weekly blocks to ramp effort and add deloads.',
    strength: 'Main barbell lifts move to 3–6 reps with longer rests. Accessories keep hypertrophy ranges.',
    peaking: 'Counts down to your event: accumulation, intensification, realization, then a taper.',
  }[st.goal];
  return `<div class="glabel">Training</div>
    <div class="group">
      ${row('Goal', `<select data-st="goal" aria-label="Training goal">${opt(GOALS, st.goal)}</select>`)}
      ${peaking ? row('Event date', `<input type="date" data-st="peakDate" value="${esc(st.peakDate || '')}" aria-label="Event date">`) : ''}
      <p class="gnote">${esc(goalHelp)}${plan.label ? ` Right now: <strong>${esc(plan.label)}</strong>, target ${plan.rir} RIR.` : ` Target: about ${plan.rir} reps in reserve.`}</p>
      ${peaking ? '' : `${toggle('useBlocks', st.useBlocks, 'Weekly training blocks', 'Ramps effort across weeks and adds a deload. Off keeps every week the same.')}
      ${st.useBlocks ? row('Weeks before deload', `<input type="number" inputmode="numeric" min="2" max="8" data-st="mesoLength" value="${st.mesoLength}" aria-label="Build weeks before deload">`) : ''}
      ${st.useBlocks ? `${toggle('deload', st.deload, 'Deload week', 'Half the sets at easy effort after each block.')}
      ${st.goal === 'hypertrophy' ? toggle('rampVolume', st.rampVolume, 'Add sets through the block', 'Up to +2 sets per exercise.') : ''}
      <button class="srow" data-act="restart-block"><span>Restart block this week</span></button>` : ''}`}
    </div>

    <div class="glabel">Workout</div>
    <div class="group">
      ${row('Units', `<select data-st="unit" aria-label="Units"><option value="lb" ${st.unit === 'lb' ? 'selected' : ''}>Pounds (lb)</option><option value="kg" ${st.unit === 'kg' ? 'selected' : ''}>Kilograms (kg)</option></select>`)}
      ${row('Body weight', `<input type="number" inputmode="decimal" step="0.1" data-st="bodyWeight" value="${st.bodyWeight}" aria-label="Body weight ${st.unit}">`, `For bodyweight lifts, in ${st.unit}`)}
      ${toggle('showWarmups', st.showWarmups, 'Warm-up sets', 'Suggested for compound lifts.')}
      ${toggle('restAlert', st.restAlert, 'Rest timer alert', 'Sound and vibration when rest ends.')}
      <details><summary class="srow"><span>Load increments<small>Smallest jump per equipment type</small></span></summary>
        <div class="incs">${Object.entries(INC_CLASSES).map(([k, label]) => row(label, `<input type="number" inputmode="decimal" step="0.25" min="0.25" data-inc="${k}" value="${st.increments[k]}" aria-label="${esc(label)} step">`)).join('')}</div>
      </details>
    </div>

    <div class="glabel">Your data</div>
    <div class="group">
      <p class="gnote" style="border-top:0">Everything is stored on this device only. Export a backup now and then; browsers can clear site data.</p>
      <button class="srow" data-act="export"><span>Export backup</span></button>
      <button class="srow" data-act="import"><span>Import backup</span></button>
      <input id="importFile" type="file" accept=".json,application/json" hidden>
      <button class="srow danger" data-act="reset-all"><span>Erase all data</span></button>
    </div>

    <div class="glabel">Appearance</div>
    <div class="group">
      <div class="srow"><span>Theme</span><div class="seg">${[['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<button class="${currentTheme() === v ? 'on' : ''}" data-act="theme" data-v="${v}" aria-pressed="${currentTheme() === v}">${l}</button>`).join('')}</div></div>
    </div>

    <div class="glabel">About</div>
    <div class="group">
      <details><summary class="srow"><span>Training basics this app is built on</span></summary>
        <ul class="muted small" style="margin:0;padding:10px 16px 10px 32px">
          <li><strong>Volume:</strong> roughly 10–20 hard sets per muscle per week works for most people.</li>
          <li><strong>Effort:</strong> ending sets with 0–3 reps in reserve builds muscle about as well as failure, with less fatigue.</li>
          <li><strong>Frequency:</strong> about twice a week per muscle mainly helps you spread volume.</li>
          <li><strong>Rest:</strong> 2–3 minutes for heavy compounds, about a minute for isolation.</li>
          <li><strong>Progression:</strong> add reps, then load, in small steady steps.</li>
          <li><strong>Stretch:</strong> exercises that load a long muscle (incline curls, overhead extensions, Romanian deadlifts) look especially good.</li>
          <li><strong>Outside the gym:</strong> protein around 1.6–2.2 g per kg, 7–9 hours of sleep, deload when progress stalls.</li>
        </ul>
        <p class="gnote" style="border-top:0">General guidance from the exercise-science literature, not medical advice.</p>
      </details>
      <p class="gnote">Workout Tracker · works offline once loaded</p>
    </div>`;
}

const currentTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
actions['theme'] = el => {
  const v = el.dataset.v;
  try { localStorage.setItem('wk.theme', v); } catch { /* storage blocked */ }
  document.documentElement.dataset.theme = v;
  document.querySelector('meta[name=theme-color]').content = v === 'dark' ? '#0e131b' : '#f3f5f9';
  document.querySelectorAll('[data-act=theme]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.v === v)); b.classList.toggle('on', b.dataset.v === v); });
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
