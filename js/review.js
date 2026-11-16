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
