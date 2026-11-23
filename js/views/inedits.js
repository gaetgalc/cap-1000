/* global Chess */
// Positions inédites (#inedits) : puzzles Lichess du thème travaillé.
import { ls } from '../store.js';
import { uciMove } from '../classify.js';
import { buildLine, describeAt, fr, hintFor, insight, justPlayed } from '../explain.js';
import { $, coach, esc, ico, tabs } from '../ui.js';
import { progress } from '../progress.js';
import { arrow, destsOf } from '../board.js';
import * as exo from '../exercise.js';
import { LI_ANGLES, LI_DIFF, LI_FOR, fetchPuzzle } from '../lichess.js';
import { S, route } from '../state.js';
import { PZ_TABS } from './puzzles.js';
import { keepUi, render } from '../app.js';

// ---------- Puzzles inédits (Lichess) ----------
async function liLoad() {
  const L = S.li;
  if (L.loading) return;
  L.loading = true; L.err = null; L.cur = null; render();
  try { L.cur = await fetchPuzzle(L.angle, L.diff); L.failed = false; L.counted = false; L.replay = false; }
  catch (e) { L.err = e.message || String(e); }
  L.loading = false;
  if (route()[0] === 'inedits') render();
}
function viewInedits() {
  if (!S.li) { const f = ls.get('focus', null), saved = ls.get('li', {}), keep = S.liKeep; S.liKeep = null; S.li = { angle: saved.angle || (f ? LI_FOR[f.id] : 'hangingPiece'), diff: saved.diff || 'easiest', cur: keep?.cur || null, failed: !!keep?.failed, replay: !!keep?.replay, loading: false, err: null }; }
  const L = S.li, stat = progress.lichessStat(L.angle);
  const sels = `<select data-f="liangle" aria-label="Thème">${LI_ANGLES.map(([v, l]) => `<option value="${v}" ${L.angle === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select data-f="lidiff" aria-label="Niveau">${LI_DIFF.map(([v, l]) => `<option value="${v}" ${L.diff === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const head = tabs('li', PZ_TABS) + `<div class="pzhead main"><h1>Positions inédites</h1><div class="row">${sels}
      <span class="chip ${stat.n ? 'good' : ''}">${stat.ok} / ${stat.n} du premier coup</span></div></div>`;
  if (L.loading) return head + coach('Je vais chercher une position que tu n’as jamais vue…');
  if (L.err) return head + `<div class="card"><p class="err">${esc(L.err)}</p><div><button class="btn pri" data-act="linext">Réessayer</button></div></div>`;
  if (!L.cur) return head + `<div class="card">${coach('Ici, tu travailles le même motif que dans tes parties, mais sur des positions que tu ne peux pas reconnaître : c’est ce qui prouve que le réflexe est acquis. Les positions viennent de la base de puzzles de Lichess, libre de droits.')}<div><button class="btn pri lg" data-act="linext">Commencer</button></div></div>`;
  const P = L.cur, me = P.white ? 'w' : 'b', side = P.white ? 'Blancs' : 'Noirs';
  const last = justPlayed(describeAt(P.prevFen, P.lastSan, me));
  return exo.screen({
    live: true, top: () => `<span class="chip ${stat.n ? 'good' : ''}">${stat.ok} / ${stat.n} du premier coup</span>`,
    head: head + coach(`${esc(last)} <b>À toi de jouer avec les ${side}.</b> Trouve le meilleur coup${P.sol.length > 2 ? `, puis la suite (${Math.ceil(P.sol.length / 2)} coups à trouver)` : ''}.`, 'intro'),
    cap: `<p><i class="dot ${P.white ? 'w' : 'b'}"></i> <span class="m-txt">${esc(last)} </span>Trait aux ${side}. ${P.sol.length > 2 ? `Trouve le meilleur coup puis la suite (${Math.ceil(P.sol.length / 2)} coups).` : 'Trouve le meilleur coup.'}</p>`,
    panel: `<div class="row m-only lisel">${sels}</div><div class="meta small">Puzzle Lichess n° ${esc(P.id)} · niveau ${P.rating}</div><div class="meta small"><a href="${P.url}" target="_blank" rel="noopener">Voir sur Lichess</a></div>
      <div id="lix"><div class="card ghost"><h3>Comment chercher</h3><ol class="routine"><li>Que vient de faire ton adversaire ? Que menace son coup ?</li><li>As-tu un échec, une capture ou une menace ?</li><li>La case où tu vas est-elle attaquée ?</li></ol></div></div>`,
    bar: '<button class="btn" data-x="hint">Indice</button><button class="btn" data-x="show">Solution</button>',
  });
}
function mountInedits() {
  const X = exo.current(), L = S.li;
  if (!X || !L?.cur) return;
  const P = L.cur, me = P.white ? 'w' : 'b', color = P.white ? 'white' : 'black', ch = new Chess(P.fen);
  let hinted = false;
  L.step = 0; L.done = false; // l'échiquier repart toujours de la position initiale
  const mov = () => ({ free: false, color, dests: destsOf(ch), showDests: true, events: { after: onMove } });
  const cg = X.board({ fen: P.fen, orientation: color, turnColor: color, lastMove: P.last, movable: mov() });
  function finish(ok) {
    if (L.done) return;
    L.done = true;
    const res = !ok ? 0 : L.failed || hinted ? 1 : 2;
    if (!L.counted) {
      progress.recordLichess(P, res, L.angle, L.replay);
      L.counted = true; keepUi();
    }
    const steps = buildLine(P.fen, P.sol, me, true), ins = insight(P.fen, me, steps, []);
    X.player({
      view: (fen, last, shapes) => cg.set({ fen, lastMove: last, movable: { color: undefined }, drawable: { autoShapes: shapes.filter(Boolean) } }),
      arrows: (a) => cg.setAutoShapes(a),
      films: { sol: { steps, start: { fen: P.fen, last: P.last, shape: arrow(P.sol[0], 'green') }, startText: 'Regarde la solution se dérouler.', brush: (k) => (steps[k].tags.mine ? 'green' : 'blue') } },
      verdict: res === 2 ? '<b class="ok">Résolu du premier coup.</b>' : res === 1 ? '<b class="ok">Résolu.</b>' : 'Voici la solution, coup par coup.', verdictAlways: true,
      panel: $('#lix'), panelHtml: () => `<div class="card idea"><h3>L’idée</h3><p>${esc(ins.idee)}</p></div>
        <ol class="line">${steps.map((q, k) => `<li data-x="jump" data-v="${k + 1}"><b>${q.white ? q.no + '.' : (k === 0 ? q.no + '…' : '')} ${fr(q.san)}</b><span>${esc(q.text)}</span></li>`).join('')}</ol>
        <p class="small">Puzzle de la base Lichess (domaine public). Thèmes : ${esc(P.themes.join(', '))}.</p>`,
      exit: `<button class="btn" data-act="linext">Suivant${ico('next')}</button>`,
      auto: res === 0, from: 0, rest: steps.length, // solution demandée : elle se joue toute seule
    });
  }
  function onMove(from, to) {
    const want = P.sol[L.step], m = ch.move({ from, to, promotion: want[4] || 'q' });
    if (!m) { cg.set({ fen: ch.fen(), movable: mov() }); return; }
    if (from + to === want.slice(0, 4) || ch.in_checkmate()) {
      L.step++;
      if (L.step >= P.sol.length || ch.in_checkmate()) { cg.set({ fen: ch.fen() }); exo.feedback('good'); return finish(true); }
      const r = uciMove(ch, P.sol[L.step]); L.step++;
      cg.set({ fen: ch.fen(), lastMove: [r.from, r.to], turnColor: color, movable: mov() });
      if (L.step >= P.sol.length) { exo.feedback('good'); return finish(true); }
      X.say('ok', `<p><b class="ok">Bien.</b> Ton adversaire répond ${fr(r.san)}. Trouve la suite.</p>`);
    } else {
      L.failed = true; exo.feedback('bad');
      cg.set({ fen: ch.fen(), movable: { color: undefined } });
      cg.setAutoShapes([{ orig: to, brush: 'red' }]);
      X.say('ko', `<p><b class="ko">Pas celui-là.</b> ${fr(m.san)} n’est pas le meilleur coup. Réessaie.</p>`);
      setTimeout(() => { if (L.done || !X.alive()) return; ch.undo(); cg.set({ fen: ch.fen(), turnColor: color, movable: mov() }); cg.setAutoShapes([]); }, 800);
    }
  }
  X.on({
    hint() { if (L.done) return; hinted = true; const w = P.sol[L.step]; cg.set({ drawable: { autoShapes: [{ orig: w.slice(0, 2), brush: 'green' }] } }); X.say('', `<p><b>Indice.</b> ${esc(hintFor(ch.fen(), w, me))} La pièce entourée doit jouer.</p>`); },
    show() { if (L.done) return; L.failed = true; finish(false); },
  });
}

export { liLoad, mountInedits, viewInedits };
