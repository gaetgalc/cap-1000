// Réponses aux coups adverses : lignes du moteur (MultiPV) mises en « coup → meilleure réponse ». node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { replyRows, repliesHead } = await import('../js/replies.js');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

test('chaque ligne donne le coup, la meilleure réponse et l’éval du point de vue du joueur', () => {
  // Trait aux Noirs, éval du moteur du point de vue des Noirs : -30 = +0,3 pour les Blancs.
  const rows = replyRows(AFTER_E4, [{ cp: -30, pv: ['e7e5', 'g1f3', 'b8c6'] }, { cp: -40, pv: ['c7c5', 'g1f3'] }], 'w');
  assert.deepEqual(rows.map((r) => [r.san, r.reply?.san, r.cp]), [['e5', 'Nf3', 30], ['c5', 'Nf3', 40]]);
  assert.equal(rows[0].uci, 'e7e5');
  assert.equal(rows[0].reply.uci, 'g1f3');
});

test('du point de vue des Noirs, l’éval change de signe', () => {
  const rows = replyRows(START, [{ cp: 30, pv: ['e2e4', 'e7e5'] }], 'b');
  assert.equal(rows[0].cp, -30);
  assert.equal(rows[0].reply.san, 'e5');
});

test('un coup sans réponse connue (mat, ligne courte) garde reply à null ; une ligne illégale ou vide est écartée', () => {
  const mate = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'; // Blancs matés
  assert.deepEqual(replyRows(mate, [], 'w'), []);
  const fool = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
  const rows = replyRows(fool, [{ cp: 99990, pv: ['d8h4'] }, { cp: 0, pv: [] }, { cp: 0, pv: ['a1a8'] }], 'b');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].san, 'Qh4#');
  assert.equal(rows[0].reply, null);
});

test('le titre dit qui joue : l’adversaire au trait → « S’il joue », toi au trait → « Si tu joues »', () => {
  assert.equal(repliesHead(AFTER_E4, 'w').who, 'opp');
  assert.equal(repliesHead(START, 'w').who, 'me');
  assert.match(repliesHead(AFTER_E4, 'w').title, /il joue/);
  assert.match(repliesHead(START, 'w').reply, /il répond/);
  assert.match(repliesHead(AFTER_E4, 'w').reply, /réponds/);
});

const { moveImpact } = await import('../js/replies.js');
test('impact d’un coup : écart avec le meilleur coup, du point de vue de celui qui joue', () => {
  // before.cp : éval avant le coup, pour celui qui joue ; after.cp : éval après, pour l'adversaire (au trait).
  const best = moveImpact({ cp: 40, best: 'e2e4' }, { cp: -40 }, 'e2e4');
  assert.deepEqual([best.kind, best.delta], ['best', 0]);
  const ok = moveImpact({ cp: 40, best: 'e2e4' }, { cp: -20 }, 'd2d4');
  assert.deepEqual([ok.kind, ok.delta, ok.after], ['good', -20, 20]);
  assert.equal(moveImpact({ cp: 40, best: 'e2e4' }, { cp: 60 }, 'g2g4').kind, 'imprecision');
  assert.equal(moveImpact({ cp: 40, best: 'e2e4' }, { cp: 150 }, 'f2f3').kind, 'erreur');
  assert.equal(moveImpact({ cp: 40, best: 'e2e4' }, { cp: 900 }, 'f2f3').kind, 'gaffe');
  assert.equal(moveImpact({ cp: 40, best: 'e2e4' }, { cp: 900 }, 'f2f3').label, 'Gaffe');
});
test('impact inconnu tant qu’une des deux évals manque', () => {
  assert.equal(moveImpact(null, { cp: 0 }, 'e2e4'), null);
  assert.equal(moveImpact({ cp: 0, best: 'e2e4' }, null, 'e2e4'), null);
});
