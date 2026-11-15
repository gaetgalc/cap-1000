// Statistiques de la pendule et erreurs répétées, sur des parties construites à la main. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { clockErrors, incOf, repeatedErrors, lineText } = await import('../js/stats.js');

test('incrément : lu à l’import, sinon déduit de la pendule', () => {
  assert.equal(incOf({ inc: 5, clk: [] }), 5);
  assert.equal(incOf({ clk: [600, 600, 607, 598, 605, 590] }), 7); // 600 → 607 : coup joué sans réfléchir, l'incrément est de 7 s
  assert.equal(incOf({ clk: [590, 580, 570, 560] }), 0);
});

test('erreurs selon la pendule : temps restant avant le coup et temps pris, après le 8e coup seulement', () => {
  const n = 24, san = Array(n).fill('x'), clk = [];
  // Blancs : 3 s par coup jusqu'au coup 9, puis 40 s ; Noirs : 10 s par coup.
  let w = 600, b = 600;
  for (let i = 0; i < n; i++) { if (i % 2 === 0) { w -= i < 16 ? 3 : 40; clk.push(w); } else { b -= 10; clk.push(b); } }
  const g = { id: 'g', w: true, base: 600, inc: 0, tc: 'rapid', san, clk };
  const an = { g: { errs: [{ ply: 16, kind: 'gaffe' }, { ply: 4, kind: 'gaffe' }, { ply: 18, kind: 'imprecision' }] } };
  const ce = clockErrors([g], an);
  assert.equal(ce.games, 1);
  const think = Object.fromEntries(ce.think.map((x) => [x.label, [x.n, x.bad]]));
  assert.deepEqual(think['15 s à 1 min'], [4, 1], 'les 4 coups des Blancs après le 8e, une gaffe (celle du coup 3 est ignorée, l’imprécision aussi)');
  assert.deepEqual(think['Moins de 5 s'], [0, 0]);
  const left = Object.fromEntries(ce.left.map((x) => [x.label, x.n]));
  assert.equal(left['Plus de 5 min'], 4);
  assert.equal(clockErrors([{ ...g, clk: clk.slice(1) }], an).games, 0, 'pendule incomplète : partie ignorée');
});

test('même position, même faute : regroupée sur plusieurs parties', () => {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
  const mk = (t, played, other = {}) => ({ g: { id: 'g' + t, t, w: false, san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', played] }, e: { fen: fen.replace(/ 3 3$/, ` ${t} 3`), ply: 5, played, bestSan: 'Nf6', best: 'g8f6', drop: 12, ...other } });
  const xs = [mk(1, 'd6'), mk(2, 'd6'), mk(3, 'Nd4')];
  const games = xs.map((x) => x.g), an = Object.fromEntries(xs.map((x) => [x.g.id, { errs: [x.e] }]));
  const [r] = repeatedErrors(games, an);
  assert.equal(r.n, 3); assert.equal(r.games, 3);
  assert.deepEqual(r.moves, [['d6', 2], ['Nd4', 1]]);
  assert.equal(r.last.g.t, 3);
  assert.equal(lineText(r.line), '1.e4 e5 2.Cf3 Cc6 3.Fc4');
  assert.deepEqual(repeatedErrors([games[0]], an), [], 'une seule partie : pas une erreur qui revient');
});
