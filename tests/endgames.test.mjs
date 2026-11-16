// Finales de base (endgames.js) : positions légales, trait au joueur, consignes complètes. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { Chess } = createRequire(import.meta.url)('../vendor/chess.js');
const { ENDGAMES, egById } = await import('../js/endgames.js');

test('chaque finale est légale, jouable et complète', () => {
  const ids = new Set();
  for (const e of ENDGAMES) {
    assert.ok(!ids.has(e.id), 'id en double : ' + e.id); ids.add(e.id);
    const c = new Chess();
    assert.ok(c.load(e.fen), e.id + ' : FEN illisible');
    assert.ok(!c.game_over(), e.id + ' : partie déjà finie');
    assert.ok(!c.in_check(), e.id + ' : le joueur commence en échec');
    assert.ok(['mat', 'promo', 'nulle'].includes(e.goal), e.id + ' : but inconnu');
    assert.ok(e.limit > 0 && e.t && e.intro && e.rule && e.plan.length >= 2, e.id + ' : consigne incomplète');
    if (e.goal !== 'nulle') assert.equal(c.turn(), 'w', e.id + ' : les finales à gagner se jouent avec les Blancs');
  }
  assert.equal(egById('lucena').goal, 'promo');
  assert.ok(ENDGAMES.length >= 10);
});
