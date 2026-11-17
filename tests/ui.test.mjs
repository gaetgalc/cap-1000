// Formats d'affichage sans navigateur : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dfmt, datef, agoFr } from '../js/ui.js';

test('dfmt rend JJ/MM/AA', () => {
  assert.equal(dfmt(Date.UTC(2023, 10, 14, 12) / 1000), '14/11/23');
  assert.equal(dfmt(Date.UTC(2026, 0, 5, 12) / 1000), '05/01/26');
});

test('datef rend la même chaîne que toLocaleDateString', () => {
  const opts = { day: 'numeric', month: 'short' }, f = datef(opts);
  for (let i = 0; i < 50; i++) {
    const ms = Date.UTC(2021, 0, 1, 12) + i * 29 * 86400000;
    assert.equal(f(ms), new Date(ms).toLocaleDateString('fr-FR', opts));
  }
});

test('datef garde le formateur : 10 000 appels de dfmt en moins de 50 ms', () => {
  const t0 = performance.now();
  for (let i = 0; i < 10000; i++) dfmt(1700000000 + i * 3600);
  const ms = performance.now() - t0;
  assert.ok(ms < 50, `${ms.toFixed(1)} ms`);
});

test('agoFr', () => {
  assert.equal(agoFr(30e3), 'à l’instant');
  assert.equal(agoFr(3 * 60e3), 'il y a 3 min');
  assert.equal(agoFr(2 * 3600e3), 'il y a 2 h');
  assert.equal(agoFr(30 * 3600e3), 'hier');
  assert.equal(agoFr(5 * 86400e3), 'il y a 5 jours');
});
