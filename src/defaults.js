// Weekly hard-set landmarks per muscle group, in the style of the Renaissance
// Periodization volume model: mev = minimum effective volume, mavLo..mavHi =
// productive range, mrv = maximum recoverable volume. Guidelines, not laws.
export const GROUPS = {
  chest: { label: 'Chest', mev: 8, mavLo: 12, mavHi: 20, mrv: 22 },
  back: { label: 'Back', mev: 10, mavLo: 14, mavHi: 22, mrv: 25 },
  shoulders: { label: 'Shoulders', mev: 8, mavLo: 16, mavHi: 22, mrv: 26 },
  biceps: { label: 'Biceps', mev: 8, mavLo: 14, mavHi: 20, mrv: 26 },
  triceps: { label: 'Triceps', mev: 6, mavLo: 10, mavHi: 14, mrv: 18 },
  quads: { label: 'Quads', mev: 8, mavLo: 12, mavHi: 18, mrv: 20 },
  hamstrings: { label: 'Hamstrings', mev: 6, mavLo: 10, mavHi: 16, mrv: 20 },
  glutes: { label: 'Glutes', mev: 0, mavLo: 4, mavHi: 12, mrv: 16 },
  calves: { label: 'Calves', mev: 8, mavLo: 12, mavHi: 16, mrv: 20 },
  abs: { label: 'Abs', mev: 0, mavLo: 8, mavHi: 16, mrv: 25 },
  traps: { label: 'Traps', mev: 0, mavLo: 6, mavHi: 14, mrv: 20 },
  forearms: { label: 'Forearms', mev: 0, mavLo: 4, mavHi: 10, mrv: 16 },
  lowerback: { label: 'Lower back', mev: 0, mavLo: 2, mavHi: 8, mrv: 12 },
  hips: { label: 'Hips', mev: 0, mavLo: 0, mavHi: 8, mrv: 12 },
  neck: { label: 'Neck', mev: 0, mavLo: 0, mavHi: 6, mrv: 10 },
};

export const MUSCLE_TO_GROUP = {
  chest: 'chest', lats: 'back', 'middle back': 'back', shoulders: 'shoulders', biceps: 'biceps', triceps: 'triceps',
  quadriceps: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves', abdominals: 'abs', traps: 'traps',
  forearms: 'forearms', 'lower back': 'lowerback', abductors: 'hips', adductors: 'hips', neck: 'neck',
};
export const MUSCLES = Object.keys(MUSCLE_TO_GROUP);
export const groupOf = muscle => MUSCLE_TO_GROUP[muscle] || null;

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'body only', 'e-z curl bar', 'kettlebells', 'bands', 'other'];

export const INC_CLASSES = {
  barbell: 'Barbell / plates',
  machine: 'Machine / cable stack',
  dumbbell: 'Dumbbell (compound)',
  small: 'Small steps (isolation)',
  bodyweight: 'Added load (bodyweight)',
};
export function defaultIncClass(equipment, mechanic) {
  if (equipment === 'barbell' || equipment === 'e-z curl bar') return 'barbell';
  if (equipment === 'machine' || equipment === 'cable') return 'machine';
  if (equipment === 'body only') return 'bodyweight';
  return mechanic === 'compound' ? 'dumbbell' : 'small';
}
export const DEFAULT_INCREMENTS = {
  lb: { barbell: 5, machine: 5, dumbbell: 5, small: 2.5, bodyweight: 5 },
  kg: { barbell: 2.5, machine: 2.5, dumbbell: 2, small: 1, bodyweight: 2.5 },
};

const b = (id, name, primary, secondary, equipment, mechanic, repMin, repMax, rest, extra = {}) => ({
  id, name, primary, secondary, equipment, mechanic, repMin, repMax, rest,
  type: equipment === 'body only' ? 'bodyweight' : 'weighted',
  compound: mechanic === 'compound',
  incClass: extra.incClass || defaultIncClass(equipment, mechanic),
  builtin: true,
});

export const BUILTIN_EXERCISES = [
  b('bench-press', 'Barbell Bench Press', 'chest', ['triceps', 'shoulders'], 'barbell', 'compound', 6, 8, 150),
  b('db-bench', 'Dumbbell Bench Press', 'chest', ['triceps', 'shoulders'], 'dumbbell', 'compound', 8, 10, 120),
  b('incline-db', 'Incline Dumbbell Press', 'chest', ['triceps', 'shoulders'], 'dumbbell', 'compound', 8, 10, 120),
  b('incline-bb', 'Incline Barbell Press', 'chest', ['triceps', 'shoulders'], 'barbell', 'compound', 6, 8, 150),
  b('dips', 'Dips', 'chest', ['triceps', 'shoulders'], 'body only', 'compound', 6, 10, 120),
  b('push-up', 'Push-ups', 'chest', ['triceps', 'shoulders'], 'body only', 'compound', 10, 20, 75),
  b('cable-fly', 'Cable Fly', 'chest', ['shoulders'], 'cable', 'isolation', 10, 15, 75),
  b('bent-row', 'Bent-Over Rows', 'middle back', ['lats', 'biceps'], 'barbell', 'compound', 6, 8, 150),
  b('pull-ups', 'Pull-ups', 'lats', ['biceps', 'middle back'], 'body only', 'compound', 5, 8, 120),
  b('chin-ups', 'Chin-ups', 'lats', ['biceps', 'middle back'], 'body only', 'compound', 5, 8, 120),
  b('lat-pulldown', 'Lat Pulldown', 'lats', ['biceps'], 'cable', 'compound', 8, 12, 105),
  b('seated-row', 'Seated Cable Row', 'middle back', ['lats', 'biceps'], 'cable', 'compound', 8, 12, 105),
  b('db-row', 'One-Arm Dumbbell Row', 'lats', ['middle back', 'biceps'], 'dumbbell', 'compound', 8, 12, 90),
  b('deadlift', 'Deadlift', 'hamstrings', ['glutes', 'lower back'], 'barbell', 'compound', 3, 6, 210),
  b('rdl', 'Romanian Deadlift', 'hamstrings', ['glutes', 'lower back'], 'barbell', 'compound', 6, 10, 150),
  b('ohp', 'Overhead Press', 'shoulders', ['triceps'], 'barbell', 'compound', 5, 8, 150),
  b('db-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', ['triceps'], 'dumbbell', 'compound', 8, 10, 120),
  b('lateral-raise', 'Lateral Raises', 'shoulders', [], 'dumbbell', 'isolation', 12, 15, 60),
  b('rear-delt', 'Rear Delt Fly', 'shoulders', ['middle back'], 'dumbbell', 'isolation', 12, 15, 60),
  b('face-pull', 'Face Pull', 'shoulders', ['traps', 'middle back'], 'cable', 'isolation', 12, 15, 60),
  b('shrug', 'Dumbbell Shrug', 'traps', ['forearms'], 'dumbbell', 'isolation', 10, 15, 60),
  b('db-curl', 'Dumbbell Curls', 'biceps', ['forearms'], 'dumbbell', 'isolation', 8, 12, 60),
  b('bb-curl', 'Barbell Curl', 'biceps', ['forearms'], 'e-z curl bar', 'isolation', 8, 12, 60),
  b('hammer-curl', 'Hammer Curl', 'biceps', ['forearms'], 'dumbbell', 'isolation', 8, 12, 60),
  b('pushdown', 'Triceps Pushdown', 'triceps', [], 'cable', 'isolation', 10, 15, 60),
  b('skullcrusher', 'Skullcrusher', 'triceps', [], 'e-z curl bar', 'isolation', 8, 12, 75),
  b('oh-tri-ext', 'Overhead Triceps Extension', 'triceps', [], 'dumbbell', 'isolation', 10, 15, 75),
  b('back-squat', 'Back Squat', 'quadriceps', ['glutes', 'hamstrings'], 'barbell', 'compound', 5, 8, 180),
  b('front-squat', 'Front Squat', 'quadriceps', ['glutes'], 'barbell', 'compound', 5, 8, 180),
  b('leg-press', 'Leg Press', 'quadriceps', ['glutes', 'hamstrings'], 'machine', 'compound', 8, 12, 120),
  b('reverse-lunge', 'Reverse Lunges (DB)', 'quadriceps', ['glutes', 'hamstrings'], 'dumbbell', 'compound', 8, 10, 90),
  b('bulgarian', 'Bulgarian Split Squat (DB)', 'quadriceps', ['glutes', 'hamstrings'], 'dumbbell', 'compound', 8, 10, 90),
  b('leg-ext', 'Leg Extension', 'quadriceps', [], 'machine', 'isolation', 10, 15, 75),
  b('leg-curl', 'Seated Leg Curls', 'hamstrings', [], 'machine', 'isolation', 10, 15, 75),
  b('hip-thrust', 'Hip Thrusts', 'glutes', ['hamstrings'], 'barbell', 'compound', 8, 12, 120),
  b('calf-raise', 'Calf Raises', 'calves', [], 'machine', 'isolation', 10, 15, 60),
  b('leg-raise', 'Hanging Leg Raises', 'abdominals', [], 'body only', 'isolation', 8, 15, 60),
  b('cable-crunch', 'Cable Crunch', 'abdominals', [], 'cable', 'isolation', 10, 15, 60),
];

// exercise ids for templates
const t = (exId, sets) => ({ exId, sets });
export const TEMPLATES = [
  {
    id: 'upper-lower', name: 'Upper / Lower', blurb: '4 days. Each muscle twice a week — a solid default for muscle gain.',
    days: [
      { name: 'Upper A', exercises: [t('bench-press', 3), t('bent-row', 3), t('pull-ups', 2), t('db-curl', 2)] },
      { name: 'Lower A', exercises: [t('reverse-lunge', 3), t('hip-thrust', 3), t('leg-curl', 2), t('leg-raise', 2)] },
      { name: 'Upper B', exercises: [t('incline-db', 3), t('chin-ups', 3), t('db-shoulder-press', 3), t('lateral-raise', 2)] },
      { name: 'Lower B', exercises: [t('bulgarian', 3), t('hip-thrust', 3), t('leg-curl', 2), t('calf-raise', 2)] },
    ],
  },
  {
    id: 'ppl', name: 'Push / Pull / Legs', blurb: '3 days a week, or run it twice for 6. Good volume per session.',
    days: [
      { name: 'Push', exercises: [t('bench-press', 3), t('db-shoulder-press', 3), t('incline-db', 3), t('lateral-raise', 3), t('pushdown', 3)] },
      { name: 'Pull', exercises: [t('lat-pulldown', 3), t('bent-row', 3), t('seated-row', 2), t('face-pull', 3), t('db-curl', 3)] },
      { name: 'Legs', exercises: [t('back-squat', 3), t('rdl', 3), t('leg-press', 3), t('leg-curl', 3), t('calf-raise', 4)] },
    ],
  },
  {
    id: 'full-body', name: 'Full Body', blurb: '3 days. Every session hits everything — efficient and beginner friendly.',
    days: [
      { name: 'Full A', exercises: [t('back-squat', 3), t('bench-press', 3), t('bent-row', 3), t('lateral-raise', 2), t('db-curl', 2)] },
      { name: 'Full B', exercises: [t('rdl', 3), t('ohp', 3), t('lat-pulldown', 3), t('leg-press', 2), t('pushdown', 2)] },
      { name: 'Full C', exercises: [t('front-squat', 3), t('incline-db', 3), t('seated-row', 3), t('hip-thrust', 2), t('hammer-curl', 2)] },
    ],
  },
  {
    id: 'strength', name: 'Strength (SBD)', blurb: '3 days built around squat, bench and deadlift. Pair with the Strength or Peaking goal.',
    days: [
      { name: 'Squat day', exercises: [t('back-squat', 4), t('bench-press', 3), t('bent-row', 3), t('leg-raise', 2)] },
      { name: 'Bench day', exercises: [t('bench-press', 4), t('ohp', 3), t('pull-ups', 3), t('pushdown', 2)] },
      { name: 'Deadlift day', exercises: [t('deadlift', 3), t('front-squat', 3), t('incline-db', 3), t('db-curl', 2)] },
    ],
  },
];

export const GOALS = {
  hypertrophy: 'Muscle gain',
  strength: 'Strength',
  peaking: 'Peaking (event date)',
};
