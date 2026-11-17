// Aides d'affichage sans état de ui.js. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { agoFr } = await import('../js/ui.js');

test('agoFr', () => {
  assert.equal(agoFr(30e3), 'à l’instant');
  assert.equal(agoFr(3 * 60e3), 'il y a 3 min');
  assert.equal(agoFr(2 * 3600e3), 'il y a 2 h');
  assert.equal(agoFr(30 * 3600e3), 'hier');
  assert.equal(agoFr(5 * 86400e3), 'il y a 5 jours');
});
