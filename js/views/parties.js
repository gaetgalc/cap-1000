// Liste des parties (#parties).
import * as st from '../stats.js';
import { F_HM, HOW, TC, dfmt, esc, pl, resChip, resWord, tabs, wdl } from '../ui.js';
import { GAMES_TABS } from '../nav.js';
import { S, games } from '../state.js';
import { periodSeg, upToDate } from './cartes.js';
import { refreshBtn } from '../app.js';

// Liste des parties (demande du 16/11) : une ligne par partie, joueurs et Elo à gauche comme sur un échiquier
// (adversaire en haut, toi en bas), puis résultat, ouverture et chiffres. Synthèse de la sélection au-dessus.
const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x);
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function partiesSummary(gs) {
  const s = st.listSummary(gs); if (!s.n) return '';
  // Encart propre à la synthèse, pas tile() de ui.js : sous-titre en chiffres alignés (small num)
  const sumTile = (lab, v, sub = '') => `<div class="glt"><span class="small">${lab}</span><b class="num">${v}</b>${sub ? `<span class="small num">${sub}</span>` : ''}</div>`;
  return `<div class="glsum">${sumTile('Parties', s.n, `${s.w} V, ${s.d} N, ${s.l} D`)}${sumTile('Score', s.score + ' %')}
    ${s.from != null ? sumTile('Mon Elo', `${s.to} <span class="${s.to > s.from ? 'up' : s.to < s.from ? 'dn' : ''}">${sgn(s.to - s.from)}</span>`, `depuis ${s.from}`) : ''}
    ${s.opp ? sumTile('Adversaires', s.opp, 'Elo moyen') : ''}${s.perf ? sumTile('Performance', s.perf, 'Elo estimé') : ''}</div>${wdl(s)}`;
}
function partieRow(g, fx, allTc) {
  const a = S.an[g.id], ok = a && !a.bad, acc = ok && a.acc != null ? a.acc : g.acc;
  const nG = ok ? a.errs.filter((e) => e.kind === 'gaffe').length : null, nE = ok ? a.errs.filter((e) => e.kind === 'erreur').length : null;
  const d = new Date(g.t * 1000), hh = F_HM(d);
  // Fautes (17/11) : deux pastilles de largeur fixe, toujours présentes (0 en gris), pour qu'elles s'alignent d'une ligne à l'autre
  const flt = (n, sym, cls, lab) => `<span class="flt ${n ? cls : ''}" title="${pl(n, lab)}"><b>${n}</b>${sym}</span>`;
  const fau = !ok ? '<span class="small">non analysée</span>' : flt(nG, '??', 'bad', 'gaffe') + flt(nE, '?', 'warn', 'erreur');
  return `<a class="gl ${g.out}" href="#partie/${g.t}" aria-label="${resWord(g.out)} contre ${esc(g.opp)}, ${dfmt(g.t)}">
    <span class="gl-pl"><span class="gl-p"><i class="dot ${g.w ? 'b' : 'w'}"></i><span class="gl-n">${esc(g.opp)}</span><b class="num">${g.or || '?'}</b>${fx.gap != null ? `<span class="small num" title="Écart avec ton Elo">${sgn(fx.gap)}</span>` : ''}</span>
      <span class="gl-p me"><i class="dot ${g.w ? 'w' : 'b'}"></i><span class="gl-n">Moi</span><b class="num">${g.r || '?'}</b>${fx.d != null ? `<span class="num ${fx.d > 0 ? 'up' : fx.d < 0 ? 'dn' : ''}" title="Variation de ton Elo sur cette partie">${sgn(fx.d)}</span>` : g.rated ? '' : '<span class="small">amicale</span>'}</span></span>
    <span class="gl-res">${resChip(g.out)}<span class="small">${esc(HOW[g.how] || g.how || '')}</span></span>
    <span class="gl-meta"><span class="gl-op">${esc(g.fam)}</span><span class="gl-c num"><b>${Math.ceil(g.san.length / 2)}</b><span class="gl-u"> coups</span></span>
      <span class="gl-c num">${acc != null ? `<b>${Math.round(acc)} %</b><span class="vh"> de précision</span>` : '<span class="small">–</span>'}</span>
      <span class="gl-c gl-f">${fau}</span><span class="gl-c num">${fx.left != null ? `<b>${mmss(fx.left)}</b><span class="vh"> restant à la pendule</span>` : '<span class="small">–</span>'}</span>
      <span class="gl-d small num">${dfmt(g.t)} ${hh}${allTc ? ` · ${TC[g.tc] || g.tc}` : ''}</span></span></a>`;
}
function viewParties() {
  const gs = games().slice().reverse(), fx = st.gameFacts(S.data?.games || []), allTc = S.f.tc === 'all';
  S.listN ||= 50;
  const head = '<div class="gl head" aria-hidden="true"><span>Joueurs et Elo</span><span>Résultat</span><span class="gl-meta"><span>Ouverture</span><span class="gl-c">Coups</span><span class="gl-c">Précision</span><span class="gl-c">Fautes</span><span class="gl-c">Pendule</span><span class="gl-d">Date</span></span></div><details class="gl-leg small"><summary>Comment lire une ligne</summary><p>Elo : écart de l’adversaire avec toi, puis ce que la partie t’a fait gagner ou perdre. Dessous : coups, précision, temps restant, fautes (?? gaffe, ? erreur).</p></details>';
  return `${tabs('parties', GAMES_TABS)}<div class="vhead"><h1>Parties</h1>${periodSeg()}</div><div class="row updrow"><span class="sub" id="upd">${upToDate()}</span>${refreshBtn()}</div>${gs.length ? `<div class="card">${partiesSummary(gs)}</div>` : ''}<div class="card gll">${head}
    ${gs.slice(0, S.listN).map((g) => partieRow(g, fx[g.id] || {}, allTc)).join('')}
    ${gs.length > S.listN ? '<div><button class="btn" data-act="more">Afficher 50 parties de plus</button></div>' : ''}</div>`;
}

export { mmss, viewParties };
