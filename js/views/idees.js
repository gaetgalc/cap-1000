/* global Chess */
// Idées de plan (#idees) : choisir la bonne idée sur une position calme de tes parties.
import { Engine } from '../engine.js';
import { uciMove } from '../classify.js';
import { PLAN_RULE, fr } from '../explain.js';
import { $, coach, esc } from '../ui.js';
import { progress } from '../progress.js';
import { arrow } from '../board.js';
import * as exo from '../exercise.js';
import { ideaChoices, ideaFollow, ideaPositionsOf, ideaStart } from '../ideas.js';
import { S, targetTc } from '../state.js';
import { gameRef, moveNo } from './puzzles.js';
import { render } from '../app.js';

// ---------- Idées de plan : sur une position calme de tes parties, choisir la bonne idée (ideas.js) ----------
// Positions d'une partie, gardées tant que son analyse ne change pas (WeakMap sur l'analyse : touch() n'invalide que ce qui a bougé).
const IDEAS = new WeakMap();
const ideasOf = (g) => { const a = S.an[g.id]; if (!a) return []; let v = IDEAS.get(a); if (!v) IDEAS.set(a, (v = ideaPositionsOf(g, a))); return v; };
const ideaGames = () => S.data.games.filter((g) => g.tc === targetTc());
const ideaDone = () => new Set(progress.hist().filter((h) => h.k === 'i').map((h) => h.id));
function ideaCur() {
  const p = ideaStart(ideaGames(), ideasOf, S.idea?.cur, ideaDone());
  if (!p) return null;
  S.idea = { cur: p.id };
  return p;
}
function ideaNext() {
  S.idea = { cur: ideaFollow(ideaGames(), ideasOf, S.idea?.cur, ideaDone())?.id };
  render();
}
function viewIdees() {
  const p = ideaCur();
  if (!p) return `<h1>Idées de plan</h1><div class="card">${coach('Pas encore de position calme dans tes parties analysées. Analyse plus de parties : chaque imprécision de milieu de partie devient un exercice de plan.')}<div><a class="btn" href="#entrainer">Retour à l’entraînement</a></div></div>`;
  const me = p.g.w ? 'w' : 'b', side = p.g.w ? 'Blancs' : 'Noirs', ch = ideaChoices(p.e.fen, p.e, me);
  return exo.screen({
    live: true,
    head: `<div class="pzhead"><h1>Idées de plan</h1></div>` + coach(`<b>Quel est le bon plan ici ?</b> Pas de tactique : choisis l’idée que tu jouerais avec les ${side}.`, 'intro'),
    cap: `<p><i class="dot ${me}"></i> Trait aux ${side}. <span class="m-txt">Quel est le bon plan ?</span><span class="d-txt">Choisis une idée à droite.</span></p>`,
    panel: `<div class="ideas">${ch.map((c, i) => `<button class="btn idea-c" data-x="pick" data-v="${i}">${esc(c.text)}</button>`).join('')}</div><div id="idex"></div>
      <div class="meta small">Coup ${moveNo(p.e)} de ta ${gameRef(p.g)} · <a href="#partie/${p.g.t}/${p.e.ply}">Ouvrir la partie</a></div>`,
    bar: '<button class="btn" data-x="skip">Autre position</button>',
  });
}
function mountIdees() {
  const X = exo.current(), p = ideaCur(); if (!X || !p) return;
  const me = p.g.w ? 'w' : 'b', ch = ideaChoices(p.e.fen, p.e, me), best = ch.find((c) => c.good), st0 = { done: false };
  const cg = X.board({ fen: p.e.fen, orientation: p.g.w ? 'white' : 'black', lastMove: p.e.prev ? [p.e.prev.slice(0, 2), p.e.prev.slice(2, 4)] : undefined, movable: { color: undefined } });
  // La troisième idée n'est qu'un coup plausible : le moteur doit confirmer qu'il est nettement moins bon que le meilleur.
  const chk = ch.findIndex((c) => c.check);
  if (chk >= 0) (async () => {
    try {
      S.play ||= new Engine();
      const val = async (mv) => { const c = new Chess(p.e.fen); if (!uciMove(c, mv)) return null; return -(await S.play.evalFen(c.fen(), 10, true)).cp; };
      const vb = await val(best.mv), vc = await val(ch[chk].mv);
      if (vb != null && vc != null && vc > vb - 50 && X.alive() && !st0.done) { const el = document.querySelector(`[data-x="pick"][data-v="${chk}"]`); if (el) el.remove(); }
    } catch { S.play = null; }
  })();
  X.on({
    pick(v) {
      if (st0.done) return; st0.done = true;
      const c = ch[+v], ok = !!c.good;
      progress.recordIdea(p.id, ok); exo.feedback(ok ? 'good' : 'bad');
      document.querySelectorAll('.idea-c').forEach((el) => { const x = ch[+el.dataset.v]; el.disabled = true; el.classList.toggle('ok', !!x.good); el.classList.toggle('ko', el.dataset.v === v && !ok); });
      cg.setAutoShapes([arrow(best.mv, 'green'), ok ? null : arrow(c.mv, 'red')].filter(Boolean));
      X.say(ok ? 'ok' : 'ko', ok ? `<b class="ok">Bon plan.</b> ${fr(best.san)} : c’est l’idée du moteur.` : `<b class="ko">Pas ce plan-là.</b> La bonne idée passait par ${fr(best.san)}.`);
      $('#idex').innerHTML = `<div class="card idea"><h3>Le bon plan : ${fr(best.san)}</h3><p>${esc(best.text)}</p>${best.k && PLAN_RULE[best.k] ? `<p class="small">${esc(PLAN_RULE[best.k])}</p>` : ''}${!ok && c.mv === p.e.playedUci ? '<p class="small">C’est le coup que tu avais joué en partie.</p>' : ''}</div>`;
      X.setBar('<button class="btn pri" data-x="next">Position suivante</button>');
    },
    next: () => ideaNext(),
    skip: () => ideaNext(),
  });
}

export { mountIdees, viewIdees };
