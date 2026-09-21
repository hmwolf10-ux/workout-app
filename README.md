# Workout Tracker

A minimal, fast web app for tracking strength training workouts. Designed for the gym with an offline-first approach, real-time timers, and smart exercise recommendations.

## Features

- **Daily Workout Programs** — Upper/Lower split (Upper A, Lower A, Upper B, Lower B) with predefined exercises and sets
- **Smart Logging** — Track weight, reps, and RIR (Reps in Reserve) for each set with auto-complete detection
- **Exercise Recommendations** — Suggests weight/rep targets based on your last performance
- **Warmup Sets** — Automatic warmup suggestions for compound lifts above threshold weights
- **Rest Timers** — Between-set and between-exercise countdown timers with vibration alerts
- **Progress Tracking** — View PRs, volume trends, and historical performance data
- **Offline-First** — All data saved to browser localStorage; works without internet
- **Minimal Design** — Dark theme, optimized for mobile and desktop gym use

## Quick Start

### Option 1: Open Locally
1. Clone this repo: `git clone https://github.com/hmwolf10-ux/workout-app.git`
2. Open `index.html` in your browser
3. That's it — no server needed (all data saves locally)

### Option 2: Use Online
- [Enable GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) to host it at `https://hmwolf10-ux.github.io/workout-app/`
- Or deploy to [Netlify](https://netlify.com) or [Vercel](https://vercel.com) (free tier, just connect your GitHub repo)

### Using the App

1. Select your workout day from the dropdown
2. Click "Start Workout" to enable logging
3. Enter weight, reps, and RIR for each set
4. Check the box to mark sets complete and auto-start rest timers
5. View history and progress in the Progress/History tabs

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

Programs are hardcoded in `PROGRAM` object; customize by editing the JavaScript.

### Recommendations

The algorithm suggests next-set targets based on:

- Last performance for this exercise (weight, reps, RIR)
- Exercise rep range targets (e.g., 6–8 for compounds, 8–10 for accessories)
- Weight increment rules (2.5–5 LB depending on exercise type)

### Data Storage

- **Workouts** — Saved to `localStorage` as `workoutData` (survives browser restarts)
- **Body Weight** — Saved to `localStorage` as `bodyWeight` for future use
- **Progress Prefs** — Display toggle settings for the Progress page

## Customization

### Change Exercises

Edit the `EXERCISE_LIBRARY` in `index.html`:

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

Edit the `PROGRAM` object to swap exercises or add new days.

### Change Timers

- **Rest between sets**: Adjust `rest` field in `EXERCISE_LIBRARY`
- **Rest between exercises**: Change `REST_BETWEEN_EXERCISES` constant (default: 120s)

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Optimized for mobile with safe-area insets for notches.

## Future Ideas

- Cloud sync via Supabase (backend plumbing started but incomplete)
- Exercise swap modal for alternatives
- Weekly/monthly progress charts
- CSV export for data backup
- Dark/light theme toggle

## License

Open source. Use freely.
