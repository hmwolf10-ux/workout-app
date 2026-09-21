# Workout Tracker

A minimal, fast web app for tracking strength training workouts. Designed for the gym with an offline-first approach, real-time timers, and smart exercise recommendations.

## Features

- **Stable, editable training plan** — Upper/Lower sessions can be adjusted for future workouts without rewriting history; plan versions are retained in the backup
- **Training profile** — Goal, experience, sessions per week, session duration, and lb/kg units
- **Equipment profile** — Available exercises, minimum/maximum load, and the smallest usable increment
- **Week 0 prescriptions** — Every exercise receives a transparent starting prescription derived from the 175 lb bench and 25 lb dumbbell reverse-lunge anchors (editable in Settings)
- **Smart Logging** — Track weight, reps, and RIR (Reps in Reserve) for each set with auto-complete detection
- **Exercise Recommendations** — Set-by-set suggestions use all prior working sets, rep ranges, RIR, equipment limits, and an explicit reason
- **Mesocycles** — Simple build weeks, optional linear/undulating periodization, and an optional deload prescription
- **Warmup Sets** — Automatic warmup suggestions for compound lifts above threshold weights
- **Rest Timers** — Between-set and between-exercise countdown timers with vibration alerts
- **Progress Tracking** — View PRs, volume trends, and historical performance data
- **Offline-First** — All data saved to browser localStorage; works without internet
- **Minimal Design** — Dark theme, optimized for mobile and desktop gym use

## Quick Start

### Option 1: Run Locally
1. Clone this repo: `git clone https://github.com/hmwolf10-ux/workout-app.git`
2. From the repository directory, run `python -m http.server 8080`
3. Open http://localhost:8080 in your browser

The development server is recommended because the app loads exercise data with `fetch`.
Workout data still saves locally in the browser and does not require a backend.

### Option 2: Use Online
- [Enable GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) to host it at `https://hmwolf10-ux.github.io/workout-app/`
- Or deploy to [Netlify](https://netlify.com) or [Vercel](https://vercel.com) (free tier, just connect your GitHub repo)

### Using the App

1. Select your workout day from the dropdown
2. Click "Start Workout" to enable logging
3. Enter weight, reps, and RIR for each set
4. Check the box to mark sets complete and auto-start rest timers
5. View progress in the Progress tab or saved sessions in the History tab.
6. Open Settings to set your profile, equipment, schedule, Week 0 anchors, and mesocycle.

## How It Works

### Logging a Set

1. Fill in **weight** (LB), **reps**, and **RIR** (reps left in reserve: 0–5+)
2. Check the ✓ box to mark complete
3. A rest timer automatically starts (90–150s depending on exercise)
4. Recommendation arrow (→) shows suggested weight/reps for the next set

### Programs

Workouts follow a standard Upper/Lower split:

- **Upper A** (Mon): Barbell Bench, Bent-Over Rows, Pull-ups, Dumbbell Curls
- **Lower A** (Tue): Reverse Lunges, Hip Thrusts, Seated Leg Curls, Hanging Leg Raises
- **Upper B** (Thu): Incline Dumbbell Press, Chin-ups, Dumbbell Shoulder Press, Lateral Raises
- **Lower B** (Fri): Bulgarian Split Squats, Hip Thrusts, Seated Leg Curls, Calf Raises

Programs are defined in `src/data/config.js`; customize them there.

### Recommendations

The algorithm suggests next-set targets based on:

- A Week 0 baseline (bench press and reverse lunge) when no logged performance exists
- All prior logged working sets for this exercise (weight, reps, RIR), including set-to-set fatigue
- Exercise rep range targets (e.g., 6–8 for compounds, 8–10 for accessories)
- Weight increment rules and the equipment profile's minimum/maximum load
- Current mesocycle and deload phase

Recommendations include a short explanation. They are conservative estimates, not a substitute
for adjusting the load when the prescribed effort does not match the actual set.

### Data Storage

- **Workouts and settings** — Saved to a versioned schema-3 `localStorage` envelope under `workoutData`
  (survives browser restarts and includes profile, equipment, plan versions, mesocycle, baseline, and history)
- **Body Weight** — Saved to `localStorage` as `bodyWeight` for future use
- **Progress Prefs** — Display toggle settings for the Progress page
- **Backup** — Versioned JSON export/import is backward compatible with the original baseline-only format

## Customization

### Change Exercises

Edit the `EXERCISE_LIBRARY` in `src/data/config.js`:

```javascript
"Barbell Bench Press": { 
  type: "weighted", 
  repMin: 6, 
  repMax: 8, 
  rest: 150,          // Rest in seconds
  compound: true,     // Shows warmup suggestions
  weightIncrement: 5, // Increment for next set
  warmupThreshold: 75 // Min weight to trigger warmup
}
```

### Change Programs

Edit the `PROGRAM` object in `src/data/config.js` to swap exercises or add new days.

### Change Timers

- **Rest between sets**: Adjust `rest` field in `EXERCISE_LIBRARY`
- **Rest between exercises**: Change `REST_BETWEEN_EXERCISES` constant (default: 120s)

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Optimized for mobile with safe-area insets for notches.

## Project Structure

- `index.html` — document shell and application markup
- `src/styles.css` — application styles
- `src/app.js` — workout, progress, settings, import/export, and localStorage behavior
- `src/data/config.js` — workout programs, exercise rules, timer settings, and demo history
- `public/data/exercises.json` — exercise catalog used for alternatives

## Future Ideas

- Exercise swap modal for alternatives
- Weekly/monthly progress charts
- CSV export for data backup
- Dark/light theme toggle

## License

Open source. Use freely.
