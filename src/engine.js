// Training logic. Pure functions only: no DOM, no storage.
//
// Model: every logged set is turned into an RIR-adjusted estimated 1RM
// (Epley on reps + reps-in-reserve). Next session's load is the heaviest
// increment that still lets you hit the target reps at the target RIR, with
// classic double progression (fill the rep range, then add load).
import { clamp, roundTo, daysBetween, addDays, startOfWeek } from './util.js';
import { groupOf } from './defaults.js';

const REP_CAP = 15; // e1RM is unreliable beyond ~15 total reps

export function e1rm(w, reps, rir = 0) {
  const r = Math.min(REP_CAP, reps + Math.max(0, rir ?? 0));
  return r <= 1 ? w : w * (1 + r / 30);
}
export function loadForReps(e, reps, rir) {
  const r = reps + rir;
  return r <= 1 ? e : e / (1 + r / 30);
}
// total reps (including reserve) possible at a load
export function repsAtLoad(e, w) {
  return w <= 0 ? Infinity : Math.max(0, 30 * (e / w - 1));
}

/* ---------- periodization ---------- */

export function planFor(settings, dateISO) {
  const plan = { goal: settings.goal, phase: 'Build', label: '', week: 1, weeks: 1, rir: 2, volMult: 1, isDeload: false, ramp: 0, mainRange: null, restBonus: 0, note: '' };

  if (settings.goal === 'peaking' && settings.peakDate) {
    const days = daysBetween(dateISO, settings.peakDate);
    if (days >= 0) {
      Object.assign(plan, { weeks: Math.floor(days / 7) + 1, restBonus: 60 });
      if (days === 0) Object.assign(plan, { phase: 'Event day', label: 'Event day', mainRange: [1, 1], rir: 1, volMult: 0.3, note: 'Warm up, hit your openers, trust the training.' });
      else if (days <= 6) Object.assign(plan, { phase: 'Taper', label: `Taper · ${days}d out`, mainRange: [1, 3], rir: 3, volMult: 0.5, note: 'Cut volume, keep the bar moving fast and stay fresh.' });
      else if (days <= 20) Object.assign(plan, { phase: 'Realization', label: `Realization · ${Math.ceil(days / 7)}w out`, mainRange: [2, 3], rir: 1, volMult: 0.8, note: 'Heavy, low-rep work on the competition lifts.' });
      else if (days <= 48) Object.assign(plan, { phase: 'Intensification', label: `Intensification · ${Math.ceil(days / 7)}w out`, mainRange: [3, 5], rir: days > 34 ? 2 : 1, note: 'Heavier work; accessories hold steady.' });
      else Object.assign(plan, { phase: 'Accumulation', label: `Accumulation · ${Math.ceil(days / 7)}w out`, mainRange: [5, 8], rir: 2, note: 'Build work capacity at moderate loads.' });
      return plan;
    }
    plan.note = 'Your event date has passed. Set a new one in Settings, or switch goal.';
  }

  const L = Math.max(2, Math.floor(settings.mesoLength) || 4);
  const cycle = L + (settings.deload ? 1 : 0);
  const start = settings.mesoStart || startOfWeek(dateISO);
  const elapsed = Math.max(0, Math.floor(daysBetween(start, dateISO) / 7));
  const idx = elapsed % cycle;
  const isDeload = !!settings.deload && idx === L;
  Object.assign(plan, {
    isDeload, week: idx + 1, weeks: cycle, block: Math.floor(elapsed / cycle) + 1,
    phase: isDeload ? 'Deload' : 'Build',
    label: isDeload ? 'Deload week' : `Week ${idx + 1} of ${L}`,
    rir: isDeload ? 4 : Math.round(3 - 2 * (idx / (L - 1))),
    volMult: isDeload ? 0.5 : 1,
    ramp: settings.rampVolume && settings.goal === 'hypertrophy' && !isDeload ? Math.min(2, Math.floor(idx / 2)) : 0,
    mainRange: settings.goal === 'strength' || settings.goal === 'peaking' ? [3, 6] : null,
    restBonus: settings.goal === 'hypertrophy' ? 0 : 30,
  });
  plan.note = isDeload
    ? 'Half the sets, easy effort. Come back fresher.'
    : `Aim to finish sets with about ${plan.rir} rep${plan.rir === 1 ? '' : 's'} in reserve.`;
  return plan;
}

export const isMain = ex => ex.compound && ex.equipment === 'barbell' && ex.primary !== 'glutes';

export function repRange(ex, entry, plan) {
  if (entry?.lo && entry?.hi) return [entry.lo, entry.hi];
  if (plan.mainRange && isMain(ex)) return plan.mainRange;
  return [ex.repMin || 8, ex.repMax || 12];
}

export function setsFor(base, plan) {
  if (plan.isDeload) return Math.max(1, Math.ceil(base * 0.5));
  return Math.max(1, Math.round(base * plan.volMult) + plan.ramp);
}

/* ---------- history ---------- */

export function historyFor(sessions, exId) {
  const out = [];
  for (const s of sessions) {
    for (const e of s.exercises) {
      if (e.exId !== exId) continue;
      const sets = e.sets.filter(x => x.done && !x.warmup && x.r > 0);
      if (sets.length) out.push({ date: s.date, sets });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function topSet(sets, bw = 0) {
  let best = null;
  for (const set of sets) {
    const e = e1rm(bw + (set.w || 0), set.r, set.rir ?? 1);
    if (!best || e > best.e) best = { set, e };
  }
  return best;
}

export function bestE1rm(hist, bw = 0) {
  return hist.reduce((m, h) => Math.max(m, topSet(h.sets, bw)?.e || 0), 0);
}

/* ---------- prescription ---------- */

export function prescribe(ex, hist, plan, cfg) {
  const [lo, hi] = cfg.range;
  const inc = cfg.inc;
  const rirT = plan.rir;
  const bw = ex.type === 'bodyweight' ? cfg.bodyWeight || 0 : 0;
  const tops = hist.map(h => topSet(h.sets, bw)).filter(Boolean);
  const base = { lo, hi, rir: rirT };

  if (!tops.length) {
    return { ...base, w: null, r: Math.round((lo + hi) / 2), basis: 'none',
      reason: `No history yet. Pick a load where ${lo}–${hi} reps leaves about ${rirT} in reserve; this session calibrates future targets.` };
  }

  const top = tops[tops.length - 1];
  const prev = tops.length > 1 ? tops[tops.length - 2] : null;
  const lay = layoffFactor(hist[hist.length - 1].date, cfg.today);
  const est = (prev && top.e < prev.e * 0.92 ? (top.e + prev.e) / 2 : top.e) * lay; // ignore a single bad day
  const w0 = top.set.w || 0;
  const lastReps = top.set.r;
  const lastRir = top.set.rir ?? 1;
  const canDo = repsAtLoad(est, bw + w0) - rirT;
  let want = Math.round(canDo);
  if (lastRir <= rirT && lay === 1) want = Math.max(want, lastReps + 1); // beat last time when effort matched

  let w = w0, r, reason;
  if (want > hi) {
    let nw = w0 + inc, steps = 1;
    while (steps < 3 && repsAtLoad(est, bw + nw + inc) - rirT >= hi) { nw += inc; steps++; }
    w = nw;
    r = clamp(Math.round(repsAtLoad(est, bw + w) - rirT), lo, hi);
    reason = `You topped the ${lo}–${hi} range at ${w0}. Add ${fmt(w - w0)} and rebuild from about ${r} reps.`;
  } else if (canDo < lo - 0.5) {
    w = Math.max(0, roundTo(loadForReps(est, lo, rirT) - bw, inc));
    if (w >= w0 && w0 > 0) w = Math.max(0, w0 - inc);
    r = lo;
    reason = `At ${rirT} RIR your last effort points below ${lo} reps at ${w0}. Drop to ${w} and rebuild.`;
  } else {
    r = clamp(want, lo, hi);
    reason = r > lastReps ? `Same load; beat last time (${lastReps} → ${r} reps).` : `Repeat the load and aim for ${r} reps.`;
  }
  if (plan.isDeload && w > w0) { w = w0; r = Math.min(r, hi); reason = 'Deload: keep the load, lower the effort.'; }
  if (lay < 1) reason = `${Math.round((1 - lay) * 100)}% layoff discount applied. ${reason}`;
  return { ...base, w, r, basis: 'e1rm', est, reason };
}

// Strength fades after a long break: discount the old estimate 2.5% per week past two weeks, up to 15%.
export function layoffFactor(lastDate, today) {
  if (!lastDate || !today) return 1;
  const gap = daysBetween(lastDate, today);
  return gap <= 14 ? 1 : 1 - Math.min(0.15, 0.025 * Math.ceil((gap - 14) / 7));
}

// Plates per side for a barbell load; null when the load can't be built exactly.
export function platesPerSide(total, unit = 'lb') {
  const bar = unit === 'kg' ? 20 : 45;
  const plates = unit === 'kg' ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
  let side = (total - bar) / 2;
  if (!(side >= 0)) return null;
  const out = [];
  for (const p of plates) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return side < 1e-6 ? out : null;
}

const fmt = n => String(Math.round(n * 100) / 100);

export function warmups(ex, work, cfg) {
  if (!ex.compound || !work || work <= 0) return [];
  const kg = cfg.unit === 'kg';
  const bar = kg ? 20 : 45;
  const minW = ex.equipment === 'barbell' ? bar : cfg.inc;
  const scheme = work >= (kg ? 60 : 135) ? [[0.4, 8], [0.6, 5], [0.8, 2]]
    : work >= (kg ? 25 : 55) ? [[0.5, 6], [0.75, 3]] : [[0.6, 5]];
  const out = [];
  for (const [p, r] of scheme) {
    const w = Math.max(minW, roundTo(work * p, cfg.inc));
    if (w < work && (!out.length || w > out[out.length - 1].w)) out.push({ w, r });
  }
  return out;
}

// in-session autoregulation after a completed set
export function nextSetHint(done, rx, inc) {
  if (!rx || rx.rir == null || done.rir == null || done.w == null || done.w <= 0) return null;
  if (done.rir - rx.rir >= 2) {
    return { w: done.w + inc, msg: `That was ${done.rir} RIR against a ${rx.rir} target. Try ${fmt(done.w + inc)} next set.` };
  }
  if (rx.lo && done.r < rx.lo && done.rir <= 1) {
    return { w: Math.max(0, done.w - inc), msg: `Reps fell under ${rx.lo}. Trim to ${fmt(Math.max(0, done.w - inc))} for the next set.` };
  }
  return null;
}

export function prCheck(hist, set, bw = 0) {
  const prior = hist.flatMap(h => h.sets);
  if (!prior.length || !set.r) return null;
  const e = e1rm(bw + (set.w || 0), set.r, set.rir ?? 1);
  const bestE = Math.max(...prior.map(s => e1rm(bw + (s.w || 0), s.r, s.rir ?? 1)));
  if (e > bestE * 1.005) return 'e1RM PR';
  const w = set.w || 0;
  if (w > Math.max(...prior.map(s => s.w || 0))) return 'Weight PR';
  const same = prior.filter(s => Math.abs((s.w || 0) - w) < 0.01);
  if (same.length && set.r > Math.max(...same.map(s => s.r))) return 'Rep PR';
  return null;
}

/* ---------- volume ---------- */

export function volumeFromExercises(entries) {
  // entries: [{primary, secondary, sets: number}]
  const vol = {};
  const add = (g, key, n) => { if (!g) return; vol[g] ??= { direct: 0, indirect: 0, total: 0 }; vol[g][key] += n; vol[g].total += n; };
  for (const e of entries) {
    const pg = groupOf(e.primary);
    add(pg, 'direct', e.sets);
    const seen = new Set([pg]);
    for (const m of e.secondary || []) {
      const g = groupOf(m);
      if (!g || seen.has(g)) continue;
      seen.add(g);
      add(g, 'indirect', e.sets * 0.5);
    }
  }
  return vol;
}

export function weeklyVolume(sessions, weekStart) {
  const end = addDays(weekStart, 6);
  const entries = [];
  for (const s of sessions) {
    if (s.date < weekStart || s.date > end) continue;
    for (const e of s.exercises) {
      const n = e.sets.filter(x => x.done && !x.warmup).length;
      if (n) entries.push({ primary: e.primary, secondary: e.secondary, sets: n });
    }
  }
  return volumeFromExercises(entries);
}

export function volumeStatus(group, total) {
  if (total < group.mev) return { key: 'low', label: 'Below MEV' };
  if (total < group.mavLo) return { key: 'ok', label: 'Building' };
  if (total <= group.mavHi) return { key: 'good', label: 'Productive' };
  if (total <= group.mrv) return { key: 'high', label: 'High' };
  return { key: 'over', label: 'Over MRV' };
}

/* ---------- fatigue / stalls ---------- */

export function stalledExercises(sessions, today, bwFor = () => 0) {
  const from = addDays(today, -35);
  const ids = new Map();
  for (const s of sessions) {
    if (s.date < from) continue;
    for (const e of s.exercises) ids.set(e.exId, e.name);
  }
  const out = [];
  for (const [id, name] of ids) {
    const hist = historyFor(sessions, id).filter(h => h.date >= from);
    if (hist.length < 3) continue;
    const es = hist.slice(-3).map(h => topSet(h.sets, bwFor(id))?.e || 0);
    if (es[1] <= es[0] * 1.005 && es[2] <= es[0] * 1.005) out.push(name);
  }
  return out;
}

/* ---------- misc ---------- */

export function sessionStats(session) {
  let sets = 0, reps = 0, volume = 0;
  for (const e of session.exercises) {
    for (const s of e.sets) {
      if (!s.done || s.warmup) continue;
      sets++; reps += s.r || 0; volume += (s.w || 0) * (s.r || 0);
    }
  }
  const duration = session.endedAt && session.startedAt ? (session.endedAt - session.startedAt) / 1000 : 0;
  return { sets, reps, volume, duration };
}

export function nextDayIndex(program, sessions) {
  if (!program?.days.length) return 0;
  const last = [...sessions].reverse().find(s => s.programId === program.id && s.dayId);
  if (!last) return 0;
  const i = program.days.findIndex(d => d.id === last.dayId);
  return i < 0 ? 0 : (i + 1) % program.days.length;
}
