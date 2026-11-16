// Courbe SVG interactive (survol, clic sur un point), utilisée par l'accueil, la relecture de partie et la page Stats.
import { $, esc } from './ui.js';

// o.compact : sans graduations ni libellés (bande fine sur téléphone), seule la ligne de o.mid est tracée.
// Renvoie { cursor(i) } pour déplacer le curseur sans redessiner la courbe.
export function lineChart(el, pts, o = {}) {
  if (pts.length < 2) { el.innerHTML = '<p class="small">Pas encore assez de données pour tracer la courbe.</p>'; return { cursor() {} }; }
  const W = Math.max(o.compact ? 200 : 280, el.clientWidth), H = o.h || 200, m = o.compact ? { l: 2, r: 2, t: 6, b: 6 } : { l: 36, r: 16, t: 14, b: 22 };
  const ys = pts.map((p) => p.y).concat(o.ref != null ? [o.ref] : []);
  let y0 = o.min ?? Math.min(...ys), y1 = o.max ?? Math.max(...ys);
  if (o.min == null) { const pad = Math.max(10, (y1 - y0) * 0.08); y0 -= pad; y1 += pad; }
  if (y1 <= y0) y1 = y0 + 1;
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x === x0 ? x0 + 1 : pts[pts.length - 1].x;
  const sx = (x) => m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r), sy = (y) => H - m.b - ((y - y0) / (y1 - y0)) * (H - m.t - m.b);
  const step = o.step || niceStep((y1 - y0) / 4);
  let grid = o.compact && o.mid != null ? `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(o.mid)}" y2="${sy(o.mid)}" stroke="var(--line)" stroke-width="1"/>` : '';
  if (!o.compact) for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" stroke-width="1"/><text x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${o.yfmt ? o.yfmt(v) : Math.round(v)}</text>`;
  const d = pts.map((p, i) => (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join('');
  const base = sy(o.base != null ? o.base : y0);
  const area = `${d}L${sx(x1).toFixed(1)} ${base}L${sx(x0).toFixed(1)} ${base}Z`;
  const ref = o.ref != null ? `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(o.ref)}" y2="${sy(o.ref)}" stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - m.r}" y="${sy(o.ref) - 6}" text-anchor="end" style="fill:var(--ink2);font-weight:600">${esc(o.refLabel || '')}</text>` : '';
  const marks = (o.marks || []).map((k) => `<circle cx="${sx(pts[k.i].x)}" cy="${sy(pts[k.i].y)}" r="4.5" fill="var(--${k.c})" stroke="var(--surface)" stroke-width="2"/>`).join('');
  const last = pts[pts.length - 1];
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(o.label || '')}">${grid}
    <path d="${area}" fill="var(--accent)" opacity=".1"/>${ref}
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>${marks}
    ${o.marks ? '' : `<circle cx="${sx(last.x)}" cy="${sy(last.y)}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`}
    ${o.compact ? '' : `<text x="${m.l}" y="${H - 5}">${esc(o.x0 || '')}</text><text x="${W - m.r}" y="${H - 5}" text-anchor="end">${esc(o.x1 || '')}</text>`}
    <g class="hov" visibility="hidden"><line y1="${m.t}" y2="${H - m.b}" stroke="var(--ink3)" stroke-width="1"/><circle r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/></g>
    ${o.cursor != null ? `<line class="cur" x1="${sx(pts[o.cursor].x)}" x2="${sx(pts[o.cursor].x)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--ink)" stroke-width="1.5"/>` : ''}
    <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" style="cursor:${o.onPick ? 'pointer' : 'crosshair'}"/></svg>`;
  const svg = $('svg', el), hov = $('.hov', el), tip = $('#tip');
  const near = (ev) => {
    const r = svg.getBoundingClientRect(); const x = ((ev.clientX - r.left) / r.width) * W;
    let bi = 0, bd = Infinity; pts.forEach((p, i) => { const dd = Math.abs(sx(p.x) - x); if (dd < bd) { bd = dd; bi = i; } });
    return bi;
  };
  const rect = $('rect', el);
  rect.onpointermove = (ev) => {
    const i = near(ev), p = pts[i];
    hov.setAttribute('visibility', 'visible');
    $('line', hov).setAttribute('x1', sx(p.x)); $('line', hov).setAttribute('x2', sx(p.x));
    $('circle', hov).setAttribute('cx', sx(p.x)); $('circle', hov).setAttribute('cy', sy(p.y));
    tip.hidden = false; tip.textContent = p.tip;
    const tw = tip.offsetWidth; tip.style.left = Math.max(4, Math.min(innerWidth - tw - 4, ev.clientX - tw / 2)) + 'px'; tip.style.top = Math.max(4, ev.clientY - 40) + 'px';
  };
  rect.onpointerleave = () => { hov.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  if (o.onPick) rect.onclick = (ev) => { tip.hidden = true; o.onPick(near(ev)); };
  const cur = $('line.cur', el);
  return { cursor(i) { if (!cur || !pts.length) return; const x = sx(pts[Math.max(0, Math.min(i, pts.length - 1))].x); cur.setAttribute('x1', x); cur.setAttribute('x2', x); } };
}
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1))); const n = raw / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
