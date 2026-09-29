// Exercise search / browse / create sheets, shared by workouts and the plan editor.
import { $, esc, uid, num, cap } from './util.js';
import { actions, openSheet, closeSheet, toast } from './ui.js';
import { getState, commit, registerExercise } from './store.js';
import { getExercise, searchExercises, catalogReady } from './catalog.js';
import { MUSCLES, EQUIPMENT, INC_CLASSES, defaultIncClass, groupOf } from './defaults.js';

let ctx = { onPick: null, title: '' };

export function openExercisePicker({ title = 'Exercises', onPick = null } = {}) {
  ctx = { onPick, title };
  openSheet(`
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
    <div class="filters">
      <input id="pickQ" type="search" placeholder="Search ${catalogReady() ? '800+' : ''} exercises" autocomplete="off">
      <select id="pickMuscle"><option value="">All muscles</option>${MUSCLES.map(m => `<option value="${m}">${cap(m)}</option>`).join('')}</select>
      <select id="pickEquip"><option value="">Any equipment</option>${EQUIPMENT.map(m => `<option value="${m}">${cap(m)}</option>`).join('')}</select>
    </div>
    <div id="pickResults" class="results"></div>
    <button class="btn block" data-act="new-custom">＋ Create custom exercise</button>`, 'tall');
  renderResults();
  $('#pickQ')?.focus();
}

function renderResults() {
  const box = $('#pickResults');
  if (!box) return;
  const list = searchExercises(getState(), { q: $('#pickQ').value, muscle: $('#pickMuscle').value, equipment: $('#pickEquip').value });
  box.innerHTML = list.length
    ? list.map(e => `<button class="result" data-act="pick-ex" data-id="${esc(e.id)}"><strong>${esc(e.name)}</strong><span>${esc(cap(e.primary))} · ${esc(cap(e.equipment))}${e.custom ? ' · custom' : ''}</span></button>`).join('')
    : '<p class="muted pad">No matches. Create a custom exercise below.</p>';
}

document.addEventListener('input', e => { if (e.target.id === 'pickQ') renderResults(); });
document.addEventListener('change', e => { if (e.target.id === 'pickMuscle' || e.target.id === 'pickEquip') renderResults(); });

actions['pick-ex'] = el => {
  const def = getExercise(getState(), el.dataset.id);
  if (!def) return;
  if (ctx.onPick) { closeSheet(); ctx.onPick(def); } else openExerciseInfo(def.id);
};

export function openExerciseInfo(id) {
  const def = getExercise(getState(), id);
  if (!def) return;
  openSheet(`
    <div class="sheet-head"><h2>${esc(def.name)}</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
    <p class="muted">${esc(cap(def.primary) || 'Unassigned')}${def.secondary?.length ? ' · also ' + esc(def.secondary.join(', ')) : ''} · ${esc(cap(def.equipment))} · ${def.compound ? 'compound' : 'isolation'}</p>
    <p>Default ${def.repMin}–${def.repMax} reps · ${def.rest}s rest${groupOf(def.primary) ? '' : ' · <em>no muscle group, so it is left out of volume tracking</em>'}</p>
    ${def.instructions?.length ? `<ol class="steps">${def.instructions.map(i => `<li>${esc(i)}</li>`).join('')}</ol>` : ''}
    <div class="row gap">
      ${def.custom ? `<button class="btn" data-act="edit-custom" data-id="${esc(def.id)}">Edit</button>` : ''}
      ${def.custom ? `<button class="btn danger" data-act="delete-custom" data-id="${esc(def.id)}">Delete</button>` : ''}
    </div>`, 'tall');
}

function customForm(def) {
  const d = def || { name: '', primary: 'chest', equipment: 'dumbbell', mechanic: 'compound', repMin: 8, repMax: 12, rest: 90, incClass: '' };
  const opt = (list, cur) => list.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(cap(v))}</option>`).join('');
  openSheet(`
    <div class="sheet-head"><h2>${def ? 'Edit' : 'New'} exercise</h2><button class="icon-btn" data-act="close-sheet" aria-label="Close">✕</button></div>
    <form id="customForm" class="form" data-id="${esc(def?.id || '')}">
      <label>Name<input name="name" required maxlength="60" value="${esc(d.name)}"></label>
      <label>Primary muscle<select name="primary">${opt(MUSCLES, d.primary)}</select></label>
      <label>Equipment<select name="equipment">${opt(EQUIPMENT, d.equipment)}</select></label>
      <label>Type<select name="mechanic">${opt(['compound', 'isolation'], d.mechanic)}</select></label>
      <div class="two">
        <label>Rep min<input name="repMin" type="number" min="1" max="50" value="${d.repMin}"></label>
        <label>Rep max<input name="repMax" type="number" min="1" max="50" value="${d.repMax}"></label>
      </div>
      <label>Rest (seconds)<input name="rest" type="number" min="15" max="600" step="15" value="${d.rest}"></label>
      <label>Load step<select name="incClass"><option value="">Auto (from equipment)</option>${Object.entries(INC_CLASSES).map(([k, v]) => `<option value="${k}" ${k === d.incClass ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <button class="btn primary block" type="submit">Save exercise</button>
    </form>`, 'tall');
}
actions['new-custom'] = () => customForm(null);
actions['edit-custom'] = el => customForm(getState().exercises[el.dataset.id]);
actions['delete-custom'] = el => {
  if (!confirm('Delete this custom exercise? Past workouts keep their logged data.')) return;
  commit(s => { delete s.exercises[el.dataset.id]; });
  closeSheet();
};

document.addEventListener('submit', e => {
  if (e.target.id !== 'customForm') return;
  e.preventDefault();
  const f = new FormData(e.target);
  const repMin = Math.max(1, num(f.get('repMin')) || 8);
  const repMax = Math.max(repMin, num(f.get('repMax')) || 12);
  const equipment = f.get('equipment');
  const mechanic = f.get('mechanic');
  const id = e.target.dataset.id || 'custom-' + uid();
  const def = {
    id, name: String(f.get('name')).trim(), primary: f.get('primary'), secondary: getState().exercises[id]?.secondary || [],
    equipment, mechanic, type: equipment === 'body only' ? 'bodyweight' : 'weighted', repMin, repMax,
    rest: num(f.get('rest')) || 90, compound: mechanic === 'compound',
    incClass: f.get('incClass') || defaultIncClass(equipment, mechanic), custom: true,
  };
  if (!def.name) return;
  commit(s => { s.exercises[id] = def; });
  toast('Exercise saved');
  if (ctx.onPick && !e.target.dataset.id) { closeSheet(); ctx.onPick(def); } else openExerciseInfo(id);
});
