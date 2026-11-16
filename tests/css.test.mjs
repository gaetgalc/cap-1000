// Feuille de style : une accolade oubliée (souvent à la fusion de deux branches) range silencieusement toutes les règles
// suivantes dans le bloc @media resté ouvert. Les navigateurs ne signalent rien : ce test le fait.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('css/app.css : accolades équilibrées, aucun bloc resté ouvert', () => {
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ''));
  let depth = 0, open = 0;
  css.split('\n').forEach((l, i) => {
    if (depth === 0 && l.includes('{')) open = i + 1;
    depth += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length;
    assert.ok(depth >= 0, `accolade fermante en trop ligne ${i + 1}`);
  });
  assert.equal(depth, 0, `bloc ouvert ligne ${open} jamais fermé`);
});
