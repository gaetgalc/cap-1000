// Sortie de théorie : le coup où tu quittes la ligne apprise, et le coup du livre. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { theoryExits, planOf } = await import('../js/theory.js');
const OPS = [{ id: 'ita', nom: 'Italienne', start: 'e4 e5 Nf3 Nc6 Bc4', idees: { w: 'Plan blanc.', b: 'Plan noir.' },
  lines: [{ side: 'w', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3' }, { side: 'b', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5' }] }];
const g = (san, w = true, t = 1) => ({ id: 'g' + t + san, t, w, san: san.split(' ') });

test('sortie de théorie : ton coup qui quitte la ligne, regroupé et compté', () => {
  const games = [g('e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6', true, 1), g('e4 e5 Nf3 Nc6 Bc4 Bc5 d3 d6', true, 2), g('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3', true, 3),
    g('e4 e5 Nf3 Nc6 Bc4 Bc5 Nc3', true, 4), g('e4 e5 Nf3 Nc6 Bc4 Be7 d3', true, 5), g('d4 d5', true, 6)];
  const x = theoryExits(games, OPS);
  assert.equal(x.length, 1, 'l’adversaire qui sort de la ligne (5…Fe7) n’est pas ta sortie de théorie');
  assert.deepEqual({ ...x[0], o: x[0].o.id }, { o: 'ita', k: 0, ply: 6, book: 'c3', played: [['d3', 2], ['Nc3', 1]], n: 3, of: 4 });
});

test('plan de l’ouverture jouée, pour ton camp', () => {
  assert.equal(planOf(g('e4 e5 Nf3 Nc6 Bc4 Bc5', false), OPS).text, 'Plan noir.');
  assert.equal(planOf(g('d4 d5'), OPS), null);
});

test('avec les analyses : seuls les écarts que le moteur juge moins bons comptent', () => {
  const games = [g('e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6', true, 1), g('e4 e5 Nf3 Nc6 Bc4 Bc5 Nc3 d6', true, 2), g('e4 e5 Nf3 Nc6 Bc4 Bc5 d3 d6', true, 3)];
  const ev = (after) => [0, 0, 0, 0, 0, 0, 30, after, after]; // demi-coup 6 : ton coup, 30 → after (point de vue des Blancs)
  const an = { [games[0].id]: { ev: ev(20) }, [games[1].id]: { ev: ev(-150) } }; // d3 tient, Cc3 perd ; partie 3 non analysée
  const x = theoryExits(games, OPS, an);
  assert.equal(x.length, 1);
  assert.deepEqual(x[0].played, [['Nc3', 1]]);
  assert.equal(x[0].of, 2, 'seules les parties analysées comptent');
});
