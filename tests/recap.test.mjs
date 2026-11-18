// Bilan après un import (18/11) : points forts et faibles de l'ensemble des parties, ce que les nouvelles changent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { importRecap } = await import('../js/recap.js');

// Partie minimale au format normalisé de chesscom.js ; a : analyse (errs, ev, maxAdv).
const game = (i, o = {}) => ({ id: 'g' + i, t: 1000 + i, w: o.w ?? true, out: o.out || 'W', r: 750, or: 750, san: Array(60).fill('e4'), fam: o.fam || 'Italian Game', how: 'resign', clk: [] });
const an = (gaffes = 0) => ({ errs: Array.from({ length: gaffes }, (_, k) => ({ ply: 20 + k, kind: 'gaffe', theme: 'en_prise_pose', drop: 30, ph: 'milieu' })), ev: Array(61).fill(0), maxAdv: 0, acc: 85 });

function pack(list) {
  const games = list.map(([g]) => g), A = {};
  for (const [g, a] of list) if (a) A[g.id] = a;
  return { games, an: A };
}

test('recap : en attente tant que les nouvelles parties ne sont pas analysées', () => {
  const { games, an: A } = pack([...Array.from({ length: 12 }, (_, i) => [game(i), an(1)]), [game(12), null]]);
  const r = importRecap(games, A, ['g12']);
  assert.equal(r.ready, false);
});

test('recap : bilan des nouvelles parties et comparaison avec la moyenne', () => {
  const old = Array.from({ length: 12 }, (_, i) => [game(i, { out: i % 2 ? 'W' : 'L' }), an(1)]);
  const neu = [[game(20, { out: 'W' }), an(3)], [game(21, { out: 'L' }), an(3)]];
  const { games, an: A } = pack([...old, ...neu]);
  const r = importRecap(games, A, ['g20', 'g21']);
  assert.equal(r.ready, true);
  assert.deepEqual({ n: r.batch.n, w: r.batch.w, d: r.batch.d, l: r.batch.l }, { n: 2, w: 1, d: 0, l: 1 });
  assert.equal(r.batch.gpg, 3);
  assert.equal(r.batch.gpgBefore, 1);
  assert.match(r.batch.text, /^2 nouvelles parties : 1 victoire, 1 défaite\. 3,0 gaffes par partie, contre 1,0 avant\.$/);
});

test('recap : points forts et faibles de l’ensemble, marqués « nouveau » quand l’import les fait apparaître', () => {
  // 10 anciennes parties à 1 gaffe : « Peu de gaffes » ; 6 nouvelles à 6 gaffes : la moyenne passe au-dessus de 2,5.
  const old = Array.from({ length: 10 }, (_, i) => [game(i, { out: 'W' }), an(1)]);
  const neu = Array.from({ length: 6 }, (_, i) => [game(30 + i, { out: 'L' }), an(6)]);
  const { games, an: A } = pack([...old, ...neu]);
  const r = importRecap(games, A, neu.map(([g]) => g.id));
  const weak = r.faiblesses.find((x) => x.t === 'Trop de gaffes par partie');
  assert.ok(weak, 'faiblesse attendue');
  assert.equal(weak.neu, true);
  assert.ok(r.gone.includes('Peu de gaffes'), 'force perdue signalée');
  assert.ok(r.faiblesses.length <= 3 && r.forces.length <= 3);
});

test('recap : moins de 10 parties, pas de points forts ni faibles mais le bilan des nouvelles reste', () => {
  const { games, an: A } = pack([[game(1), an(0)], [game(2, { out: 'D' }), an(2)]]);
  const r = importRecap(games, A, ['g2']);
  assert.equal(r.ready, true);
  assert.deepEqual([r.forces, r.faiblesses], [[], []]);
  assert.match(r.batch.text, /^1 nouvelle partie : 1 nulle\. 2,0 gaffes par partie, contre 0,0 avant\.$/);
});
