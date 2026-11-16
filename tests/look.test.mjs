// Réglages d'apparence (cap1000:look) : valeurs lues, classes posées sur la page, vitesse de lecture. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { DEFAULT, normalize, classesOf, speedOf, clampSize, PALETTES, PIECES, SPEEDS } = await import('../js/look.js');
const { pack } = await import('../js/backup.js');

test('apparence : valeurs par défaut, et toute valeur inconnue ou abîmée revient au défaut', () => {
  assert.deepEqual(normalize(undefined), DEFAULT);
  assert.deepEqual(normalize('n’importe quoi'), DEFAULT);
  assert.deepEqual(normalize({ pal: 'rose', pc: 'xkcd', coords: 'oui', speed: 'turbo', size: 'grand' }), DEFAULT);
  assert.deepEqual(normalize({ pal: 'bois', pc: 'merida', coords: false, speed: 'lent', size: 600 }), { pal: 'bois', pc: 'merida', coords: false, speed: 'lent', size: 600 });
  assert.equal(DEFAULT.pal, 'vert'); assert.equal(DEFAULT.pc, 'cburnett'); assert.equal(DEFAULT.coords, true); assert.equal(DEFAULT.speed, 'normal'); assert.equal(DEFAULT.size, null);
  assert.equal(PALETTES.length, 3); assert.ok(PIECES.length >= 1); assert.equal(SPEEDS.length, 3);
});

test('apparence : une classe par réglage qui s’écarte du défaut, rien pour le défaut', () => {
  assert.deepEqual(classesOf(DEFAULT), []);
  assert.deepEqual(classesOf({ ...DEFAULT, pal: 'bleu', pc: 'chessnut', coords: false }).sort(), ['nocoords', 'pal-bleu', 'pc-chessnut']);
});

test('vitesse de lecture : lente plus longue, rapide plus courte', () => {
  assert.equal(speedOf('normal'), 1);
  assert.ok(speedOf('lent') > 1); assert.ok(speedOf('rapide') < 1);
  assert.equal(speedOf('inconnue'), 1);
});

test('taille de l’échiquier : bornée, ou rien (taille automatique)', () => {
  assert.equal(clampSize(100), 320); assert.equal(clampSize(5000), 1000); assert.equal(clampSize(612.4), 612);
  assert.equal(clampSize(null), null); assert.equal(clampSize(NaN), null);
});

test('la sauvegarde emporte les réglages d’apparence', () => {
  const b = pack('gaet', { look: { pal: 'bois' }, key: 'secret' }, { data: null, an: {}, ai: {} }, 1);
  assert.deepEqual(b.ls.look, { pal: 'bois' });
});
