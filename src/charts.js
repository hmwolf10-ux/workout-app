import { esc, parseISO, fmtDate, fmtNum } from './util.js';

const W = 320;

export function lineChart(points, { height = 170, unit = '' } = {}) {
  if (points.length < 2) return '<p class="muted">Log this exercise at least twice to see a trend.</p>';
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const xs = points.map(p => parseISO(p.x).getTime());
  const ys = points.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = y1 - y0 || y1 * 0.1 || 1;
  y0 -= span * 0.15; y1 += span * 0.15;
  const X = t => pad.l + ((t - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const Y = v => height - pad.b - ((v - y0) / (y1 - y0)) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const grid = [0, 0.5, 1].map(f => {
    const v = y0 + (y1 - y0) * f;
    return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pad.l - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }).join('');
  const dots = points.map((p, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5"><title>${esc(fmtDate(p.x))}: ${fmtNum(p.y)} ${esc(unit)}</title></circle>`).join('');
  const short = { month: 'short', day: 'numeric' };
  return `<svg viewBox="0 0 ${W} ${height}" class="chart" role="img" aria-label="Trend from ${fmtNum(ys[0])} to ${fmtNum(ys[ys.length - 1])} ${esc(unit)}">
    ${grid}<path d="${path}" class="line"/>${dots}
    <text x="${pad.l}" y="${height - 6}">${esc(fmtDate(points[0].x, short))}</text>
    <text x="${W - pad.r}" y="${height - 6}" text-anchor="end">${esc(fmtDate(points[points.length - 1].x, short))}</text>
  </svg>`;
}

export function barChart(items, { height = 120 } = {}) {
  const max = Math.max(1, ...items.map(i => i.value));
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const bw = (W - pad.l - pad.r) / items.length;
  const bars = items.map((it, i) => {
    const h = ((height - pad.t - pad.b) * it.value) / max;
    const x = pad.l + i * bw + bw * 0.15;
    return `<rect x="${x.toFixed(1)}" y="${(height - pad.b - h).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="bar"><title>${esc(it.label)}: ${fmtNum(it.value)}</title></rect>
      <text x="${(x + bw * 0.35).toFixed(1)}" y="${height - 7}" text-anchor="middle">${esc(it.label)}</text>
      ${it.value ? `<text x="${(x + bw * 0.35).toFixed(1)}" y="${(height - pad.b - h - 4).toFixed(1)}" text-anchor="middle" class="val">${esc(it.text ?? Math.round(it.value))}</text>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${height}" class="chart" role="img" aria-label="Weekly totals">${bars}</svg>`;
}
