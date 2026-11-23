// S'entraîner (#entrainer), Avant de jouer (#avantpartie), échauffements (#exos, #drill/<type>).
import { ls } from '../store.js';
import * as st from '../stats.js';
import { LESSONS, RULES } from '../lessons.js';
import { $, coach, esc, ico, pl } from '../ui.js';
import { progress } from '../progress.js';
import { board } from '../board.js';
import * as exo from '../exercise.js';
import { DRILLS, makeRound } from '../drills.js';
import { OPENINGS } from '../openings.js';
import { CAUSES, mainCause } from '../brief.js';
import { STAGES, programWeek } from '../program.js';
import { ENDGAMES } from '../endgames.js';
import { S, dkey } from '../state.js';
import { allLineKeys, lineHref } from './ouvertures.js';
import { allPuzzles, moveNo, nextStep, pzDay, pzProg, pzQueue } from './puzzles.js';
import { cvList } from './jeu.js';
import { keepUi } from '../app.js';
import { session } from './cartes.js';

// ---------- Avant de jouer : la règle, la routine et la consigne du moment, puis Chess.com ----------
function viewAvant() {
  const fc = ls.get('focus', null), c = mainCause(progress.causes()), L = fc ? LESSONS[fc.id] : null, w = fc ? programWeek(fc.since) : null;
  return `<h1>Avant de jouer</h1><div class="card avant">
    <span class="small">Ta règle pour ces parties</span><p class="rulet">« ${esc(fc ? RULES[fc.id] : 'Échecs, captures, menaces : je les examine avant chaque coup.')} »</p>
    ${L?.routine ? `<h3>Ta routine, avant chaque coup</h3><ol class="routine">${L.routine.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    ${c ? `<p class="sub">Et surtout : ${esc(CAUSES[c].tip)}</p>` : ''}
    ${w && w.i < 4 ? `<p class="small">Semaine ${w.i + 1} sur 4 · ${STAGES[w.i].t} : ${esc(STAGES[w.i].d)}</p>` : ''}
    <div class="row"><a class="btn pri lg" href="https://www.chess.com/play/online/new" target="_blank" rel="noopener">Jouer sur Chess.com</a><button class="btn" data-act="refresh">J’ai joué, mettre à jour</button></div>
    <p class="small">Après la partie, reviens sur l’accueil : je te demanderai si tu as appliqué la règle, et l’analyse dira si c’est vrai.</p></div>`;
}
function viewExos() {
  const hist = progress.drills();
  return `<h1>Échauffements</h1>${coach('Sous 1000 Elo, la plupart des parties se perdent sur une vérification oubliée. Ces exercices entraînent le geste lui-même, sur des positions tirées de tes parties : 10 positions, 2 minutes. La justesse d’abord, la vitesse vient ensuite.')}
  <div class="menu">${Object.entries(DRILLS).map(([k, d]) => {
    const h = hist.filter((x) => x.type === k), last = h[h.length - 1];
    return `<a class="mrow" href="#drill/${k}"><span class="mico">${h.length ? Math.round((100 * last.ok) / last.n) + '%' : ico('play')}</span><span class="stepc"><b>${d.t}</b><span>${d.d}${h.length ? ` · ${pl(h.length, 'série')}` : ''}</span></span><span class="chev" aria-hidden="true">${ico('next')}</span></a>`;
  }).join('')}
  <a class="mrow" href="#rush"><span class="mico">${ico('bolt')}</span><span class="stepc"><b>Rush</b><span>Les mêmes questions à la chaîne, contre la montre ou en survie</span></span><span class="chev" aria-hidden="true">${ico('next')}</span></a>
  <a class="mrow" href="#finales"><span class="mico">${ico('king')}</span><span class="stepc"><b>Finales de base</b><span>Mater, faire dame, tenir la nulle contre le moteur · ${ENDGAMES.length} positions</span></span><span class="chev" aria-hidden="true">${ico('next')}</span></a>
  <a class="mrow" href="#gagner"><span class="mico">${ico('play')}</span><span class="stepc"><b>Gagner les parties gagnées</b><span>Reprends une partie où tu avais +5 et va jusqu’au mat contre le moteur · ${pl(cvList().length, 'partie')}</span></span><span class="chev" aria-hidden="true">${ico('next')}</span></a></div>`;
}
function viewDrill(type) {
  const D = DRILLS[type];
  if (!D) return viewExos();
  if (S.dr && (S.dr.type !== type || S.dr.day !== dkey())) S.dr = null;
  if (S.dr && S.dr.ans != null) drAdvance(); // la réponse était donnée quand tu as quitté l'écran
  if (!S.dr) S.dr = { type, day: dkey(), items: makeRound(type, S.data.games, 10), i: 0, ok: 0, ms: 0, ans: null };
  const d = S.dr, n = d.items.length;
  if (n < 3) return `<h1>${D.t}</h1><div class="card"><p class="sub">Pas assez de positions de ce type dans tes parties pour l’instant. Essaie un autre exercice.</p><div><a class="btn" href="#exos">Voir les exercices</a></div></div>`;
  if (d.i >= n) {
    const sec = Math.round(d.ms / 1000 / n), hist = progress.drills().filter((x) => x.type === type), prev = hist[hist.length - 2];
    const msg = d.ok >= n - 1 ? 'Le réflexe est là. Garde ce rythme en partie : la même question, avant chaque coup.' : d.ok >= n * 0.6 ? 'C’est en bonne voie. Refais une série en prenant une seconde de plus par position.' : 'Ralentis : la justesse d’abord. Refais une série sans regarder le temps.';
    return `<h1>${D.t}</h1><div class="card"><div class="row" style="align-items:baseline"><span class="big num">${d.ok}/${n}</span><span class="sub">${sec} s par position${prev ? ` · série précédente : ${prev.ok}/${prev.n}` : ''}</span></div>${coach(msg)}
      <div>${nextStep('dr')}</div><div class="row"><button class="btn" data-act="dragain">Refaire une série</button><a class="btn" href="#exos">Autres échauffements</a></div></div>`;
  }
  const it = d.items[d.i];
  const chips = `<span class="chip">${d.i + 1} / ${n}</span><span class="chip good">${pl(d.ok, 'juste')}</span>`;
  return exo.screen({
    live: true, top: () => chips,
    head: `<div class="pzhead main"><h1>${D.t}</h1><div class="row">${chips}</div></div>
      <div class="seg">${d.items.map((_, k) => `<i class="${k < d.i ? 'done' : k === d.i ? 'cur' : ''}"></i>`).join('')}</div>
      ${coach(it.q)}`,
    cap: `<p><i class="dot ${it.white ? 'w' : 'b'}"></i> Tu as les ${it.white ? 'Blancs' : 'Noirs'}.${it.tap ? ' Touche une pièce sur l’échiquier.' : ''}</p>`,
    panel: `<div class="card ghost"><h3>Pourquoi cet exercice</h3><p class="sub">${D.why}</p></div>`,
    bar: it.options.map(([v, l]) => `<button class="btn opt" data-x="ans" data-v="${v}">${l}</button>`).join(''),
  });
}
// Passe à la position suivante ; à la fin, la série est notée dans l'historique.
function drAdvance() {
  const d = S.dr; d.i++; d.ans = null;
  if (d.i < d.items.length) return;
  progress.recordDrill(d.type, d.ok, d.items.length, d.ms);
}
function mountDrill() {
  const X = exo.current(), d = S.dr;
  if (!X || !d || d.i >= d.items.length) return;
  const it = d.items[d.i], mine = it.white ? 'white' : 'black';
  d.ans = null; d.t1 = Date.now();
  const cg = X.board({ fen: it.fen, orientation: mine, lastMove: it.last, movable: { free: false, color: undefined }, draggable: { enabled: false }, selectable: { enabled: !!it.tap }, drawable: { enabled: false, visible: true, autoShapes: it.pre || [] }, events: it.tap ? { select: (key) => {
    const pc = cg.state.pieces.get(key);
    if (pc && (it.type === 'menace' ? pc.color === mine : pc.color !== mine)) answer(key);
  } } : {} });
  function answer(v) {
    if (d.ans != null) return;
    const ok = v === it.answer;
    d.ans = v; if (ok) d.ok++;
    d.ms += Math.min(60000, Date.now() - (d.t1 || Date.now()));
    keepUi();
    X.say(ok ? 'ok' : 'ko', `<div class="capm"><span class="capn">${ok ? 'Juste' : 'Raté'}</span></div><p>${esc(it.text)}</p>`);
    const shapes = it.shapes.slice();
    if (it.tap && it.answer !== 'none' && it.answer !== 'skip') shapes.push({ orig: it.answer, brush: 'green' });
    if (it.tap && !ok && /^[a-h][1-8]$/.test(v)) shapes.push({ orig: v, brush: 'red' });
    cg.set({ drawable: { autoShapes: shapes } });
    X.setBar(`<button class="btn pri" data-act="drnext">${d.i === d.items.length - 1 ? 'Voir mon score' : `Suivant${ico('next')}`}</button>`);
  }
  X.on({ ans: answer });
}
// S'entraîner (section fusionnée avec Apprendre le 16/11, refaite le 16/11) : en tête, la chose à faire maintenant,
// avec l'échiquier de ton prochain puzzle (mountEntrainer) ; puis les exercices en tuiles, chacun avec son dessin et son état ;
// l'historique en simple lien. Un seul bouton plein : celui de la tête.
function entNext() {
  const d = pzDay(), fc = ls.get('focus', null), q = d.due ? (pzQueue(fc?.id || '', false)[0] || pzQueue('', false)[0]) : null;
  if (q && d.done < d.goal) return { kind: 'pz', p: q, d };
  const due = progress.linesDue(allLineKeys());
  if (due.length) return { kind: 'ln', n: due.length, href: lineHref(due[0]) };
  return { kind: 'dr' };
}
function viewEntrainer() {
  const egDue = progress.endgamesDue(ENDGAMES.map((e) => e.id)).length;
  const n = entNext(), d = pzDay(), due = progress.linesDue(allLineKeys()), cv = cvList().length, nh = progress.hist().length;
  const les = session().steps.find((x) => x.k === 'les');
  let hero;
  if (n.kind === 'pz') {
    const { g, e } = n.p, left = d.goal - d.done;
    hero = `<section class="ent-now"><div class="ent-b"><div class="board" id="entb" data-id="${esc(n.p.id)}" aria-label="Position de ton prochain puzzle"></div></div>
      <div class="ent-t"><h2>${left === d.goal ? 'Puzzles du jour' : `Encore ${pl(left, 'puzzle')} aujourd’hui`}</h2>
      <p>Coup ${moveNo(e)} contre ${esc(g.opp)} : ton coup t’a coûté ${e.drop} points de chances de gain. ${st.THEMES[e.theme] ? `Thème : ${esc(st.THEMES[e.theme].toLowerCase())}.` : ''}</p>
      ${pzProg(d)}<button class="btn pri lg" data-act="pzfocus">${d.done ? 'Continuer mes puzzles' : 'Résoudre mes puzzles'}</button></div></section>`;
  } else if (n.kind === 'ln') {
    hero = `<section class="ent-now noboard"><div class="ent-t"><h2>${pl(n.n, 'ligne')} d’ouverture à réviser</h2><p>Puzzles du jour faits. Récite tes lignes de mémoire : la répétition espacée les fixe.</p><a class="btn pri lg" href="${n.href}">Réciter mes lignes</a></div></section>`;
  } else {
    hero = `<section class="ent-now noboard"><div class="ent-t"><h2>${d.done >= d.goal ? 'Objectif du jour atteint' : 'Échauffe ton regard'}</h2><p>${d.done >= d.goal ? 'Tes puzzles sont faits. Deux minutes de vérification gardent le réflexe.' : 'Dix positions tirées de tes parties, deux minutes, pour vérifier avant de jouer.'}</p><a class="btn pri lg" href="#exos">Lancer un échauffement</a></div></section>`;
  }
  // Sommaire plutôt que tuiles à icône (18/11, « pas AI slop ») : une ligne par exercice, ce qui t'attend à droite, en chiffres.
  const entTile = (href, t, desc, tag) => `<a class="ent-row" href="${href}"><span class="ent-tt"><b>${t}</b><span class="ent-d">${desc}</span></span>${tag ? `<span class="ent-n">${tag}</span>` : ''}${ico('next')}</a>`;
  return `<h1>S’entraîner</h1>${hero}
  <h2 class="ent-h">Pratiquer</h2><div class="ent-list">
    ${n.kind === 'pz' ? '' : entTile('#puzzles', 'Puzzles sur mes erreurs', 'Tes propres fautes, à corriger', d.due ? `${d.due} en attente` : '')}
    ${entTile('#exos', 'Échauffements', 'Vérifier avant de jouer, 2 minutes', '')}
    ${entTile(due.length ? lineHref(due[0]) : '#ouvertures/apprendre', 'Réciter mes lignes', 'Tes ouvertures, de mémoire', due.length ? `${due.length} à réviser` : '')}
    ${entTile('#rush', 'Rush', 'Vérifier vite, contre la montre', progress.rushBest().t3 ? 'Record : ' + progress.rushBest().t3 : '')}
    ${entTile('#gagner', 'Finir les parties gagnées', 'Convertir l’avantage contre le moteur', cv ? `${pl(cv, 'partie')} à convertir` : '')}
    ${entTile('#finales', 'Finales de base', 'Mater, faire dame, tenir la nulle', egDue ? `${egDue} à refaire` : '')}
    ${entTile('#inedits', 'Positions inédites', 'Puzzles neufs sur ton chantier', '')}
    ${entTile('#idees', 'Idées de plan', 'Choisir le bon plan dans tes positions calmes', '')}
  </div>
  <h2 class="ent-h">Apprendre</h2><div class="ent-list">
    ${entTile('#cours', 'Cours', les?.d ? esc(les.d) : 'Leçons illustrées par tes positions', '')}
    ${entTile('#ouvertures/apprendre', 'Ouvertures', `${OPENINGS.length} fiches : idées, pièges, lignes`, '')}
  </div>
  <a class="ent-log" href="#historique">${ico('log')}<span>Historique</span><span class="small">${nh ? `${pl(nh, 'exercice')} noté${nh > 1 ? 's' : ''}` : 'Rien encore'}</span>${ico('next')}</a>`;
}
// Échiquier de la tête de S'entraîner : position du prochain puzzle, côté du joueur, sans flèche (rien n'est dévoilé)
function mountEntrainer() {
  const el = $('#entb');
  if (!el || !el.offsetWidth || el.firstChild) return;
  const p = allPuzzles().find((x) => x.id === el.dataset.id);
  if (p) board(el, { fen: p.e.fen, orientation: p.g.w ? 'white' : 'black', viewOnly: true, coordinates: false });
}

export { drAdvance, mountDrill, mountEntrainer, viewAvant, viewDrill, viewEntrainer, viewExos };
