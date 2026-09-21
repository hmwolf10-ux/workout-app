const EXERCISE_LIBRARY = {
  "Barbell Bench Press": { type: "weighted", repMin: 6, repMax: 8, rest: 150, compound: true, weightIncrement: 5, warmupThreshold: 75 },
  "Dumbbell Bench Press": { type: "weighted", repMin: 8, repMax: 10, rest: 120, compound: true, weightIncrement: 2.5, warmupThreshold: 60 },
  "Bent-Over Rows": { type: "weighted", repMin: 6, repMax: 8, rest: 150, compound: true, weightIncrement: 5, warmupThreshold: 75 },
  "Pull-ups": { type: "bodyweight", repMin: 5, repMax: 8, rest: 120, compound: true, weightIncrement: 2.5, warmupThreshold: 50 },
  "Dumbbell Curls": { type: "weighted", repMin: 8, repMax: 10, rest: 60, weightIncrement: 2.5, warmupThreshold: 40 },
  "Reverse Lunges (DB)": { type: "weighted", repMin: 8, repMax: 10, rest: 90, weightIncrement: 5, warmupThreshold: 60 },
  "Hip Thrusts": { type: "weighted", repMin: 8, repMax: 12, rest: 120, compound: true, weightIncrement: 5, warmupThreshold: 75 },
  "Seated Leg Curls": { type: "weighted", repMin: 12, repMax: 12, rest: 60, weightIncrement: 5, warmupThreshold: 60 },
  "Hanging Leg Raises": { type: "bodyweight", repMin: 10, repMax: 12, rest: 60 },
  "Incline Dumbbell Press": { type: "weighted", repMin: 8, repMax: 8, rest: 120, compound: true, weightIncrement: 2.5, warmupThreshold: 60 },
  "Chin-ups": { type: "bodyweight", repMin: 5, repMax: 8, rest: 120, compound: true, weightIncrement: 2.5, warmupThreshold: 40 },
  "Dumbbell Shoulder Press": { type: "weighted", repMin: 8, repMax: 8, rest: 120, compound: true, weightIncrement: 2.5, warmupThreshold: 50 },
  "Lateral Raises": { type: "weighted", repMin: 12, repMax: 12, rest: 60, weightIncrement: 2.5, warmupThreshold: 40 },
  "Bulgarian Split Squat (DB)": { type: "weighted", repMin: 8, repMax: 10, rest: 90, weightIncrement: 5, warmupThreshold: 60 },
  "Calf Raises": { type: "weighted", repMin: 12, repMax: 15, rest: 60, weightIncrement: 5, warmupThreshold: 60 },
};

const PROGRAM = {
  "Upper A": { weekday: "Mon", exercises: [
    { name: "Barbell Bench Press", sets: 3 },
    { name: "Bent-Over Rows", sets: 3 },
    { name: "Pull-ups", sets: 2 },
    { name: "Dumbbell Curls", sets: 2 },
  ]},
  "Lower A": { weekday: "Tue", exercises: [
    { name: "Reverse Lunges (DB)", sets: 3 },
    { name: "Hip Thrusts", sets: 3 },
    { name: "Seated Leg Curls", sets: 2 },
    { name: "Hanging Leg Raises", sets: 2 },
  ]},
  "Upper B": { weekday: "Thu", exercises: [
    { name: "Incline Dumbbell Press", sets: 3 },
    { name: "Chin-ups", sets: 3 },
    { name: "Dumbbell Shoulder Press", sets: 3 },
    { name: "Lateral Raises", sets: 2 },
  ]},
  "Lower B": { weekday: "Fri", exercises: [
    { name: "Bulgarian Split Squat (DB)", sets: 3 },
    { name: "Hip Thrusts", sets: 3 },
    { name: "Seated Leg Curls", sets: 2 },
    { name: "Calf Raises", sets: 2 },
  ]},
};

const DAY_ORDER = ["Upper A", "Lower A", "Upper B", "Lower B"];
const REST_BETWEEN_EXERCISES = 120;

const SEED = [
  { date: "2026-08-26", day: "Upper A", exercises: [
    { name: "Barbell Bench Press", type: "weighted", sets: [{w:155,r:9,rir:5},{w:185,r:5,rir:2},{w:185,r:4,rir:2}] },
    { name: "Dumbbell Bench Press", type: "weighted", sets: [{w:75,r:8,rir:2},{w:75,r:7,rir:2},{w:75,r:6,rir:2}] },
    { name: "Bent-Over Rows", type: "weighted", sets: [{w:135,r:9,rir:1},{w:135,r:8,rir:2},{w:135,r:8,rir:0},{w:135,r:8,rir:0}] },
    { name: "Pull-ups", type: "weighted", sets: [{w:5,r:2,rir:1},{w:0,r:2,rir:1}] },
    { name: "Dumbbell Curls", type: "weighted", sets: [{w:30,r:11,rir:1},{w:30,r:9,rir:2}] },
  ]},
  { date: "2026-08-27", day: "Lower A", exercises: [
    { name: "Reverse Lunges (DB)", type: "weighted", sets: [{w:30,r:11,rir:2},{w:30,r:11,rir:1},{w:30,r:11,rir:0}] },
    { name: "Hip Thrusts", type: "weighted", sets: [{w:135,r:10,rir:1},{w:135,r:10,rir:1},{w:135,r:10,rir:0}] },
    { name: "Seated Leg Curls", type: "weighted", sets: [{w:145,r:9,rir:2},{w:145,r:9,rir:1}] },
    { name: "Hanging Leg Raises", type: "bodyweight", sets: [{r:10,rir:2},{r:10,rir:1}] },
  ]},
  { date: "2026-08-29", day: "Upper B", exercises: [
    { name: "Incline Dumbbell Press", type: "weighted", sets: [{w:50,r:7,rir:2},{w:50,r:7,rir:1},{w:50,r:7,rir:0}] },
    { name: "Chin-ups", type: "weighted", sets: [{w:5,r:7,rir:0.5},{w:5,r:5,rir:1},{w:5,r:4,rir:1}] },
    { name: "Dumbbell Shoulder Press", type: "weighted", sets: [{w:45,r:9,rir:1},{w:45,r:9,rir:0},{w:45,r:9,rir:0}] },
    { name: "Lateral Raises", type: "weighted", sets: [{w:15,r:15,rir:1},{w:15,r:14,rir:1}] },
  ]},
  { date: "2026-08-30", day: "Lower B", exercises: [
    { name: "Bulgarian Split Squat (DB)", type: "weighted", sets: [{w:30,r:10,rir:1},{w:30,r:10,rir:0},{w:30,r:9,rir:0}] },
    { name: "Hip Thrusts", type: "weighted", sets: [{w:135,r:10,rir:1},{w:135,r:10,rir:1},{w:135,r:9,rir:0}] },
    { name: "Seated Leg Curls", type: "weighted", sets: [{w:145,r:12,rir:1},{w:145,r:12,rir:0}] },
    { name: "Calf Raises", type: "weighted", sets: [{w:185,r:12,rir:1},{w:185,r:12,rir:0}] },
  ]},
];
