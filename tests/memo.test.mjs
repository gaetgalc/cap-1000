// Cache des vues : même résultat tant que la clé ne change pas, recalcul après touch(), changement de filtre ou de jour.
process.env.TZ = 'Europe/Paris';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMemo, viewKey } from '../js/memo.js';
import { makeProgress } from '../js/progress.js';

// État minimal : S.rev, S.f et l'horloge de progress (dkey) sont les trois entrées de la clé.
function setup() {
  const S = { rev: 0, f: { tc: 'rapid', days: 0 } }, clock = { t: new Date(2026, 10, 17, 10, 0, 0).getTime() };
  const store = { get: (k, d) => d, set() {} };
  const P = makeProgress(store, () => clock.t);
  const memo = makeMemo(() => viewKey(S, P.dkey()));
  let calls = 0;
  const calc = (v = 'x') => () => { calls++; return { v, n: calls }; };
  return { S, clock, memo, calc, calls: () => calls, touch: () => { S.rev++; } };
}

test('clé stable : le calcul ne se refait pas et rend le même objet', () => {
  const { memo, calc, calls } = setup();
  const a = memo('bilan', calc()), b = memo('bilan', calc());
  assert.equal(a, b);
  assert.equal(calls(), 1);
});

test('deux noms de cache ne se mélangent pas', () => {
  const { memo, calc, calls } = setup();
  const a = memo('a', calc('a')), b = memo('b', calc('b'));
  assert.notEqual(a, b);
  assert.equal(memo('a', calc('zz')).v, 'a');
  assert.equal(calls(), 2);
});

test('touch() (import, analyse, restauration…) force le recalcul de tous les noms', () => {
  const { memo, calc, calls, touch } = setup();
  memo('a', calc()); memo('b', calc());
  touch();
  assert.equal(memo('a', calc()).n, 3);
  assert.equal(memo('b', calc()).n, 4);
  assert.equal(calls(), 4);
});

test('changement de cadence ou de période : recalcul', () => {
  const { S, memo, calc, calls } = setup();
  memo('a', calc());
  S.f = { tc: 'blitz', days: 0 };
  memo('a', calc());
  assert.equal(calls(), 2);
  S.f = { tc: 'blitz', days: 30 };
  memo('a', calc());
  assert.equal(calls(), 3);
  memo('a', calc());
  assert.equal(calls(), 3);
});

test('changement de jour (horloge injectée) : recalcul, même juste après minuit', () => {
  const { clock, memo, calc, calls } = setup();
  clock.t = new Date(2026, 10, 17, 23, 59, 30).getTime();
  memo('a', calc());
  clock.t = new Date(2026, 10, 17, 23, 59, 59).getTime();
  memo('a', calc());
  assert.equal(calls(), 1, 'même jour local : pas de recalcul');
  clock.t = new Date(2026, 10, 18, 0, 0, 1).getTime();
  memo('a', calc());
  assert.equal(calls(), 2);
});

test('un calcul qui lève une erreur n’est pas gardé', () => {
  const { memo } = setup();
  assert.throws(() => memo('a', () => { throw new Error('boum'); }));
  assert.equal(memo('a', () => 5), 5);
});
