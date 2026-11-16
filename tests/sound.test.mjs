// Sons : choix du son selon le coup, coup reconnu entre deux positions, réglage coupé par défaut. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { soundFor, moveBetween, moveAt, enabled, setEnabled, play } = await import('../js/sound.js');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const after = (fen, san) => { const c = new Chess(fen); c.move(san); return c.fen(); };

test('un coup simple, une prise, un roque, un échec ont chacun leur son', () => {
  const c = new Chess(START);
  assert.equal(soundFor(c.move('e4')), 'move');
  c.move('d5');
  assert.equal(soundFor(c.move('exd5')), 'capture');
  assert.equal(soundFor(new Chess('r3k3/8/8/8/8/8/8/4K2R w Kq - 0 1').move('O-O')), 'castle');
  assert.equal(soundFor(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').move('Ra8+')), 'check');
  // Une prise qui donne échec : l'échec prime
  assert.equal(soundFor(new Chess('3rk3/8/8/8/8/8/8/3RK3 w - - 0 1').move('Rxd8+')), 'check');
  // Prise en passant
  assert.equal(soundFor(new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2').move('exd6')), 'capture');
  assert.equal(soundFor(null), null);
});

test('le coup qui mène d’une position à la suivante est reconnu, sinon rien', () => {
  const a = after(START, 'e4');
  assert.equal(moveBetween(START, a)?.san, 'e4');
  assert.equal(moveBetween(START, START), null, 'même position : pas de son');
  assert.equal(moveBetween(a, START), null, 'retour en arrière : pas de son');
  assert.equal(moveBetween(START, after(a, 'e5')), null, 'deux coups d’un coup : pas de son');
  assert.equal(moveBetween(undefined, a), null, 'affichage initial : pas de son');
  assert.equal(moveBetween('pas une position', a), null);
  // Promotion autre que la dame
  const p = '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', c = new Chess(p); c.move({ from: 'e7', to: 'e8', promotion: 'n' });
  assert.equal(moveBetween(p, c.fen())?.san, 'e8=N+');
});

test('un coup joué à la main donne le coup et la position obtenue', () => {
  const r = moveAt(START, 'g1', 'f3');
  assert.equal(r.move.san, 'Nf3');
  assert.equal(r.fen, after(START, 'Nf3'));
  assert.equal(moveAt(START, 'e2', 'e5'), null);
});

test('sons coupés par défaut, réglage gardé dans cap1000:snd, play sans Web Audio ne plante pas', () => {
  assert.equal(enabled(), false);
  setEnabled(true);
  assert.equal(mem.get('cap1000:snd'), '1');
  assert.equal(enabled(), true);
  assert.doesNotThrow(() => play('move'));
  setEnabled(false);
  assert.equal(mem.has('cap1000:snd'), false);
  assert.equal(enabled(), false);
});
