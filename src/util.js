export const $ = (sel, root = document) => root.querySelector(sel);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const parseISO = s => new Date(s + 'T00:00:00');
export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
export function startOfWeek(iso) {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}
export function fmtDate(iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return parseISO(iso).toLocaleDateString(undefined, opts);
}
export function fmtDur(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export const roundTo = (n, step) => Math.round(n / step) * step;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export function num(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
export const fmtNum = n => (n == null || Number.isNaN(n) ? '–' : String(Math.round(n * 100) / 100));
export const fmtK = n => (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n).toLocaleString());
export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : '');
export const sum = a => a.reduce((x, y) => x + y, 0);
