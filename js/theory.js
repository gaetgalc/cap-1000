// Ouvertures : le coup où tu quittes la ligne apprise (catalogue openings.js), et le plan de l'ouverture jouée.
// Calcul pur, testé dans tests/theory.test.mjs.
import { matchGame } from './openings.js';
const findOp = (g, ops) => ops.find((o) => matchGame(o, g));

// Pour chaque partie d'une ouverture du catalogue : la ligne de ton camp la plus suivie, et le premier écart.
// Ne compte que tes coups (si l'adversaire sort de la ligne, ce n'est pas ta sortie). Regroupé par ligne et demi-coup.
export function theoryExits(games, ops) {
  const map = new Map();
  for (const g of games) {
    const o = findOp(g, ops); if (!o) continue;
    const side = g.w ? 'w' : 'b';
    let bestK = -1, bestD = -1;
    o.lines.forEach((l, k) => {
      if (l.side !== side) return;
      const mv = l.moves.split(' '); let d = 0;
      while (d < mv.length && g.san[d] === mv[d]) d++;
      if (d > bestD) { bestD = d; bestK = k; }
    });
    if (bestK < 0) continue;
    const mv = o.lines[bestK].moves.split(' '), d = bestD;
    const key = o.id + ':' + bestK + ':' + d;
    if (d >= mv.length || d >= g.san.length) continue;
    // Toutes les parties arrivées à cette position de la ligne comptent dans « of » ; les sorties sur ton coup dans « n ».
    let r = map.get(key);
    if (!r) map.set(key, (r = { o, k: bestK, ply: d, book: mv[d], played: new Map(), n: 0, mine: (d % 2 === 0) === g.w }));
    if (r.mine) { r.n++; r.played.set(g.san[d], (r.played.get(g.san[d]) || 0) + 1); }
  }
  // « of » : parties qui ont suivi la ligne au moins jusqu'à ce demi-coup.
  const out = [...map.values()].filter((r) => r.mine && r.n);
  for (const r of out) {
    const mv = r.o.lines[r.k].moves.split(' ');
    r.of = games.filter((g) => (g.w ? 'w' : 'b') === r.o.lines[r.k].side && findOp(g, ops) === r.o && mv.slice(0, r.ply).every((m, i) => g.san[i] === m) && g.san.length > r.ply).length;
    r.played = [...r.played].sort((a, b) => b[1] - a[1]);
    delete r.mine;
  }
  return out.sort((a, b) => b.n - a.n || a.ply - b.ply);
}

export function planOf(g, ops) {
  const o = findOp(g, ops);
  return o && o.idees ? { o, text: o.idees[g.w ? 'w' : 'b'] } : null;
}
