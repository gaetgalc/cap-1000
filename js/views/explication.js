/* global Chess */
// Explication d'une erreur, commune aux puzzles, aux cours et à la relecture : suites commentées, « Demande au coach ».
import { Engine } from '../engine.js';
import { fmtEval, uciMove } from '../classify.js';
import * as st from '../stats.js';
import { LESSONS, RULES } from '../lessons.js';
import { buildLine, fr, insight, material, settle } from '../explain.js';
import { coach, dfmt, esc, txt } from '../ui.js';
import { progress } from '../progress.js';
import { arrow } from '../board.js';
import { askPosition, coachKey, positionText } from '../coach.js';
import { CAUSES } from '../brief.js';
import { toast } from '../toast.js';
import { DEPTH, S } from '../state.js';

// Après une réussite du premier coup : l'élève dit si le puzzle était facile ou difficile, ce qui avance ou rapproche son retour.
function rateRow(id) {
  const r = id && progress.rateInfo(id);
  if (!r) return '';
  const b = (q, l) => `<button class="${r.q === q ? 'on' : ''}" data-x="rate" data-v="${q}" aria-pressed="${r.q === q}">${l} · ${r.days[q]} j</button>`;
  return `<div class="rate"><span class="small">Pour toi, ce puzzle était… (prochain retour)</span><div class="seg2 mini">${b('e', 'Facile')}${b('', 'Normal')}${b('h', 'Difficile')}</div></div>`;
}
// ---------- Explication : suites commentées, idée, comparaison ----------
const LINES = new Map();
// Pourquoi l'erreur en partie : la réponse de l'élève oriente le brief du coach et l'échauffement (brief.js, CAUSES).
function whyCard(id, e) {
  const cur = progress.causeOf(id);
  return `<div class="card whyq"><h3>Pourquoi as-tu joué ${fr(e.played)} en partie ?</h3><div class="whyb">${Object.entries(CAUSES).map(([k, c]) => `<button class="btn sm ${cur === k ? 'on' : ''}" data-x="why" data-v="${k}" aria-pressed="${cur === k}">${c.label}</button>`).join('')}</div>
    <p class="small">${cur ? esc(CAUSES[cur].tip) : 'Ta réponse oriente mes prochains conseils et ton échauffement.'}</p></div>`;
}
// « Demande au coach » : Claude commente la position (clé API), ou la question est copiée pour une conversation Claude.
const ASK = new Map(); // réponses par position, le temps de la session
const askLabel = () => (coachKey() ? 'Demande au coach' : 'Copier la question pour Claude');
async function askRun(key, p, out) {
  if (ASK.has(key)) return ASK.get(key);
  if (!coachKey()) {
    const t = positionText(p);
    try { await navigator.clipboard.writeText(t); toast('Question copiée : colle-la dans une conversation Claude'); } catch { if (out) out.innerHTML = `<p class="small">Copie ce texte dans une conversation Claude :</p><textarea readonly rows="4" aria-label="Question pour Claude">${esc(t)}</textarea>`; }
    return null;
  }
  if (out) out.innerHTML = coach('Je regarde la position…');
  const a = await askPosition(p); ASK.set(key, a); return a;
}
function getLines(g, e) {
  const id = g.t + ':' + e.ply;
  if (LINES.has(id)) return LINES.get(id);
  const me = g.w ? 'w' : 'b';
  const pr = (async () => {
    let bestU = [e.best], refU = [e.playedUci];
    try {
      S.play ||= new Engine();
      for (const arr of [bestU, refU]) {
        const c = new Chess(e.fen);
        if (!uciMove(c, arr[0]) || c.game_over()) continue;
        const r = await S.play.evalFen(c.fen(), DEPTH + 2);
        arr.splice(0, arr.length, ...settle(e.fen, [arr[0], ...r.pv]));
      }
    } catch { S.play = null; bestU = e.line.length ? e.line : [e.best]; refU = [e.playedUci, ...e.punish]; }
    const best = buildLine(e.fen, bestU, me, true), ref = buildLine(e.fen, refU, me);
    return { best, ref, ins: insight(e.fen, me, best, ref), m0: material(e.fen, me) };
  })();
  LINES.set(id, pr);
  return pr;
}
// Après la solution : « La bonne suite » se joue toute seule, puis « Ton coup » montre ce que ton coup permettait.
// o : { g, e, api (échiquier de solveBoard), panel (élément de l'explication), verdict, exact (le meilleur coup est déjà sur l'échiquier) }
function explainUI(X, o) {
  const e = o.e, g = o.g, start = (uci, brush) => ({ fen: e.fen, last: e.prev ? [e.prev.slice(0, 2), e.prev.slice(2, 4)] : undefined, shape: arrow(uci, brush) });
  X.say('', `<p>${o.verdict || ''} Je prépare l’explication…</p>`);
  X.solved();
  if (o.rate) X.on({ rate(v) { progress.ratePuzzle(o.rate, v || ''); document.querySelectorAll('.rate').forEach((el) => { el.outerHTML = rateRow(o.rate); }); } });
  if (o.why) X.on({ why(v) { if (progress.recordCause(o.why, v)) document.querySelectorAll('.whyq').forEach((el) => { el.outerHTML = whyCard(o.why, e); }); } });
  const askKey = e.fen + '|' + e.playedUci;
  X.setBar(X.spec.exit);
  getLines(g, e).then((d) => {
    if (!X.alive()) return;
    // Bilan matériel cumulé depuis le début de la suite : dans un échange, on voit +9 puis « égalité », pas +9 puis −9.
    const chip = (L) => (i) => { if (!L.slice(0, i).some((q) => q.raw.captured)) return ''; const m = L[i - 1].mat - d.m0; return `<span class="chip ${m > 0 ? 'good' : m < 0 ? 'bad' : ''}">${m ? `Bilan ${m > 0 ? '+' : '−'}${Math.abs(m)}` : 'Bilan : égalité'}</span>`; };
    const bilan = (L, label, txt) => { const s = L[L.length - 1]; return !s ? '' : s.tags.mate ? `<b>Bilan :</b> échec et mat${s.tags.mine ? '' : ' contre toi'}.` : `<b>Bilan de ${label} :</b> ${txt}.`; };
    const real = g.san[e.ply + 1], refReply = d.ref[1];
    X.on({ async ask(_, btn) {
      const out = btn.parentElement.querySelector('.askout'); btn.disabled = true;
      const p = { fen: e.fen, me: g.w ? 'w' : 'b', played: e.playedUci, best: e.best, pv: d.best.map((q) => q.san), ev: e.e0, context: `Partie du ${dfmt(g.t)} contre ${g.opp} (${g.or} Elo), ouverture ${g.fam}. Type d’erreur détecté : ${st.THEMES[e.theme] || 'imprécision'}.` };
      try { const a = await askRun(askKey, p, out); if (a && X.alive()) { out.innerHTML = coach(txt(a)); btn.remove(); } else btn.disabled = false; }
      catch (err) { out.innerHTML = `<p class="small">${esc(err.message || err)}</p>`; btn.disabled = false; }
    } });
    X.player({
      view: o.api.view, arrows: o.api.arrows, ask: o.api.ask,
      films: {
        best: { steps: d.best, start: start(e.best, 'green'), startText: 'La flèche verte montre le meilleur coup.', tone: 'ok', brush: (k) => (d.best[k].tags.mine ? 'green' : 'blue'),
          chip: chip(d.best), bilan: bilan(d.best, 'la bonne suite', d.ins.bestTxt), guess: (i) => d.best[i].tags.mine, ask: 'À toi : joue la suite sur l’échiquier.' },
        ref: { steps: d.ref, start: start(e.playedUci, 'red'), startText: 'La flèche rouge montre le coup que tu as joué en partie.', tone: 'ko', brush: (k) => (k === 0 || !d.ref[k].tags.mine ? 'red' : 'blue'),
          chip: chip(d.ref), bilan: bilan(d.ref, 'ton coup', d.ins.refTxt), guess: (i) => i === 1, ask: 'À toi de punir ce coup : joue la meilleure réponse de ton adversaire.', cta: 'Voir mon erreur' },
      },
      verdict: o.verdict, exit: X.spec.exit, from: o.exact === false ? 0 : 1, rest: 1,
      panel: o.panel, panelHtml: (key) => { const best = key === 'best', L = d[key]; return `${rateRow(o.rate)}<div class="seg2 mini" role="tablist"><button role="tab" data-x="film" data-v="best" class="${best ? 'on' : ''}">La bonne suite</button><button role="tab" data-x="film" data-v="ref" class="${best ? '' : 'on'}">Ton coup : ${fr(e.played)}</button></div>
        <div class="card idea"><h3>L’idée derrière ${fr(e.bestSan)}</h3><p>${esc(d.ins.idee)}</p>${ASK.has(askKey) ? `<div class="askout">${coach(txt(ASK.get(askKey)))}</div>` : `<div class="askrow"><button class="btn sm" data-x="ask">${askLabel()}</button><div class="askout"></div></div>`}</div>
        ${o.why ? whyCard(o.why, e) : ''}
        <h3 class="lh">${best ? 'La bonne suite, coup par coup' : `Ce que permettait ${fr(e.played)}`}</h3>
        <ol class="line">${L.map((q, k) => `<li data-x="jump" data-v="${k + 1}"><b>${q.white ? q.no + '.' : (k === 0 ? q.no + '…' : '')} ${fr(q.san)}</b><span>${esc(q.text)}</span></li>`).join('')}</ol>
        ${!best && real && refReply && real !== refReply.san ? `<p class="small">En partie, ton adversaire a répondu ${fr(real)} au lieu de ${fr(refReply.san)} : il n’a pas trouvé la meilleure réponse. Ton coup restait une erreur, un adversaire plus attentif l’aurait punie.</p>` : ''}
        <div class="card why"><h3>Pourquoi pas ${fr(e.played)} ?</h3><p>${esc(d.ins.pourquoi)}</p>
          <div class="cmp"><div class="ok"><span>Meilleur coup · ${fr(e.bestSan)}</span><b>${d.ins.bestTxt}</b><span>évaluation ${fmtEval(e.e0)}</span></div><div class="ko"><span>Ton coup · ${fr(e.played)}</span><b>${d.ins.refTxt}</b><span>évaluation ${fmtEval(e.e1)}</span></div></div>
          <p class="small">Bilan matériel au bout des suites montrées. Valeurs : pion 1, cavalier et fou 3, tour 5, dame 9. L’évaluation est celle du moteur, de ton point de vue : +1 vaut un pion d’avance.</p></div>
        ${e.theme ? `<div class="card rule"><span class="small">À retenir</span><p class="rulet">${RULES[e.theme]}</p><a href="#cours/${e.theme}">Cours : ${LESSONS[e.theme].titre}</a></div>` : ''}`; },
    });
  });
}

export { ASK, LINES, askRun, explainUI, getLines };
