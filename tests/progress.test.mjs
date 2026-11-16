// Règles de la mémoire d'entraînement, sans navigateur : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProgress, DAY } from '../js/progress.js';

// Stockage en mémoire et horloge réglable : les deux adaptateurs de test.
function setup(start = new Date(2026, 10, 15, 10, 0, 0).getTime()) {
  const data = new Map(), clock = { t: start };
  const store = { get: (k, d) => (data.has(k) ? JSON.parse(data.get(k)) : d), set: (k, v) => data.set(k, JSON.stringify(v)) };
  const P = makeProgress(store, () => clock.t);
  return { P, clock, store, tomorrow: (n = 1) => { clock.t = P.dayStart() + n * DAY + 3600000; } };
}
const pz = (id, theme = 'en_prise_pose', t = 1000, drop = 20) => ({ id, g: { t }, e: { theme, drop } });
const ids = (list) => list.map((p) => p.id);

test('un puzzle fait aujourd’hui ne revient pas aujourd’hui, quel que soit le résultat', () => {
  for (const res of [0, 1, 2]) {
    const { P, tomorrow } = setup(), all = [pz('a'), pz('b')];
    P.recordPuzzle(all[0], res);
    assert.deepEqual(ids(P.queue(all, '', false)), ['b'], `résultat ${res} : encore dans la file le jour même`);
    tomorrow();
    assert.ok(ids(P.queue(all, '', false)).includes('a'), `résultat ${res} : absent le lendemain`);
  }
});

test('réussi du premier coup : revient après 1, 3, 7, 21 puis 60 jours', () => {
  const { P, clock, tomorrow } = setup(), a = pz('a');
  for (const gap of [1, 3, 7, 21, 60, 60]) {
    const d0 = P.dayStart();
    P.recordPuzzle(a, 2);
    clock.t = d0 + gap * DAY - 60000;
    assert.equal(P.queue([a], '', false).length, 0, `revenu avant ${gap} jours`);
    clock.t = d0 + gap * DAY + 60000;
    assert.equal(P.queue([a], '', false).length, 1, `pas revenu après ${gap} jours`);
  }
  tomorrow(0);
});

test('un raté remet le compteur à zéro : retour demain, puis à nouveau 1 jour après une réussite', () => {
  const { P, clock } = setup(), a = pz('a');
  P.recordPuzzle(a, 2); clock.t += DAY; P.recordPuzzle(a, 2); // 2 réussites : prochain retour dans 3 jours
  clock.t += 3 * DAY; P.recordPuzzle(a, 1);                   // trouvé avec aide : raté
  const d0 = P.dayStart();
  clock.t = d0 + DAY + 1000; assert.equal(P.queue([a], '', false).length, 1, 'un raté revient le lendemain');
  P.recordPuzzle(a, 2);
  clock.t = P.dayStart() + DAY + 1000; assert.equal(P.queue([a], '', false).length, 1, 'après un raté, la première réussite revient au bout d’un jour');
  assert.equal(P.acquired(), 0);
});

test('un seul résultat par jour compte ; les suivants sont notés comme révisions', () => {
  const { P } = setup(), a = pz('a');
  assert.equal(P.recordPuzzle(a, 0), true);
  assert.equal(P.recordPuzzle(a, 2), false);
  assert.deepEqual(P.hist().map((h) => [h.r, h.re]), [[0, 0], [2, 1]]);
  assert.equal(P.act()[P.dkey()].pz, 1);
  assert.equal(P.todayPuzzles().length, 1);
  assert.equal(P.acquired(), 0);
});

test('objectif du jour : 8 puzzles, ou moins s’il n’y en a pas autant', () => {
  const few = setup(), three = [pz('a'), pz('b'), pz('c')];
  assert.deepEqual((({ done, due, goal }) => ({ done, due, goal }))(few.P.day(three)), { done: 0, due: 3, goal: 3 });
  few.P.recordPuzzle(three[0], 2);
  assert.deepEqual((({ done, due, goal }) => ({ done, due, goal }))(few.P.day(three)), { done: 1, due: 2, goal: 3 });
  const many = setup(), twenty = Array.from({ length: 20 }, (_, i) => pz('p' + i));
  assert.equal(many.P.day(twenty).goal, 8);
  for (const p of twenty.slice(0, 9)) many.P.recordPuzzle(p, 2);
  const d = many.P.day(twenty);
  assert.deepEqual([d.done, d.due, d.goal, d.t.length], [9, 11, 8, 9]);
});

test('le thème du chantier est compté d’abord, tous les thèmes ensuite', () => {
  const { P } = setup(), all = [pz('a', 'mat_rate'), pz('b', 'en_prise_pose'), pz('c', 'en_prise_pose')];
  assert.equal(P.day(all, 'mat_rate').due, 1);
  P.recordPuzzle(all[0], 2);
  assert.equal(P.day(all, 'mat_rate').due, 2, 'chantier épuisé : on compte les autres thèmes');
  assert.deepEqual(ids(P.queue(all, 'en_prise_pose', false)), ['b', 'c']);
});

test('ordre de la file : déjà vus d’abord, puis parties les plus récentes, puis erreurs les plus coûteuses', () => {
  const { P, tomorrow } = setup(), all = [pz('vieux', 'x', 100), pz('recent', 'x', 900), pz('cher', 'x', 900, 60), pz('vu', 'x', 50)];
  P.recordPuzzle(all[3], 0); tomorrow();
  assert.deepEqual(ids(P.queue(all, '', false)), ['vu', 'cher', 'recent', 'vieux']);
});

test('ratés du jour : sans ceux réussis depuis, ni ceux qui n’existent plus', () => {
  const { P } = setup(), [a, b, c] = [pz('a'), pz('b'), pz('c')];
  P.recordPuzzle(a, 0); P.recordPuzzle(b, 1); P.recordPuzzle(c, 2);
  assert.deepEqual(P.failedToday(), ['a', 'b']);
  P.recordPuzzle(a, 2); // révision réussie
  assert.deepEqual(P.failedToday(), ['b']);
  assert.deepEqual(P.failedToday((id) => id !== 'b'), []);
});

test('entraînement libre : tout sauf les puzzles du jour', () => {
  const { P } = setup(), all = [pz('a'), pz('b')];
  P.recordPuzzle(all[0], 2);
  assert.deepEqual(ids(P.queue(all, '', true)), ['b']);
  P.recordPuzzle(all[1], 2);
  assert.equal(P.queue(all, '', true).length, 2, 'plus rien d’autre : on repropose ceux du jour');
});

test('série : jours consécutifs, aujourd’hui ou jusqu’à hier', () => {
  const { P, tomorrow } = setup();
  assert.equal(P.streak(), 0);
  P.recordPuzzle(pz('a'), 2); tomorrow(); P.recordDrill('sur', 8, 10, 60000);
  assert.equal(P.streak(), 2);
  tomorrow(); assert.equal(P.streak(), 2, 'rien encore aujourd’hui : la série d’hier tient');
  tomorrow(); assert.equal(P.streak(), 0, 'un jour entier sans rien : série perdue');
});

test('journal borné, positions Lichess gardées pour les 60 dernières seulement', () => {
  const { P } = setup(), L = (i) => ({ id: 'L' + i, rating: 900, fen: 'f', prevFen: 'p', last: ['a1', 'a2'], lastSan: 'a2', sol: ['a2a3'], white: true, themes: [] });
  for (let i = 0; i < 70; i++) P.recordLichess(L(i), 2, 'fork', false);
  const h = P.hist();
  assert.equal(h.filter((x) => x.p).length, 60);
  assert.ok(!h[0].p && h[69].p);
  assert.deepEqual(P.lichessStat('fork'), { n: 70, ok: 70 });
  P.recordLichess(L(0), 0, 'fork', true);
  assert.deepEqual(P.lichessStat('fork'), { n: 70, ok: 70 }, 'un puzzle rejoué ne change pas le score');
  for (let i = 0; i < 700; i++) P.recordPuzzle(pz('m' + i), 2);
  assert.equal(P.hist().length, 600);
});

test('échauffements et cours comptent dans l’activité du jour', () => {
  const { P } = setup();
  P.recordDrill('menace', 7, 10, 90000);
  assert.deepEqual(P.drills().map((d) => [d.type, d.ok, d.n]), [['menace', 7, 10]]);
  P.setLessonRead('en_prise_pose', true);
  assert.equal(P.lessonsRead().en_prise_pose, true);
  assert.deepEqual(P.act()[P.dkey()], { dr: 1, les: 1 });
  P.setLessonRead('en_prise_pose', false);
  assert.deepEqual(P.act()[P.dkey()], { dr: 1 });
});

test('avis facile ou difficile : un palier de plus ou de moins, jamais le jour même, modifiable dans la journée', () => {
  const { P, clock, tomorrow } = setup(), a = pz('a');
  P.recordPuzzle(a, 2);
  assert.deepEqual(P.rateInfo('a'), { q: '', days: { e: 3, '': 1, h: 1 } });
  assert.equal(P.ratePuzzle('a', 'e'), 3);
  const d0 = P.dayStart();
  clock.t = d0 + 2 * DAY + 3600000; assert.equal(P.queue([a], '', false).length, 0, 'facile : pas avant 3 jours');
  clock.t = d0 + 3 * DAY + 3600000; assert.equal(P.queue([a], '', false).length, 1);
  assert.equal(P.ratePuzzle('a', ''), null, 'le lendemain, l’avis ne se change plus');
  P.recordPuzzle(a, 2); // deuxième réussite, après un « facile » : palier suivant, 7 jours
  assert.equal(P.ratePuzzle('a', 'h'), 3);
  assert.equal(P.ratePuzzle('a', ''), 7, 'retour à la règle');
  assert.equal(P.hist().at(-1).q, undefined, 'avis « normal » : rien de noté');
  assert.equal(P.hist()[0].q, 'e', 'l’avis de la veille reste au journal');
  P.ratePuzzle('a', 'e');
  assert.equal(P.hist().at(-1).q, 'e', 'l’avis est noté dans le journal');
  tomorrow(); const b = pz('b'); P.recordPuzzle(b, 1);
  assert.equal(P.rateInfo('b'), null, 'trouvé avec aide : pas d’avis, il revient demain');
});

test('partie gagnante rejouée : notée au journal et dans l’activité, sans compter comme un puzzle', () => {
  const { P } = setup();
  P.recordConversion(1700000000, 2, 31);
  P.recordConversion(1700000000, 0, 12);
  assert.deepEqual(P.conversions().map((h) => [h.id, h.r, h.n]), [['1700000000', 2, 31], ['1700000000', 0, 12]]);
  assert.equal(P.act()[P.dkey()].cv, 2);
  assert.equal(P.todayPuzzles().length, 0);
});

test('lignes d’ouverture : même calendrier que les puzzles, mémoire séparée, nouvelle tant que jamais récitée', () => {
  const { P, clock, store } = setup();
  assert.equal(P.lineState('italienne:0'), null);
  assert.deepEqual(P.linesDue(['italienne:0']), [], 'une ligne jamais apprise n’est pas à réviser');
  assert.ok(P.recordLine('italienne:0', 2));
  assert.ok(!P.recordLine('italienne:0', 0), 'un seul résultat par jour');
  assert.equal(store.get('pz', null), null, 'les puzzles ne sont pas touchés');
  assert.equal(P.acquired(), 0);
  const d0 = P.dayStart();
  clock.t = d0 + DAY + 3600000;
  assert.deepEqual(P.linesDue(['italienne:0', 'x']), ['italienne:0']);
  P.recordLine('italienne:0', 2); clock.t = P.dayStart() + 3 * DAY + 3600000; P.recordLine('italienne:0', 2);
  assert.ok(P.lineState('italienne:0').acquise, 'acquise après trois réussites espacées');
  assert.equal(P.act()[P.dkey()].op, 1);
  assert.deepEqual(P.hist().map((h) => [h.k, h.r, h.re]).slice(0, 2), [['o', 2, 0], ['o', 0, 1]]);
});

test('réussites d’affilée du jour : série en cours et meilleure série, révisions et veille ignorées', () => {
  const { P, tomorrow } = setup();
  assert.deepEqual(P.run(), { cur: 0, best: 0 });
  P.recordPuzzle(pz('v'), 2); P.recordPuzzle(pz('w'), 2);
  tomorrow(); // la veille ne compte pas
  for (const [id, r] of [['a', 2], ['b', 2], ['c', 2], ['d', 1], ['e', 2]]) P.recordPuzzle(pz(id), r);
  assert.deepEqual(P.run(), { cur: 1, best: 3 });
  P.recordPuzzle(pz('d'), 0); // révision du jour : ni casse ni prolonge la série
  P.recordPuzzle(pz('f'), 2); P.recordPuzzle(pz('g'), 2);
  assert.deepEqual(P.run(), { cur: 3, best: 3 });
  P.recordPuzzle(pz('h'), 2);
  assert.deepEqual(P.run(), { cur: 4, best: 4 });
  P.recordPuzzle(pz('i'), 0);
  assert.deepEqual(P.run(), { cur: 0, best: 4 });
});

test('cause d’une erreur : une réponse par puzzle, modifiable, et la cause dominante sur les 30 dernières', () => {
  const { P, clock } = setup();
  assert.equal(P.causes().n, 0);
  assert.equal(P.causes().top, null);
  P.recordCause('a', 'vu'); P.recordCause('b', 'calc'); P.recordCause('c', 'vu');
  P.recordCause('b', 'vu'); // l'élève corrige sa réponse
  assert.equal(P.causeOf('b'), 'vu');
  assert.deepEqual(P.causes(), { n: 3, by: { vu: 3 }, top: { id: 'vu', n: 3, share: 1 } });
  P.recordCause('d', 'nimporte'); // cause inconnue : ignorée
  assert.equal(P.causes().n, 3);
  for (let i = 0; i < 30; i++) { clock.t += 1000; P.recordCause('t' + i, 'temps'); }
  assert.deepEqual(P.causes().by, { temps: 30 }, 'seules les 30 dernières réponses comptent');
});

test('auto-évaluation d’une partie et exercice de plan : notés, relus, au journal', () => {
  const { P } = setup();
  assert.equal(P.selfOf('g1'), null);
  P.recordSelf('g1', true); P.recordSelf('g1', false);
  assert.equal(P.selfOf('g1').y, false, 'la dernière réponse compte');
  P.recordIdea('5:38', true); P.recordIdea('5:40', false);
  assert.deepEqual(P.hist().filter((h) => h.k === 'i').map((h) => [h.id, h.r]), [['5:38', 2], ['5:40', 0]]);
  assert.equal(P.act()[P.dkey()].idea, 2);
});

test('Rush : score noté au journal, record par mode', () => {
  const { P } = setup();
  assert.deepEqual(P.rushBest(), { t3: 0, surv: 0 });
  assert.equal(P.recordRush('t3', 12, 15), true, 'premier score : record');
  assert.equal(P.recordRush('t3', 9, 12), false);
  assert.equal(P.recordRush('surv', 20, 23), true);
  assert.deepEqual(P.rushBest(), { t3: 12, surv: 20 });
  const h = P.hist().filter((x) => x.k === 'r');
  assert.deepEqual(h.map((x) => [x.m, x.ok, x.n]), [['t3', 12, 15], ['t3', 9, 12], ['surv', 20, 23]]);
  assert.equal(P.act()[P.dkey()].rush, 3);
});

test('finale : même répétition espacée que les lignes, mémoire séparée', () => {
  const { P, tomorrow } = setup();
  assert.equal(P.endgameState('kq'), null);
  P.recordEndgame('kq', 2);
  const s = P.endgameState('kq');
  assert.equal(s.ok, 1); assert.equal(s.aReviser, false);
  tomorrow(1);
  assert.equal(P.endgameState('kq').aReviser, true);
  assert.deepEqual(P.endgamesDue(['kq', 'lucena']), ['kq'], 'une finale jamais jouée n’est pas à réviser');
  assert.equal(P.lineState('kq'), null, 'pas mélangée aux lignes d’ouverture');
  assert.equal(P.hist().at(-1).k, 'f');
});

test('partie jouée depuis une position de la relecture : notée au journal', () => {
  const { P } = setup();
  P.recordPlay('123', 30, 'gagne', 14);
  assert.deepEqual((({ k, id, ply, why, n }) => ({ k, id, ply, why, n }))(P.hist().at(-1)), { k: 'j', id: '123', ply: 30, why: 'gagne', n: 14 });
});
