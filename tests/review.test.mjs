// Relecture de partie : symbole d'un coup, part de la barre d'évaluation, erreur précédente ou suivante. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { moveMark, evalShare, errStep } = await import('../js/review.js');
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
