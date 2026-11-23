/* global Chess */
// Échiquier libre (#echiquier). État dans S.fb ; mise à jour sur place par fbSync.
import { ls } from '../store.js';
import { MATE, fmtEval, uciMove } from '../classify.js';
import { describeAt, fr } from '../explain.js';
import { $, esc, ico, setHtml, tabs } from '../ui.js';
import { arrow, destsOf } from '../board.js';
import { evalShare } from '../review.js';
import * as exo from '../exercise.js';
import { moveImpact } from '../replies.js';
import { GAMES_TABS } from '../app.js';
import { REP, repCard, repLines } from './reponses.js';
import { S, route } from '../state.js';

// ---------- Échiquier libre (#echiquier) : explorer n'importe quelle position, les deux camps ----------
// S.fb : { mv, fens, i, me } ; une ligne unique, un coup joué au milieu remplace la suite. me : camp en bas de l'échiquier.
const START_FEN = new Chess().fen();
const fbNew = (fen = START_FEN, mv = [], fens = [fen]) => ({ mv, fens, i: mv.length, me: S.fb?.me || 'w' });
// Texte collé : FEN, ou PGN (partie Chess.com copiée), ou suite de coups « 1. e4 e5 2. Nf3 ».
function fbParse(t) {
  t = t.trim(); if (!t) return null;
  const f = new Chess();
  if (f.load(t)) return fbNew(f.fen());
  const ch = new Chess();
  if (!ch.load_pgn(t, { sloppy: true })) return null;
  const head = ch.header().FEN, line = ch.history({ verbose: true }), r = new Chess(head || START_FEN), mv = [], fens = [r.fen()];
  for (const m of line) { const x = r.move({ from: m.from, to: m.to, promotion: m.promotion }); if (!x) break; mv.push(x); fens.push(r.fen()); }
  return mv.length || head ? fbNew(fens[0], mv, fens) : null;
}
function fbMoves(P) {
  const ply0 = (P.fens[0].split(' ')[1] === 'b' ? 1 : 0) + 2 * (+P.fens[0].split(' ')[5] - 1);
  return P.mv.map((m, j) => { const n = ply0 + j; return `${n % 2 === 0 || j === 0 ? `<span class="n">${Math.floor(n / 2) + 1}${n % 2 ? '…' : '.'}</span>` : ''}<button data-act="fbgo" data-i="${j + 1}" class="${j + 1 === P.i ? 'cur' : ''}">${fr(m.san)}</button>`; }).join('') || '<span class="small">Aucun coup encore : joue sur l’échiquier, pour les deux camps.</span>';
}
// Éval de la position pour le camp au trait (null en attendant le moteur) : meilleure ligne, ou fin de partie.
function fbEval(fen, lines) {
  if (!lines) return null;
  if (lines.length) return { cp: lines[0].cp, best: lines[0].pv?.[0] };
  return { cp: new Chess(fen).in_checkmate() ? -MATE : 0 };
}
// Impact du dernier coup : éval avant (position précédente) et après ; null tant qu'une des deux manque.
function fbImpact(P) {
  if (!P.i) return null;
  const pf = P.fens[P.i - 1], f = P.fens[P.i], m = P.mv[P.i - 1];
  return moveImpact(fbEval(pf, REP.get(pf)), fbEval(f, REP.get(f)), m.from + m.to + (m.promotion || ''));
}
const IMPACT_CLS = { best: 'good', good: 'good', imprecision: '', erreur: 'warn', gaffe: 'bad' };
function fbCap(P, lines) {
  const fen = P.fens[P.i], last = P.i ? P.mv[P.i - 1] : null, ch = new Chess(fen), turn = fen.split(' ')[1];
  const over = ch.in_checkmate() ? 'Échec et mat.' : ch.in_stalemate() ? 'Pat.' : ch.in_draw() ? 'Nulle.' : '';
  const e = lines === false ? false : fbEval(fen, lines), b = e?.best ? uciMove(new Chess(fen), e.best) : null, im = fbImpact(P);
  const evc = e === false ? '<span class="small">moteur indisponible</span>' : e ? `<span class="chip evnum" title="Évaluation du moteur, de ton point de vue">${fmtEval(turn === P.me ? e.cp : -e.cp)}</span>` : '<span class="small">éval…</span>';
  const pov = (cp) => (turn === P.me ? -cp : cp); // im.before et im.after sont du point de vue du camp qui a joué (l'autre que celui au trait)
  const imc = last ? (im ? `<span class="chip ${IMPACT_CLS[im.kind]}" title="Effet du coup ${esc(fr(last.san))} sur l’éval, de ton point de vue">${esc(fr(last.san))} : ${im.label}${im.kind === 'best' ? '' : `, ${fmtEval(pov(im.before))} → ${fmtEval(pov(im.after))}`}</span>` : e === false ? '' : '<span class="small">impact…</span>') : '';
  const bestc = over ? `<span class="chip">${over}</span>` : b ? `<span class="capbest">Meilleur <b>${fr(b.san)}</b></span>` : '';
  const txtK = last ? describeAt(P.fens[P.i - 1], last.san, P.me) : 'Joue les coups des deux camps : le moteur donne les meilleures réponses.';
  return `<div class="capm"><span class="capn"><i class="dot ${turn === 'w' ? 'w' : 'b'}"></i>Trait aux ${turn === 'w' ? 'Blancs' : 'Noirs'}</span>${evc}${imc}${bestc}</div><p>${esc(txtK)}</p>`;
}
// Barre d'évaluation (part des Blancs) de la position affichée ; reste en place tant que le moteur calcule.
function fbBarEv(P, lines) {
  const fen = P.fens[P.i], e = fbEval(fen, lines), el = $('#fbev'); if (!el) return;
  el.classList.toggle('flip', P.me === 'b');
  if (!e) return;
  const cp = fen.split(' ')[1] === 'w' ? e.cp : -e.cp, n = el.querySelector('b');
  el.style.setProperty('--ev', evalShare(cp));
  // Score comme sur Chess.com : sans signe, du côté du camp qui mène (Blancs : bout clair, Noirs : bout sombre)
  n.textContent = fmtEval(Math.abs(cp)).replace('+', '');
  n.className = cp >= 0 ? 'w' : 'k';
}
// Flèche du meilleur coup sur l'échiquier libre (demande du 20/11) : affichée par défaut, réglage gardé sur l'appareil.
const fbArrowOn = () => ls.get('fbArrow', true) !== false;
const fbArrowBtn = () => { const on = fbArrowOn(); return `<button class="btn ico fbarr" data-act="fbarrow" aria-pressed="${on}" aria-label="Flèche du meilleur coup" title="${on ? 'Masquer' : 'Afficher'} la flèche du meilleur coup">${ico(on ? 'arrow' : 'arrowoff')}</button>`; };
function fbBar(P) {
  const i = P.i, n = P.mv.length;
  return `<button class="btn ico gvfl" data-act="fbgo" data-i="0" aria-label="Début" ${i === 0 ? 'disabled' : ''}>${ico('first')}</button><button class="btn ico" data-act="fbgo" data-i="${i - 1}" aria-label="Coup précédent" ${i === 0 ? 'disabled' : ''}>${ico('prev')}</button><button class="btn ico" data-act="fbgo" data-i="${i + 1}" aria-label="Coup suivant" ${i === n ? 'disabled' : ''}>${ico('next')}</button><button class="btn ico gvfl" data-act="fbgo" data-i="${n}" aria-label="Fin" ${i === n ? 'disabled' : ''}>${ico('last')}</button>${fbArrowBtn()}<button class="btn" data-act="fbflip">Retourner</button>`;
}
function viewEchiquier() {
  const P = (S.fb ||= fbNew());
  return exo.screen({
    live: true, capSide: true, wrap: 'gv fb',
    rail: `<div class="evbar ${P.me === 'b' ? 'flip' : ''}" id="fbev" aria-hidden="true" title="Qui domine : part des Blancs d’après le moteur, score du camp qui mène"><i></i><b></b></div>`,
    head: `<div class="fbtabs">${tabs('fb', GAMES_TABS)}</div><div class="pzhead main"><h1>Échiquier libre</h1></div>`,
    cap: fbCap(P, REP.get(P.fens[P.i])),
    panel: `<div class="card rep" id="rep"></div>
      <div class="card"><h3>Coups joués</h3><div class="moves vline" id="fbm">${fbMoves(P)}</div></div>
      <details class="card fbload"><summary>Partir d’une autre position</summary>
        <label class="small" for="fbin">Colle une position (FEN) ou une partie (PGN, copiée depuis Chess.com).</label>
        <textarea id="fbin" rows="3" spellcheck="false" autocomplete="off"></textarea>
        <div class="row"><button class="btn" data-act="fbload">Charger</button><button class="btn" data-act="fbreset">Position de départ</button></div><p class="small" id="fberr" role="status"></p></details>`,
    bar: fbBar(P),
  });
}
const fbMov = (fen) => ({ free: false, color: fen.split(' ')[1] === 'w' ? 'white' : 'black', dests: destsOf(new Chess(fen)), showDests: true, events: { after: fbMove } });
function mountEchiquier() {
  const X = exo.current(), P = S.fb; if (!X || !P) return;
  X.board({ fen: P.fens[P.i], orientation: P.me === 'w' ? 'white' : 'black', movable: fbMov(P.fens[P.i]), drawable: { enabled: true } });
  fbSync();
}
function fbSync() {
  const X = exo.current(), P = S.fb; if (!X?.cg || !P || route()[0] !== 'echiquier') return;
  const fen = P.fens[P.i], last = P.i ? P.mv[P.i - 1] : null, again = () => { if (S.fb === P && P.fens[P.i] === fen) fbSync(); };
  const lines = repLines(fen, again), best = lines?.[0]?.pv?.[0];
  if (lines && P.i && !REP.has(P.fens[P.i - 1])) repLines(P.fens[P.i - 1], again); // éval d'avant le coup, pour son impact
  fbBarEv(P, lines);
  X.cg.set({ fen, turnColor: fen.split(' ')[1] === 'w' ? 'white' : 'black', lastMove: last ? [last.from, last.to] : undefined, movable: fbMov(fen), drawable: { autoShapes: best && fbArrowOn() ? [arrow(best, 'green')] : [] } });
  X.say('', fbCap(P, lines));
  X.setBar(fbBar(P));
  setHtml($('#fbm'), fbMoves(P));
  setHtml($('#rep'), repCard(fen, P.me, lines));
}
function fbMove(from, to) {
  const P = S.fb; if (!P) return;
  const ch = new Chess(P.fens[P.i]), p = ch.get(from), m = ch.move({ from, to, promotion: p?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined });
  if (!m) { fbSync(); return; }
  const nx = P.mv[P.i];
  if (!(nx && nx.from === m.from && nx.to === m.to && nx.promotion === m.promotion)) { P.mv.length = P.i; P.fens.length = P.i + 1; P.mv.push(m); P.fens.push(ch.fen()); }
  P.i++;
  fbSync();
}
function fbGo(i) { const P = S.fb; if (!P) return; P.i = Math.max(0, Math.min(P.mv.length, i)); fbSync(); }

export { fbArrowOn, fbGo, fbMove, fbNew, fbParse, fbSync, mountEchiquier, viewEchiquier };
