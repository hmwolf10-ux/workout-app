# Workout Tracker

**[▶ Open the app](https://hmwolf10-ux.github.io/workout-app/)**

A phone-first training app: build your own programs from 800+ exercises, log sets in one tap, and get load targets that follow your actual performance. It works offline, installs to your home screen, and keeps everything on your device.

## What it does

- **Build any workout.** Start from a template (Upper/Lower, Push/Pull/Legs, Full Body, Strength) or a blank program. Add, reorder and remove days and exercises, set sets and rep ranges, or create custom exercises. Need a one-off? Start a Quick workout and add exercises as you go.
- **Log fast.** Every set is pre-filled with today's target, so a normal set is one tap. Warm-up ramps, a rest timer with sound and vibration, notes, swap/reorder mid-workout, and PR alerts.
- **Targets that adapt.** Each set is converted to an RIR-adjusted estimated 1RM. The next session's load is the heaviest step that still hits the target reps at the target effort, using double progression (fill the rep range, then add load). After each set it can nudge the next one up or down.
- **Periodization built in.** Choose a goal:
  - *Muscle gain*: effort ramps 3 → 1 RIR over a 2–8 week block, sets ramp up, then a half-volume deload.
  - *Strength*: main barbell lifts move to 3–6 reps with longer rests.
  - *Peaking*: pick an event date and it runs accumulation → intensification → realization → taper.
- **Volume tracking.** Weekly hard sets per muscle group against MEV / MAV / MRV landmarks, in the plan editor and on the Progress tab.
- **Progress.** Strength trends, records, sets and tonnage per week, streaks, body-weight log, and a heads-up when several lifts stop progressing.
- **Supersets, plates and stretch-focused templates.** Link two exercises into a superset (rest happens after the pair), see the plates per side for barbell loads, and start from Upper/Lower stretch-focus or 6-day PPL templates.
- **Readiness and layoffs.** Mark a run-down day for an extra rep in reserve and fewer sets; long breaks discount your old strength estimate instead of asking you to beat it.
- **Per-exercise history.** Tap any exercise name for its e1RM chart, best reps at each load and recent sessions. A 12-week consistency map sits on Progress.
- **History you can fix.** Open any workout to edit or delete sets, or repeat it.
- **Private and offline.** Data lives in your browser's `localStorage`; export/import a JSON backup from Settings. Installable as a PWA.

## Running it

It is plain HTML and ES modules with no build step. Serve the folder with any static server (the app loads the exercise catalog with `fetch`):

```
python -m http.server 8080
```

then open http://localhost:8080. Deploy by enabling GitHub Pages on `main` (root folder), or drop the folder on Netlify/Vercel.

Tests for the training engine use Node's built-in runner:

```
npm test
```

## How the training model works

| Piece | Rule |
| --- | --- |
| Estimated 1RM | Epley on `reps + RIR` (capped at 15 total reps) |
| Next load | Same weight if the rep target fits the range; +1 step if you'd top the range; down if you'd land below it |
| Target effort | Ramps across the block (3 → 1 RIR), 4 RIR on deload, phase-specific when peaking |
| Bad days | One session more than 8% below the last is averaged rather than trusted |
| Bodyweight lifts | Reps first; added load once you top the range (uses your logged body weight) |
| Volume | Primary muscle counts 1 per set, secondary muscles 0.5 |

These are well-supported defaults, not medical or coaching advice. Landmarks vary by person; adjust sets to your recovery.

## Project structure

- `index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg`: app shell and PWA files
- `src/main.js`: routing, events, rest timer
- `src/engine.js`: pure training logic (e1RM, prescriptions, periodization, volume)
- `src/session.js`: starting, logging and finishing workouts
- `src/store.js`: state, persistence, backup, migration from the old app version
- `src/catalog.js`, `src/pickers.js`: exercise catalog, search, custom exercises
- `src/defaults.js`: built-in exercises, templates, volume landmarks
- `src/views/`: Today, Workout, Plan, Progress, History, Settings, Exercise detail
- `public/data/exercises.json`: exercise catalog
- `tests/`: engine tests

## License

Open source. Use freely.
