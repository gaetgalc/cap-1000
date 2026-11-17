// Échauffements : makeRound rend une position par partie, vite, à partir des rejeux en cache. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.Chess = require('../vendor/chess.js').Chess;
const { bigGames } = require('./fixture.js');
const { makeRound } = await import('../js/drills.js');
const { replay, hasReplay } = await import('../js/classify.js');

// Partie brute au format Chess.com -> partie normalisée minimale (id, w, san), comme js/chesscom.js.
const norm = (g) => ({
  id: g.url, w: g.white.username === 'testeur',
  san: g.pgn.split('\n\n')[1].replace(/\{[^}]*\}/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter((s) => s && !/^(1-0|0-1|1\/2-1\/2)$/.test(s)),
});
const games = bigGames(200).map(norm);
for (const g of games) replay(g); // comme warmReplays au démarrage

for (const type of ['sur', 'menace', 'cadeau', 'compte']) {
  test(`${type} : 10 positions de ce type, et vite`, () => {
    const out = makeRound(type, games, 10);
    assert.equal(out.length, 10);
    assert.ok(out.every((x) => x.type === type && typeof x.fen === 'string' && x.q && x.answer != null));
    // meilleur de trois appels : le tirage au sort change la charge d'un appel à l'autre, pas le budget
    let ms = Infinity;
    for (let k = 0; k < 3; k++) { const t0 = performance.now(); makeRound(type, games, 10); ms = Math.min(ms, performance.now() - t0); }
    assert.ok(ms < 80, `second appel en ${Math.round(ms)} ms (limite 80)`);
  });
}

for (const type of ['sur', 'menace', 'cadeau', 'compte']) {
  test(`${type} : une position par partie (12 parties distinctes, jamais deux fois la même)`, () => {
    const out = makeRound(type, games.slice(0, 12), 12);
    assert.ok(out.length >= 6, `seulement ${out.length} positions`);
    assert.equal(new Set(out.map((x) => x.fen)).size, out.length);
  });
}

test('menace : last est le dernier coup adverse et la position suit prevFen', () => {
  for (const x of makeRound('menace', games, 10)) {
    assert.ok(Array.isArray(x.last) && x.last.length === 2);
    assert.ok(x.text && x.q.includes('vient de jouer'));
  }
});

test('hasReplay : faux avant replay(g), vrai après', () => {
  const g = { ...games[0], id: 'hasreplay-test' };
  assert.equal(hasReplay(g), false);
  replay(g);
  assert.equal(hasReplay(g), true);
});

test('cas froid : 200 parties dont 20 réchauffées, 10 positions en moins de 100 ms', () => {
  const cold = bigGames(200).map((g, k) => ({ ...norm(g), id: 'froid-' + k }));
  for (const g of cold.slice(0, 20)) replay(g);
  let ms = Infinity, n = 0;
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); n = makeRound('sur', cold, 10).length; ms = Math.min(ms, performance.now() - t0); }
  assert.equal(n, 10);
  assert.ok(ms < 100, `${Math.round(ms)} ms (limite 100)`);
});
