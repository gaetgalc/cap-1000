// Programme de 4 semaines par chantier et bilan de la semaine. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { STAGES, programWeek, weekStats, reviewText } = await import('../js/program.js');
const D = 86400000, mon = new Date(2026, 10, 9).getTime(); // lundi 9 novembre 2026

test('semaines du programme : du lundi au dimanche, à partir de la semaine où le chantier commence', () => {
  assert.equal(STAGES.length, 4);
  const since = (mon + 2 * D) / 1000; // chantier commencé un mercredi
  assert.deepEqual(programWeek(since, mon + 3 * D), { i: 0, start: mon, prev: mon - 7 * D });
  assert.equal(programWeek(since, mon + 7 * D + 1000).i, 1, 'le lundi suivant : semaine 2');
  assert.equal(programWeek(since, mon + 40 * D).i, 4, 'au-delà de 4 semaines : programme fini');
});

test('chiffres d’une semaine : parties, erreurs du chantier, puzzles et échauffements', () => {
  const t = (d) => (mon + d * D) / 1000;
  const games = [{ id: 'a', t: t(1) }, { id: 'b', t: t(2) }, { id: 'c', t: t(9) }, { id: 'd', t: t(3) }];
  const an = { a: { errs: [{ theme: 'x', kind: 'gaffe' }, { theme: 'x', kind: 'imprecision' }] }, b: { errs: [{ theme: 'y', kind: 'gaffe' }] }, c: { errs: [] }, d: { bad: true } };
  const hist = [{ t: mon + D, k: 'm' }, { t: mon + D, k: 'm', re: 1 }, { t: mon + 2 * D, k: 'd' }, { t: mon + 8 * D, k: 'm' }];
  assert.deepEqual(weekStats({ games, an, hist, themeId: 'x', from: mon, to: mon + 7 * D }), { n: 2, errs: 1, rate: 0.5, puzzles: 1, drills: 1 });
});

test('bilan rédigé : comparaison avec la semaine d’avant', () => {
  assert.equal(reviewText({ n: 6, errs: 3, rate: 0.5, puzzles: 30, drills: 4 }, { n: 5, errs: 6, rate: 1.2, puzzles: 10, drills: 0 }, 'Pièce posée en prise'),
    'Semaine passée : 6 parties, 0,5 « Pièce posée en prise » par partie (1,2 la semaine d’avant), 30 puzzles, 4 échauffements. En progrès.');
  assert.match(reviewText({ n: 0, errs: 0, rate: null, puzzles: 12, drills: 0 }, null, 'X'), /^Semaine passée : aucune partie analysée, 12 puzzles\./);
  assert.match(reviewText({ n: 4, errs: 6, rate: 1.5, puzzles: 0, drills: 0 }, { n: 4, errs: 2, rate: 0.5, puzzles: 0, drills: 0 }, 'X'), /En recul/);
});
