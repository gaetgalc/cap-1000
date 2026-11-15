// Classement des erreurs à partir d'évaluations enregistrées, sans moteur. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
globalThis.Chess = createRequire(import.meta.url)('../vendor/chess.js').Chess;
const { classify, replay, winPct, fmtEval, MATE } = await import('../js/classify.js');

// Évaluations enregistrées : ev du point de vue des Blancs, une entrée par position (coups joués + 1).
const raw = (ev, moves) => ({ ev, best: moves.map((m) => m[0] ?? null), pv: moves });
const quiet = (n, cp = 20) => Array.from({ length: n }, () => cp);

test('mat encaissé : le coup qui laisse un mat en un est une gaffe du thème « mat_autorise »', () => {
  const game = { w: false, san: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'] };
  const ev = [...quiet(6, 30), MATE - 1, MATE]; // après 3…Cf6, les Blancs ont mat en 1
  const pv = [['e2e4'], ['e7e5'], ['g1f3'], ['b8c6'], ['f1c4'], ['g7g6', 'h5f3', 'g8f6'], ['h5f7'], []];
  const { errs, acc } = classify(game, raw(ev, pv));
  assert.equal(errs.length, 1);
  const e = errs[0];
  assert.deepEqual([e.ply, e.kind, e.theme, e.played, e.best, e.bestSan], [5, 'gaffe', 'mat_autorise', 'Nf6', 'g7g6', 'g6']);
  assert.deepEqual(e.punish, ['Qxf7#']);
  assert.equal(e.prev, 'f1c4');
  assert.ok(acc < 90);
});

test('pièce posée en prise : la dame va sur une case où elle est prise gratuitement', () => {
  const game = { w: true, san: ['e4', 'e5', 'Qh5', 'Nc6', 'Qg5', 'Qxg5'] };
  const ev = [20, 20, 10, 10, 30, -850, -850];
  const pv = [['e2e4'], ['e7e5'], ['g1f3'], ['b8c6'], ['f1c4', 'g8f6', 'd2d3'], ['d8g5'], []];
  const [e] = classify(game, raw(ev, pv)).errs;
  assert.deepEqual([e.ply, e.kind, e.theme, e.played, e.bestSan], [4, 'gaffe', 'en_prise_pose', 'Qg5', 'Bc4']);
  assert.deepEqual(e.line, ['Bc4', 'Nf6', 'd3']);
});

test('cadeau non pris : une pièce gratuite était à prendre', () => {
  // 1.e4 e5 2.Cf3 Dg5 : le cavalier peut prendre la dame ; les Blancs jouent 3.d3
  const game = { w: true, san: ['e4', 'e5', 'Nf3', 'Qg5', 'd3', 'Qd8'] };
  const ev = [20, 20, 20, 20, 900, 150, 150];
  const pv = [['e2e4'], ['e7e5'], ['g1f3'], ['b8c6'], ['f3g5'], ['g5d8'], []];
  const [e] = classify(game, raw(ev, pv)).errs;
  assert.deepEqual([e.kind, e.theme, e.bestSan], ['gaffe', 'cadeau_rate', 'Nxg5']);
});

test('seuils : sous 5 points rien, de 5 à 10 une imprécision sans thème, 10 à 20 une erreur', () => {
  const game = { w: true, san: ['e4', 'e5', 'Nf3', 'Nc6', 'a3', 'Nf6', 'h3', 'd5'] };
  const cpFor = (pct) => Math.round(-Math.log(2 / ((pct - 50) / 50 + 1) - 1) / 0.00368208); // évaluation donnant ce pourcentage de gain
  const at = (drops) => { const ev = quiet(9, cpFor(70)); ev[5] = cpFor(70 - drops[0]); ev[6] = cpFor(70 - drops[0]); ev[7] = cpFor(70 - drops[0] - drops[1]); ev[8] = ev[7]; return ev; };
  const pv = [['e2e4'], ['e7e5'], ['g1f3'], ['b8c6'], ['f1b5'], ['g8f6'], ['f1c4'], ['d7d5'], []];
  const kinds = (drops) => classify(game, raw(at(drops), pv)).errs.map((e) => [e.ply, e.kind, e.theme]);
  assert.deepEqual(kinds([3, 3]), []);
  assert.deepEqual(kinds([7, 3]), [[4, 'imprecision', null]]);
  assert.deepEqual(kinds([7, 14]), [[4, 'imprecision', null], [6, 'erreur', 'ouverture']]);
});

test('le coup du moteur n’est jamais compté comme une erreur, et une partie illisible est refusée', () => {
  const game = { w: true, san: ['e4', 'e5', 'Nf3', 'Nc6'] };
  const { errs, acc, maxAdv } = classify(game, raw([20, -300, -300, -300, -300], [['e2e4'], ['e7e5'], ['g1f3'], ['b8c6'], []])); // la chute suit 1.e4, qui est le coup du moteur
  assert.deepEqual(errs, []);
  assert.equal(maxAdv, 20);
  assert.ok(acc < 100, 'la précision tient compte de la perte même sans erreur classée');
  assert.equal(replay({ san: ['e4', 'e5', 'Zz9'] }), null);
});

test('probabilité de gain et affichage de l’évaluation', () => {
  assert.equal(winPct(0), 50);
  assert.equal(winPct(MATE - 3), 100);
  assert.equal(winPct(-MATE + 3), 0);
  assert.ok(winPct(100) > 58 && winPct(100) < 60);
  assert.deepEqual([fmtEval(150), fmtEval(-70), fmtEval(MATE - 2), fmtEval(-MATE + 4)], ['+1.5', '-0.7', 'M2', '-M4']);
});

test('coups qui tiennent : comptés à moins de 6 points du meilleur, et puzzles sans réponse nette écartés', async () => {
  const { goodMoves, isPuzzle, candidates } = await import('../js/classify.js');
  assert.equal(goodMoves(undefined), undefined);
  assert.equal(goodMoves([300, -50, -80]), 1);
  assert.equal(goodMoves([30, 20, 10]), 3);
  assert.equal(goodMoves([MATE - 2, 300, 100]), 1);
  assert.equal(goodMoves([MATE - 2, 900, 100]), 2, 'mat ou +9 : les deux gagnent');
  const e = { theme: 'plan', best: 'e2e4', e0: 50 };
  assert.ok(isPuzzle(e) && isPuzzle({ ...e, alt: 2 }));
  assert.ok(!isPuzzle({ ...e, alt: 3 }), 'erreur de plan où 3 coups tenaient : pas de puzzle');
  assert.ok(isPuzzle({ ...e, theme: 'en_prise_ignore', alt: 3 }), 'menace ignorée : reste un puzzle même avec plusieurs parades');
  assert.ok(!isPuzzle({ ...e, theme: null }) && !isPuzzle({ ...e, e0: -800 }));
  // candidates : coups du joueur qui perdent au moins 10 points ; classify les relie à raw.mp
  const game = { w: true, san: ['e4', 'e5', 'Qh5', 'Nc6', 'Qg5', 'Qxg5'] };
  const ev = [20, 20, 10, 10, 30, -850, -850];
  assert.deepEqual(candidates(game, ev), [4]);
  const pv = [['e2e4'], ['e7e5'], ['g1f3'], ['b8c6'], ['f1c4', 'g8f6', 'd2d3'], ['d8g5'], []];
  const [err] = classify(game, { ev, best: pv.map((m) => m[0] ?? null), pv, mp: { 4: [30, 25, -60] } }).errs;
  assert.equal(err.alt, 2);
});
