// Explications sans IA : quelques positions de référence. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { buildLine, insight, settle, material, hintFor, moveText } = await import('../js/explain.js');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('une suite qui finit par un mat se construit (régression du 15/11) et le dit', () => {
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const line = buildLine(fen, ['h5f7'], 'w', true);
  assert.equal(line.length, 1);
  assert.ok(line[0].tags.mate && Array.isArray(line[0].tags.shapes));
  assert.match(line[0].text, /échec et mat\.$/);
  assert.match(insight(fen, 'w', line, []).idee, /mat/);
  assert.match(hintFor(fen, 'h5f7', 'w'), /échecs/);
});

test('fourchette avec échec : le texte la nomme, les flèches visent le roi et la tour', () => {
  const [s] = buildLine('r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', ['d5c7'], 'w', true);
  assert.match(s.text, /Fourchette/);
  assert.deepEqual(s.tags.shapes.map((q) => q.dest).sort(), ['a8', 'e8']);
  assert.ok(s.tags.shapes.every((q) => q.orig === 'c7' && q.by === 'mover'));
});

test('pièce posée en prise : signalée dans la suite de ton coup, pas dans la bonne suite', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'; // les Noirs jouent Dh4, que le cavalier prend
  const mine = buildLine(fen, ['d8h4'], 'b', false)[0], best = buildLine(fen, ['d8h4'], 'b', true)[0];
  assert.match(mine.text, /peut être prise par son cavalier/);
  assert.deepEqual(mine.tags.shapes.map((q) => [q.orig, q.dest, q.by]), [['f3', 'h4', 'other']]);
  assert.equal(best.tags.shapes.length, 0);
});

test('échange : la reprise annonce le bilan, et le matériel se compte du point de vue du joueur', () => {
  const line = buildLine(START, ['e2e4', 'd7d5', 'e4d5', 'd8d5'], 'w', true);
  assert.match(line[3].text, /reprend en d5.*égalité/);
  assert.deepEqual(line.map((s) => s.mat), [0, 0, 1, 0]);
  assert.equal(material('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1', 'b'), -9);
});

test('une suite ne s’arrête jamais au milieu d’un échange', () => {
  const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5'];
  assert.deepEqual(settle(START, moves, 3), moves.slice(0, 4), 'la prise en d5 peut être reprise : la suite va jusqu’à la reprise');
  assert.deepEqual(settle(START, moves.slice(0, 3), 3), moves.slice(0, 2), 'plus de coups disponibles : la suite recule avant l’échange');
  assert.deepEqual(settle(START, moves, 5), moves.slice(0, 5));
  assert.deepEqual(settle(START, ['e2e5'], 5), ['e2e5'], 'coup illégal : au moins le premier coup est rendu');
});

test('coup calme d’une suite : son intention est dite (prépare, case forte, colonne)', () => {
  assert.match(buildLine(START, ['e2e4', 'e7e5', 'f1c4'], 'w', true)[0].text, /Ce coup prépare Fc4/);
  const col = buildLine('4k3/pp3ppp/8/8/8/8/PP3PPP/R3K3 w - - 0 1', ['a1d1'], 'w', true)[0].text;
  assert.match(col, /colonne d, ouverte/);
  assert.doesNotMatch(col, /sans pion devant elle/, 'pas deux fois la même idée');
});

test('idée du meilleur coup positionnel : l’intention et sa règle, plus de phrase passe-partout', () => {
  const fen = '4k3/pp3ppp/3p4/8/4P3/2N5/PPP2PPP/4K3 w - - 0 1';
  const best = buildLine(fen, ['c3d5'], 'w', true), ref = buildLine(fen, ['a2a3'], 'w');
  const { idee } = insight(fen, 'w', best, ref);
  assert.match(idee, /^Cd5 installe ton cavalier en d5, une case forte/);
  assert.doesNotMatch(idee, /améliore ta position sans rien donner/);
});

test('relecture : l’intention d’un coup joué se lit dans la suite réelle de la partie', () => {
  const g = { san: ['e4', 'e5', 'Bc4', 'Nc6'] };
  assert.match(moveText(g, 1, 'w'), /Ce coup prépare Fc4/);
  assert.doesNotMatch(moveText(g, 4, 'w'), /prépare/, 'dernier coup : pas de suite, pas d’intention de préparation');
});
