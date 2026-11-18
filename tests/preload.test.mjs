// Le graphe d'imports de js/app.js doit être entièrement préchargé par index.html
// (un aller-retour réseau au lieu d'un par niveau d'imports sur GitHub Pages).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

function reachable(entry) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    const re = /(?:import|export)\s*(?:[^'"();]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;
    for (const m of src.matchAll(re)) walk(resolve(dirname(file), m[1]));
  };
  walk(entry);
  return [...seen].map((f) => relative(root, f).split('\\').join('/')).sort();
}

const preloaded = [...html.matchAll(/<link\s+rel="modulepreload"\s+href="([^"]+)"/g)].map((m) => m[1]).sort();

test('chaque module du graphe de js/app.js est préchargé', () => {
  const missing = reachable(resolve(root, 'js/app.js')).filter((f) => !preloaded.includes(f));
  assert.deepEqual(missing, []);
});

test('chaque modulepreload désigne un module existant et atteint', () => {
  const reached = reachable(resolve(root, 'js/app.js'));
  for (const href of preloaded) {
    assert.ok(existsSync(resolve(root, href)), `${href} n'existe pas`);
    assert.ok(reached.includes(href), `${href} n'est pas importé`);
  }
  assert.equal(new Set(preloaded).size, preloaded.length, 'doublon');
});

test('les polices Geist 400, 500 et 600 sont préchargées', () => {
  for (const w of [400, 500, 600]) {
    assert.ok(html.includes(`href="vendor/fonts/geist-sans-latin-${w}-normal.woff2" as="font" type="font/woff2" crossorigin`), `Geist ${w}`);
  }
});
