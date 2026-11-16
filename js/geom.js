// Géométrie de l'échiquier sans moteur : cases, attaques, valeurs et noms des pièces.
// Partagée par explain.js (commentaires des coups) et plan.js (intention d'un coup).
export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const NOM = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
export const FEM = { r: 1, q: 1 };
const FR = { N: 'C', B: 'F', R: 'T', Q: 'D', K: 'R' };
export const fr = (san) => String(san).replace(/[NBRQK]/g, (c) => FR[c]);
export const sqOf = (r, f) => 'abcdefgh'[f] + (8 - r);
export const rf = (sq) => [8 - +sq[1], sq.charCodeAt(0) - 97];
// « ton cavalier », « sa dame » : toujours du point de vue du joueur (me).
export const poss = (type, color, me) => (color === me ? (FEM[type] ? 'ta ' : 'ton ') : (FEM[type] ? 'sa ' : 'son ')) + NOM[type];
export const il = (type) => (FEM[type] ? 'elle' : 'il');
export const e_ = (type) => (FEM[type] ? 'e' : '');

export function attacksFrom(B, r, f) {
  const p = B[r][f]; if (!p) return [];
  const out = [], on = (a, b) => a >= 0 && a < 8 && b >= 0 && b < 8;
  const step = (list) => { for (const [dr, df] of list) if (on(r + dr, f + df)) out.push([r + dr, f + df]); };
  const ray = (list) => { for (const [dr, df] of list) { let a = r + dr, b = f + df; while (on(a, b)) { out.push([a, b]); if (B[a][b]) break; a += dr; b += df; } } };
  const D = [[1, 1], [1, -1], [-1, 1], [-1, -1]], O = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (p.type === 'n') step([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]);
  else if (p.type === 'k') step([...D, ...O]);
  else if (p.type === 'p') step(p.color === 'w' ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]]);
  else if (p.type === 'b') ray(D); else if (p.type === 'r') ray(O); else ray([...D, ...O]);
  return out;
}
export function attackers(B, sq, color) {
  const [tr, tf] = rf(sq), out = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = B[r][f];
    if (p && p.color === color && attacksFrom(B, r, f).some(([a, b]) => a === tr && b === tf)) out.push({ sq: sqOf(r, f), type: p.type });
  }
  return out;
}
export const cheapest = (list) => list.slice().sort((a, b) => VAL[a.type] - VAL[b.type])[0];
// Joue un coup UCI ou SAN sur une partie chess.js ; null si illégal.
export function play(ch, mv) {
  if (!mv) return null;
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(mv)) return ch.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] || 'q' });
  return ch.move(mv, { sloppy: true });
}
