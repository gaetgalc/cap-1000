// Prompt « Demande au coach » sur une position : seuls des faits vérifiés, et la consigne d'un entraîneur. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { positionPrompt } = await import('../js/coach.js');

test('position : pièces, coup joué, meilleur coup, suite, intention et repères, en notation française', () => {
  const fen = '4k3/pp3ppp/8/8/4P3/2N5/PPP2PPP/4K3 w - - 0 14';
  const { system, user } = positionPrompt({ fen, me: 'w', played: 'a3', best: 'c3d5', pv: ['c3d5', 'e8d7', 'e1d2'], ev: 60, context: 'Partie contre Bob (950 Elo).' });
  assert.match(system, /entraîneur/);
  assert.match(system, /texte simple/);
  assert.match(user, /Partie contre Bob/);
  assert.match(user, /Blancs : Cc3, Re1/);
  assert.match(user, /Trait aux Blancs \(toi\), coup 14/);
  assert.match(user, /Coup joué en partie : a3/);
  assert.match(user, /Meilleur coup selon le moteur : Cd5\. Suite du moteur : Cd5 Rd7 Rd2/);
  assert.match(user, /Évaluation : \+0\.6/);
  assert.match(user, /installe ton cavalier en d5/, 'intention calculée du meilleur coup');
  assert.match(user, /Colonne d ouverte/, 'repères de la position');
});

test('position sans coup joué (relecture en fin de partie) ni analyse : le prompt reste valable', () => {
  const { user } = positionPrompt({ fen: '4k3/8/8/8/8/8/8/4K3 b - - 0 40', me: 'w' });
  assert.match(user, /Trait aux Noirs \(ton adversaire\)/);
  assert.doesNotMatch(user, /Meilleur coup/);
});
