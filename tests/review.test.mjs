// Relecture de partie : symbole d'un coup, part de la barre d'évaluation, erreur précédente ou suivante. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { moveMark, evalShare, errStep, gaffeTrail } = await import('../js/review.js');
const { MATE } = await import('../js/classify.js');

test('symbole : ?? gaffe, ? erreur, ?! imprécision, avec la couleur du site', () => {
  assert.deepEqual(moveMark({ kind: 'gaffe' }), { s: '??', c: 'bad', t: 'Gaffe' });
  assert.deepEqual(moveMark({ kind: 'erreur' }), { s: '?', c: 'warn', t: 'Erreur' });
  assert.deepEqual(moveMark({ kind: 'imprecision' }), { s: '?!', c: 'ink3', t: 'Imprécision' });
});

test('symbole ! : meilleur coup joué quand un seul coup tenait', () => {
  // mp : évaluations des 3 meilleurs coups (camp au trait) ; le deuxième perd plus de 6 points de chances de gain
  assert.deepEqual(moveMark(null, { played: 'e2e4', best: 'e2e4', mp: [300, -50, -200] }), { s: '!', c: 'good', t: 'Seul bon coup' });
  assert.equal(moveMark(null, { played: 'e7e8q', best: 'e7e8q', mp: [MATE - 1, 0] })?.s, '!');
});

test('pas de symbole : coup ordinaire, plusieurs coups tenaient, ou pas de calcul des coups qui tiennent', () => {
  assert.equal(moveMark(null, { played: 'e2e4', best: 'e2e4', mp: [30, 25, 10] }), null);
  assert.equal(moveMark(null, { played: 'e2e4', best: 'e2e4' }), null);
  assert.equal(moveMark(null, { played: 'd2d4', best: 'e2e4', mp: [300, -50, -200] }), null);
  assert.equal(moveMark(undefined, {}), null);
  assert.equal(moveMark(null, { played: 'e1f1', best: 'e1f1', mp: [-40] }), null, 'coup forcé (un seul coup légal) : pas de « ! »');
});

test('barre d’évaluation : part des Blancs entre 0 et 1, égalité au milieu, mat aux extrêmes', () => {
  assert.equal(evalShare(0), 0.5);
  assert.ok(evalShare(200) > 0.6 && evalShare(200) < 0.75);
  assert.equal(evalShare(MATE - 3), 1);
  assert.equal(evalShare(-MATE + 2), 0);
  assert.equal(evalShare(150) + evalShare(-150), 1);
  assert.equal(evalShare(undefined), 0.5);
});

test('erreur précédente ou suivante : positions des erreurs, sans boucler', () => {
  const plies = [4, 11, 20];
  assert.equal(errStep(plies, 0, 1), 4);
  assert.equal(errStep(plies, 4, 1), 11);
  assert.equal(errStep(plies, 12, 1), 20);
  assert.equal(errStep(plies, 20, 1), null);
  assert.equal(errStep(plies, 20, -1), 11);
  assert.equal(errStep(plies, 5, -1), 4);
  assert.equal(errStep(plies, 4, -1), null);
  assert.equal(errStep([], 3, 1), null);
});

test('fil des gaffes (accueil) : de la plus récente partie à la plus ancienne, une étape par gaffe', () => {
  const G = (t, tc = 'rapid') => ({ id: 'g' + t, t, tc });
  const e = (ply, kind, drop = 20) => ({ ply, kind, drop, best: 'e2e4' });
  const games = [G(1), G(2), G(3), G(4), G(5, 'blitz'), G(6)];
  const an = {
    g1: { errs: [e(30, 'gaffe')] },
    g2: { errs: [e(40, 'gaffe'), e(12, 'gaffe'), e(20, 'erreur'), e(25, 'imprecision')] }, // 2 gaffes, dans l'ordre de la partie
    g3: { errs: [e(10, 'erreur', 10), e(14, 'erreur', 30), e(16, 'imprecision')] },      // pas de gaffe : sa pire erreur
    g4: { errs: [] },                                                                      // partie propre : une étape sans faute
    g6: { bad: true },
  };
  const t = gaffeTrail(games, an, 'rapid');
  assert.deepEqual(t.map((x) => [x.g.t, x.e?.ply ?? null, x.i, x.n]), [[4, null, 0, 0], [3, 14, 0, 0], [2, 12, 1, 2], [2, 40, 2, 2], [1, 30, 1, 1]]);
});

test('fil des gaffes : la partie la plus récente non analysée reste en tête', () => {
  const t = gaffeTrail([{ id: 'a', t: 1, tc: 'rapid' }, { id: 'b', t: 2, tc: 'rapid' }], { a: { errs: [{ ply: 8, kind: 'gaffe', best: 'e2e4' }] } }, 'rapid');
  assert.deepEqual(t.map((x) => [x.g.id, x.e?.ply ?? null, !!x.pending]), [['b', null, true], ['a', 8, false]]);
});

test('moveTimes : temps passé sur chaque coup, d’après la pendule restante, l’incrément et la cadence', async () => {
  const { moveTimes, clockFmt } = await import('../js/review.js');
  // 10 min + 5 s : le premier coup de chaque camp part de la cadence de base ; ensuite pendule précédente + incrément - pendule
  const g = { base: 600, inc: 5, san: ['e4', 'e5', 'Nf3', 'Nc6'], clk: [603, 600, 590, 580] };
  assert.deepEqual(moveTimes(g), [2, 5, 18, 25]);
  assert.equal(moveTimes({ base: 600, inc: 0, san: ['e4', 'e5'], clk: [600] }), null); // pendule incomplète
  assert.equal(moveTimes({ base: 0, inc: 0, san: ['e4'], clk: [] }), null); // partie par correspondance
  assert.equal(clockFmt(4), '4 s');
  assert.equal(clockFmt(75), '1:15');
});

test('clocksAt : pendule de chaque camp après k demi-coups (cadence de base avant son premier coup)', async () => {
  const { clocksAt } = await import('../js/review.js');
  const g = { base: 600, inc: 0, san: ['e4', 'e5', 'Nf3', 'Nc6'], clk: [598, 590, 570, 560] };
  assert.deepEqual(clocksAt(g, 0), { w: 600, b: 600 });
  assert.deepEqual(clocksAt(g, 1), { w: 598, b: 600 });
  assert.deepEqual(clocksAt(g, 4), { w: 570, b: 560 });
  assert.equal(clocksAt({ base: 600, san: ['e4'], clk: [] }, 1), null);
});
