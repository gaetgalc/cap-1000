// Classement des erreurs d'une partie à partir des évaluations brutes du moteur.
// Calcul pur : aucun appel au moteur. Changer une règle ici, c'est augmenter VERSION ; les parties déjà évaluées
// sont alors reclassées à l'ouverture du site, sans relancer Stockfish (tests/classify.test.mjs).
/* global Chess */
import { VAL } from './explain.js';

export const MATE = 100000;
export const VERSION = 2; // version des règles de classement (seuils, thèmes, coups qui tiennent)

// Probabilité de gain (%) pour un score en centipions.
export function winPct(cp) {
  if (cp >= MATE - 1000) return 100;
  if (cp <= -MATE + 1000) return 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
export function fmtEval(cp) {
  if (cp >= MATE - 1000) return 'M' + (MATE - cp);
  if (cp <= -MATE + 1000) return '-M' + (MATE + cp);
  return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
}
const isMate = (cp) => Math.abs(cp) >= MATE - 1000;

export function uciMove(ch, uci) {
  if (!uci) return null;
  return ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
}
// Une prise gagne-t-elle du matériel ? gain = valeur prise (si non reprise) ou différence.
export function freeCapture(fen, uci) {
  const c = new Chess(fen);
  const m = uciMove(c, uci);
  if (!m || !m.captured) return null;
  const rec = c.moves({ verbose: true }).some((x) => x.to === m.to);
  const capV = VAL[m.captured];
  return { m, gain: rec ? capV - VAL[m.piece] : capV };
}
function tacticIn(fen, pv) {
  if (!pv || pv.length < 3) return false;
  const c = new Chess(fen);
  if (!uciMove(c, pv[0]) || !uciMove(c, pv[1])) return false;
  const f = freeCapture(c.fen(), pv[2]);
  return !!f && f.gain >= 2;
}
export function phase(fen, ply) {
  if (ply < 20) return 'ouverture';
  let tot = 0, queens = 0;
  for (const ch of fen.split(' ')[0].toLowerCase()) { if ('nbrq'.includes(ch)) tot += VAL[ch]; if (ch === 'q') queens++; }
  return (tot <= 10 || (queens === 0 && tot <= 16)) ? 'finale' : 'milieu';
}
function sanLine(fen, pv, n = 4) {
  const c = new Chess(fen); const out = [];
  for (const u of (pv || []).slice(0, n)) { const m = uciMove(c, u); if (!m) break; out.push(m.san); }
  return out;
}

// Rejoue la partie : positions (FEN) avant chaque coup et coups joués. null si elle est illisible.
// Gardé en mémoire par partie (17/11) : « Mon jeu », le classement et les puzzles rejouent les mêmes parties ;
// chess.js coûte ~20 ms par partie, soit plusieurs secondes sur des centaines. Le résultat ne se modifie pas.
const REPLAYS = new Map();
const replayKey = (game) => (game.id ?? '') + '|' + game.san.join(' ');
export const hasReplay = (game) => REPLAYS.has(replayKey(game));
export function replay(game) {
  const key = replayKey(game);
  if (REPLAYS.has(key)) return REPLAYS.get(key);
  const ch = new Chess(), fens = [ch.fen()], mv = [];
  for (const s of game.san) {
    const m = ch.move(s, { sloppy: true });
    if (!m) break;
    mv.push(m); fens.push(ch.fen());
  }
  const r = mv.length < 4 ? null : { fens, mv };
  REPLAYS.set(key, r);
  return r;
}

// Coups du joueur qui font perdre au moins 10 points de chances de gain (erreurs et gaffes) : ce sont les
// positions où le moteur cherche aussi les deuxième et troisième meilleurs coups (raw.mp).
export function candidates(game, ev) {
  const pov = (cp) => (game.w ? cp : -cp), out = [];
  for (let i = 0; i + 1 < ev.length; i++) if ((i % 2 === 0) === game.w && winPct(pov(ev[i])) - winPct(pov(ev[i + 1])) >= 10) out.push(i);
  return out;
}
// Nombre de coups qui tiennent la position (1 à 3) : à moins de 6 points de chances de gain du meilleur.
// mp : évaluations des 3 meilleurs coups, du point de vue du camp au trait.
export const GOOD = 6;
export function goodMoves(mp) {
  if (!mp?.length) return undefined;
  return mp.filter((cp) => winPct(mp[0]) - winPct(cp) < GOOD).length;
}
// Une erreur devient-elle un puzzle ? Il faut un thème, un meilleur coup, une position pas déjà perdue.
// Les erreurs sans motif tactique (ouverture, plan, finale) où au moins 3 coups tenaient sont écartées :
// sans réponse nette, le puzzle n'apprend rien. Elles restent dans la relecture et les statistiques.
const VAGUE = new Set(['ouverture', 'plan', 'finale']);
export const isPuzzle = (e) => !!e.theme && !!e.best && e.e0 > -500 && !(e.alt >= 3 && VAGUE.has(e.theme));

// raw : données brutes de l'évaluation, une entrée par position.
//   ev : évaluation en centipions du point de vue des Blancs ; best : meilleur coup (UCI) ; pv : début de la suite du moteur ;
//   mp : { ply: [cp des 3 meilleurs coups] } pour les positions de candidates() (absent sur les analyses anciennes).
// Renvoie ce qui s'en déduit : { errs, acc, maxAdv, last }.
export function classify(game, raw) {
  const { fens, mv } = replay(game), ev = raw.ev, best = raw.best, pvs = raw.pv;
  const pov = (cp) => (game.w ? cp : -cp);
  const errs = []; let sumDrop = 0, nMine = 0, maxAdv = -MATE;
  for (let i = 0; i < mv.length; i++) {
    const mine = (i % 2 === 0) === game.w;
    if (!mine) continue;
    const e0 = pov(ev[i]), e1 = pov(ev[i + 1]);
    maxAdv = Math.max(maxAdv, e0);
    const drop = Math.max(0, winPct(e0) - winPct(e1));
    sumDrop += drop; nMine++;
    if (drop < 5 || !best[i]) continue;
    const played = mv[i].from + mv[i].to + (mv[i].promotion || '');
    if (played === best[i]) continue;
    const kind = drop >= 20 ? 'gaffe' : drop >= 10 ? 'erreur' : 'imprecision';
    let theme = null;
    if (kind !== 'imprecision') {
      const reply = pvs[i + 1]?.[0];
      const fc = reply ? freeCapture(fens[i + 1], reply) : null;
      const bc = freeCapture(fens[i], best[i]);
      if (isMate(e0) && e0 > 0 && !(isMate(e1) && e1 > 0)) theme = 'mat_rate';
      else if (isMate(e1) && e1 < 0 && !(isMate(e0) && e0 < 0)) theme = 'mat_autorise';
      else if (fc && fc.gain >= 2) theme = fc.m.to === mv[i].to ? 'en_prise_pose' : 'en_prise_ignore';
      else if (bc && bc.gain >= 2) theme = 'cadeau_rate';
      else if (tacticIn(fens[i + 1], pvs[i + 1])) theme = 'tactique_subie';
      else if (tacticIn(fens[i], pvs[i])) theme = 'tactique_ratee';
      else { const ph = phase(fens[i], i); theme = ph === 'milieu' ? 'plan' : ph; }
    }
    const cb = new Chess(fens[i]); const bm = uciMove(cb, best[i]);
    errs.push({
      ply: i, kind, theme, drop: Math.round(drop), fen: fens[i], e0, e1,
      played: mv[i].san, playedUci: played, best: best[i], bestSan: bm ? bm.san : best[i],
      prev: i > 0 ? mv[i - 1].from + mv[i - 1].to : null,
      punish: sanLine(fens[i + 1], pvs[i + 1], 3), line: sanLine(fens[i], pvs[i], 4),
      ph: phase(fens[i], i),
      alt: goodMoves(raw.mp?.[i]),
    });
  }
  return {
    errs, maxAdv,
    acc: nMine ? Math.round((100 - sumDrop / nMine) * 10) / 10 : null,
    last: pov(ev[ev.length - 1]),
  };
}
