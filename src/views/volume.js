import { esc, fmtNum } from '../util.js';
import { GROUPS } from '../defaults.js';
import { volumeStatus } from '../engine.js';

// Weekly hard sets per muscle group against MEV / MAV / MRV landmarks.
export function volumeRows(vol) {
  const rows = Object.entries(GROUPS)
    .filter(([k, g]) => vol[k]?.total > 0 || g.mev >= 6)
    .map(([k, g]) => {
      const t = vol[k]?.total || 0;
      const st = volumeStatus(g, t);
      const scale = g.mrv * 1.2;
      const pos = v => Math.min(100, (v / scale) * 100).toFixed(1);
      return `<div class="vol">
        <div class="vol-top"><span>${esc(g.label)}</span><span><strong>${fmtNum(t)}</strong> ${t === 1 ? 'set' : 'sets'} · <em class="st ${st.key}">${st.label}</em></span></div>
        <div class="track" role="img" aria-label="${esc(g.label)} ${fmtNum(t)} sets; productive ${g.mavLo} to ${g.mavHi}">
          <span class="zone" style="left:${pos(g.mavLo)}%;width:${(pos(g.mavHi) - pos(g.mavLo)).toFixed(1)}%"></span>
          <span class="fill ${st.key}" style="width:${pos(t)}%"></span>
          <span class="tick" style="left:${pos(g.mev)}%" title="MEV ${g.mev}"></span>
          <span class="tick mrv" style="left:${pos(g.mrv)}%" title="MRV ${g.mrv}"></span>
        </div>
      </div>`;
    });
  return rows.join('') + `<p class="muted small">Sets count fully toward the primary muscle and half toward secondary muscles. Shaded band = productive range; ticks = minimum effective and maximum recoverable volume.</p>`;
}
