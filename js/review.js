// Relecture de partie : calculs purs (symbole d'un coup, barre d'évaluation, navigation entre les erreurs).
// Sans affichage ni moteur : testés dans tests/review.test.mjs.
import { winPct, goodMoves } from './classify.js';

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
