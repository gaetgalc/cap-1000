// Explorateur Lichess filtré par niveau (explorer.js) : adresse, lecture de la réponse, erreurs. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { explorerUrl, explorerRows, fetchExplorer, RATINGS } = await import('../js/explorer.js');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DATA = { white: 500, draws: 100, black: 400, opening: { eco: 'C50', name: 'Italian Game' }, moves: [
  { uci: 'e2e4', san: 'e4', white: 300, draws: 50, black: 150, averageRating: 1450 },
  { uci: 'g1f3', san: 'Nf3', white: 100, draws: 50, black: 250, averageRating: 1500 },
  { uci: 'a2a3', san: 'a3', white: 0, draws: 0, black: 1 },
] };

test('adresse : base Lichess, parties rapides et blitz, joueurs de ton niveau', () => {
  const u = new URL(explorerUrl(START));
  assert.equal(u.host, 'explorer.lichess.ovh');
  assert.equal(u.searchParams.get('fen'), START);
  assert.equal(u.searchParams.get('ratings'), RATINGS.join(','));
  assert.equal(u.searchParams.get('speeds'), 'blitz,rapid');
});

test('lignes : part de chaque coup et score du camp au trait, en notation française', () => {
  const r = explorerRows(DATA, 'w');
  assert.equal(r.total, 1000);
  assert.deepEqual(r.rows.map((x) => [x.san, x.pct, x.score]), [['e4', 50, 65], ['Cf3', 40, 31], ['a3', 0, 0]]);
  assert.equal(explorerRows(DATA, 'b').rows[0].score, 35, 'aux Noirs, le score est celui des Noirs');
  assert.equal(r.opening, 'Italian Game');
  assert.deepEqual(explorerRows({}, 'w'), { total: 0, rows: [], opening: '' });
});

test('erreurs : message lisible, réponse gardée en mémoire', async () => {
  let calls = 0;
  const ok = async () => { calls++; return { ok: true, status: 200, json: async () => DATA }; };
  await fetchExplorer(START, ok); await fetchExplorer(START, ok);
  assert.equal(calls, 1, 'même position : pas de seconde requête');
  await assert.rejects(fetchExplorer('x', async () => ({ ok: false, status: 429 })), /limite/);
  await assert.rejects(fetchExplorer('y', async () => ({ ok: false, status: 401 })), /connexion/);
  await assert.rejects(fetchExplorer('z', async () => { throw new Error('net'); }), /ne répond pas/);
});
