// Portrait du joueur en phrases, à partir des parties analysées. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { portrait } = await import('../js/portrait.js');

const mk = (i, o) => ({ g: { id: 'g' + i, t: i, w: o.w ?? true, out: o.out, san: Array(80).fill('x'), base: 600, clk: o.clk || [] }, a: { errs: o.errs || [], maxAdv: o.max ?? 0 } });
const pack = (l) => ({ games: l.map((x) => x.g), an: Object.fromEntries(l.map((x) => [x.g.id, x.a])) });
const err = (ply, theme) => ({ ply, theme, kind: 'gaffe' });

test('portrait : phase, camp, menaces subies, parties gagnantes perdues', () => {
  const l = [];
  for (let i = 0; i < 6; i++) l.push(mk(i, { w: true, out: i < 4 ? 'W' : 'L', errs: [err(40, 'en_prise_ignore')] }));
  for (let i = 6; i < 12; i++) l.push(mk(i, { w: false, out: i < 8 ? 'W' : 'L', max: i < 10 ? 400 : 0, errs: [err(41, 'tactique_subie'), err(10, 'cadeau_rate')] }));
  const { games, an } = pack(l), p = portrait(games, an);
  const by = Object.fromEntries(p.map((x) => [x.k, x.t]));
  assert.match(by.phase, /^Tu perds tes points au milieu de partie : 67 % de tes erreurs graves entre les coups 13 et 30\.$/);
  assert.match(by.camp, /67 % de score avec les Blancs, 33 % avec les Noirs/);
  assert.match(by.style, /^Tu subis plus que tu ne rates : 67 % de tes erreurs tactiques sont des menaces adverses/);
  assert.match(by.conv, /2 parties gagnantes sur 4/);
});

test('portrait : rien sous 5 parties analysées', () => {
  const { games, an } = pack([mk(1, { out: 'W' }), mk(2, { out: 'L' })]);
  assert.deepEqual(portrait(games, an), []);
});
