// Relecture de partie : calculs purs (symbole d'un coup, barre d'évaluation, navigation entre les erreurs).
// Sans affichage ni moteur : testés dans tests/review.test.mjs.
import { winPct, goodMoves, freeCapture } from './classify.js';

const KIND = {
  gaffe: { s: '??', c: 'bad', t: 'Gaffe' },
  erreur: { s: '?', c: 'warn', t: 'Erreur' },
  imprecision: { s: '?!', c: 'ink3', t: 'Imprécision' },
};
// Symbole d'un coup : e = erreur classée sur ce coup (classify), sinon o = { played, best (UCI), mp (3 meilleurs coups) }.
// « ! » : le meilleur coup a été joué alors qu'un seul coup tenait (connu seulement si mp a été calculé pour cette position) ;
// pas sur un coup forcé (un seul coup légal, mp d'une seule entrée).
// Renvoie { s: symbole, c: jeton de couleur (--bad, --warn, --ink3, --good), t: libellé } ou null.
export function moveMark(e, o = {}) {
  if (e && KIND[e.kind]) return { ...KIND[e.kind] };
  if (o.played && o.best && o.played.slice(0, 4) === o.best.slice(0, 4) && o.mp?.length > 1 && goodMoves(o.mp) === 1) return { s: '!', c: 'good', t: 'Seul bon coup' };
  return null;
}

// Part des Blancs dans la barre d'évaluation (0 à 1), d'après les chances de gain ; cp du point de vue des Blancs.
export const evalShare = (cp) => (cp == null ? 0.5 : Math.round(winPct(cp) * 10) / 1000);

// Erreur suivante (dir = 1) ou précédente (dir = -1) depuis la position k ; plies triées. null s'il n'y en a pas.
export function errStep(plies, k, dir) {
  if (dir > 0) return plies.find((p) => p > k) ?? null;
  for (let i = plies.length - 1; i >= 0; i--) if (plies[i] < k) return plies[i];
  return null;
}

// Fil des gaffes de la carte « Ta dernière partie » (accueil) : parties de la cadence suivie, de la plus récente à la plus
// ancienne ; une étape par gaffe (i sur n, dans l'ordre de la partie). Partie sans gaffe : une étape, sa pire erreur
// (i = n = 0) ou rien (e = null). Partie la plus récente pas encore analysée : en tête (pending).
export function gaffeTrail(games, an, tc) {
  const gs = games.filter((g) => g.tc === tc).sort((a, b) => b.t - a.t), out = [];
  gs.forEach((g, k) => {
    const a = an[g.id];
    if (!a) { if (k === 0) out.push({ g, e: null, i: 0, n: 0, pending: true }); return; }
    if (a.bad) return;
    const gaffes = a.errs.filter((x) => x.kind === 'gaffe' && x.best).sort((x, y) => x.ply - y.ply);
    if (gaffes.length) gaffes.forEach((e, j) => out.push({ g, e, i: j + 1, n: gaffes.length }));
    else out.push({ g, e: a.errs.filter((x) => x.kind === 'erreur' && x.best).sort((x, y) => y.drop - x.drop)[0] || null, i: 0, n: 0 });
  });
  return out;
}

// Temps passé sur chaque coup (secondes), comme la colonne de pendule de Chess.com : pendule du coup précédent du même camp
// (la cadence de base pour son premier coup) + incrément - pendule après le coup. null sans pendule complète.
export function moveTimes(g) {
  if (!g.base || !g.clk || g.clk.length !== g.san.length) return null;
  return g.clk.map((c, i) => Math.max(0, (i >= 2 ? g.clk[i - 2] : g.base) + (g.inc || 0) - c));
}
export const clockFmt = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
// Pendule de chaque camp après k demi-coups joués (secondes), comme sous et au-dessus de l'échiquier de Chess.com.
export function clocksAt(g, k) {
  if (!g.base || !g.clk || g.clk.length !== g.san.length) return null;
  const last = (side) => { for (let i = Math.min(k, g.clk.length) - 1; i >= 0; i--) if (i % 2 === side) return g.clk[i]; return g.base; };
  return { w: last(0), b: last(1) };
}

// ---------- Qualité de chaque coup, pour les deux camps (20/11, « comme Chess.com ») ----------
// Mêmes seuils de chances de gain perdues que classify.js : imprécision ≥ 5, erreur ≥ 10, gaffe ≥ 20.
// k : clé ; t : libellé ; s : symbole sur l'échiquier ('' : aucun) ; c : jeton de couleur.
export const QUALITY = [
  { k: 'brillant', t: 'Brillant', s: '!!', c: 'q-brill' },
  { k: 'seul', t: 'Seul bon coup', s: '!', c: 'q-great' },
  { k: 'theorie', t: 'Théorie', s: '', c: 'q-book' },
  { k: 'meilleur', t: 'Meilleur', s: '★', c: 'good' },
  { k: 'excellent', t: 'Excellent', s: '', c: 'good' },
  { k: 'bon', t: 'Bon', s: '', c: 'ink2' },
  { k: 'imprecision', t: 'Imprécision', s: '?!', c: 'q-inacc' },
  { k: 'erreur', t: 'Erreur', s: '?', c: 'warn' },
  { k: 'manque', t: 'Occasion manquée', s: '×', c: 'bad' },
  { k: 'gaffe', t: 'Gaffe', s: '??', c: 'bad' },
];
export const QBY = Object.fromEntries(QUALITY.map((q) => [q.k, q]));
// o : { ev (éval avant chaque coup, Blancs), best (meilleur coup UCI par position), mv (coups verbose de chess.js), fens,
//       book (demi-coups de théorie), mp ({ ply: cp des 3 meilleurs coups, camp au trait }) }.
// Renvoie une catégorie par coup (null si l'éval d'après manque). Brillant : meilleur coup qui laisse du matériel
// (au moins 2 points nets) que le moteur conseille de prendre, hors position déjà gagnée. Occasion manquée : l'adversaire
// vient de perdre au moins 10 points et ce coup en rend autant. Seul bon coup : le deuxième coup perd au moins 6 points.
export function moveQualities({ ev, best, mv, fens, book = 0, mp = {} }) {
  const out = [];
  let prevDrop = 0;
  for (let i = 0; i < mv.length; i++) {
    if (ev[i] == null || ev[i + 1] == null) { out.push(null); prevDrop = 0; continue; }
    const s = i % 2 === 0 ? 1 : -1, w0 = winPct(s * ev[i]), drop = Math.max(0, w0 - winPct(s * ev[i + 1]));
    const m = mv[i], b = best[i], isBest = !!b && (m.from + m.to) === b.slice(0, 4);
    let k;
    if (i < book) k = 'theorie';
    else if (!isBest && drop >= 5) k = drop >= 10 && prevDrop >= 10 ? 'manque' : drop >= 20 ? 'gaffe' : drop >= 10 ? 'erreur' : 'imprecision';
    else if (!isBest) k = drop < 2 ? 'excellent' : 'bon';
    else if (w0 < 90 && fens?.[i + 1] && best[i + 1] && (freeCapture(fens[i + 1], best[i + 1])?.gain ?? 0) >= 2) k = 'brillant';
    else k = mp[i]?.length > 1 && goodMoves(mp[i]) === 1 ? 'seul' : 'meilleur';
    out.push(k);
    prevDrop = i < book ? 0 : drop;
  }
  return out;
}
// Décompte par camp : { w: { clé: n }, b: { clé: n } }.
export function qualityCounts(q) {
  const c = { w: {}, b: {} };
  q.forEach((k, i) => { if (k) { const side = c[i % 2 === 0 ? 'w' : 'b']; side[k] = (side[k] || 0) + 1; } });
  return c;
}
