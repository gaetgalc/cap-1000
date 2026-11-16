// Intention d'un coup (plan, cible, pièce gênée), sans moteur : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { intent, features } = await import('../js/plan.js');
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

test('prépare : le coup rend possible un coup suivant de la suite, d’une autre pièce', () => {
  const r = intent(START, ['e2e4', 'e7e5', 'f1c4'], 'w');
  assert.equal(r.k, 'prepare');
  assert.match(r.text, /^Ce coup prépare Fc4/);
});

test('prépare : la cible du coup préparé est nommée, du point de vue du joueur', () => {
  // Le pion d4 libère la diagonale du fou c1 : Fg5 attaquera la dame en d8... ici le cavalier f6.
  const fen = 'rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1';
  const r = intent(fen, ['d2d4', 'e7e6', 'c1g5'], 'b');
  assert.equal(r.k, 'prepare');
  assert.match(r.text, /prépare Fg5, qui attaquera ton cavalier en f6/);
});

test('enferme : une pièce adverse n’a plus qu’une case sûre', () => {
  const r = intent('n7/7k/8/8/1B6/8/8/7K w - - 0 1', ['b4d6'], 'w');
  assert.equal(r.k, 'trap');
  assert.match(r.text, /enferme son cavalier en a8 : il n’a plus qu’une case sûre/);
});

test('bloque : la pièce se pose devant un pion passé adverse', () => {
  const r = intent('8/8/4k3/8/3p4/8/1N6/4K3 w - - 0 1', ['b2d3'], 'w');
  assert.equal(r.k, 'block');
  assert.match(r.text, /bloque son pion passé en d4/);
});

test('avant-poste : cavalier soutenu par un pion, qu’aucun pion adverse ne peut chasser', () => {
  const r = intent('4k3/pp3ppp/3p4/8/4P3/2N5/PPP2PPP/4K3 w - - 0 1', ['c3d5'], 'w');
  assert.equal(r.k, 'outpost');
  assert.match(r.text, /installe ton cavalier en d5/);
});

test('colonne : la tour prend une colonne ouverte, ou vise le pion d’une colonne semi-ouverte', () => {
  assert.match(intent('4k3/pp3ppp/8/8/8/8/PP3PPP/R3K3 w - - 0 1', ['a1d1'], 'w').text, /colonne d, ouverte/);
  assert.match(intent('4k3/pp3ppp/3p4/8/8/8/PP3PPP/R3K3 w - - 0 1', ['a1d1'], 'w').text, /colonne d.*vise son pion en d6/);
});

test('roi : la pièce vise plusieurs cases autour du roi adverse', () => {
  const r = intent('6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', ['d1h5'], 'w');
  assert.equal(r.k, 'king');
  assert.match(r.text, /ta dame vise maintenant 2 cases autour de son roi/);
});

test('rupture : le pion attaque un pion adverse pour ouvrir le jeu', () => {
  const r = intent('4k3/8/8/3p4/8/8/2P5/4K3 w - - 0 1', ['c2c4'], 'w');
  assert.equal(r.k, 'break');
  assert.match(r.text, /attaque son pion en d5/);
});

test('activité : la pièce passe d’une position passive à une position active', () => {
  const r = intent('4k3/8/8/8/8/8/8/N3K3 w - - 0 1', ['a1b3'], 'w');
  assert.equal(r.k, 'active');
  assert.match(r.text, /de 2 à 6 cases/);
});

test('rien à dire : pas d’intention inventée', () => {
  assert.equal(intent(START, ['g1f3'], 'w'), null);
  assert.equal(intent(START, ['e2e5'], 'w'), null, 'coup illégal');
});

test('features : pions passés, colonnes ouvertes et pièces sans case, en phrases', () => {
  const f = features('4k3/8/8/8/3p4/8/1N6/4K3 w - - 0 1', 'w');
  assert.ok(f.some((s) => /pion passé.*d4/i.test(s)), f.join(' | '));
  const g = features('n7/7k/3B4/P7/8/8/8/7K w - - 0 30', 'w'); // milieu de partie : le fou d6 couvre c7, le pion a5 couvre b6 : le cavalier a8 n'a aucune case
  assert.ok(g.some((s) => /^Son cavalier en a8.*aucune case/.test(s)), g.join(' | '));
  assert.ok(!features(START, 'w').some((s) => /case sûre/.test(s)), 'au début, les pièces non sorties ne comptent pas');
});
