// Débrief d'une partie en moments clés, à partir de l'analyse brute (ev) et des erreurs. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { moments } = await import('../js/debrief.js');

// Partie des Blancs, 40 demi-coups. ev : centipions du point de vue des Blancs, une valeur par position (41).
function setup(evAt, errs, extra = {}) {
  const san = Array.from({ length: 40 }, (_, i) => (i % 2 ? 'Nf6' : 'e4'));
  const ev = Array.from({ length: 41 }, (_, i) => evAt(i));
  return { g: { w: true, san, out: 'L', how: 'resigned', ...extra }, a: { ev, errs } };
}
const err = (ply, theme, drop, played, bestSan, kind = 'gaffe') => ({ ply, theme, drop, played, bestSan, kind });

test('moments clés dans l’ordre de la partie : ouverture, tournant, faute, fin', () => {
  // Égalité, puis l'adversaire se trompe au demi-coup 23 (+4), puis le joueur gaffe au demi-coup 30 (−5).
  const { g, a } = setup((i) => (i <= 23 ? 20 : i <= 30 ? 400 : -500), [err(30, 'en_prise_pose', 55, 'Bd3', 'Re1')]);
  const m = moments(g, a);
  assert.deepEqual(m.map((x) => x.k), ['ouv', 'tour', 'faute', 'fin']);
  assert.deepEqual(m.map((x) => x.ply), [20, 24, 30, 40], 'le tournant se montre après le coup adverse : à toi de le punir');
  assert.match(m[0].text, /équilibrée/);
  assert.match(m[1].text, /^Coup 12 : ton adversaire joue Cf6 et te donne l’avantage/);
  assert.match(m[1].text, /tu en profites/);
  assert.match(m[2].text, /^Coup 16 : Fd3 au lieu de Te1 \(Pièce posée en prise\)/);
  assert.match(m[3].text, /^Défaite \(abandon\)\. Tu as eu jusqu’à \d+ % de chances de gain : la partie était gagnable\./);
});

test('tournant non puni : ta réponse est racontée avec lui ; l’occasion manquée est un moment à part', () => {
  const { g, a } = setup((i) => (i <= 23 ? 0 : 400), [err(24, 'tactique_ratee', 30, 'Nc3', 'Qh5+'), err(28, 'cadeau_rate', 25, 'a3', 'Bxf7'), err(34, 'en_prise_pose', 40, 'Bd3', 'Re1')], { out: 'W', how: 'timeout' });
  const m = moments(g, a);
  assert.deepEqual(m.map((x) => x.k), ['ouv', 'tour', 'rate', 'faute', 'fin']);
  assert.match(m[1].text, /tu ne le punis pas : Cc3 au lieu de Dh5\+ \(Tactique ratée\)/);
  assert.match(m[2].text, /^Coup 15 : Fxf7 gagnait/);
  assert.match(m[4].text, /^Victoire \(temps\)\./);
});

test('partie courte, sans erreur ni tournant : début et fin seulement', () => {
  const san = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'];
  const m = moments({ w: true, san, out: 'W', how: 'checkmated' }, { ev: [20, 20, 30, 30, 40, 40, 60, 100000], errs: [] });
  assert.deepEqual(m.map((x) => x.k), ['ouv', 'fin']);
  assert.equal(m[0].ply, 7);
  assert.match(m[1].text, /^Victoire \(mat\)/);
});

test('tournant non puni par la faute décisive : un seul moment, qui dit tout', () => {
  const { g, a } = setup((i) => (i <= 23 ? 0 : i === 24 ? 400 : -500), [err(24, 'en_prise_pose', 60, 'Bb7', 'Bxa8')]);
  const m = moments(g, a);
  assert.deepEqual(m.map((x) => x.k), ['ouv', 'tour', 'fin']);
  assert.match(m[1].text, /Mais tu ne le punis pas : Fb7 au lieu de Fxa8 \(Pièce posée en prise\), tes chances de gain passent de \d+ % à \d+ %\./);
});

test('sortie de l’ouverture : le plan typique de l’ouverture jouée est rappelé', () => {
  const { g, a } = setup(() => 0, []);
  const m = moments(g, a, { plan: 'Le fou en c4 vise f7.', name: 'Partie italienne' });
  assert.match(m[0].text, /Partie italienne, le plan pour ton camp : Le fou en c4 vise f7\.$/);
});
