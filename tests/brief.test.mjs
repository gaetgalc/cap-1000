// Brief du coach de l'accueil : faits tirés des parties, puis trois phrases. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { briefFacts, coachBrief, CAUSES } = await import('../js/brief.js');

// Partie analysée : out (W/L/D), erreurs [ply, thème, genre], pendule optionnelle (secondes restantes après chaque demi-coup).
const game = (t, out, errs, clk) => ({ g: { id: 'g' + t, t, out, w: true, base: 600, tc: 'rapid', san: Array(60).fill('x'), clk: clk || [] }, a: { errs: errs.map(([ply, theme, kind = 'gaffe']) => ({ ply, theme, kind })) } });
const pack = (list) => ({ games: list.map((x) => x.g), an: Object.fromEntries(list.map((x) => [x.g.id, x.a])) });

test('faits : défaites liées au chantier, coup moyen et pendule, sur les 10 dernières parties analysées', () => {
  const low = Array(60).fill(90); // moins de 2 minutes avant chaque coup
  const { games, an } = pack([
    game(1, 'L', [[40, 'en_prise_pose']]), // trop ancienne : hors des 10 dernières
    ...Array.from({ length: 7 }, (_, i) => game(10 + i, 'W', [])),
    game(20, 'L', [[44, 'en_prise_pose']], low),
    game(21, 'L', [[30, 'en_prise_pose'], [50, 'en_prise_pose', 'imprecision']], low),
    game(22, 'L', [[20, 'mat_rate']]),
  ]);
  games.push({ id: 'x', t: 99, out: 'L', san: [] }); // non analysée : ignorée
  const f = briefFacts(games, an, 'en_prise_pose');
  assert.deepEqual(f, { n: 10, lost: 3, lostWith: 2, errs: 2, avgMove: 20, low: 2, timed: 2 });
});

test('brief : diagnostic chiffré, consigne du jour, critère de réussite', () => {
  const b = coachBrief({
    facts: { n: 10, lost: 5, lostWith: 4, errs: 6, avgMove: 23, low: 3, timed: 4 },
    theme: 'Pièce posée en prise', rule: 'Avant de lâcher une pièce, je regarde qui attaque sa case d’arrivée.',
    fs: { base: 1.4, now: 1.1, nAfter: 3, target: 0.7, ok: false }, cause: { n: 0, by: {}, top: null }, next: 'les puzzles de ton chantier',
  });
  assert.equal(b.diag, 'Sur tes 10 dernières parties, 4 de tes 5 défaites passent par « Pièce posée en prise », en moyenne vers le coup 23, et 3 fois sur 4 avec moins de 2 minutes à la pendule.');
  assert.equal(b.todo, 'Aujourd’hui : les puzzles de ton chantier. En partie : avant de lâcher une pièce, je regarde qui attaque sa case d’arrivée.');
  assert.equal(b.goal, 'Objectif : 0,7 par partie sur 5 parties. Tu es à 1,1.');
});

test('brief : la cause que tu donnes à tes erreurs oriente la consigne', () => {
  const b = coachBrief({
    facts: { n: 10, lost: 2, lostWith: 0, errs: 3, avgMove: 15, low: 0, timed: 3 },
    theme: 'Menace ignorée', rule: 'Après chaque coup adverse, je cherche ce qu’il attaque.',
    fs: { base: 0.6, now: null, nAfter: 0, target: 0.3, ok: false }, cause: { n: 5, by: { vu: 4, calc: 1 }, top: { id: 'vu', n: 4, share: 0.8 } }, next: null,
  });
  assert.equal(b.diag, 'Sur tes 10 dernières parties, « Menace ignorée » revient 3 fois, vers le coup 15 en moyenne. Tu me dis surtout : « Je n’ai pas vu sa menace » (4 fois sur 5).');
  assert.equal(b.todo, `Séance du jour faite. En partie : ${CAUSES.vu.tip[0].toLowerCase() + CAUSES.vu.tip.slice(1)}`);
  assert.equal(b.goal, 'Objectif : 0,3 par partie sur 5 parties. Tu es à 0,6.');
});

test('brief : sans partie analysée, chantier validé', () => {
  assert.match(coachBrief({ facts: { n: 0 }, theme: 'X', rule: 'R.', fs: null, cause: { n: 0, by: {}, top: null }, next: 'analyser tes parties' }).diag, /analys/);
  const ok = coachBrief({ facts: { n: 10, lost: 1, lostWith: 0, errs: 0, avgMove: null, low: 0, timed: 0 }, theme: 'Mat raté', rule: 'R.', fs: { base: 0.5, now: 0.1, nAfter: 6, target: 0.25, ok: true }, cause: { n: 0, by: {}, top: null }, next: null });
  assert.match(ok.diag, /plus aucune erreur de type « Mat raté »/);
  assert.match(ok.goal, /^Objectif atteint/);
});
