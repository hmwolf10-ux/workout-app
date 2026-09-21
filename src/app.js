let externalExercises = [];

fetch('public/data/exercises.json')
  .then(response => response.json())
  .then(data => {
    externalExercises = data;
    console.log('Loaded', data.length, 'exercises from database');
  })
  .catch(error => console.error('Could not load exercises.json:', error));

function getExerciseAlternatives(exerciseName) {
  if (!externalExercises.length) return [];
  const exercise = externalExercises.find(ex => ex.name.toLowerCase() === exerciseName.toLowerCase());
  if (!exercise || !exercise.primaryMuscles) return [];
  const primaryMuscle = exercise.primaryMuscles[0];
  return externalExercises
    .filter(ex => ex.primaryMuscles && ex.primaryMuscles.includes(primaryMuscle) && ex.name !== exerciseName)
    .slice(0, 5)
    .map(ex => ex.name);
}

let currentDay = "Upper A";
let workoutData = {};
let bodyWeight = 180;
let appSettings = {
  unit: 'lb',
  activeDays: ['Upper A', 'Lower A', 'Upper B', 'Lower B'],
  baseline: {
    completed: false,
    recordedAt: null,
    bench: { weight: 175, reps: 6, rir: 2 },
    lunge: { weight: 25, reps: 8, rir: 2 }
  }
};
let timer = { remaining: 0, running: false, intervalId: null };
let workoutActive = false;
let workoutStartTime = null;
let workoutTimerInterval = null;

function todayISO() { const d = new Date(); const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
function fmtDate(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {weekday: 'long', month: 'short', day: 'numeric'}); }

function showPage(pageName, tab) {
  document.querySelectorAll('.content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.getElementById(pageName + 'Page').classList.add('active');
  tab.classList.add('active');

  if (pageName === 'progress') renderProgressPage();
  if (pageName === 'history') renderHistoryPage();
  if (pageName === 'settings') renderSettingsPage();
}

function init() {
  loadSettings();
  loadData();
  loadProgressPrefs();
  ensureCurrentDayIsAvailable();
  loadWorkout();
  renderWorkoutPage();
}

function ensureCurrentDayIsAvailable() {
  if (!appSettings.activeDays.includes(currentDay)) {
    currentDay = appSettings.activeDays[0] || DAY_ORDER[0];
  }
}

function renderDaySelector() {
  const sel = document.getElementById('daySelectInline');
  if (sel) sel.value = currentDay;
}

function switchDay(day) {
  if (workoutActive) {
    alert("Finish your workout first!");
    return;
  }
  currentDay = day;
  loadWorkout();
  renderDaySelector();
  renderWorkoutPage();
}

function toggleWorkout() {
  if (!workoutActive) {
    workoutActive = true;
    const btn = document.getElementById('startBtn');
    const timerDisplay = document.getElementById('workoutTimer');
    const daySelect = document.getElementById('daySelectInline');
    btn.textContent = 'End Workout';
    btn.classList.add('active');
    timerDisplay.style.display = 'block';
    if (daySelect) daySelect.disabled = true;
    workoutStartTime = Date.now();
    updateWorkoutTimer();
    workoutTimerInterval = setInterval(updateWorkoutTimer, 100);
    renderWorkoutPage();
  } else {
    document.getElementById('endWorkoutModal').style.display = 'flex';
  }
}

function saveAndEndWorkout() {
  workoutActive = false;
  const btn = document.getElementById('startBtn');
  const timerDisplay = document.getElementById('workoutTimer');
  const daySelect = document.getElementById('daySelectInline');
  btn.textContent = 'Start Workout';
  btn.classList.remove('active');
  timerDisplay.style.display = 'none';
  if (daySelect) daySelect.disabled = false;
  if (workoutTimerInterval) clearInterval(workoutTimerInterval);
  clearInterval(timer.intervalId);
  timer.running = false;
  document.getElementById('timerDisplay').classList.remove('active');
  document.getElementById('endWorkoutModal').style.display = 'none';
  persistData();
  renderWorkoutPage();
}

function discardWorkout() {
  const key = `${todayISO()}-${currentDay}`;
  delete workoutData[key];
  workoutActive = false;
  const btn = document.getElementById('startBtn');
  const timerDisplay = document.getElementById('workoutTimer');
  const daySelect = document.getElementById('daySelectInline');
  btn.textContent = 'Start Workout';
  btn.classList.remove('active');
  timerDisplay.style.display = 'none';
  if (daySelect) daySelect.disabled = false;
  if (workoutTimerInterval) clearInterval(workoutTimerInterval);
  clearInterval(timer.intervalId);
  timer.running = false;
  document.getElementById('timerDisplay').classList.remove('active');
  document.getElementById('endWorkoutModal').style.display = 'none';
  persistData();
  loadWorkout();
  renderWorkoutPage();
}

function updateWorkoutTimer() {
  if (!workoutActive || !workoutStartTime) return;
  const elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  document.getElementById('workoutTimer').textContent = `${min}:${sec.toString().padStart(2, '0')}`;
}

function loadWorkout() {
  const key = `${todayISO()}-${currentDay}`;
  if (!workoutData[key]) {
    workoutData[key] = PROGRAM[currentDay].exercises.map(progEx => {
      const exLib = EXERCISE_LIBRARY[progEx.name];
      return {
        name: progEx.name,
        type: exLib ? exLib.type : 'weighted',
        sets: Array(progEx.sets).fill(null).map(() => ({ w: null, r: null, rir: null, logged: false, recViewed: false }))
      };
    });
  }
}

function findFirstUncompletedSet() {
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  for (let exIdx = 0; exIdx < exData.length; exIdx++) {
    for (let setIdx = 0; setIdx < exData[exIdx].sets.length; setIdx++) {
      if (!exData[exIdx].sets[setIdx].logged) {
        return { exIdx, setIdx };
      }
    }
  }
  return null;
}

function isLastSetOfWorkout(exIdx, setIdx) {
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  for (let i = setIdx + 1; i < exData[exIdx].sets.length; i++) {
    if (!exData[exIdx].sets[i].logged) return false;
  }
  for (let i = exIdx + 1; i < exData.length; i++) {
    for (let j = 0; j < exData[i].sets.length; j++) {
      if (!exData[i].sets[j].logged) return false;
    }
  }
  return true;
}

function isLastSetOfExercise(exIdx, setIdx) {
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  for (let i = setIdx + 1; i < exData[exIdx].sets.length; i++) {
    if (!exData[exIdx].sets[i].logged) return false;
  }
  return true;
}

function needsWarmup(exName, weight) {
  if (weight === null) return false;
  const ex = EXERCISE_LIBRARY[exName];
  const threshold = ex && ex.warmupThreshold ? ex.warmupThreshold : 75;
  return weight > threshold;
}

function toggleWarmup(btn) {
  const table = btn.nextElementSibling;
  if (table && table.classList.contains('warmup-table')) {
    table.style.display = table.style.display === 'none' ? 'block' : 'none';
    btn.style.opacity = table.style.display === 'none' ? '1' : '0.8';
  }
}

function getWarmupSets(exName, targetWeight) {
  if (!needsWarmup(exName, targetWeight)) return null;
  const light = Math.round(targetWeight * 0.5 / 5) * 5 || 45;
  const medium = Math.round(targetWeight * 0.7 / 5) * 5 || 65;
  return [
    { w: 45, r: 3 },
    { w: light, r: 3 },
    { w: medium, r: 2 }
  ];
}

function renderWorkoutPage() {
  const con = document.getElementById('workoutPage');
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  const programDefs = PROGRAM[currentDay].exercises;
  const firstUncompleted = workoutActive ? findFirstUncompletedSet() : null;

  let html = '<div class="workout-header-section">';
  html += '<label for="daySelectInline">Today\'s Program:</label>';
  html += '<select class="day-select" id="daySelectInline" onchange="switchDay(this.value)">';
  appSettings.activeDays.forEach(day => {
    html += `<option value="${day}" ${currentDay === day ? "selected" : ""}>${day} · ${PROGRAM[day].weekday}</option>`;
  });
  html += '</select></div>';
  if (!appSettings.baseline.completed) {
    html += renderBaselinePrompt();
  }
  for (let exIdx = 0; exIdx < exData.length; exIdx++) {
    const ex = exData[exIdx];
    const progDef = programDefs[exIdx];
    const exLib = EXERCISE_LIBRARY[ex.name];
    const lastPerf = findLastPerformance(ex.name);
    const lastWeekPerf = findLastWeekPerformance(ex.name);

    html += `<div class="exercise-block">`;
    html += `<div class="exercise-title">`;
    html += `<span>${ex.name}</span>`;
    html += `<span class="exercise-meta">`;
    const repText = exLib && exLib.repMin ? exLib.repMin + '-' + exLib.repMax : 'max';
    const restSecs = exLib ? exLib.rest : 60;
    html += `<span>${progDef.sets} sets × ${repText} reps, ${restSecs}s rest</span>`;
    html += `<span class="set-controls">`;
    html += `<button class="set-btn" onclick="swapExercise(${exIdx})" title="Swap exercise">⇄</button>`;
    html += `<button class="set-btn" onclick="addSet(${exIdx})">+</button>`;
    html += `<button class="set-btn" onclick="deleteSet(${exIdx})" ${ex.sets.length <= 1 ? 'disabled' : ''}>−</button>`;
    html += `</span></span></div>`;

    const rec = getRecommendation(ex.name, 0, lastPerf);
    if (exLib && exLib.compound && rec && needsWarmup(ex.name, rec.w)) {
      const warmups = getWarmupSets(ex.name, rec.w);
      html += `<button class="warmup-btn" onclick="toggleWarmup(this)">${warmups.length} warm-up sets</button>`;
      html += `<div class="warmup-table" style="display:none;">`;
      html += `<div class="warmup-header"><div>#</div><div>LB</div><div>REPS</div><div></div></div>`;
      warmups.forEach((wu, idx) => {
        html += `<div class="warmup-row"><div>WU${idx + 1}</div><div>${wu.w}</div><div>${wu.r}</div><div></div></div>`;
      });
      html += `<div class="warmup-context">Based on your first working set: ${rec.w} lb ${rec.r} reps</div>`;
      html += `</div>`;
    }
    html += `</div>`;

    html += `<div class="sets-table">`;
    html += `<div class="set-header">`;
    html += `<div class="set-header-cell">#</div>`;
    html += `<div class="set-header-cell">LB</div>`;
    html += `<div class="set-header-cell">REPS</div>`;
    html += `<div class="set-header-cell">RIR</div>`;
    html += `<div class="set-header-cell" style="text-align: center;">✓</div>`;
    html += `</div>`;

    for (let setIdx = 0; setIdx < ex.sets.length; setIdx++) {
      const set = ex.sets[setIdx];
      const rec = getRecommendation(ex.name, setIdx, lastPerf);
      const lastWeekSet = lastWeekPerf && setIdx < lastWeekPerf.sets.length ? lastWeekPerf.sets[setIdx] : null;

      html += `<div class="set-row">`;
      html += `<div class="set-num">S${setIdx + 1}</div>`;

      const wPlaceholder = ex.type === 'bodyweight' ? (lastWeekSet && lastWeekSet.w !== null ? lastWeekSet.w : '0 (BW)') : (lastWeekSet && lastWeekSet.w !== null ? lastWeekSet.w : 'lbs');
      html += `<input
        class="input-field"
        type="text"
        inputmode="numeric"
        placeholder="${wPlaceholder}"
        value="${set.w !== null ? set.w : ''}"
        onblur="saveSet(${exIdx}, ${setIdx}, 'w', this.value)"
        onkeypress="return /[0-9]/.test(event.key)"
        data-ex="${exIdx}" data-set="${setIdx}" data-field="w"
        ${!workoutActive ? 'disabled' : ''}
      >`;

      const rPlaceholder = lastWeekSet && lastWeekSet.r !== null ? lastWeekSet.r : 'rep';
      html += `<input
        class="input-field"
        type="text"
        inputmode="numeric"
        placeholder="${rPlaceholder}"
        value="${set.r !== null ? set.r : ''}"
        onblur="saveSet(${exIdx}, ${setIdx}, 'r', this.value)"
        onkeypress="return /[0-9]/.test(event.key)"
        data-ex="${exIdx}" data-set="${setIdx}" data-field="r"
        ${!workoutActive ? 'disabled' : ''}
      >`;

      const rirPlaceholder = lastWeekSet && lastWeekSet.rir !== null ? lastWeekSet.rir : 'RIR';
      html += `<select
        class="input-field"
        onchange="saveSet(${exIdx}, ${setIdx}, 'rir', this.value)"
        data-ex="${exIdx}" data-set="${setIdx}" data-field="rir"
        ${!workoutActive ? 'disabled' : ''}
      >
        <option value="">${rirPlaceholder}</option>
        <option value="0" ${set.rir === 0 ? 'selected' : ''}>0</option>
        <option value="1" ${set.rir === 1 ? 'selected' : ''}>1</option>
        <option value="2" ${set.rir === 2 ? 'selected' : ''}>2</option>
        <option value="3" ${set.rir === 3 ? 'selected' : ''}>3</option>
        <option value="4" ${set.rir === 4 ? 'selected' : ''}>4</option>
        <option value="5" ${set.rir === 5 ? 'selected' : ''}>5+</option>
      </select>`;

      const hasReps = set.r !== null && set.r > 0;
      const hasWeight = ex.type === 'weighted' ? (set.w !== null && set.w > 0) : true;
      const canCheck = hasReps && hasWeight;
      const isPR = set.logged && checkIfPR(ex.name, set.w, set.r);
      const checkClass = isPR ? 'style="accent-color: #10b981;"' : '';
      html += `<input
        type="checkbox"
        class="checkbox"
        ${set.logged ? 'checked' : ''}
        ${canCheck && workoutActive ? '' : 'disabled'}
        onchange="toggleSetComplete(${exIdx}, ${setIdx}, this.checked)"
        ${checkClass}
      >`;
      html += `</div>`;

      const isFirstGlobal = firstUncompleted && firstUncompleted.exIdx === exIdx && firstUncompleted.setIdx === setIdx;
      if (workoutActive && rec && !set.logged && !set.recViewed && isFirstGlobal) {
        html += `<div class="set-rec-row" title="${rec.reason || ''}" onclick="applyRec(${exIdx}, ${setIdx}, ${rec.w !== null ? rec.w : 'null'}, ${rec.r}, ${rec.rir !== null ? rec.rir : 'null'})">`;
        html += `<div class="rec-val">→</div>`;
        html += `<div class="rec-val">${rec.w !== null ? rec.w : '0'}</div>`;
        html += `<div class="rec-val">${rec.r}</div>`;
        html += `<div class="rec-val">${rec.rir !== null ? rec.rir : ''}</div>`;
        html += `<div></div>`;
        html += `</div>`;
        html += `<div class="recommendation-reason">${rec.reason || 'Tap to apply recommendation'}</div>`;
      }
    }
    html += `</div>`;

    if (lastWeekPerf) {
      const lastDate = getLastWorkedDate(ex.name);
      html += `<div class="last-week-label">Last: ${lastDate || 'N/A'}</div>`;
      html += `<div class="last-week-table">`;
      html += `<div class="last-week-header">`;
      html += `<div class="set-header-cell">#</div>`;
      html += `<div class="set-header-cell">LB</div>`;
      html += `<div class="set-header-cell">REPS</div>`;
      html += `<div class="set-header-cell">RIR</div>`;
      html += `<div class="set-header-cell" style="text-align: center;">✓</div>`;
      html += `</div>`;

      for (let setIdx = 0; setIdx < lastWeekPerf.sets.length; setIdx++) {
        const set = lastWeekPerf.sets[setIdx];
        html += `<div class="last-week-row">`;
        html += `<div class="set-num">S${setIdx + 1}</div>`;
        html += `<div style="text-align: center;">${set.w !== null ? set.w : '−'}</div>`;
        html += `<div style="text-align: center;">${set.r !== null ? set.r : '−'}</div>`;
        html += `<div style="text-align: center;">${set.rir !== null ? set.rir : '−'}</div>`;
        html += `<div></div>`;
        html += `</div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
  }

  con.innerHTML = html;
}

function saveSet(exIdx, setIdx, field, value) {
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  const set = exData[exIdx].sets[setIdx];

  if (field === 'w') {
    const parsed = value ? parseInt(value) : null;
    set.w = parsed && parsed > 0 ? parsed : null;
  }
  if (field === 'r') {
    const parsed = value ? parseInt(value) : null;
    set.r = parsed && parsed > 0 ? parsed : null;
  }
  if (field === 'rir') set.rir = value ? parseFloat(value) : null;

  persistData();
  renderWorkoutPage();
}

function persistData() {
  try {
    localStorage.setItem('workoutData', JSON.stringify({
      schemaVersion: 2,
      workoutData,
      settings: appSettings,
      bodyWeight
    }));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

function loadData() {
  try {
    const stored = localStorage.getItem('workoutData');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.workoutData) {
        workoutData = parsed.workoutData;
        if (parsed.settings) appSettings = { ...appSettings, ...parsed.settings, baseline: { ...appSettings.baseline, ...(parsed.settings.baseline || {}) } };
        if (parsed.bodyWeight) bodyWeight = parsed.bodyWeight;
      } else {
        workoutData = parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
  }
}

function loadSettings() {
  try {
    const storedBW = localStorage.getItem('bodyWeight');
    if (storedBW) {
      bodyWeight = parseInt(storedBW);
    }
    const storedSettings = localStorage.getItem('appSettings');
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      appSettings = { ...appSettings, ...parsed, baseline: { ...appSettings.baseline, ...(parsed.baseline || {}) } };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

function saveAppSettings() {
  try {
    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    persistData();
  } catch (e) {
    console.error('Failed to save app settings:', e);
  }
}

function saveBodyWeight(val) {
  const parsed = parseInt(val);
  if (parsed && parsed > 0) {
    bodyWeight = parsed;
    try {
      localStorage.setItem('bodyWeight', bodyWeight.toString());
      persistData();
    } catch (e) {
      console.error('Failed to save body weight:', e);
    }
  }
}

function toggleSetComplete(exIdx, setIdx, isChecked) {
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  const set = exData[exIdx].sets[setIdx];
  const def = PROGRAM[currentDay].exercises[exIdx];

  if (!isChecked && set.logged) {
    if (!confirm('Undo this set? This will clear the rest timer.')) {
      renderWorkoutPage();
      return;
    }
  }

  set.logged = isChecked;
  if (!isChecked) {
    set.recViewed = false;
    clearInterval(timer.intervalId);
    timer.running = false;
    document.getElementById('timerDisplay').classList.remove('active');
    persistData();
    renderWorkoutPage();
    return;
  }

  persistData();

  if (isLastSetOfWorkout(exIdx, setIdx)) {
    clearInterval(timer.intervalId);
    timer.running = false;
    document.getElementById('timerDisplay').classList.remove('active');
    document.getElementById('endWorkoutModal').style.display = 'flex';
  } else if (isLastSetOfExercise(exIdx, setIdx)) {
    startTimer(REST_BETWEEN_EXERCISES);
    renderWorkoutPage();
  } else {
    startTimer(def.rest);
    renderWorkoutPage();
  }
}

function addSet(exIdx) {
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  exData[exIdx].sets.push({ w: null, r: null, rir: null, logged: false, recViewed: false });
  persistData();
  renderWorkoutPage();
}

function deleteSet(exIdx) {
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  if (exData[exIdx].sets.length > 1) {
    exData[exIdx].sets.pop();
    persistData();
    renderWorkoutPage();
  }
}

function applyRec(exIdx, setIdx, w, r, rir) {
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  const set = exData[exIdx].sets[setIdx];

  if (w !== null) set.w = w;
  set.r = r;
  if (rir !== null) set.rir = rir;
  set.recViewed = true;

  persistData();
  renderWorkoutPage();
}

function getLastWorkedDate(exName) {
  let latestDate = null;

  for (let key in workoutData) {
    const lastDashIdx = key.lastIndexOf('-');
    const dateStr = key.substring(0, lastDashIdx);
    if (!dateStr) continue;

    const dayExercises = workoutData[key];
    for (let ex of dayExercises) {
      if (ex.name === exName) {
        const completedSet = ex.sets.find(s => s.logged && s.r !== null && s.r > 0);
        if (completedSet) {
          if (!latestDate || dateStr > latestDate) {
            latestDate = dateStr;
          }
        }
      }
    }
  }

  if (latestDate) {
    return new Date(latestDate + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  }

  for (let s of SEED) {
    const ex = s.exercises.find(e => e.name === exName);
    if (ex) {
      return new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    }
  }

  return null;
}

function checkIfPR(exName, weight, reps) {
  if (weight === null || reps === null || reps <= 0) return false;
  const lastPerf = findLastPerformance(exName);
  if (!lastPerf) return true;
  for (let set of lastPerf.sets) {
    if (set.logged && set.r !== null && set.r > 0) {
      const lastW = set.w || 0;
      if (weight > lastW || (weight === lastW && reps > set.r)) {
        return true;
      }
    }
  }
  return weight > 0 && reps > 0;
}

function findLastPerformance(exName) {
  let latest = null;
  let latestDate = null;

  for (let key in workoutData) {
    const lastDashIdx = key.lastIndexOf('-');
    const dateStr = key.substring(0, lastDashIdx);
    if (!dateStr) continue;

    const dayExercises = workoutData[key];
    for (let ex of dayExercises) {
      if (ex.name === exName) {
        const completedSet = ex.sets.find(s => s.logged && s.r !== null && s.r > 0);
        if (completedSet) {
          if (!latestDate || dateStr > latestDate) {
            latestDate = dateStr;
            latest = ex;
          }
        }
      }
    }
  }

  if (latest) return latest;

  if (appSettings.baseline.completed) return null;

  for (let s of SEED) {
    const ex = s.exercises.find(e => e.name === exName);
    if (ex) return ex;
  }

  return null;
}

function findLastWeekPerformance(exName) {
  let latest = null;
  let latestDate = null;

  for (let key in workoutData) {
    const lastDashIdx = key.lastIndexOf('-');
    const dateStr = key.substring(0, lastDashIdx);
    if (!dateStr) continue;

    const dayExercises = workoutData[key];
    for (let ex of dayExercises) {
      if (ex.name === exName) {
        const completedSet = ex.sets.find(s => s.logged && s.r !== null && s.r > 0);
        if (completedSet) {
          if (!latestDate || dateStr > latestDate) {
            latestDate = dateStr;
            latest = ex;
          }
        }
      }
    }
  }

  if (latest) return latest;

  for (let s of SEED) {
    const ex = s.exercises.find(e => e.name === exName);
    if (ex) return ex;
  }

  return null;
}

function getRecommendation(exName, setIdx, lastPerf) {
  const exLib = EXERCISE_LIBRARY[exName];
  if (!exLib) return null;
  if (!lastPerf) return getBaselineRecommendation(exName);

  const prevSetIdx = setIdx - 1;
  const completedSets = lastPerf.sets.filter(set => set.logged && set.r !== null && set.r > 0);
  const ls = completedSets.length ? completedSets[Math.min(setIdx, completedSets.length - 1)] : null;

  if (!ls || ls.r === null) return null;

  const rir = ls.rir !== null ? ls.rir : 0;

  if (exLib.type === 'bodyweight') {
    const max = 15;
    if (rir < 1) {
      return { w: null, r: ls.r, rir: 0, reason: 'Repeat the last reps and leave at least 1 rep in reserve.' };
    }
    if (rir < 2) {
      return { w: null, r: ls.r, rir: 1, reason: 'Repeat the last reps while keeping the effort controlled.' };
    }
    if (ls.r >= max) {
      return { w: null, r: ls.r + 1, rir: 1, reason: 'You reached the top of the rep range; add one rep.' };
    }
    if (rir < 4) {
      return { w: null, r: ls.r + 1, rir: 1, reason: 'Add one rep before increasing load.' };
    }
    return { w: null, r: Math.min(ls.r + 2, max), rir: 1, reason: 'You had plenty in reserve; add reps next time.' };
  }

  const min = exLib.repMin || 8;
  const max = exLib.repMax || 12;
  const incr = exLib.weightIncrement || 5;

  if (rir < 1) {
    return { w: ls.w, r: Math.max(min, ls.r), rir: 0, reason: 'Hold the load steady and avoid repeating a failed set.' };
  }
  if (rir < 2) {
    return { w: ls.w, r: Math.max(min, ls.r), rir: 1, reason: 'Repeat this load until the reps feel more controlled.' };
  }

  if (ls.r >= max) {
    return { w: ls.w + incr, r: min, rir: 1, reason: `You completed the top of the range; add ${incr} ${appSettings.unit}.` };
  }

  if (rir < 4) {
    return { w: ls.w, r: Math.min(ls.r + 1, max), rir: 1, reason: 'Add one rep before increasing load.' };
  }

  return { w: ls.w, r: Math.min(ls.r + 2, max), rir: 1, reason: 'You had plenty in reserve; add reps before load.' };
}

function getBaselineRecommendation(exName) {
  if (!appSettings.baseline.completed) return null;
  const exLib = EXERCISE_LIBRARY[exName];
  if (!exLib) return null;
  const upperRatios = {
    'Barbell Bench Press': 1,
    'Bent-Over Rows': 0.75,
    'Dumbbell Bench Press': 0.43,
    'Incline Dumbbell Press': 0.3,
    'Dumbbell Shoulder Press': 0.25,
    'Dumbbell Curls': 0.17,
    'Lateral Raises': 0.1
  };
  const lowerRatios = {
    'Reverse Lunges (DB)': 1,
    'Bulgarian Split Squat (DB)': 1,
    'Hip Thrusts': 4,
    'Seated Leg Curls': 4,
    'Calf Raises': 5
  };
  const anchor = ['Upper A', 'Upper B'].some(day => PROGRAM[day].exercises.some(ex => ex.name === exName))
    ? appSettings.baseline.bench
    : appSettings.baseline.lunge;
  const ratio = upperRatios[exName] || lowerRatios[exName];
  const min = exLib.repMin || 8;
  const weight = exLib.type === 'bodyweight' ? null : roundToIncrement(anchor.weight * (ratio || 0.5), exLib.weightIncrement || 5);
  return {
    w: weight,
    r: min,
    rir: 2,
    reason: `Week 0 estimate from your ${anchor.weight} ${appSettings.unit} baseline. Adjust it after your first set.`
  };
}

function roundToIncrement(value, increment) {
  return Math.max(increment, Math.round(value / increment) * increment);
}

function startTimer(sec) {
  clearInterval(timer.intervalId);
  timer.remaining = sec;
  timer.running = true;
  const td = document.getElementById('timerDisplay');
  td.classList.add('active');
  updateTimerDisplay();
  timer.intervalId = setInterval(() => {
    timer.remaining--;
    updateTimerDisplay();
    if (timer.remaining <= 0) {
      clearInterval(timer.intervalId);
      timer.running = false;
      td.classList.remove('active');
      playTimerAlert();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(timer.remaining / 60);
  const s = timer.remaining % 60;
  document.getElementById('timerTime').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function playTimerAlert() {
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.setValueAtTime(600, now + 0.15);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.setValueAtTime(0, now + 0.3);
  osc.start(now);
  osc.stop(now + 0.3);
}

function toggleTimer() {
  if (timer.running) {
    clearInterval(timer.intervalId);
    timer.running = false;
  } else {
    timer.running = true;
    timer.intervalId = setInterval(() => {
      timer.remaining--;
      updateTimerDisplay();
      if (timer.remaining <= 0) {
        clearInterval(timer.intervalId);
        timer.running = false;
        document.getElementById('timerDisplay').classList.remove('active');
      }
    }, 1000);
  }
}

function skipTimer() {
  clearInterval(timer.intervalId);
  timer.running = false;
  const td = document.getElementById('timerDisplay');
  td.classList.remove('active');
}

let progressPrefs = {
  streak: true, stats: true, prCards: true, curves: true,
  oneRM: true, muscleGroup: true, volumeTrend: true, sessions: true,
  weekly: true, volumeByType: true
};

function loadProgressPrefs() {
  try {
    const saved = localStorage.getItem('progressPrefs');
    if (saved) progressPrefs = JSON.parse(saved);
  } catch (e) {}
}

function saveProgressPrefs() {
  try {
    localStorage.setItem('progressPrefs', JSON.stringify(progressPrefs));
  } catch (e) {}
}

function renderProgressPage() {
  const content = document.getElementById('progressPage');
  loadProgressPrefs();
  let html = '';

  html += `<div style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #2a2a2a; display: flex; gap: 8px; flex-wrap: wrap;">`;
  html += `<button class="start-btn" onclick="toggleProgressCustomize()" style="background: #2a2a2a; color: #888;">⚙️ Customize</button>`;
  html += `</div>`;

  html += `<div id="progressView">`;
  if (progressPrefs.streak) html += renderStreakCard();
  if (progressPrefs.stats) html += renderStatsGrid();
  if (progressPrefs.prCards) html += renderPRCards();
  if (progressPrefs.curves) html += renderExerciseCurves();
  if (progressPrefs.oneRM) html += renderEstimated1RM();
  if (progressPrefs.muscleGroup) html += renderMuscleGroupDist();
  if (progressPrefs.volumeTrend) {
    const volumeTrend = getVolumeTrend();
    html += `<div style="margin-bottom: 16px; padding: 12px; background: #0d0d0d; border-radius: 4px; border: 1px solid #2a2a2a;"><h3 style="color: #fff; font-size: 13px; margin: 0 0 8px 0;">Total Volume Trend</h3>` + renderVolumeTrend(volumeTrend) + `</div>`;
  }
  if (progressPrefs.sessions) {
    const sessions = getRecentSessions();
    html += `<div style="margin-bottom: 16px; padding: 12px; background: #0d0d0d; border-radius: 4px; border: 1px solid #2a2a2a;"><h3 style="color: #fff; font-size: 13px; margin: 0 0 8px 0;">Latest Sessions</h3>` + renderSessions(sessions) + `</div>`;
  }
  if (progressPrefs.weekly) {
    const weekly = getWeeklySummary();
    html += `<div style="margin-bottom: 16px; padding: 12px; background: #0d0d0d; border-radius: 4px; border: 1px solid #2a2a2a;"><h3 style="color: #fff; font-size: 13px; margin: 0 0 8px 0;">Weekly Summary</h3>` + renderWeeklySummary(weekly) + `</div>`;
  }
  if (progressPrefs.volumeByType) {
    const volumeByType = getVolumeByType();
    html += `<div style="margin-bottom: 16px; padding: 12px; background: #0d0d0d; border-radius: 4px; border: 1px solid #2a2a2a;"><h3 style="color: #fff; font-size: 13px; margin: 0 0 8px 0;">Volume by Workout Type</h3>` + renderVolumeByType(volumeByType) + `</div>`;
  }
  html += `</div>`;

  html += `<div id="progressCustomize" style="display: none;">`;
  html += `<div style="margin-bottom: 16px; padding: 12px; background: #111; border-radius: 4px; border: 1px solid #2a2a2a;">`;
  html += `<h3 style="color: #fff; font-size: 13px; margin: 0 0 12px 0;">Choose what to display:</h3>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.streak ? 'checked' : ''} onchange="togglePref('streak'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Workout Streak</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.stats ? 'checked' : ''} onchange="togglePref('stats'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Stats Grid</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.prCards ? 'checked' : ''} onchange="togglePref('prCards'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Personal Record Cards</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.curves ? 'checked' : ''} onchange="togglePref('curves'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Exercise Progression Curves</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.oneRM ? 'checked' : ''} onchange="togglePref('oneRM'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Estimated 1RM</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.muscleGroup ? 'checked' : ''} onchange="togglePref('muscleGroup'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Muscle Group Distribution</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.volumeTrend ? 'checked' : ''} onchange="togglePref('volumeTrend'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Total Volume Trend</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.sessions ? 'checked' : ''} onchange="togglePref('sessions'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Latest Sessions</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;"><input type="checkbox" ${progressPrefs.weekly ? 'checked' : ''} onchange="togglePref('weekly'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Weekly Summary</span></label>`;
  html += `<label style="display: flex; align-items: center; gap: 8px; margin-bottom: 0; cursor: pointer;"><input type="checkbox" ${progressPrefs.volumeByType ? 'checked' : ''} onchange="togglePref('volumeByType'); renderProgressPage();"> <span style="color: #e0e0e0; font-size: 12px;">Volume by Workout Type</span></label>`;
  html += `</div>`;
  html += `</div>`;

  content.innerHTML = html;
}

function toggleProgressCustomize() {
  const view = document.getElementById('progressView');
  const customize = document.getElementById('progressCustomize');
  if (view.style.display === 'none') {
    view.style.display = 'block';
    customize.style.display = 'none';
  } else {
    view.style.display = 'none';
    customize.style.display = 'block';
  }
}

function togglePref(key) {
  progressPrefs[key] = !progressPrefs[key];
  saveProgressPrefs();
}

function renderHistoryPage() {
  const con = document.getElementById('historyPage');
  const sessions = getRecentSessions(50);
  let html = `<div class="page-heading"><h2>Workout history</h2><span>${sessions.length} saved sessions</span></div>`;
  if (sessions.length === 0) {
    html += `<div class="empty-state">Finish your first workout and it will appear here.</div>`;
  } else {
    html += `<div class="history-list">`;
    sessions.forEach(session => {
      html += `<div class="history-card">
        <div><strong>${session.dayName}</strong><span>${fmtDate(session.dateStr)}</span></div>
        <div class="history-stats"><span>${session.completedSets} sets</span><span>${Math.round(session.volume).toLocaleString()} ${appSettings.unit}</span><span>${session.reps} reps</span></div>
      </div>`;
    });
    html += `</div>`;
  }
  con.innerHTML = html;
}

function renderSettingsPage() {
  const con = document.getElementById('settingsPage');
  let html = '';

  html += `<div class="settings-card">
    <h3>Week 0 strength baseline</h3>
    <p class="settings-help">Enter a recent hard set. The app estimates a starting load for every exercise, then replaces estimates as you log real sets.</p>
    ${renderBaselineFields()}
    <button class="modal-btn save" onclick="saveBaseline()">Save baseline</button>
  </div>`;

  html += `<div class="settings-card">
    <h3>Weekly schedule</h3>
    <p class="settings-help">Choose the sessions you want available. Your completed history is never changed.</p>
    <div class="schedule-grid">${DAY_ORDER.map(day => `<label><input type="checkbox" ${appSettings.activeDays.includes(day) ? 'checked' : ''} onchange="toggleActiveDay('${day}', this.checked)"> ${day}<small>${PROGRAM[day].weekday}</small></label>`).join('')}</div>
  </div>`;

  html += `<div style="margin-bottom: 16px; padding: 12px; background: #111; border-radius: 4px; border: 1px solid #2a2a2a;">`;
  html += `<h3 style="color: #fff; font-size: 13px; margin: 0 0 12px 0;">Body Weight</h3>`;
  html += `<div class="settings-row" style="margin: 0;">`;
  html += `<label>Current:</label>`;
  html += `<input type="number" value="${bodyWeight}" onblur="saveBodyWeight(this.value)" />`;
  html += `<span>lbs</span>`;
  html += `</div>`;
  html += `</div>`;

  html += `<div style="margin-bottom: 16px; padding: 12px; background: #111; border-radius: 4px; border: 1px solid #2a2a2a;">`;
  html += `<h3 style="color: #fff; font-size: 13px; margin: 0 0 12px 0;">Backup & Restore</h3>`;
  html += `<div style="display: flex; gap: 8px; flex-wrap: wrap;">`;
  html += `<button class="modal-btn save" onclick="exportWorkoutData()" style="flex: 1; min-width: 120px;">Export as JSON</button>`;
  html += `<button class="modal-btn" onclick="triggerImportFile()" style="flex: 1; min-width: 120px;">Import from File</button>`;
  html += `<input type="file" id="importFileInput" accept=".json,.csv" style="display: none;" onchange="importWorkoutData(event)" />`;
  html += `</div>`;
  html += `</div>`;

  con.innerHTML = html;
}

function renderBaselinePrompt() {
  return `<div class="baseline-prompt">
    <div><strong>Set up Week 0</strong><span>Tell us two recent lifts to unlock starting recommendations.</span></div>
    <button class="modal-btn save" onclick="showPage('settings', document.querySelector('.nav-tab:nth-child(4)'))">Set baseline</button>
  </div>`;
}

function renderBaselineFields() {
  const bench = appSettings.baseline.bench;
  const lunge = appSettings.baseline.lunge;
  return `<div class="baseline-grid">
    <label>Bench press (${appSettings.unit})<input id="baselineBenchWeight" type="number" min="0" value="${bench.weight || ''}" placeholder="175"></label>
    <label>Reps<input id="baselineBenchReps" type="number" min="1" value="${bench.reps || ''}" placeholder="6"></label>
    <label>Reverse lunge / dumbbell (${appSettings.unit})<input id="baselineLungeWeight" type="number" min="0" value="${lunge.weight || ''}" placeholder="25"></label>
    <label>Reps<input id="baselineLungeReps" type="number" min="1" value="${lunge.reps || ''}" placeholder="8"></label>
  </div>`;
}

function saveBaseline() {
  const benchWeight = Number(document.getElementById('baselineBenchWeight').value);
  const benchReps = Number(document.getElementById('baselineBenchReps').value);
  const lungeWeight = Number(document.getElementById('baselineLungeWeight').value);
  const lungeReps = Number(document.getElementById('baselineLungeReps').value);
  if (!benchWeight || !benchReps || !lungeWeight || !lungeReps) {
    alert('Enter a weight and reps for both baseline lifts.');
    return;
  }
  appSettings.baseline = {
    completed: true,
    recordedAt: todayISO(),
    bench: { weight: benchWeight, reps: benchReps, rir: 2 },
    lunge: { weight: lungeWeight, reps: lungeReps, rir: 2 }
  };
  saveAppSettings();
  renderSettingsPage();
  renderWorkoutPage();
}

function toggleActiveDay(day, enabled) {
  if (enabled && !appSettings.activeDays.includes(day)) {
    appSettings.activeDays.push(day);
  } else if (!enabled && appSettings.activeDays.length > 1) {
    appSettings.activeDays = appSettings.activeDays.filter(activeDay => activeDay !== day);
  } else if (!enabled) {
    renderSettingsPage();
    return;
  }
  appSettings.activeDays = DAY_ORDER.filter(programDay => appSettings.activeDays.includes(programDay));
  ensureCurrentDayIsAvailable();
  saveAppSettings();
  renderSettingsPage();
  renderWorkoutPage();
}

function exportWorkoutData() {
  const backup = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    bodyWeight,
    settings: appSettings,
    workoutData
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `workout-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function triggerImportFile() {
  document.getElementById('importFileInput').click();
}

function importWorkoutData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      if (backup.workoutData) {
        workoutData = backup.workoutData;
        if (backup.bodyWeight) bodyWeight = backup.bodyWeight;
        if (backup.settings) appSettings = { ...appSettings, ...backup.settings, baseline: { ...appSettings.baseline, ...(backup.settings.baseline || {}) } };
        persistData();
        saveAppSettings();
        loadSettings();
        loadWorkout();
        renderWorkoutPage();
        alert('Workout data imported successfully!');
      } else {
        alert('Invalid backup file format');
      }
    } catch (err) {
      alert('Error reading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function getVolumeTrend() {
  const volumeByDate = {};
  for (let key in workoutData) {
    const lastDashIdx = key.lastIndexOf('-');
    const dateStr = key.substring(0, lastDashIdx);
    if (!dateStr) continue;
    const dayExercises = workoutData[key];
    let dayVolume = 0;
    for (let ex of dayExercises) {
      for (let set of ex.sets) {
        if (set.logged && set.r && set.r > 0) {
          const w = set.w || 0;
          dayVolume += w * set.r;
        }
      }
    }
    if (dayVolume > 0) volumeByDate[dateStr] = dayVolume;
  }
  return Object.entries(volumeByDate).sort((a, b) => a[0].localeCompare(b[0]));
}

function renderVolumeTrend(trend) {
  if (trend.length === 0) return `<div style="color: #666; font-size: 12px;">No data yet</div>`;
  const max = Math.max(...trend.map(t => t[1]));
  let html = `<div style="display: flex; gap: 3px; height: 80px; align-items: flex-end; padding: 8px; background: #111; border-radius: 3px;">`;
  for (let [date, vol] of trend) {
    const h = (vol / max * 100);
    html += `<div style="flex: 1; background: #2563eb; height: ${h}%; min-height: 2px; border-radius: 1px;" title="${date}: ${Math.round(vol)} volume"></div>`;
  }
  html += `</div>`;
  return html;
}

function getBestLifts() {
  const bestByEx = {};
  for (let key in workoutData) {
    const lastDashIdx = key.lastIndexOf('-');
    const dateStr = key.substring(0, lastDashIdx);
    const dayExercises = workoutData[key];
    for (let ex of dayExercises) {
      if (!bestByEx[ex.name]) bestByEx[ex.name] = { weight: 0, reps: 0, date: null };
      for (let set of ex.sets) {
        if (set.logged && set.r && set.r > 0) {
          const w = set.w || 0;
          if (w > bestByEx[ex.name].weight || (w === bestByEx[ex.name].weight && set.r > bestByEx[ex.name].reps)) {
            bestByEx[ex.name] = { weight: w, reps: set.r, date: dateStr };
          }
        }
      }
    }
  }
  for (let s of SEED) {
    for (let ex of s.exercises) {
      if (!bestByEx[ex.name]) bestByEx[ex.name] = { weight: 0, reps: 0, date: s.date };
      const set = ex.sets[0];
      if (set && set.r) {
        const w = set.w || 0;
        if (w > bestByEx[ex.name].weight || (w === bestByEx[ex.name].weight && set.r > bestByEx[ex.name].reps)) {
          bestByEx[ex.name] = { weight: w, reps: set.r, date: s.date };
        }
      }
    }
  }
  return Object.entries(bestByEx).sort((a, b) => (b[1].weight * b[1].reps) - (a[1].weight * a[1].reps)).slice(0, 5);
}

function getVolumeByType() {
  const volByType = { 'Upper A': 0, 'Upper B': 0, 'Lower A': 0, 'Lower B': 0 };
  const countByType = { 'Upper A': 0, 'Upper B': 0, 'Lower A': 0, 'Lower B': 0 };

  for (let key in workoutData) {
    const lastDashIdx = key.lastIndexOf('-');
    const dayName = key.substring(lastDashIdx + 1);
    const dayExercises = workoutData[key];
    for (let ex of dayExercises) {
      for (let set of ex.sets) {
        if (set.logged && set.r && set.r > 0) {
          volByType[dayName] = (volByType[dayName] || 0) + (set.w || 0) * set.r;
          countByType[dayName] = (countByType[dayName] || 0) + 1;
        }
      }
    }
  }
  return { volByType, countByType };
}

function renderVolumeByType(data) {
  const max = Math.max(...Object.values(data.volByType));
  let html = `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 11px;">`;
  for (let type of ['Upper A', 'Upper B', 'Lower A', 'Lower B']) {
    const vol = data.volByType[type] || 0;
    const h = max > 0 ? (vol / max * 100) : 0;
    html += `<div style="text-align: center;">`;
    html += `<div style="height: 60px; background: #1a1a1a; border-radius: 3px; margin-bottom: 6px; display: flex; align-items: flex-end; justify-content: center;"><div style="width: 60%; height: ${h}%; background: #10b981; border-radius: 2px;"></div></div>`;
    html += `<div style="color: #999;">${type}</div>`;
    html += `<div style="color: #60a5fa; font-weight: 600;">${Math.round(vol)}</div>`;
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function getRecentSessions(limit = 5) {
  const sessions = [];
  for (let key in workoutData) {
    const lastDashIdx = key.lastIndexOf('-');
    const dateStr = key.substring(0, lastDashIdx);
    const dayName = key.substring(lastDashIdx + 1);
    const dayExercises = workoutData[key];
    let sessionVol = 0, reps = 0, maxW = 0, completedSets = 0;
    for (let ex of dayExercises) {
      for (let set of ex.sets) {
        if (set.logged && set.r && set.r > 0) {
          sessionVol += (set.w || 0) * set.r;
          reps += set.r;
          maxW = Math.max(maxW, set.w || 0);
          completedSets++;
        }
      }
    }
    if (sessionVol > 0) sessions.push({ dateStr, dayName, volume: sessionVol, reps, maxWeight: maxW, completedSets });
  }
  return sessions.sort((a, b) => b.dateStr.localeCompare(a.dateStr)).slice(0, limit);
}

function renderSessions(sessions) {
  if (sessions.length === 0) return `<div style="color: #666; font-size: 12px;">No sessions yet</div>`;
  let html = `<div style="font-size: 12px;">`;
  for (let s of sessions) {
    html += `<div style="margin: 6px 0; padding: 8px; background: #1a1a1a; border-radius: 3px; display: flex; justify-content: space-between; align-items: center;">`;
    html += `<div><strong>${s.dayName}</strong> • ${s.dateStr}</div>`;
    html += `<div style="color: #999;">Vol: <span style="color: #60a5fa;">${Math.round(s.volume)}</span> • ${s.reps} reps • Max: <span style="color: #10b981;">${s.maxWeight} lbs</span></div>`;
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function getWorkoutStreak() {
  const dates = Object.keys(workoutData).map(key => key.substring(0, key.lastIndexOf('-'))).filter((v, i, a) => a.indexOf(v) === i);
  if (dates.length === 0) return { streak: 0, lastDate: null };
  dates.sort((a, b) => b.localeCompare(a));
  let streak = 0, current = new Date(todayISO());
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(current);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.getFullYear() + '-' + String(checkDate.getMonth() + 1).padStart(2, '0') + '-' + String(checkDate.getDate()).padStart(2, '0');
    if (dates.includes(dateStr)) streak++;
    else if (streak > 0) break;
  }
  return { streak, lastDate: dates[0] };
}

function renderStreakCard() {
  const { streak } = getWorkoutStreak();
  return `<div style="margin-bottom: 16px; padding: 20px; background: linear-gradient(135deg, #2563eb, #1e40af); border-radius: 8px; text-align: center;">
    <div style="font-size: 44px; font-weight: 700; color: #fff; line-height: 1;">${streak}</div>
    <div style="font-size: 12px; color: #ccc; margin-top: 6px;">Days in a Row 🔥</div>
  </div>`;
}

function getStatsData() {
  let totalSessions = 0, totalVolume = 0, totalReps = 0;
  for (let key in workoutData) {
    const dayExercises = workoutData[key];
    let dayHasData = false;
    for (let ex of dayExercises) {
      for (let set of ex.sets) {
        if (set.logged && set.r && set.r > 0) {
          totalVolume += (set.w || 0) * set.r;
          totalReps += set.r;
          dayHasData = true;
        }
      }
    }
    if (dayHasData) totalSessions++;
  }
  for (let s of SEED) {
    let dayHasData = false;
    for (let ex of s.exercises) {
      for (let set of ex.sets) {
        if (set.r && set.r > 0) {
          totalVolume += (set.w || 0) * set.r;
          totalReps += set.r;
          dayHasData = true;
        }
      }
    }
    if (dayHasData) totalSessions++;
  }
  return { sessions: totalSessions, volume: totalVolume, reps: totalReps };
}

function renderStatsGrid() {
  const { sessions, volume, reps } = getStatsData();
  return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; margin-bottom: 16px;">
    <div style="padding: 12px; background: #0d0d0d; border-radius: 4px; text-align: center; border: 1px solid #2a2a2a;">
      <div style="font-size: 20px; font-weight: 700; color: #2563eb;">${sessions}</div>
      <div style="font-size: 10px; color: #888; margin-top: 4px;">Sessions</div>
    </div>
    <div style="padding: 12px; background: #0d0d0d; border-radius: 4px; text-align: center; border: 1px solid #2a2a2a;">
      <div style="font-size: 20px; font-weight: 700; color: #10b981;">${(volume / 1000).toFixed(1)}K</div>
      <div style="font-size: 10px; color: #888; margin-top: 4px;">Total Vol</div>
    </div>
    <div style="padding: 12px; background: #0d0d0d; border-radius: 4px; text-align: center; border: 1px solid #2a2a2a;">
      <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">${reps}</div>
      <div style="font-size: 10px; color: #888; margin-top: 4px;">Reps Total</div>
    </div>
  </div>`;
}

function renderPRCards() {
  const bestLifts = getBestLifts().slice(0, 3);
  if (bestLifts.length === 0) return `<div style="margin-bottom: 16px; color: #666; font-size: 12px;">No PRs yet</div>`;
  let html = `<div style="margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;">`;
  for (let [name, data] of bestLifts) {
    html += `<div style="padding: 12px; background: #1a2a1a; border-left: 3px solid #10b981; border-radius: 4px;">
      <div style="font-size: 11px; color: #888; margin-bottom: 4px;">${name}</div>
      <div style="font-size: 18px; font-weight: 700; color: #10b981;">${data.weight || 'BW'}</div>
      <div style="font-size: 11px; color: #666; margin-top: 4px;">× ${data.reps}</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function renderExerciseCurves() {
  const exerciseData = {};
  for (let key in workoutData) {
    const dateStr = key.substring(0, key.lastIndexOf('-'));
    const dayExercises = workoutData[key];
    for (let ex of dayExercises) {
      if (!exerciseData[ex.name]) exerciseData[ex.name] = [];
      const maxSet = ex.sets.reduce((max, s) => !max || (s.logged && s.w > (max.w || 0)) ? s : max, null);
      if (maxSet && maxSet.logged) exerciseData[ex.name].push({ date: dateStr, w: maxSet.w || 0, r: maxSet.r });
    }
  }
  for (let s of SEED) {
    for (let ex of s.exercises) {
      if (!exerciseData[ex.name]) exerciseData[ex.name] = [];
      const maxSet = ex.sets[0];
      if (maxSet && maxSet.r) exerciseData[ex.name].push({ date: s.date, w: maxSet.w || 0, r: maxSet.r });
    }
  }

  let html = `<div style="margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px;">`;
  for (let [name, points] of Object.entries(exerciseData).slice(0, 4)) {
    const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
    const trend = sorted.length > 1 ? (sorted[sorted.length - 1].w - sorted[0].w) : 0;
    const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
    const trendColor = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#888';
    html += `<div style="padding: 10px; background: #0d0d0d; border-radius: 4px; border: 1px solid #2a2a2a;">
      <div style="font-size: 11px; color: #888; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
      <svg viewBox="0 0 80 30" style="width: 100%; height: 30px;">
        ${sorted.map((p, i) => {
          const x = (i / (sorted.length - 1 || 1)) * 70 + 5;
          const maxW = Math.max(...sorted.map(s => s.w), 1);
          const y = 25 - (p.w / maxW) * 20;
          return `<circle cx="${x}" cy="${y}" r="2" fill="#2563eb" />`;
        }).join('')}
      </svg>
      <div style="font-size: 12px; font-weight: 600; color: #60a5fa; margin-top: 4px;">${sorted[sorted.length - 1]?.w || 0} lbs</div>
      <div style="font-size: 10px; color: ${trendColor}; margin-top: 2px;">${trendIcon} ${Math.abs(trend).toFixed(1)} lbs</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function estimateOneRM(weight, reps) {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function renderEstimated1RM() {
  const bestLifts = getBestLifts().slice(0, 3);
  if (bestLifts.length === 0) return `<div style="margin-bottom: 16px; color: #666; font-size: 12px;">No lifts logged yet</div>`;
  let html = `<div style="margin-bottom: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px;">`;
  for (let [name, data] of bestLifts) {
    const oneRM = estimateOneRM(data.weight, data.reps);
    html += `<div style="padding: 10px; background: #1a1a2a; border-radius: 4px; border: 1px solid #2a2a4a;">
      <div style="font-size: 10px; color: #666; margin-bottom: 4px;">Est. 1RM</div>
      <div style="font-size: 16px; font-weight: 700; color: #60a5fa;">${oneRM}</div>
      <div style="font-size: 10px; color: #888; margin-top: 3px;">${name}</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function getMuscleGroupStats() {
  const stats = {};
  for (let exName in EXERCISE_LIBRARY) {
    const ex = externalExercises.find(e => e.name.toLowerCase() === exName.toLowerCase());
    if (!ex || !ex.primaryMuscles) continue;
    const muscle = ex.primaryMuscles[0];
    if (!stats[muscle]) stats[muscle] = 0;
    for (let key in workoutData) {
      const dayEx = workoutData[key].find(e => e.name === exName);
      if (dayEx) {
        for (let set of dayEx.sets) {
          if (set.logged && set.r && set.r > 0) stats[muscle] += (set.w || 0) * set.r;
        }
      }
    }
  }
  return Object.entries(stats).sort((a, b) => b[1] - a[1]);
}

function renderMuscleGroupDist() {
  const muscleData = getMuscleGroupStats();
  if (muscleData.length === 0) return `<div style="margin-bottom: 16px; color: #666; font-size: 12px;">No muscle group data</div>`;
  const total = muscleData.reduce((sum, [_, vol]) => sum + vol, 0);
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
  let html = `<div style="margin-bottom: 16px; padding: 12px; background: #0d0d0d; border-radius: 4px; border: 1px solid #2a2a2a;">`;
  html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 11px; margin-bottom: 12px;">`;
  for (let i = 0; i < muscleData.length; i++) {
    const [muscle, vol] = muscleData[i];
    const pct = ((vol / total) * 100).toFixed(0);
    html += `<div style="display: flex; align-items: center; gap: 6px;">
      <div style="width: 10px; height: 10px; background: ${colors[i % colors.length]}; border-radius: 2px;"></div>
      <span>${muscle}: <span style="color: #60a5fa; font-weight: 600;">${pct}%</span></span>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function getWeeklySummary() {
  const weeks = {};
  for (let key in workoutData) {
    const date = new Date(key.substring(0, key.lastIndexOf('-')) + 'T00:00:00');
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weeks[weekKey]) weeks[weekKey] = { volume: 0, sessions: 0, reps: 0 };
    let hasData = false;
    const dayEx = workoutData[key];
    for (let ex of dayEx) {
      for (let set of ex.sets) {
        if (set.logged && set.r && set.r > 0) {
          weeks[weekKey].volume += (set.w || 0) * set.r;
          weeks[weekKey].reps += set.r;
          hasData = true;
        }
      }
    }
    if (hasData) weeks[weekKey].sessions++;
  }
  return Object.entries(weeks).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 4);
}

function renderWeeklySummary(weeks) {
  if (weeks.length === 0) return `<div style="color: #666; font-size: 12px;">No weekly data</div>`;
  let html = `<div style="display: grid; gap: 8px;">`;
  for (let [week, data] of weeks) {
    const date = new Date(week + 'T00:00:00');
    const label = `Week of ${(date.getMonth() + 1)}/${date.getDate()}`;
    html += `<div style="padding: 10px; background: #111; border-radius: 3px; display: flex; justify-content: space-between;">
      <div style="font-size: 12px; color: #e0e0e0;">${label}</div>
      <div style="font-size: 11px; color: #999;">Vol: <span style="color: #60a5fa;">${(data.volume/1000).toFixed(1)}K</span> • ${data.sessions} sessions</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

let swapExerciseIndex = null;

function swapExercise(exIdx) {
  swapExerciseIndex = exIdx;
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  const currentName = exData[exIdx].name;
  const alternatives = getExerciseAlternatives(currentName);

  let html = `<p style="color: #999; margin-bottom: 16px;">Current: <strong>${currentName}</strong></p>`;

  if (alternatives.length === 0) {
    html += `<p style="color: #666;">No alternatives found in database for this exercise.</p>`;
  } else {
    html += `<p style="color: #999; margin-bottom: 12px;">Select an alternative that targets the same muscle group:</p>`;
    html += `<div style="display: grid; gap: 8px;">`;
    alternatives.forEach(alt => {
      html += `<button class="modal-btn" onclick="performExerciseSwap('${alt}')" style="text-align: left; background: #0d0d0d; border: 1px solid #2a2a2a;">`;
      html += `${alt}`;
      html += `</button>`;
    });
    html += `</div>`;
  }

  document.getElementById('swapExerciseContent').innerHTML = html;
  document.getElementById('swapExerciseModal').style.display = 'flex';
}

function closeSwapModal() {
  document.getElementById('swapExerciseModal').style.display = 'none';
  swapExerciseIndex = null;
}

function performExerciseSwap(newExerciseName) {
  if (swapExerciseIndex === null) return;
  const exData = workoutData[`${todayISO()}-${currentDay}`];
  exData[swapExerciseIndex].name = newExerciseName;
  persistData();
  closeSwapModal();
  renderWorkoutPage();
}

init();
