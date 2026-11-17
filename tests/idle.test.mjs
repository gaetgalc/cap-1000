// Repli de idle() sans requestIdleCallback : la tranche se décompte, elle n'est pas constante. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeIdle, SLICE_MS } from '../js/idle.js';

test('sans requestIdleCallback : une boucle « tant qu’il reste du temps » s’arrête après environ 12 ms', async () => {
  const clock = { t: 1000 }, idle = makeIdle({}, () => clock.t);
  const n = await new Promise((res) => idle((dl) => { let k = 0; while (dl.timeRemaining() > 2) { k++; clock.t += 1; } res(k); }));
  assert.equal(n, SLICE_MS - 2, 'arrêt quand il reste 2 ms ou moins');
  assert.ok(n >= 8 && n <= 12);
});
test('chaque tranche repart de zéro, et le temps restant ne devient jamais négatif', async () => {
  const clock = { t: 0 }, idle = makeIdle({}, () => clock.t);
  const left = await new Promise((res) => idle((dl) => { clock.t += 500; res(dl.timeRemaining()); }));
  assert.equal(left, 0);
  const fresh = await new Promise((res) => idle((dl) => res(dl.timeRemaining())));
  assert.equal(fresh, SLICE_MS);
});
test('avec requestIdleCallback : il est utilisé tel quel', () => {
  const seen = [], f = () => {};
  makeIdle({ requestIdleCallback: (g) => seen.push(g) })(f);
  assert.deepEqual(seen, [f]);
});
