// Regards croisés sur les parties (insights.js) : phase, pièce, heure, rang dans la session, Elo estimé. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { phaseStats, phaseJob, pieceStats, hourStats, sessionStats, perfRef, gameRating, insightText, PIECE } = await import('../js/insights.js');

// 24 demi-coups légaux (Italienne) : les 20 premiers sont l'ouverture, les suivants le milieu de partie.
const SAN = 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 Nbd2 h6 Nf1 Re8 Ng3 Be6 h3 Qd7'.split(' ');
const ev = SAN.map(() => 0).concat(0); // 25 positions, point de vue des Blancs
for (let i = 21; i < ev.length; i++) ev[i] = -300; // 11.Ng3 (demi-coup 20) perd 3 pions

test('précision par phase : ouverture parfaite, gaffe au milieu de partie', () => {
  const g = { id: 'g', w: true, san: SAN, out: 'L', t: 1 };
  const ph = Object.fromEntries(phaseStats([g], { g: { ev } }).map((x) => [x.k, x]));
  assert.equal(ph.ouverture.n, 10);
  assert.equal(ph.ouverture.acc, 100);
  assert.equal(ph.ouverture.bad, 0);
  assert.equal(ph.milieu.n, 2);
  assert.equal(ph.milieu.bad, 1);
  assert.ok(ph.milieu.acc < 90);
  assert.equal(ph.finale.n, 0);
  assert.equal(phaseStats([g], { g: { ev, bad: true } }).reduce((s, x) => s + x.n, 0), 0, 'analyse illisible ignorée');
});

test('fautes par pièce : rapportées au nombre de coups de cette pièce', () => {
  const g = { id: 'g', w: true, san: SAN };
  const an = { g: { errs: [{ ply: 20, kind: 'gaffe', played: 'Ng3' }, { ply: 22, kind: 'imprecision', played: 'h3' }] } };
  const by = Object.fromEntries(pieceStats([g], an).map((x) => [x.p, x]));
  assert.equal(by.n.moves, 4, 'Cf3, Cbd2, Cf1, Cg3');
  assert.equal(by.n.bad, 1);
  assert.equal(by.p.bad, 0, 'une imprécision ne compte pas');
  assert.equal(by.k.moves, 1, 'le roque est un coup du roi');
  assert.equal(pieceStats([g], an)[0].p, 'n', 'la pièce la plus fautive en tête');
  assert.equal(PIECE.n, 'cavalier');
});

test('score par tranche horaire', () => {
  const mk = (h, out) => ({ t: h, out });
  const gs = [mk(9, 'W'), mk(10, 'W'), mk(14, 'D'), mk(20, 'L'), mk(23, 'L'), mk(2, 'L')];
  const by = Object.fromEntries(hourStats(gs, (t) => t).map((x) => [x.k, x]));
  assert.equal(by.matin.n, 2); assert.equal(by.matin.score, 100);
  assert.equal(by.aprem.score, 50);
  assert.equal(by.soir.n, 1);
  assert.equal(by.nuit.n, 2, '23 h et 2 h');
});

test('rang dans la session : une pause de plus d’une heure ouvre une nouvelle session', () => {
  const H = 3600, gs = [
    { t: 0, out: 'W' }, { t: 900, out: 'W' }, { t: 1800, out: 'L' }, { t: 2700, out: 'L' }, // 1re, 2e, 3e, 4e
    { t: 10 * H, out: 'W' }, { t: 10 * H + 1200, out: 'L' },                               // nouvelle session
  ];
  const by = Object.fromEntries(sessionStats(gs).map((x) => [x.k, x]));
  assert.equal(by[1].n, 2); assert.equal(by[1].score, 100);
  assert.equal(by[2].n, 2); assert.equal(by[2].score, 50);
  assert.equal(by[3].n, 2, '3e partie et au-delà réunies'); assert.equal(by[3].score, 0);
});

test('Elo estimé : repère personnel, borné à 400 points de ton classement', () => {
  const gs = [], an = {};
  for (let i = 0; i < 12; i++) { gs.push({ id: 'x' + i, t: i, r: 900, tc: 'rapid' }); an['x' + i] = { acc: 70 }; }
  const ref = perfRef(gs, an);
  assert.deepEqual(ref, { elo: 900, acc: 70, n: 12 });
  assert.equal(gameRating(70, ref), 900);
  assert.equal(gameRating(80, ref), 1150);
  assert.equal(gameRating(99, ref), 1300, 'borné');
  assert.equal(gameRating(null, ref), null);
  assert.equal(gameRating(70, perfRef(gs.slice(0, 5), an)), null, 'moins de 10 parties : pas d’estimation');
});

test('phrases : ne disent que les écarts nets', () => {
  const s = (k, n, score) => ({ k, label: k, n, score });
  const t = insightText({ sessions: [s(1, 20, 60), s(2, 15, 52), s(3, 12, 35)], hours: [], phases: [], pieces: [] });
  assert.match(t[0], /3e partie/);
  assert.deepEqual(insightText({ sessions: [s(1, 20, 50), s(2, 15, 49), s(3, 12, 47)], hours: [], phases: [], pieces: [] }), []);
});

test('phrase sur la pièce : accordée au féminin pour la dame et la tour', () => {
  const pc = (p, name, moves, bad) => ({ p, name, moves, bad, rate: bad / moves });
  const t = insightText({ pieces: [pc('q', 'dame', 33, 11), pc('n', 'cavalier', 60, 4)] });
  assert.match(t[0], /^Ta dame .* Avant de la jouer/);
  assert.match(insightText({ pieces: [pc('n', 'cavalier', 33, 11), pc('q', 'dame', 60, 4)] })[0], /^Ton cavalier .* Avant de le jouer/);
});

test('calcul par phase en tranches : même résultat que d’un coup, au moins une partie par tranche', () => {
  const games = [1, 2, 3, 4, 5].map((t) => ({ id: 'g' + t, w: t % 2 === 1, san: SAN, out: 'L', t }));
  const an = Object.fromEntries(games.map((g) => [g.id, { ev: g.id === 'g4' ? [] : ev, bad: g.id === 'g5' }]));
  const job = phaseJob(games, an);
  assert.equal(job.done, false);
  let clock = 0, slices = 0;
  const now = () => (clock += 10); // chaque lecture de l'horloge coûte 10 ms : une partie par tranche de 15 ms
  while (!job.step(15, now)) slices++;
  assert.ok(slices >= 2, 'plusieurs tranches');
  assert.equal(job.done, true);
  assert.deepEqual(job.result(), phaseStats(games, structuredClone(an)), 'référence calculée sur des analyses neuves, pas sur le cache du job');
  assert.equal(phaseJob(games, an).step(0, () => 0), false, 'une tranche de 0 ms traite quand même une partie, sans finir');
});

test('cache par analyse : même objet réutilisé, analyse remplacée recalculée', () => {
  const g = { id: 'g', w: true, san: SAN, out: 'L', t: 1 }, a = { ev: [...ev] };
  const total = (an) => phaseStats([g], an).reduce((s, x) => s + x.bad, 0);
  assert.equal(total({ g: a }), 1);
  a.ev = ev.map(() => 0); // modifiée sur place : le cache garde l'ancien résultat (une analyse n'est jamais modifiée ainsi)
  assert.equal(total({ g: a }), 1, 'même objet : réutilisé');
  assert.equal(total({ g: { ev: ev.map(() => 0) } }), 0, 'objet neuf : recalculé');
});
