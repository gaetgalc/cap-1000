// Rush (#rush) : positions de vérification à la chaîne, 3 minutes ou survie.
import { coach, esc, ico } from '../ui.js';
import { progress } from '../progress.js';
import * as exo from '../exercise.js';
import { makeRound } from '../drills.js';
import { S, route } from '../state.js';
import { mmss } from './parties.js';
import { render } from '../app.js';

// ---------- Rush (#rush, #rush/<t3|surv>) : positions de vérification à la chaîne, comme Puzzle Rush ----------
// Positions des échauffements (drills.js) tirées de tes parties, mélangées. t3 : 3 minutes ; surv : la série s'arrête à 3 fautes.
const RUSH = { t3: { t: '3 minutes', d: 'Le plus de bonnes réponses en 3 minutes.' }, surv: { t: 'Survie', d: 'Pas de limite de temps : la série s’arrête à la 3e faute.' } };
const RUSH_TYPES = ['sur', 'menace', 'cadeau'], RUSH_MS = 180000, RUSH_LIVES = 3;
let rushTimer = null;
function rushFill(R) {
  const add = RUSH_TYPES.flatMap((ty) => makeRound(ty, S.data.games, 6));
  for (let i = add.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [add[i], add[j]] = [add[j], add[i]]; }
  R.items.push(...add);
}
const rushLeft = (R) => Math.max(0, RUSH_MS - (Date.now() - R.t0));
const rushClock = (R) => (R.m === 't3' ? mmss(Math.ceil(rushLeft(R) / 1000)) : `${'●'.repeat(RUSH_LIVES - R.ko)}${'○'.repeat(R.ko)}`);
function rushFinish(R) {
  if (R.done) return;
  R.done = true; clearInterval(rushTimer);
  R.rec = progress.recordRush(R.m, R.ok, R.n);
}
function viewRush(m) {
  const best = progress.rushBest();
  if (!RUSH[m]) {
    if (S.rush?.done) S.rush = null; // depuis le menu, une série finie repart de zéro
    return `<h1>Rush</h1>${coach('Des positions de tes parties, à la chaîne : ta pièce est-elle sûre ? que menace son dernier coup ? quelle pièce adverse est gratuite ? Réponds vite, mais juste : c’est le réflexe de vérification, sous la pression de la pendule.')}
    <div class="menu">${Object.entries(RUSH).map(([k, x]) => `<a class="mrow" href="#rush/${k}"><span class="mico">${ico(k === 't3' ? 'clock' : 'bolt')}</span><span class="stepc"><b>${x.t}</b><span>${x.d}</span></span><span class="chip ${best[k] ? 'good' : ''}">Record : ${best[k] || '—'}</span><span class="chev" aria-hidden="true">${ico('next')}</span></a>`).join('')}</div>`;
  }
  let R = S.rush;
  if (!R || R.m !== m) { R = S.rush = { m, items: [], i: 0, ok: 0, ko: 0, n: 0, t0: 0, done: false, missed: [] }; rushFill(R); }
  if (R.items.length < 3) return `<h1>Rush</h1><div class="card"><p class="sub">Pas assez de positions dans tes parties pour l’instant. Reviens après quelques parties de plus.</p><div><a class="btn" href="#exos">Échauffements</a></div></div>`;
  if (R.m === 't3' && R.t0 && !rushLeft(R)) rushFinish(R);
  if (R.done) {
    return `<h1>Rush ${RUSH[m].t.toLowerCase()}</h1><div class="card"><div class="row" style="align-items:baseline"><span class="big num">${R.ok}</span><span class="sub">bonne${R.ok > 1 ? 's' : ''} réponse${R.ok > 1 ? 's' : ''} sur ${R.n}${R.rec ? ' · nouveau record' : ` · record : ${best[m]}`}</span></div>
      ${coach(R.rec ? 'Nouveau record. Le réflexe s’installe : garde-le en partie, à chaque coup.' : R.n && R.ok / R.n < 0.7 ? 'Trop de fautes : ralentis un peu, la justesse compte plus que le nombre.' : 'Bonne série. Refais-en une demain pour fixer le réflexe.')}
      <div class="row"><button class="btn pri" data-act="rushagain">Rejouer</button><a class="btn" href="#rush">Autre mode</a></div></div>
      ${R.missed.length ? `<div class="card"><h2>Fautes</h2>${R.missed.slice(0, 8).map((x) => `<div class="hrow"><i class="hres r0"></i><span class="stepc"><b>${x.q}</b><span>${esc(x.text)}</span></span></div>`).join('')}</div>` : ''}`;
  }
  if (R.i >= R.items.length - 2) rushFill(R);
  const it = R.items[R.i];
  const chips = `<span class="chip rushclk">${rushClock(R)}</span><span class="chip good">${R.ok}</span>`;
  return exo.screen({
    live: true, top: () => chips,
    head: `<div class="pzhead main"><h1>Rush ${RUSH[m].t.toLowerCase()}</h1><div class="row">${chips}</div></div>${coach(it.q)}`,
    cap: `<p><i class="dot ${it.white ? 'w' : 'b'}"></i> Tu as les ${it.white ? 'Blancs' : 'Noirs'}.${it.tap ? ' Touche une pièce sur l’échiquier.' : ''}</p>`,
    panel: `<div class="card ghost"><h3>${RUSH[m].t}</h3><p class="sub">${RUSH[m].d} Record : ${best[m] || '—'}.</p></div>`,
    bar: it.options.map(([v, l]) => `<button class="btn opt" data-x="ans" data-v="${v}">${l}</button>`).join('') + '<button class="btn" data-x="stop">Arrêter</button>',
  });
}
function mountRush() {
  clearInterval(rushTimer);
  const X = exo.current(), R = S.rush;
  if (!X || !R || R.done || !RUSH[route()[1]]) return;
  const it = R.items[R.i], mine = it.white ? 'white' : 'black';
  if (!R.t0) R.t0 = Date.now();
  let answered = false;
  const tick = () => {
    if (!X.alive()) { clearInterval(rushTimer); return; }
    document.querySelectorAll('.rushclk').forEach((c) => { c.textContent = rushClock(R); });
    if (R.m === 't3' && !rushLeft(R)) { rushFinish(R); render(); }
  };
  rushTimer = setInterval(tick, 250);
  const cg = X.board({ fen: it.fen, orientation: mine, lastMove: it.last, movable: { free: false, color: undefined }, draggable: { enabled: false }, selectable: { enabled: !!it.tap }, drawable: { enabled: false, visible: true, autoShapes: it.pre || [] }, events: it.tap ? { select: (key) => {
    const pc = cg.state.pieces.get(key);
    if (pc && (it.type === 'menace' ? pc.color === mine : pc.color !== mine)) answer(key);
  } } : {} });
  function answer(v) {
    if (answered || R.done) return;
    answered = true;
    const ok = v === it.answer;
    R.n++; if (ok) R.ok++; else { R.ko++; R.missed.push({ q: it.q, text: it.text }); }
    exo.feedback(ok ? 'good' : 'bad');
    document.querySelectorAll('.rushclk').forEach((c) => { c.textContent = rushClock(R); });
    X.say(ok ? 'ok' : 'ko', `<div class="capm"><span class="capn">${ok ? 'Juste' : 'Raté'}</span></div>${ok ? '' : `<p>${esc(it.text)}</p>`}`);
    const shapes = it.shapes.slice();
    if (it.tap && it.answer !== 'none' && it.answer !== 'skip') shapes.push({ orig: it.answer, brush: 'green' });
    cg.set({ drawable: { autoShapes: shapes } });
    R.i++;
    if (R.m === 'surv' && R.ko >= RUSH_LIVES) rushFinish(R);
    setTimeout(() => { if (X.alive() && route()[0] === 'rush' && S.rush === R) render(); }, ok ? 450 : 1600);
  }
  X.on({ ans: answer, stop() { rushFinish(R); render(); } });
}

export { RUSH, mountRush, rushTimer, viewRush };
