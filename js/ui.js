// Aides d'affichage sans état : sélection dans la page, échappement, formats, icônes, bulle du coach.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const dfmt = (t) => new Date(t * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
export const TC = { rapid: 'Rapide', blitz: 'Blitz', bullet: 'Bullet', daily: 'Différé', all: 'Toutes cadences' };
export const HOW = { checkmated: 'mat', timeout: 'temps', resigned: 'abandon', abandoned: 'partie quittée', stalemate: 'pat', agreed: 'nulle par accord', repetition: 'répétition', insufficient: 'matériel insuffisant', '50move': '50 coups', timevsinsufficient: 'temps contre matériel insuffisant' };
export const coach = (html, cls = '') => `<div class="coach ${cls}"><span class="coach-av" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="7" r="3.6" fill="currentColor"/><path d="M8 20c0-4 1.5-6 4-8.5 2.5 2.5 4 4.500 4 8.500z" fill="currentColor"/><rect x="6" y="19.500" width="12" height="2.500" rx="1" fill="currentColor"/></svg></span><div class="coach-b">${html}</div></div>`;
export const txt = (t) => esc(t).replace(/\n/g, '<br>');
export const pl = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
export const f1 = (x) => x.toFixed(1).replace('.', ',');
// Icônes dessinées : les flèches Unicode deviennent des émojis sur iPhone.
const LN = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
const IC = {
  prev: `<path d="M15 5l-7 7 7 7" ${LN}/>`, next: `<path d="M9 5l7 7-7 7" ${LN}/>`,
  first: `<path d="M18 5l-7 7 7 7M7 5v14" ${LN}/>`, last: `<path d="M6 5l7 7-7 7M17 5v14" ${LN}/>`,
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>', pause: '<path d="M7 5h3.500v14H7zM13.500 5H17v14h-3.500z" fill="currentColor"/>',
  replay: '<path d="M12 6V2.500L7 6.500l5 4V8a4.500 4.500 0 1 1-4.500 4.500h-2A6.500 6.500 0 1 0 12 6z" fill="currentColor"/>',
};
export const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${IC[n]}</svg>`;
export const setHtml = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } }; // ne reconstruit pas un bouton sous le doigt
export function wdl(s) {
  if (!s.n) return '';
  return `<span class="wdl" title="${s.w} victoires, ${s.d} nulles, ${s.l} défaites">${s.w ? `<i class="w" style="flex:${s.w}"></i>` : ''}${s.d ? `<i class="d" style="flex:${s.d}"></i>` : ''}${s.l ? `<i class="l" style="flex:${s.l}"></i>` : ''}</span>`;
}
export const WDL_LEGEND = '<div class="legend"><span style="--c:var(--good)">Victoires</span><span style="--c:var(--neutral)">Nulles</span><span style="--c:var(--bad)">Défaites</span></div>';
