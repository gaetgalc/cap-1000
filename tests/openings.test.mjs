// Catalogue des ouvertures : chaque ligne est légale, commence par l'ouverture, et ses commentaires tombent sur des coups existants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { Chess } = createRequire(import.meta.url)('../vendor/chess.js');
const { OPENINGS, movesOf, matchGame } = await import('../js/openings.js');

test('toutes les lignes sont légales et cohérentes', () => {
  for (const o of OPENINGS) {
    assert.ok(o.lines.length >= 1 && o.histoire.length && o.idees.w && o.idees.b, o.id);
    for (const l of o.lines) {
      const c = new Chess(), mv = movesOf(l);
      for (const [i, s] of mv.entries()) assert.ok(c.move(s), `${o.id} / ${l.n} : coup ${i} (${s}) illégal`);
      if (!l.free) assert.ok(matchGame(o, { san: mv }), `${o.id} / ${l.n} : ne commence pas par l’ouverture`);
      for (const k of Object.keys(l.notes || {})) assert.ok(+k < mv.length, `${o.id} / ${l.n} : note ${k} hors de la ligne`);
      // le dernier coup de la ligne est celui du joueur : la séance se termine sur son coup
      assert.equal((mv.length - 1) % 2 === 0 ? 'w' : 'b', l.side, `${o.id} / ${l.n} : le dernier coup doit être celui du camp joué`);
    }
  }
});

test('reconnaissance des parties : ordre des coups, Londres sans ordre fixe', () => {
  const by = (id) => OPENINGS.find((o) => o.id === id);
  assert.ok(matchGame(by('italienne'), { san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'] }));
  assert.ok(!matchGame(by('italienne'), { san: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] }));
  assert.ok(matchGame(by('londres'), { san: ['d4', 'Nf6', 'Nf3', 'e6', 'Bf4'] }));
  assert.ok(!matchGame(by('londres'), { san: ['d4', 'd5', 'c4', 'e6', 'Bf4'] }));
});
