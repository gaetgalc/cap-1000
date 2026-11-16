// Exercices de plan : positions calmes de tes parties, trois idées à départager. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { ideaPositions, ideaChoices } = await import('../js/ideas.js');
const FEN = '4k3/pp3ppp/8/8/4P3/2N5/PPP2PPP/4K3 w - - 0 20';
const E = { ply: 38, fen: FEN, best: 'c3d5', bestSan: 'Nd5', playedUci: 'a2a3', played: 'a3', punish: [], line: ['Nd5'], kind: 'imprecision', theme: null, e0: 40 };

test('trois idées : celle du meilleur coup (la bonne), celle du coup joué, une autre plausible', () => {
  const c = ideaChoices(FEN, E, 'w');
  assert.equal(c.length, 3);
  assert.equal(c.filter((x) => x.good).length, 1);
  assert.match(c.find((x) => x.good).text, /^Installer ton cavalier en d5/);
  assert.equal(c.find((x) => x.mv === 'a2a3').text, 'Jouer ton pion en a3.');
  const third = c.find((x) => !x.good && x.mv !== 'a2a3');
  assert.ok(third.check, 'la troisième idée doit être vérifiée par le moteur');
  assert.notEqual(third.k, 'outpost');
  assert.deepEqual(ideaChoices(FEN, E, 'w').map((x) => x.mv), c.map((x) => x.mv), 'ordre stable pour une même position');
});

test('positions retenues : coup du joueur, après le 8e coup, position calme, idée nette pour le meilleur coup', () => {
  const g = { id: 'g1', t: 5, w: true, san: [] };
  const errs = [E, { ...E, ply: 10 }, { ...E, ply: 40, e0: 900 }, { ...E, ply: 42, kind: 'gaffe', theme: 'en_prise_pose' }, { ...E, ply: 44, best: 'e1d2', line: ['Kd2'] }];
  const list = ideaPositions([g, { id: 'g2', t: 6 }], { g1: { errs }, g2: { bad: true } });
  assert.deepEqual(list.map((x) => x.id), ['5:38']);
});

test('le meilleur coup doit être calme : ni prise, ni échec', () => {
  const g = { id: 'g1', t: 5, w: true, san: [] };
  const cap = '4k3/pp3ppp/8/3p4/4P3/2N5/PPP2PPP/4K3 w - - 0 20', chk = '4k3/pp3ppp/8/8/4P3/2N5/PPP2PPP/4KB2 w - - 0 20';
  const list = ideaPositions([g], { g1: { errs: [E, { ...E, ply: 40, fen: cap, line: ['Nxd5'] }, { ...E, ply: 42, fen: chk, best: 'f1b5', line: ['Bb5+'] }] } });
  assert.deepEqual(list.map((x) => x.id), ['5:38']);
});

test('jamais deux idées identiques ; le roque se dit « Roquer »', () => {
  const fen = 'r3k2r/pppq1ppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQ1PPP/R3K2R w KQkq - 0 10';
  const c = ideaChoices(fen, { ...E, fen, best: 'c3d5', line: ['Nd5'], playedUci: 'e1g1', punish: [] }, 'w');
  assert.equal(new Set(c.map((x) => x.text)).size, c.length);
  assert.equal(c.find((x) => x.mv === 'e1g1')?.text, 'Roquer côté roi.');
  // Cas réel (partie du 16/11) : Db7 et Dc7 préparaient tous deux Tg4 ; le coup joué est alors décrit tel quel.
  const f2 = '1k4rr/p5q1/1p2pp2/Q1b4p/2Pp3N/3P4/P4PPP/1R2R1K1 b - - 0 21';
  const same = ideaChoices(f2, { ...E, fen: f2, best: 'g7b7', line: ['Qb7', 'Qb5', 'Rg4', 'g3'], playedUci: 'g7c7', punish: ['Qb5', 'Rg4'] }, 'b');
  assert.equal(new Set(same.map((x) => x.text)).size, same.length);
  assert.equal(same.find((x) => x.mv === 'g7c7').text, 'Jouer ta dame en c7.');
});
