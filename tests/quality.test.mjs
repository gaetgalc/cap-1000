// Qualité de chaque coup des deux camps (relecture, 20/11) et coups de théorie. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { buildBook, bookPlies, posKey } = await import('../js/book.js');
const { moveQualities, qualityCounts, QUALITY } = await import('../js/review.js');
const { MATE } = await import('../js/classify.js');

const fensOf = (sans) => { const ch = new Chess(), f = [ch.fen()]; for (const x of sans) { ch.move(x); f.push(ch.fen()); } return f; };
test('théorie : positions connues de la base, quel que soit l’ordre des coups', () => {
  const b = buildBook(['e4', 'e4 e5', 'e4 e5 Nf3', 'e4 e5 Nf3 Nc6'].map((l) => posKey(fensOf(l.split(' ')).pop())).join('\n'));
  assert.equal(bookPlies(b, fensOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'])), 4);
  assert.equal(bookPlies(b, fensOf(['e4', 'c5'])), 1);
  assert.equal(bookPlies(b, fensOf(['a3'])), 0);
  assert.notEqual(posKey(fensOf(['e4']).pop()), posKey(fensOf(['d4']).pop()));
});
test('la base fournie (vendor/book.txt, Lichess chess-openings, CC0) reconnaît la défense Owen par transposition', () => {
  const b = buildBook(readFileSync(new URL('../vendor/book.txt', import.meta.url), 'utf8'));
  assert.ok(bookPlies(b, fensOf(['d4', 'b6', 'e4', 'Bb7'])) >= 4);
  assert.ok(bookPlies(b, fensOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])) >= 6);
  assert.ok(bookPlies(b, fensOf(['e4', 'e5', 'Qh5', 'Ke7', 'Qxe5+'])) < 5);
});

// Partie construite : positions, coups, évals (point de vue des Blancs) et meilleurs coups donnés à la main.
function game(sans) {
  const ch = new Chess(), fens = [ch.fen()], mv = [];
  for (const s of sans) { mv.push(ch.move(s)); fens.push(ch.fen()); }
  return { fens, mv };
}
const uci = (m) => m.from + m.to;

test('chaque coup reçoit sa catégorie, pour les deux camps, avec les seuils du classement des erreurs', () => {
  const { fens, mv } = game(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5']);
  // ev[i] : éval avant le coup i (Blancs) ; best[i] : meilleur coup dans la position i
  const ev = [30, 30, 30, 30, 70, -30, 200, -150, -150];
  const best = [uci(mv[0]), uci(mv[1]), uci(mv[2]), 'f8c5', 'b1c3', 'f8c5', 'd2d3', uci(mv[7]), null];
  const q = moveQualities({ ev, best, mv, fens, book: 2, mp: { 2: [30, 25, 20], 7: [150, -50] } });
  assert.deepEqual(q, ['theorie', 'theorie',
    'meilleur', // plusieurs coups tenaient : pas « seul bon coup »
    'bon', // Noirs : -0,3 → -0,7, 3,6 points perdus
    'imprecision', // Blancs : +0,7 → -0,3, 9,2 points
    'gaffe', // Noirs : +0,3 → -2, 20 points
    'manque', // Blancs : l'adversaire vient de gaffer, et ce coup rend plus de 10 points
    'seul', // meilleur coup, et le deuxième perd plus de 6 points
  ]);
  const c = qualityCounts(q);
  assert.equal(c.w.theorie, 1); assert.equal(c.b.theorie, 1);
  assert.equal(c.w.manque, 1); assert.equal(c.b.gaffe, 1); assert.equal(c.b.seul, 1);
  assert.ok(QUALITY.every((x) => x.k && x.t));
});

test('erreur entre 10 et 20 points ; excellent sous 2 points', () => {
  const { fens, mv } = game(['e4', 'e5', 'Nf3']);
  const q = moveQualities({ ev: [30, -100, -90, -95], best: ['d2d4', 'g8f6', 'b1c3'], mv, fens, book: 0 });
  assert.deepEqual(q, ['erreur', 'excellent', 'excellent']);
});

test('brillant : le meilleur coup donne une pièce que le moteur conseille de prendre (mat de Légal)', () => {
  const { fens, mv } = game(['e4', 'e5', 'Nf3', 'd6', 'Bc4', 'Bg4', 'Nc3', 'g6', 'Nxe5']);
  const ev = [30, 30, 30, 30, 30, 30, 30, 100, 300, 300];
  const best = mv.map(uci).concat(['g4d1']);
  const q = moveQualities({ ev, best, mv, fens, book: 0 });
  assert.equal(q[8], 'brillant');
  assert.equal(q[0], 'meilleur'); // un meilleur coup sans sacrifice reste « meilleur »
});

test('partie à moitié analysée ou mat : pas de catégorie sans éval après le coup', () => {
  const { fens, mv } = game(['f3', 'e5', 'g4', 'Qh4#']);
  const q = moveQualities({ ev: [0, -20, -40, -MATE + 1, -MATE], best: ['e2e4', 'd7d5', 'g1f3', 'd8h4', null], mv, fens, book: 0 });
  assert.equal(q[2], 'gaffe');
  assert.equal(q[3], 'meilleur');
  assert.equal(moveQualities({ ev: [0], best: [], mv, fens, book: 0 })[1], null);
});
