import { defaultIncClass } from './defaults.js';

const STRENGTH_CATEGORIES = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman']);
let catalog = [];
let byId = new Map();

function convert(c) {
  const equipment = c.equipment || 'other';
  const mechanic = c.mechanic || 'isolation';
  const compound = mechanic === 'compound';
  const type = equipment === 'body only' ? 'bodyweight' : 'weighted';
  let repMin, repMax, rest;
  if (type === 'bodyweight') [repMin, repMax, rest] = compound ? [6, 12, 90] : [10, 20, 60];
  else if (compound) [repMin, repMax, rest] = equipment === 'barbell' ? [6, 10, 150] : [8, 12, 105];
  else [repMin, repMax, rest] = [10, 15, 75];
  return {
    id: 'db:' + c.id, name: c.name, primary: c.primaryMuscles[0], secondary: c.secondaryMuscles || [],
    equipment, mechanic, type, repMin, repMax, rest, compound, incClass: defaultIncClass(equipment, mechanic),
    level: c.level, instructions: c.instructions || [], catalog: true,
  };
}

export async function loadCatalog() {
  try {
    const res = await fetch('public/data/exercises.json');
    const raw = await res.json();
    catalog = raw.filter(c => STRENGTH_CATEGORIES.has(c.category) && c.primaryMuscles?.[0]).map(convert);
    byId = new Map(catalog.map(e => [e.id, e]));
  } catch (err) {
    console.warn('Exercise catalog unavailable; using saved exercises only.', err);
  }
}

export function getExercise(state, id) {
  return state.exercises[id] || byId.get(id) || null;
}

export function searchExercises(state, { q = '', muscle = '', equipment = '', limit = 50 } = {}) {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const seen = new Set();
  const out = [];
  const consider = (e, rank) => {
    const key = e.name.toLowerCase();
    if (seen.has(key)) return;
    if (muscle && e.primary !== muscle) return;
    if (equipment && e.equipment !== equipment) return;
    const name = key;
    if (!tokens.every(t => name.includes(t))) return;
    seen.add(key);
    out.push({ e, score: rank + (tokens.length && name.startsWith(tokens[0]) ? 0 : 1) + name.length / 1000 });
  };
  Object.values(state.exercises).forEach(e => consider(e, e.custom ? 0 : 1));
  catalog.forEach(e => consider(e, 2));
  return out.sort((a, b) => a.score - b.score).slice(0, limit).map(x => x.e);
}

export const catalogReady = () => catalog.length > 0;
