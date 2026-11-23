// Mon jeu (#bilan) : objectif, chantier, points forts et faibles, tendance, phases de jeu.
import { ls } from '../store.js';
import * as st from '../stats.js';
import { $, TC, WDL_LEGEND, dfmt, esc, f1, pl, skel, tabs, wdl } from '../ui.js';
import { lineChart } from '../charts.js';
import * as exo from '../exercise.js';
import { PRO_TABS } from '../nav.js';
import { hourStats, insightText, phaseJob, pieceStats, sessionStats } from '../insights.js';
import { S, games, goal, memo, route, targetTc } from '../state.js';
import { causesCard, focusCard, focusStats, goalBlock, periodSeg, portraitCard, programCard, session, theoryCard, trendCard } from './cartes.js';
import { idle } from '../app.js';

// ---------- Mon jeu : objectif, chantier, points forts et faibles, tendance, bilan ----------
// Quand et comment tu perds (insights.js, comme les « Insights » de Chess.com) : phase, pièce, heure, rang dans la session.
// Calcul gardé par memo() tant que les parties, les analyses, le filtre et le jour ne changent pas. La phase demande de rejouer
// chaque partie : elle se calcule par tranches quand le navigateur est libre (phaseJob), la carte montre un bloc gris d'ici là
// puis se remplit sur place. Le reste de la page ne l'attend pas.
function insightsOf() {
  return memo('insights', () => { const gs = games(); return { job: phaseJob(gs, S.an), pieces: pieceStats(gs, S.an), hours: hourStats(gs), sessions: sessionStats(gs) }; });
}
// Une seule boucle à la fois (phasesRun). Si les données changent en route, elle reprend sur le nouveau calcul tant qu'on est
// sur Mon jeu ; les parties inchangées ne sont pas refaites (cache par analyse dans insights.js).
let phasesRun = null;
function runPhases(I) {
  if (phasesRun) return;
  phasesRun = I;
  idle(function step(dl) {
    let more = false;
    try {
      const here = S.data && route()[0] === 'bilan' && $('#ins');
      if (!here) return; // on a quitté Mon jeu : le prochain mountBilan relancera
      phasesRun = insightsOf();
      phasesRun.job.step(Math.max(0, dl.timeRemaining() - 2));
      more = !phasesRun.job.done;
      if (!more && !exo.live()) $('#ins').outerHTML = insightsCard();
    } finally { if (!more) phasesRun = null; } // libérée même si une tranche lève une exception
    if (more) idle(step);
  });
}
function insightsCard() {
  const J = insightsOf(), I = { ...J, phases: J.job.done ? J.job.result() : null }, lines = insightText({ ...I, phases: I.phases || [] }), every = (r) => (r ? `1 tous les ${Math.round(1 / r)} coups` : 'aucune');
  const row = (label, n, val, cls = '') => `<tr><td>${label}</td><td class="r small">${n}</td><td class="r ${cls}"><b>${val}</b></td></tr>`;
  const sc = (x) => (x.n >= 5 ? (x.score >= 55 ? 'ok' : x.score <= 42 ? 'ko' : '') : '');
  const pcs = I.pieces.filter((p) => p.moves >= 10).slice(0, 4);
  return `<div class="card" id="ins"><h2>Quand et comment tu perds <span class="small">${TC[S.f.tc] || 'toutes cadences'}</span></h2>
    ${lines.length ? `<div class="stack">${lines.map((t) => `<p class="ins">${esc(t)}</p>`).join('')}</div>` : '<p class="small">Pas encore d’écart net : il faut au moins 8 parties de chaque côté pour en tirer une règle.</p>'}
    <div class="grid ins-grid">
      <div><h3>Par phase <span class="small">fautes graves</span></h3><table><tbody>${I.phases ? I.phases.map((x) => row(x.label, x.n ? x.n + ' coups' : '—', x.n ? every(x.rate) : '—')).join('') : `<tr><td>${skel('Calcul en cours', 70, 50, 60)}</td></tr>`}</tbody></table></div>
      <div><h3>Par pièce jouée <span class="small">fautes graves</span></h3><table><tbody>${pcs.length ? pcs.map((x) => row(x.name[0].toUpperCase() + x.name.slice(1), x.moves + ' coups', every(x.rate))).join('') : '<tr><td class="small">Analyse plus de parties.</td></tr>'}</tbody></table></div>
      <div><h3>Selon l’heure <span class="small">score</span></h3><table><tbody>${I.hours.map((x) => row(x.label, pl(x.n, 'partie'), x.n ? x.score + ' %' : '—', sc(x))).join('')}</tbody></table></div>
      <div><h3>Dans la session <span class="small">score</span></h3><table><tbody>${I.sessions.map((x) => row(x.label, pl(x.n, 'partie'), x.n ? x.score + ' %' : '—', sc(x))).join('')}</tbody></table></div>
    </div><p class="small">Phase et pièce : parties analysées seulement. Une session : parties jouées à moins d’une heure d’intervalle.</p></div>`;
}
function viewBilan() {
  const gs = games(), gb = goalBlock();
  const { es, sig, fc } = session();
  const sigHtml = (arr, c, empty) => (arr.length ? arr.slice(0, 4).map((x) => `<div class="sig" style="--c:var(--${c})"><b>${esc(x.t)}</b><span>${esc(x.d)}</span>${x.lesson ? `<a href="#${x.lesson === 'ouvertures' ? 'ouvertures' : 'cours/' + x.lesson}">${x.lesson === 'ouvertures' ? 'Voir tes ouvertures' : 'Ouvrir le cours'}</a>` : ''}</div>`).join('') : `<p class="sub">${empty}</p>`);
  const all = st.tally(gs);
  return `${tabs('bilan', PRO_TABS)}<div class="vhead"><h1>Mon jeu</h1>${periodSeg()}</div>
  <div class="hero">${gb.html}
    <div class="card"><h2>Classement ${S.f.tc === 'all' ? 'Rapide' : TC[S.f.tc]}</h2><div class="chart" id="rc"></div></div></div>
  ${portraitCard()}
  ${focusCard(fc, es)}
  ${programCard(fc)}
  ${causesCard()}
  ${theoryCard()}
  ${gs.length ? `<div class="grid">
    <div class="card"><h2>Points forts</h2>${sigHtml(sig.forces, 'good', 'Pas encore assez de parties pour dégager un point fort net.')}</div>
    <div class="card"><h2>Points faibles</h2>${sigHtml(sig.faiblesses, 'bad', 'Aucune faiblesse nette détectée pour ce filtre.')}</div>
  </div>
  <div class="grid">
  ${trendCard(gs)}
    <div class="card"><h2>Bilan <span class="small">${all.n} parties, ${TC[S.f.tc]}</span></h2>
      <table><tbody><tr><td>Toutes</td><td style="width:45%">${wdl(all)}</td><td class="r"><b>${st.score(all)} %</b></td></tr>
        <tr><td>Blancs</td><td>${wdl(st.tally(gs.filter((g) => g.w)))}</td><td class="r">${st.score(st.tally(gs.filter((g) => g.w)))} %</td></tr>
        <tr><td>Noirs</td><td>${wdl(st.tally(gs.filter((g) => !g.w)))}</td><td class="r">${st.score(st.tally(gs.filter((g) => !g.w)))} %</td></tr></tbody></table>${WDL_LEGEND}
      <dl class="kv">${es.n ? `<dt>Précision moyenne</dt><dd>${es.acc.toFixed(1)} %</dd><dt>Gaffes par partie</dt><dd>${(es.gaffes / es.n).toFixed(1)}</dd>` : ''}<dt>Parties analysées</dt><dd>${es.n} sur ${gs.length}</dd></dl>
      ${S.job.running ? '' : '<div><button class="btn sm" data-act="analyse">Analyser 20 parties de plus</button></div>'}</div>
  </div>
  ${insightsCard()}` : `<div class="card"><p class="sub">Aucune partie pour ce filtre (${TC[S.f.tc]}). Change la cadence ou la période.</p></div>`}`;
}
function mountBilan() {
  const I = S.data && games().length ? insightsOf() : null;
  if (I && !I.job.done) runPhases(I);

  const fcEl = $('#fchart'), f = ls.get('focus', null);
  if (fcEl && f) {
    const fs = focusStats(f), ser = st.themeSeries(fs.done, S.an, f.id);
    if (ser.length >= 2) lineChart(fcEl, ser.map((p, i) => ({ x: i, y: p.y, tip: `Parties ${i * 5 + 1} à ${i * 5 + 5} : ${f1(p.y)} par partie` })), { h: 120, min: 0, label: 'Erreurs par partie, par paquets de 5 parties', yfmt: (v) => f1(v), x0: 'Plus ancien', x1: 'Plus récent', ...(fs.target != null ? { ref: fs.target, refLabel: 'Objectif' } : {}) });
    else fcEl.remove();
  }
  const el = $('#rc'); if (!el) return;
  const tc = targetTc();
  const pts = S.data.games.filter((g) => g.tc === tc && g.rated && g.r && (!S.f.days || g.t >= Date.now() / 1000 - S.f.days * 86400)).map((g) => ({ x: g.t, y: g.r, tip: `${dfmt(g.t)} : ${g.r}` }));
  const g = goal();
  const o = { label: 'Évolution du classement', x0: pts[0] ? dfmt(pts[0].x) : '', x1: pts.length ? dfmt(pts[pts.length - 1].x) : '' };
  if (tc === 'rapid') { o.ref = g.elo; o.refLabel = 'Objectif ' + g.elo; }
  o.h = innerWidth >= 860 ? 280 : 200;
  lineChart(el, pts, o);
}

export { mountBilan, viewBilan };
