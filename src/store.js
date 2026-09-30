import { uid, isoDate, startOfWeek } from './util.js';
import { BUILTIN_EXERCISES, DEFAULT_INCREMENTS, TEMPLATES } from './defaults.js';

const KEY = 'workout-app:v4';
const LEGACY_KEY = 'workoutData';
let state = null;
const subs = new Set();
export let storageError = false;

export const getState = () => state;
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageError = false; }
  catch (err) { storageError = true; console.error('Save failed', err); }
}
// commit: change state, save, re-render. mutate: change state and save silently.
export function commit(fn) { fn?.(state); persist(); subs.forEach(f => f(state)); }
export function mutate(fn) { fn(state); persist(); }

export function freshState() {
  return {
    v: 4,
    settings: {
      unit: 'lb', bodyWeight: 180, goal: 'hypertrophy', experience: 'intermediate',
      useBlocks: false, mesoLength: 4, deload: true, rampVolume: true, peakDate: null, mesoStart: null,
      increments: { ...DEFAULT_INCREMENTS.lb }, showWarmups: true, restAlert: true,
    },
    exercises: {}, programs: [], activeProgramId: null, sessions: [], active: null, bodyLog: [],
  };
}

function normalize(s) {
  const base = freshState();
  s.settings = { ...base.settings, ...s.settings, increments: { ...base.settings.increments, ...(s.settings?.increments || {}) } };
  s.exercises ||= {};
  for (const e of BUILTIN_EXERCISES) s.exercises[e.id] ||= { ...e };
  s.programs ||= []; s.sessions ||= []; s.bodyLog ||= [];
  if (!s.settings.mesoStart) s.settings.mesoStart = startOfWeek(isoDate());
  if (s.activeProgramId && !s.programs.some(p => p.id === s.activeProgramId)) s.activeProgramId = s.programs[0]?.id || null;
  sortSessions(s);
  return s;
}
export function sortSessions(s = state) {
  s.sessions.sort((a, b) => a.date.localeCompare(b.date) || (a.startedAt || 0) - (b.startedAt || 0));
}

export function initStore() {
  let loaded = null;
  try { loaded = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* corrupt; start fresh */ }
  if (loaded?.v === 4) {
    state = normalize(loaded);
  } else {
    state = normalize(freshState());
    if (convertLegacy(state, readLegacy())) state.meta = { migrated: true };
  }
  persist();
  return state;
}

/* ---------- programs ---------- */

export function programFromTemplate(tpl) {
  return {
    id: uid(), name: tpl.name,
    days: tpl.days.map(d => ({ id: uid(), name: d.name, exercises: d.exercises.map(e => ({ uid: uid(), exId: e.exId, sets: e.sets })) })),
  };
}
export const getProgram = (s, id) => s.programs.find(p => p.id === id) || null;
export const activeProgram = (s = state) => getProgram(s, s.activeProgramId);

export function registerExercise(s, def) {
  s.exercises[def.id] ||= { ...def };
  return s.exercises[def.id];
}

/* ---------- legacy (v2/v3) data ---------- */

function readLegacy() {
  try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch { return null; }
}

function legacyDef(s, name, type) {
  const found = Object.values(s.exercises).find(e => e.name.toLowerCase() === name.toLowerCase());
  if (found) return found;
  const id = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return registerExercise(s, {
    id, name, primary: '', secondary: [], equipment: 'other', mechanic: 'compound', type: type === 'bodyweight' ? 'bodyweight' : 'weighted',
    repMin: 8, repMax: 12, rest: 90, compound: false, incClass: 'small', custom: true,
  });
}

// Converts the old localStorage payload into v4 sessions/program/settings. Returns true when anything was found.
export function convertLegacy(s, raw) {
  if (!raw || !raw.workoutData) return false;
  const added = [];
  for (const [key, exs] of Object.entries(raw.workoutData)) {
    const date = key.slice(0, 10), day = key.slice(11);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(exs)) continue;
    const exercises = exs.map(ex => {
      const def = legacyDef(s, ex.name, ex.type);
      const sets = (ex.sets || []).filter(x => x.logged && x.r > 0).map(x => ({ w: x.w ?? 0, r: x.r, rir: x.rir ?? null, done: true }));
      return sets.length ? { uid: uid(), exId: def.id, name: def.name, primary: def.primary, secondary: def.secondary, sets } : null;
    }).filter(Boolean);
    if (exercises.length) added.push({ id: uid(), date, name: day, exercises, startedAt: null, endedAt: null, imported: true });
  }
  s.sessions.push(...added);
  sortSessions(s);

  const old = raw.settings || {};
  if (old.unit === 'kg' || old.unit === 'lb') s.settings.unit = old.unit;
  if (raw.bodyWeight) s.settings.bodyWeight = Number(raw.bodyWeight) || s.settings.bodyWeight;
  if (old.profile?.goal === 'strength') s.settings.goal = 'strength';
  if (old.mesocycle?.length) s.settings.mesoLength = Number(old.mesocycle.length) || 4;

  if (!s.programs.length) {
    const days = old.plan?.sessions ? Object.entries(old.plan.sessions) : null;
    if (days?.length) {
      s.programs.push({
        id: uid(), name: 'Upper / Lower',
        days: days.map(([name, d]) => ({
          id: uid(), name,
          exercises: (d.exercises || []).map(e => ({ uid: uid(), exId: legacyDef(s, e.name).id, sets: e.sets || 3 })),
        })),
      });
    } else {
      s.programs.push(programFromTemplate(TEMPLATES[0]));
    }
    s.activeProgramId = s.programs[0].id;
  }
  return added.length > 0 || s.programs.length > 0;
}

/* ---------- backup ---------- */

export function exportJSON() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 1);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (data?.v === 4 && Array.isArray(data.sessions)) {
    delete data.exportedAt;
    state = normalize(data);
    persist();
    subs.forEach(f => f(state));
    return `Restored ${state.sessions.length} workouts.`;
  }
  if (data?.workoutData) {
    const before = state.sessions.length;
    convertLegacy(state, data);
    persist();
    subs.forEach(f => f(state));
    return `Imported ${state.sessions.length - before} workouts from the old format.`;
  }
  throw new Error('Unrecognized backup file.');
}

export function resetAll() {
  state = normalize(freshState());
  persist();
  subs.forEach(f => f(state));
}
