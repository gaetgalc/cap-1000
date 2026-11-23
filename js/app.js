import { dbGet, dbSet, dbDel, ls } from './store.js';
import { importPlayer } from './chesscom.js';
import { Engine, evaluateGame, multiPass } from './engine.js';
import { classify, VERSION, replay } from './classify.js';
import * as st from './stats.js';
import { viewStats, mountStats } from './alltime.js';
import { $, esc, coach, txt, pl, ico, setHtml, tabs, skel, F_DNUM, installed } from './ui.js';
import { progress } from './progress.js';
import { board, destroyBoards } from './board.js';
import * as exo from './exercise.js';
import { LI_FOR } from './lichess.js';
import { facts, askCoach, buildPrompt, parseLesson } from './coach.js';
import * as backup from './backup.js';
import { toast } from './toast.js';
import * as sound from './sound.js';
import { sectionOf, tabTarget, PRO_TABS } from './nav.js';
import * as look from './look.js';
import { makeIdle } from './idle.js';
import { DEPTH, S, dkey, rapidAll, route, streak, targetTc, touch } from './state.js';
import { gvAsk, gvDb, gvGo, gvMove, gvQGo, gvSync, gvTab, gvVarGo, mountPartie, viewPartie } from './views/partie.js';
import { fbArrowOn, fbGo, fbMove, fbNew, fbParse, fbSync, mountEchiquier, viewEchiquier } from './views/echiquier.js';
import { session, upToDate } from './views/cartes.js';
import { failedToday, mountPuzzle, pzDay, pzQueue, pzReset, viewHistory, viewPuzzles } from './views/puzzles.js';
import { liLoad, mountInedits, viewInedits } from './views/inedits.js';
import { LINES } from './views/explication.js';
import { allLineKeys, famHref, lexpLoad, lineHref, mountLigne, mountMonOuv, mountOpening, viewApprendre, viewLigne, viewMonOuv, viewOpening, viewOuvertures } from './views/ouvertures.js';
import { mountFinale, mountGagner, mountJouer, viewFinale, viewFinales, viewGagner, viewJouer } from './views/jeu.js';
import { mountRush, rushTimer, viewRush } from './views/rush.js';
import { mountAccueil, viewAccueil } from './views/accueil.js';
import { mountBilan, viewBilan } from './views/bilan.js';
import { genCourse, lessonArgs, mountLecon, viewCours, viewLecon } from './views/cours.js';
import { viewParties } from './views/parties.js';
import { mountIdees, viewIdees } from './views/idees.js';
import { drAdvance, mountDrill, mountEntrainer, viewAvant, viewDrill, viewEntrainer, viewExos } from './views/entrainer.js';
import { mountPlan, viewPlan } from './views/reglages.js';

// ---------- Données ----------
// État, accès aux parties et version des données (touch, memo) : js/state.js. Ici : chargement, import, analyse.
async function load() {
  if (!S.user) return;
  S.data = (await dbGet('data:' + S.user)) || null;
  S.an = (await dbGet('an:' + S.user)) || {};
  S.ai = (await dbGet('ai:' + S.user)) || {};
  touch();
}
async function doImport(user, manual) {
  const first = !S.data;
  S.importing = { done: 0, total: 0, err: null };
  if (first) render(); else paintJob();
  try {
    const prev = user === S.user ? S.data : await dbGet('data:' + user);
    const d = await importPlayer(user, prev, (a, b) => { S.importing = { done: a, total: b, err: null }; paintJob(); const el = $('#imp'); if (el) el.textContent = b ? `Import des parties : ${a} mois sur ${b}` : 'Connexion à Chess.com'; });
    const n = d.games.length - (prev?.games?.length || 0);
    // Bilan de l'import (18/11) : parties arrivées, cumulées jusqu'à ce que l'élève ait lu le bilan (« J'ai lu »).
    const known = new Set((prev?.games || []).map((g) => g.id)), fresh = d.games.filter((g) => !known.has(g.id)).map((g) => g.id);
    if (fresh.length) { const r0 = ls.get('recap', null); ls.set('recap', { ids: [...new Set([...(r0?.ids || []), ...fresh])], t: Date.now() }); }
    S.user = d.user; S.data = d; ls.set('user', d.user);
    await dbSet('data:' + d.user, d);
    S.an = (await dbGet('an:' + d.user)) || {};
    S.ai = (await dbGet('ai:' + d.user)) || {};
    touch();
    S.importing = null; S.upErr = null;
    if (!d.games.some((g) => g.tc === S.f.tc) && S.f.tc !== 'all') { S.f = { tc: 'all', days: 0 }; ls.set('filter', S.f); }
    if (first) render(); else if (route()[0] === 'partie') { paintJob(); header(); } else bgRender(); // relecture : les nouvelles parties ne changent pas la partie ouverte
    // Message éphémère réservé à ce que l'élève vient de faire (revue HIG, 17/11) : un import automatique change les nombres sur place.
    if (first || manual) toast(first ? `${pl(d.games.length, 'partie')} importée${d.games.length > 1 ? 's' : ''}` : n > 1 ? `${n} nouvelles parties importées` : n ? '1 nouvelle partie importée' : 'Aucune nouvelle partie');
    reclassify();
    autoAnalyse();
  } catch (e) {
    if (first) { S.importing = { err: e.message || String(e) }; render(); }
    else {
      // Échec : noté dans la ligne d'état (#upd) ; message éphémère seulement si l'élève a demandé la mise à jour,
      // pas à chaque retour sur l'onglet.
      S.importing = null; S.upErr = Date.now(); paintJob();
      document.querySelectorAll('#upd, [data-upd]').forEach((u) => { u.textContent = upToDate(); });
      if (manual) toast('Mise à jour impossible : ' + (e.message || String(e)));
    }
  }
}

// Rendu déclenché en arrière-plan (fin d'analyse, import, cours généré) : n'interrompt jamais un exercice en cours.
function bgRender() {
  if (exo.live()) { paintJob(); header(); return; }
  render(true);
}

// ---------- Analyse moteur en arrière-plan ----------
// Une analyse stockée = évaluations brutes du moteur (ev, best, pv) + ce que classify() en déduit (errs, acc…) + version des règles.
const analysis = (g, raw) => ({ ...raw, ...classify(g, raw), v: VERSION });
// Analyse d'avant la séparation évaluer / classer : pas de données brutes, donc impossible à reclasser. À réévaluer une fois.
const legacy = (a) => !!a && !a.bad && !a.pv;
// Analyse sans recherche des coups qui tiennent (raw.mp, ajoutée le 15/11) : complétée une fois, sur les seules positions d'erreur.
const partial = (a) => !!a && !a.bad && !!a.pv && !a.mp;
const toRedo = (a) => legacy(a) || partial(a);
function analysisPool() {
  const pool = S.data.games.filter((g) => g.tc === targetTc());
  return (pool.length ? pool : S.data.games).slice().sort((a, b) => b.t - a.t);
}
// Les règles de classement ont changé : les parties déjà évaluées sont reclassées sur place, sans relancer le moteur.
function reclassify() {
  if (!S.data) return;
  const user = S.user, todo = S.data.games.filter((g) => { const a = S.an[g.id]; return a && a.pv && a.v !== VERSION; });
  let i = 0;
  (function step() {
    if (S.user !== user || !todo.length) return;
    for (const t0 = performance.now(); i < todo.length && performance.now() - t0 < 30; i++) S.an[todo[i].id] = analysis(todo[i], S.an[todo[i].id]);
    touch();
    if (i < todo.length) setTimeout(step, 0); else { dbSet('an:' + user, S.an); bgRender(); }
  })();
}
// Parties rejouées d'avance, par tranches de 10 ms quand le navigateur est libre (17/11) : « Mon jeu » et la relecture
// trouvent alors leurs positions déjà calculées (replay garde chaque partie), au lieu de figer l'écran à l'ouverture.
// idle (js/idle.js) : sans requestIdleCallback, tranches décomptées d'environ 10 ms.
const idle = makeIdle(window);
function warmReplays() {
  if (!S.data) return;
  const user = S.user, todo = S.data.games.filter((g) => S.an[g.id] && !S.an[g.id].bad).reverse();
  let i = 0;
  idle(function step(dl) {
    if (S.user !== user) return;
    while (i < todo.length && dl.timeRemaining() > 2) replay(todo[i++]);
    if (i < todo.length) idle(step);
  });
}
// Au démarrage : nouvelles parties récentes à analyser, puis anciennes analyses à réévaluer (une seule fois).
function autoAnalyse() {
  if (!S.data) return;
  const pool = analysisPool(), list = [...pool.slice(0, 20).filter((g) => !S.an[g.id]), ...pool.filter((g) => toRedo(S.an[g.id]))];
  if (list.length) runAnalysis(0, null, list);
}
// count parties de plus (les plus récentes non analysées d'abord), ou une seule (only), ou une liste précise (list).
async function runAnalysis(count, only, list, manual) {
  if (S.job.running || !S.data) return;
  const pool = analysisPool();
  const queue = list || (only ? [only] : [...pool.filter((g) => !S.an[g.id]), ...pool.filter((g) => toRedo(S.an[g.id]))].slice(0, count));
  if (!queue.length) return;
  S.job = { running: true, done: 0, part: 0, total: queue.length, stop: false, msg: '', manual: !!manual };
  const user = S.user, saveAn = () => (S.user === user ? dbSet('an:' + user, S.an) : null);
  paintJob();
  if (['accueil', 'cours'].includes(route()[0])) bgRender(); // « pas encore analysée » devient un bloc de chargement
  try {
    S.engine ||= new Engine();
    await S.engine.ready;
    for (const g of queue) {
      if (S.job.stop || S.user !== user) break;
      const old = S.an[g.id], alive = () => !S.job.stop;
      if (partial(old)) {
        const mp = await multiPass(S.engine, g, old.ev, DEPTH, alive);
        if (!mp) break;
        S.an[g.id] = analysis(g, { ev: old.ev, best: old.best, pv: old.pv, nb: old.nb, depth: old.depth, mp });
      } else {
        const raw = await evaluateGame(S.engine, g, DEPTH, alive, (i, n) => { S.job.part = i / n; paintJob(); });
        if (S.job.stop && !raw) break; // interrompue : l'ancienne analyse, s'il y en a une, reste en place
        S.an[g.id] = raw ? analysis(g, raw) : { ev: [], errs: [], nb: 0, acc: null, maxAdv: 0, last: 0, bad: true };
      }
      touch();
      S.job.done++; S.job.part = 0;
      if (S.job.done % 3 === 0 || S.job.done === queue.length) await saveAn();
      paintJob();
      const r = route()[0];
      if ((r === 'puzzles' && !exo.current()) || (r === 'partie' && only) || ((r === 'accueil' || r === 'bilan') && !only && (S.job.done === 3 || S.job.done % 5 === 0))) bgRender();
    }
    await saveAn();
  } catch (e) {
    S.job.msg = 'Le moteur d’analyse n’a pas pu démarrer sur ce navigateur. Les statistiques restent disponibles.';
    S.engine = null;
  }
  S.job.running = false;
  bgRender();
  const n = S.job.done;
  if (n && S.job.manual && !S.job.msg && S.user === user) toast(`${pl(n, 'partie')} analysée${n > 1 ? 's' : ''}`);
}
// Bandeau d'avancement : import, puis analyse (parties finies + avancée dans la partie en cours).
// La barre est mise à jour sur place (transform), sans reconstruire le bouton de pause sous le doigt.
function paintJob() {
  const busy = !!S.importing && !S.importing.err;
  document.querySelectorAll('[data-act="refresh"]').forEach((b) => b.toggleAttribute('aria-busy', busy));
  const el = $('#job');
  const j = S.job;
  if (S.importing && !S.importing.err && S.data) {
    el.hidden = false; el.dataset.k = 'imp'; el.innerHTML = `<span>Mise à jour depuis Chess.com (${S.importing.done}/${S.importing.total || '?'} mois)</span>`;
  } else if (j.running) {
    if (el.dataset.k !== 'run') {
      el.dataset.k = 'run';
      el.innerHTML = '<span id="jobt"></span><span class="bar" role="progressbar" aria-label="Analyse des parties" aria-valuemin="0" aria-valuemax="100"><i></i></span><button class="btn sm" id="jobstop">Mettre en pause</button>';
      $('#jobstop').onclick = () => { S.job.stop = true; };
    }
    el.hidden = false;
    const p = Math.min(1, (j.done + (j.part || 0)) / j.total), bar = $('.bar', el);
    setHtml($('#jobt'), `Analyse de tes parties : <b class="num">${j.done}/${j.total}</b>`);
    bar.setAttribute('aria-valuenow', Math.round(100 * p));
    bar.firstElementChild.style.transform = `scaleX(${p})`;
  } else { el.dataset.k = ''; if (j.msg) { el.hidden = false; el.innerHTML = `<span class="err">${esc(j.msg)}</span>`; } else el.hidden = true; }
}

// Bas de la colonne de gauche, ordinateur (18/11, demande de Gaëtan : « remets la barre mettre à jour en bas à gauche ») :
// état de la mise à jour et bouton, sur toutes les pages hors exercice (body.fit cache .tools).
const sideUpd = () => `<div class="sideupd d-only"><span class="small" data-upd>${upToDate()}</span><button class="btn sm" data-act="refresh" title="Récupérer les nouvelles parties de ${esc(S.user)}" ${S.importing && !S.importing.err ? 'aria-busy="true"' : ''}>${ico('refresh')}<span>Mettre à jour</span></button></div>`;
const refreshBtn = () => `<button class="btn ico" data-act="refresh" aria-label="Mettre à jour" title="Récupérer les nouvelles parties de ${esc(S.user)}" ${S.importing && !S.importing.err ? 'aria-busy="true"' : ''}>${ico('refresh')}</button>`;
function header() {
  const t = $('#tools'), [r, a] = route();
  const imm = !!S.data && (!!exo.current() || r === 'erreur' || (r === 'cours' && !!a) || (r === 'ouvertures' && !!a && a !== 'apprendre') || r === 'monouv' || r === 'avantpartie'); // écran d'exercice ou page de cours : barre du haut avec retour
  document.body.classList.toggle('imm', imm);
  document.body.classList.toggle('homefit', !!S.data && r === 'accueil');
  pageTitle(imm, r);
  if (!S.data) { t.innerHTML = ''; return; }
  const tr = st.trend(rapidAll()), stk = streak();
  // Sur téléphone, pendant un exercice, la barre du haut montre l'avancée (puzzles du jour, position de la série).
  // L'accueil n'y met pas l'Elo : son bandeau d'objectif le montre déjà.
  const top = exo.top();
  t.innerHTML = `${top ? `<span class="m-only row chips">${top}</span>` : `<span class="m-only row chips">${tr && r !== 'accueil' ? `<span class="chip">${tr.cur} Elo</span>` : ''}<span class="chip ${stk ? 'warn' : ''}">Série ${stk} j</span></span>`}${exo.current() ? sndBtn() : ''}${sideUpd()}`;
  navBadges();
}
// Titre de la barre du haut. Écran à retour (imm) : title de ROUTES. Téléphone, hors accueil (revue HIG, tâche 6) : le texte du
// premier h1 de la vue, à la place du logo (body.titled) ; le h1 reste dans la page pour les lecteurs d'écran (.vh) et le
// titre de la barre leur est caché pour ne pas être lu deux fois. Lu après l'écriture de la vue : header() vient après.
function pageTitle(imm, r) {
  const ttl = $('#ttl'), h = imm ? null : $('#view h1');
  const bar = !!h && !!S.data && r !== 'accueil' && phoneNav.matches;
  if (h) h.classList.toggle('vh', bar);
  document.body.classList.toggle('titled', bar);
  ttl.textContent = imm ? ROUTES[r]?.title : bar ? h.textContent.replace(/\s+/g, ' ').trim() : '';
  if (bar) ttl.setAttribute('aria-hidden', 'true'); else ttl.removeAttribute('aria-hidden');
}
// Bouton son / muet d'un écran d'exercice : barre du haut sur téléphone, bas de la colonne d'icônes sur ordinateur.
const sndAttrs = (b) => { const on = sound.enabled(); b.setAttribute('aria-pressed', on); b.title = on ? 'Couper les sons' : 'Activer les sons'; b.innerHTML = ico(on ? 'snd' : 'mute'); };
function sndBtn() { const on = sound.enabled(); return `<button class="btn ico snd" data-act="snd" aria-label="Sons" aria-pressed="${on}" title="${on ? 'Couper les sons' : 'Activer les sons'}">${ico(on ? 'snd' : 'mute')}</button>`; }

function viewWelcome() {
  const imp = S.importing;
  return `<div class="card welcome"><h1>Cap 1000</h1>
    <p class="sub">Entre ton pseudo Chess.com. Tes parties sont importées, analysées dans ton navigateur, puis transformées en puzzles, en cours et en plan d’entraînement.</p>
    <form id="wf" class="row"><input type="text" id="wu" placeholder="Pseudo Chess.com" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(new URLSearchParams(location.search).get('u') || '')}" style="flex:1;min-width:180px"><button class="btn pri" ${imp && !imp.err ? 'disabled' : ''}>Importer mes parties</button></form>
    ${imp?.err ? `<p class="err">${esc(imp.err)}</p>` : imp ? '<p class="sub" id="imp">Connexion à Chess.com</p>' : ''}
    <p class="small">Aucun compte ni mot de passe : seules tes parties publiques sont lues. Tout reste enregistré sur cet appareil.</p>
    <p class="small">${installed() ? 'App installée : ta progression faite dans Safari n’y est pas encore. ' : ''}Déjà une sauvegarde ? <button class="btn sm" data-act="bakimp">Restaurer un fichier</button><input type="file" id="bakfile" accept="application/json,.json" hidden></p>
    <p class="small" id="bakmsg" role="status"></p></div>`;
}

// ---------- État de l'écran, conservé quand on quitte ou recharge la page ----------
function keepUi() {
  if (!S.data) return;
  ls.set('ui', { d: dkey(), pz: S.pz, cl: S.cl, cv: S.cv && !S.cv.over ? S.cv : null, fg: S.fg && !S.fg.over ? S.fg : null, jp: S.jp && !S.jp.over ? S.jp : null, dr: S.dr && S.dr.i < S.dr.items.length ? S.dr : null, li: S.li?.cur && !S.li.counted ? { cur: S.li.cur, failed: !!S.li.failed, replay: !!S.li.replay } : null });
}
function restoreUi() {
  const u = ls.get('ui', null); if (!u) return;
  const same = u.d === dkey();
  if (u.pz) S.pz = same ? u.pz : { ...u.pz, free: false, redo: [], show: null }; // un nouveau jour repart de la file normale
  S.cl = u.cl || null;
  S.cv = u.cv || null;
  S.fg = u.fg || null;
  S.jp = u.jp || null;
  if (same) S.dr = u.dr || null;
  S.liKeep = u.li || null;
}

// Restauration d'une sauvegarde : confirmation avec son contenu, puis l'état est relu depuis le stockage.
async function restoreFrom(file) {
  const m = $('#bakmsg');
  if (!file) return;
  try {
    const b = await backup.readFile(file), x = backup.summary(b);
    const ok = confirm(`Remplacer les données de cet appareil par la sauvegarde de ${b.user}${x.date ? ' du ' + F_DNUM(x.date) : ''} ?\n${x.games} parties, ${x.an} analysées, ${x.pz} puzzles suivis, ${x.h} exercices au journal.\nLa clé du coach reste celle de cet appareil.`);
    if (!ok) return;
    S.job.stop = true;
    await backup.restore(b);
    S.user = b.user; S.f = ls.get('filter', S.f); S.pz = null; S.cl = null; S.dr = null; S.cv = null; S.li = null; S.liKeep = null; S.gen = null; LINES.clear();
    await load(); restoreUi(); look.apply();
    location.hash = '#accueil'; render();
    toast('Sauvegarde restaurée');
    reclassify(); autoAnalyse();
  } catch (e) { if (m) m.textContent = e.message || String(e); }
}

function repPlay(uci) {
  if (route()[0] === 'partie' && S.gv) gvMove(uci.slice(0, 2), uci.slice(2, 4));
  else if (route()[0] === 'echiquier' && S.fb) fbMove(uci.slice(0, 2), uci.slice(2, 4));
}

// ---------- Routage et événements ----------
// Table des routes (#route/a/b/c) : view rend le HTML de la vue ; mount monte échiquiers, courbes et écouteurs juste après ;
// resize redessine au redimensionnement ; title nomme l'écran dans la barre du haut (exercice, page de cours) ; back est la cible
// du bouton Retour (adresse, ou fonction qui la rend, ou qui navigue elle-même par history.back() et ne rend rien ; #accueil
// sans back). Sans prototype : #constructor n'est pas une route.
const pzMount = () => { mountPuzzle(); const s = $('#pzt'); if (s) s.onchange = () => { S.pz.theme = s.value; S.pz.cur = null; S.pz.show = null; render(); }; };
const ROUTES = {
  __proto__: null,
  accueil: { view: viewAccueil, mount: mountAccueil, resize: mountAccueil },
  avantpartie: { view: viewAvant, title: 'Avant de jouer' },
  entrainer: { view: viewEntrainer, mount: mountEntrainer, resize: mountEntrainer },
  puzzles: { view: () => viewPuzzles(), mount: pzMount, title: 'Puzzles' },
  erreur: { view: (a, b) => viewPuzzles([a, b]), mount: pzMount, title: 'Comprendre', back: () => (history.length > 1 ? history.back() : '#puzzles') },
  historique: { view: viewHistory },
  exos: { view: viewExos },
  inedits: { view: viewInedits, mount: mountInedits, title: 'Positions inédites', back: '#puzzles' },
  drill: { view: viewDrill, mount: mountDrill, title: 'Échauffement', back: '#exos' },
  idees: { view: viewIdees, mount: mountIdees, title: 'Idées de plan' },
  gagner: { view: viewGagner, mount: mountGagner, title: 'Gagner', back: (a) => (a ? '#gagner' : '#exos') },
  rush: { view: viewRush, mount: mountRush, title: 'Rush', back: (a) => (a ? '#rush' : '#entrainer') },
  finales: { view: viewFinales },
  finale: { view: viewFinale, mount: mountFinale, title: 'Finale', back: '#finales' },
  cours: { view: (a, b) => (a ? viewLecon(a, b) : viewCours()), mount: (a) => a && mountLecon(), title: 'Cours', back: '#cours' }, // liste, ou leçon #cours/<id>[/fiche]
  // Mes ouvertures (échiquier de l'explorateur), catalogue #ouvertures/apprendre, ou fiche #ouvertures/<id>
  ouvertures: {
    view: (a) => (a === 'apprendre' ? viewApprendre() : a ? viewOpening(a) : viewOuvertures()),
    mount: (a) => { if (!a) { board($('#exb'), { fen: S.exFen, orientation: S.white ? 'white' : 'black', viewOnly: true }); lexpLoad(S.exFen); } else if (a !== 'apprendre') mountOpening(); },
    title: 'Ouverture', back: '#ouvertures/apprendre',
  },
  ligne: { view: viewLigne, mount: mountLigne, title: 'Ouverture', back: (a) => '#ouvertures/' + a },
  monouv: { view: viewMonOuv, mount: mountMonOuv, title: 'Mon ouverture', back: '#ouvertures' },
  parties: { view: viewParties },
  // Relecture : au passage ordinateur / téléphone, le bandeau change de colonne (vue reconstruite), sinon mise à jour sur place
  partie: { view: viewPartie, mount: mountPartie, title: 'Partie', back: '#parties', resize: () => { if (S.gv?.cg) gvSync(); } }, // exercise.js change le bandeau de colonne sur place au passage ordinateur / téléphone ; gvSync recale l'affichage
  jouer: { view: viewJouer, mount: mountJouer, title: 'Jouer', back: (a) => '#partie/' + a },
  echiquier: { view: viewEchiquier, mount: mountEchiquier, title: 'Échiquier', resize: fbSync },
  bilan: { view: viewBilan, mount: mountBilan, resize: mountBilan },
  stats: { view: () => tabs('stats', PRO_TABS) + viewStats(S) /* viewStats vit dans alltime.js : les onglets sont ajoutés ici */, mount: () => mountStats(S), resize: () => mountStats(S) },
  plan: { view: viewPlan, mount: mountPlan },
};
const navLast = {}; // section -> dernière page vue (en mémoire, pas de stockage)
function render(keepScroll) {
  const y = scrollY;
  destroyBoards();
  $('#tip').hidden = true;
  if (location.hash === '#plus') { history.replaceState(null, '', '#plan'); } // ancien menu Plus : ses entrées sont dans S'entraîner et Plan
  const v = $('#view'), [r, a, b, c] = route();
  paintJob();
  $('#nav').hidden = !S.data;
  const here = '#' + route().join('/'), sec = sectionOf(here);
  // Entrée de section : sa section (js/nav.js) ; page d'un volet : son adresse exacte, ou sa route pour une page à une seule partie (#cours/x allume « Cours »)
  document.querySelectorAll('#nav a').forEach((x) => { const h = x.getAttribute('href'); x.classList.toggle('on', x.classList.contains('grp-h') ? x.closest('.grp').dataset.menu === sec : h === here || (h === '#' + r && r !== 'ouvertures' && !x.dataset.fill)); });
  if (!S.data) { v.innerHTML = viewWelcome(); exo.attach(); header(); const f = $('#wf'); f.onsubmit = (ev) => { ev.preventDefault(); const u = $('#wu').value.trim(); if (u) doImport(u); }; return; }
  if (r !== 'partie') S.gv = null;
  if (r !== 'rush') clearInterval(rushTimer);
  if (r !== 'drill' && S.dr && S.dr.i >= S.dr.items.length) S.dr = null; // une série en cours se reprend, une série finie repart de zéro
  const R = ROUTES[r] || { view: viewAccueil }; // adresse inconnue : la vue de l'accueil, sans montage
  v.innerHTML = R.view(a, b, c);
  exo.attach(); // avant de créer les échiquiers : ils naissent à leur taille définitive
  R.mount?.(a, b, c);
  header();
  if (sec && !document.body.classList.contains('imm')) navLast[sec] = here; // dernière page vue de la section, barre du bas visible seulement : l'onglet du téléphone y revient (un écran immersif sans barre mènerait à une impasse)
  keepUi();
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
}
// Volets de la navigation (16/11) : chaque entrée ouvre la liste de ses pages.
// Ordinateur (souris) : survol, focus clavier ou flèche bas ; le clic sur l'entrée mène à la page principale de la section.
// Téléphone (revue HIG, tâche 4) : pas de volet, l'onglet mène à la dernière page vue de sa section, ou à son entrée si l'on y est déjà (tabTarget).
const phoneNav = matchMedia('(max-width: 859px)');
const navGroups = () => [...document.querySelectorAll('#nav .grp')];
function navOpen(g, on) {
  if (on) { navFill(g); navGroups().forEach((o) => o !== g && navOpen(o, false)); }
  g.classList.toggle('open', on);
  if (!phoneNav.matches) g.querySelector('.grp-h').setAttribute('aria-expanded', on);
}
// Menus d'ordinateur seulement : aria-haspopup et aria-expanded n'existent pas sur un onglet du téléphone
function navAria() {
  navGroups().forEach((g) => {
    const h = g.querySelector('.grp-h');
    if (phoneNav.matches) { navOpen(g, false); ['aria-haspopup', 'aria-expanded', 'aria-controls'].forEach((a) => h.removeAttribute(a)); }
    else { h.setAttribute('aria-haspopup', 'true'); h.setAttribute('aria-controls', 'fly-' + g.dataset.menu); h.setAttribute('aria-expanded', g.classList.contains('open')); }
  });
}
function navClose() { navGroups().forEach((g) => navOpen(g, false)); }
// Pastilles « reste à faire » (16/11) : étapes de la séance du jour sur Aujourd'hui, lignes d'ouverture à réviser sur S'entraîner ;
// dans les volets, le nombre restant à côté de « Puzzles du jour » et des lignes. Mises à jour à chaque header().
function navBadges() {
  const put = (menu, n, label) => {
    const h = document.querySelector(`#nav .grp[data-menu="${menu}"] .grp-h`); if (!h) return;
    let b = h.querySelector('.nbadge');
    if (!n) { b?.remove(); h.removeAttribute('aria-description'); return; }
    if (!b) { b = document.createElement('span'); b.className = 'nbadge'; b.setAttribute('aria-hidden', 'true'); h.appendChild(b); }
    b.textContent = n; h.setAttribute('aria-description', label);
  };
  const count = (sel, n) => { const a = document.querySelector(sel); if (!a) return; let c = a.querySelector('.fcount'); if (!n) { c?.remove(); return; } if (!c) { c = document.createElement('span'); c.className = 'fcount'; a.appendChild(c); } c.textContent = n; };
  if (!S.data) { put('acc', 0); put('ent', 0); return; }
  const left = session().steps.filter((x) => !x.done).length, lines = progress.linesDue(allLineKeys()).length, d = pzDay(), pz = d.due ? Math.max(0, d.goal - d.done) : 0;
  put('acc', left, `${pl(left, 'étape')} de la séance à faire`);
  put('ent', lines, `${pl(lines, 'ligne')} d’ouverture à réviser`);
  count('#fly-acc [data-act="pzfocus"]', pz);
  count('#fly-ent [data-fill="lignes"]', lines);
}
// Liens qui dépendent du jour : étapes de la séance (échauffement et cours du chantier), première ligne d'ouverture à réviser
function navFill(g) {
  if (!S.data) return;
  const set = (k, h) => { const el = g.querySelector(`[data-fill="${k}"]`); if (el && h) el.setAttribute('href', h); };
  if (g.dataset.menu === 'acc') { const { steps } = session(); for (const x of steps) { if (x.k === 'dr') set('drill', x.cta[1]); if (x.k === 'les') set('cours', x.cta[1]); } }
  if (g.dataset.menu === 'ent') { const due = progress.linesDue(allLineKeys()); set('lignes', due.length ? lineHref(due[0]) : '#ouvertures/apprendre'); }
}
navAria(); phoneNav.addEventListener('change', () => { navAria(); header(); }); // passage ordinateur / téléphone : menus et titre de la barre
const navItems = (g) => [...g.querySelectorAll('.fly a')];
navGroups().forEach((g) => {
  const h = g.querySelector('.grp-h');
  g.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse' && !phoneNav.matches) navOpen(g, true); });
  g.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse' && !phoneNav.matches) navOpen(g, false); });
  // Focus au clavier (Tab) : le volet s'ouvre, sauf juste après Échap (g.shut, levé quand le focus sort de l'entrée)
  g.addEventListener('focusin', () => { if (!phoneNav.matches && !g.shut && !g.classList.contains('open') && h.matches(':focus-visible')) navOpen(g, true); });
  g.addEventListener('focusout', (ev) => { if (g.contains(ev.relatedTarget)) return; g.shut = false; if (!phoneNav.matches) navOpen(g, false); });
  // Appui au doigt sur une tablette large (>= 860 px) : l'entrée ouvre et ferme le volet ; souris et Entrée mènent à la page principale
  let pt = 'mouse';
  h.addEventListener('pointerdown', (ev) => { pt = ev.pointerType; });
  h.addEventListener('click', (ev) => {
    if (phoneNav.matches) { ev.preventDefault(); const to = tabTarget(g.dataset.menu, location.hash, navLast); if (location.hash === to) scrollTo(0, 0); else location.hash = to; }
    else if (ev.detail > 0 && pt !== 'mouse') { ev.preventDefault(); navOpen(g, !g.classList.contains('open')); }
  });
  g.addEventListener('click', (ev) => { if (ev.target.closest('.fly a')) { navOpen(g, false); document.activeElement?.blur(); } });
  g.addEventListener('keydown', (ev) => {
    if (phoneNav.matches) return; // pas de volet sur téléphone
    const items = navItems(g), i = items.indexOf(document.activeElement);
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault(); ev.stopPropagation(); navOpen(g, true);
      const n = ev.key === 'ArrowDown' ? (i < 0 ? 0 : (i + 1) % items.length) : (i <= 0 ? items.length - 1 : i - 1);
      items[n].focus();
    } else if ((ev.key === 'Home' || ev.key === 'End') && i >= 0) { ev.preventDefault(); ev.stopPropagation(); items[ev.key === 'Home' ? 0 : items.length - 1].focus(); }
  });
});
// Échap ferme le volet ouvert (au survol comme au clavier) et rend le focus à son entrée
document.addEventListener('keydown', (ev) => {
  const g = document.querySelector('#nav .grp.open');
  if (ev.key !== 'Escape' || !g) return;
  ev.preventDefault(); ev.stopPropagation(); navOpen(g, false);
  if (g.contains(document.activeElement)) { g.shut = true; g.querySelector('.grp-h').focus(); }
}, true);
// Appui ailleurs : ferme le volet ouvert (ordinateur)
document.addEventListener('click', (ev) => {
  const g = document.querySelector('#nav .grp.open');
  if (!g || g.contains(ev.target)) return;
  navOpen(g, false);
}, true);
document.addEventListener('click', (ev) => {
  const x = ev.target.closest('[data-x]'); // action de l'exercice en cours : indice, solution, lecture d'une suite…
  if (x) { exo.act(x.dataset.x, x); return; }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'A') ev.preventDefault();
  if (act === 'refresh') doImport(S.user, true);
  else if (act === 'analyse') runAnalysis(20, null, null, true);
  else if (act === 'analyse1') runAnalysis(1, S.gv.g, null, true);
  else if (act === 'stattc') { S.statTc = el.dataset.tc; render(true); }
  else if (act === 'rushagain') { S.rush = null; render(); }
  else if (act === 'playhere') {
    const v = S.gv; if (!v) return;
    if (v.var) { const w = v.var, m = w.mv[w.i - 1] || v.mv[w.k0 - 1]; S.jp = { t: v.g.t, k: 'v', from: w.k0 + w.i, fen: w.fens[w.i], last: m ? [m.from, m.to] : undefined, moves: [], over: null }; location.hash = `#jouer/${v.g.t}/v`; }
    else { S.jp = null; location.hash = `#jouer/${v.g.t}/${v.k}`; }
  }
  else if (act === 'back') { const [r, a] = route(), to = ROUTES[r]?.back, h = typeof to === 'function' ? to(a) : to || '#accueil'; if (h) location.hash = h; }
  else if (act === 'linext') liLoad();
  else if (act === 'lireplay') {
    const x = progress.hist().find((h) => String(h.t) === el.dataset.t); if (!x?.p) return;
    S.li = { angle: x.a || 'mix', diff: ls.get('li', {}).diff || 'easiest', cur: { id: x.id, rating: x.rt, url: 'https://lichess.org/training/' + x.id, ...x.p }, failed: false, counted: false, replay: true, loading: false, err: null };
    location.hash = '#inedits';
  }
  else if (act === 'histmore') { S.histN += 60; render(true); }
  else if (act === 'lifocus') { const f = ls.get('focus', null); S.li = { angle: f ? LI_FOR[f.id] : 'mix', diff: ls.get('li', {}).diff || 'easiest', cur: null, loading: false, err: null }; location.hash = '#inedits'; }
  else if (act === 'drnext') { drAdvance(); render(); }
  else if (act === 'dragain') { const t = S.dr.type; S.dr = null; location.hash = '#drill/' + t; render(); }
  else if (act === 'pzfocus') { const f = ls.get('focus', null); pzReset(f && pzQueue(f.id, false).length ? f.id : '', false); if (route()[0] === 'puzzles') render(); else location.hash = '#puzzles'; }
  else if (act === 'pzmore') { S.pz.show = null; render(); }
  else if (act === 'pzredo') { if (!S.pz) pzReset('', false); S.pz.redo = failedToday(); S.pz.show = null; if (route()[0] === 'puzzles') render(); else location.hash = '#puzzles'; }
  else if (act === 'pzredostop') { S.pz.redo = []; S.pz.show = dkey(); render(); }
  else if (act === 'focusnext') { ls.set('focus', { id: el.dataset.id, since: Math.floor(Date.now() / 1000) }); render(true); }
  else if (act === 'goto-cours') location.hash = '#cours/' + el.dataset.id;
  else if (act === 'pzfree') { S.pz.free = true; S.pz.cur = null; S.pz.show = null; render(); }
  else if (act === 'pznext') {
    const z = S.pz, d = pzDay();
    if (z.redo?.length) { z.redo.shift(); if (!z.redo.length) z.show = dkey(); render(); return; }
    // L'objectif du jour vient d'être atteint : on le dit une fois, avec la suite de la séance.
    if (d.done >= d.goal && z.recap !== dkey()) { z.recap = dkey(); z.show = dkey(); z.cur = null; render(); return; }
    let q = pzQueue(z.theme, z.free).filter((p) => p.id !== z.cur?.id);
    if (!q[0] && z.theme) { z.theme = ''; q = pzQueue('', false).filter((p) => p.id !== z.cur?.id); }
    z.cur = q[0] ? { id: q[0].id } : null;
    if (!q[0]) z.free = false;
    render();
  }
  else if (act === 'pztheme') { pzReset(el.dataset.theme, true); location.hash = '#puzzles'; }
  else if (act === 'lu') { progress.setLessonRead(el.dataset.id, !progress.lessonsRead()[el.dataset.id]); render(true); }
  else if (act === 'gen') genCourse(el.dataset.id);
  else if (act === 'brief') {
    const { ex, args } = lessonArgs(el.dataset.id), pr = buildPrompt(args), text = pr.system + '\n\n' + pr.user;
    ls.set('brief:' + el.dataset.id, ex.map((x) => ({ t: x.g.t, ply: x.e.ply })));
    const ok = $('#briefok'), raw = $('#briefraw');
    navigator.clipboard.writeText(text).then(() => { ok.textContent = 'Copié. Colle-le dans Claude.'; }).catch(() => { raw.hidden = false; raw.value = text; raw.select(); ok.textContent = 'Copie le texte ci-dessous à la main.'; });
  }
  else if (act === 'clnext') {
    const L = S.ai[S.cl?.id]; if (!L) return;
    const n = 1 + L.positions.length + 1 + (L.quiz.length ? 1 : 0);
    if (S.cl.step >= n - 1) { progress.setLessonRead(S.cl.id, true); S.cl = null; location.hash = '#accueil'; }
    else { S.cl.step++; render(); }
  }
  else if (act === 'clq') { S.cl.quiz[+el.dataset.q] = +el.dataset.c; render(true); }
  else if (act === 'snd') { sound.setEnabled(!sound.enabled()); document.querySelectorAll('[data-act="snd"]').forEach(sndAttrs); sound.play('move'); }
  else if (act === 'keydel') { ls.del('key'); render(true); }
  else if (act === 'color') { S.white = el.dataset.w === '1'; S.path = []; render(true); }
  else if (act === 'exmove') { S.path.push(el.dataset.san); render(true); }
  else if (act === 'opfam') location.hash = famHref(el.dataset.fam, S.white);
  else if (act === 'exline') { S.white = el.dataset.w === '1'; S.path = el.dataset.san ? el.dataset.san.split(' ') : []; location.hash = '#ouvertures'; }
  else if (act === 'expath') { S.path = S.path.slice(0, +el.dataset.n); render(true); }
  else if (act === 'more') { S.listN += 50; render(true); }
  else if (act === 'goto') gvGo(+el.dataset.k);
  else if (act === 'dbgo') gvDb(+el.dataset.i);
  else if (act === 'dbend') gvGo(S.gv?.k ?? 0);
  else if (act === 'askpos') gvAsk();
  else if (act === 'recapok') { ls.del('recap'); render(true); }
  else if (act === 'lgnav') { S.lg = Math.max(0, (S.lg || 0) + +el.dataset.d); render(true); }
  else if (act === 'selfck') { progress.recordSelf(el.dataset.id, el.dataset.v === '1'); render(true); }
  else if (act === 'askclose') { if (S.gv) { S.gv.ask = null; gvSync(); } }
  else if (act === 'vgo') gvVarGo(+el.dataset.i);
  else if (act === 'repplay') repPlay(el.dataset.u);
  else if (act === 'qgo') gvQGo(el.dataset.q, el.dataset.s);
  else if (act === 'gvtab') { if (S.gv) gvTab(S.gv, el.dataset.v); }
  else if (act === 'fbgo') fbGo(+el.dataset.i);
  else if (act === 'fbarrow') { ls.set('fbArrow', !fbArrowOn()); fbSync(); }
  else if (act === 'fbflip') { S.fb.me = S.fb.me === 'w' ? 'b' : 'w'; exo.current()?.cg?.set({ orientation: S.fb.me === 'w' ? 'white' : 'black' }); fbSync(); }
  else if (act === 'fbreset') { S.fb = fbNew(); render(); }
  else if (act === 'fbload') { const P = fbParse($('#fbin').value); if (P) { S.fb = P; render(); } else $('#fberr').textContent = 'Position ou partie illisible : colle une FEN complète ou un PGN.'; }
  else if (act === 'vexit') { const k0 = S.gv?.var?.k0; if (k0 != null) gvGo(k0); }
  else if (act === 'bakexp') { const m = $('#bakmsg'); backup.exportFile(S.user).then((n) => { if (m) m.textContent = `Fichier ${n} téléchargé. Range-le dans tes fichiers ou envoie-le sur ton autre appareil.`; toast('Sauvegarde téléchargée'); }).catch((e) => { if (m) m.textContent = 'Sauvegarde impossible : ' + (e.message || e); }); }
  else if (act === 'opgrp') { S.opGrp = el.dataset.g; render(true); }
  else if (act === 'optab') { S.opTab = el.dataset.tab; render(true); }
  else if (act === 'bakimp') $('#bakfile')?.click();
  else if (act === 'look') { const k = el.dataset.k, v = el.dataset.v; look.setLook({ [k]: k === 'coords' ? v === 'true' : k === 'size' ? null : v }); render(true); }
  else if (act === 'reset') {
    if (el.dataset.sure) { const u = S.user; ls.clear(['key', 'model', 'goal', 'hours', 'look']); dbDel('data:' + u); dbDel('an:' + u); dbDel('ai:' + u); S.ai = {}; S.li = null; S.liKeep = null; S.dr = null; S.cv = null; S.gen = null; S.cl = null; LINES.clear(); S.job.stop = true; S.user = null; S.data = null; S.an = {}; touch(); S.pz = null; location.hash = '#accueil'; render(); }
    else { el.dataset.sure = '1'; el.textContent = 'Confirmer : effacer parties, analyses et progression (réglages et clé du coach conservés)'; }
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'bakfile') { restoreFrom(ev.target.files[0]); ev.target.value = ''; return; }
  const el = ev.target.closest('[data-f]'); if (!el) return;
  if (el.dataset.f === 'liangle' || el.dataset.f === 'lidiff') { S.li[el.dataset.f === 'liangle' ? 'angle' : 'diff'] = el.value; ls.set('li', { angle: S.li.angle, diff: S.li.diff }); S.li.cur = null; S.li.err = null; render(true); return; }
  if (el.dataset.f === 'snd') { sound.setEnabled(el.checked); sound.play('good'); return; }
  if (el.dataset.f === 'focus') { ls.set('focus', { id: el.value, since: Math.floor(Date.now() / 1000) }); render(true); return; }
  if (el.dataset.f !== 'tc') return; // la période (data-f="days") : des boutons, voir l'écouteur de clics suivant
  S.f.tc = el.value; if (S.pz) pzReset('', false);
  ls.set('filter', S.f); S.path = []; render(true);
});
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-f="days"]'); if (!b) return;
  S.f.days = +b.dataset.v; ls.set('filter', S.f); S.path = []; render(true);
});
document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-form]'); if (!f) return;
  ev.preventDefault();
  if (f.dataset.form === 'key') { const v = $('#keyin', f).value.trim(); if (v) { ls.set('key', v); render(true); toast('Clé enregistrée sur cet appareil'); } }
  else if (f.dataset.form === 'paste') {
    const id = f.dataset.id, refs = ls.get('brief:' + id, null) || lessonArgs(id).ex.map((x) => ({ t: x.g.t, ply: x.e.ply }));
    try { const L = parseLesson($('#pastein').value, refs.length); L.ex = refs; L.model = 'abonnement'; S.ai[id] = L; await dbSet('ai:' + S.user, S.ai); S.cl = null; S.gen = null; location.hash = '#cours/' + id; render(); }
    catch (e) { $('#pasteerr').textContent = e.message; }
  }
  else if (f.dataset.form === 'ask') {
    const q = $('#askq').value.trim(), out = $('#aska'), c = S.clPos; if (!q || !c) return;
    out.innerHTML = coach(skel('Je regarde la position', 90, 70));
    try { const L = S.ai[S.cl.id]; const ans = await askCoach(`Cours : ${L.titre}. Idée : ${L.idee}\n${facts(c.x.g, c.x.e)}\nExplication donnée : ${c.pos.explication}`, q); out.innerHTML = coach(txt(ans)); }
    catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
});
document.addEventListener('keydown', (ev) => {
  if (/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
  if (exo.key(ev)) return; // lecture d'une suite : flèches pour avancer, espace pour lire ou mettre en pause
  if (route()[0] === 'echiquier' && S.fb) {
    const P = S.fb, k = { ArrowLeft: P.i - 1, ArrowRight: P.i + 1, Home: 0, End: P.mv.length }[ev.key];
    if (k != null) { ev.preventDefault(); fbGo(k); }
    return;
  }
  if (route()[0] !== 'partie' || !S.gv) return;
  const w = S.gv.var;
  if (w) { if (ev.key === 'ArrowLeft') gvVarGo(w.i - 1); else if (ev.key === 'ArrowRight') gvVarGo(w.i + 1); else if (ev.key === 'Escape') gvGo(w.k0); return; }
  if (ev.key === 'ArrowLeft') gvGo(S.gv.k - 1); else if (ev.key === 'ArrowRight') gvGo(S.gv.k + 1);
  else if (ev.key === 'Home') gvGo(0); else if (ev.key === 'End') gvGo(S.gv.mv.length);
});
// Changement de vue : fondu de 150 ms (View Transitions API, rien si elle manque), aussi en entrant dans un exercice
// ou en le quittant (17/11 : la colonne de navigation glisse au lieu de sauter, voir css). Jamais si l'appareil demande
// moins de mouvement ; les rendus d'arrière-plan (bgRender) ne passent pas par ici.
const calm = matchMedia('(prefers-reduced-motion: reduce)');
addEventListener('hashchange', () => {
  navClose(); // un rendu d'arrière-plan laisse le volet ouvert, un changement de page le ferme
  if (!document.startViewTransition || calm.matches || document.hidden) render();
  else { const t = document.startViewTransition(() => render()); t.ready.catch(() => {}); t.finished.catch(() => {}); } // une transition annulée (fenêtre redimensionnée) n'est pas une erreur
});
document.addEventListener('pointerover', (ev) => {
  const el = ev.target.closest?.('[data-tip]'), tip = $('#tip');
  if (!el) return;
  tip.hidden = false; tip.textContent = el.dataset.tip;
  const r = el.getBoundingClientRect(), tw = tip.offsetWidth;
  tip.style.left = Math.max(4, Math.min(innerWidth - tw - 4, r.left + r.width / 2 - tw / 2)) + 'px'; tip.style.top = Math.max(4, r.top - 34) + 'px';
});
document.addEventListener('pointerout', (ev) => { if (ev.target.closest?.('[data-tip]')) $('#tip').hidden = true; });
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => S.data && ROUTES[route()[0]]?.resize?.(), 200); });

if (new URLSearchParams(location.search).has('debug')) window.__cap = S; // accès à l'état pour les tests
// Mise à jour automatique : au chargement et au retour sur l'onglet, si les données ont plus de 10 minutes.
const STALE = 10 * 60000;
const stale = () => Date.now() - (S.data?.fetchedAt || 0) > STALE;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.data && S.user && !S.importing && stale()) doImport(S.user); });
(async function init() {
  look.apply(); // palette, pièces, coordonnées et taille de l'échiquier avant le premier rendu
  await load();
  restoreUi();
  navigator.storage?.persist?.().catch(() => {}); // demande au navigateur de ne pas effacer les données de l'app
  // App installée (écran d'accueil) : la page occupe tout l'écran, les marges du bas (barre d'accueil de l'iPhone) passent par env(safe-area-inset-*).
  if (installed()) { const m = document.querySelector('meta[name="viewport"]'); if (m && !/viewport-fit/.test(m.content)) m.content += ', viewport-fit=cover'; }
  render();
  const u = new URLSearchParams(location.search).get('u');
  reclassify(); warmReplays();
  if (!S.data && (S.user || u)) doImport(S.user || u);
  else if (S.data && stale()) doImport(S.user);
  else if (S.data && Object.values(S.an).some(toRedo)) autoAnalyse(); // anciennes analyses à réévaluer ou compléter, même sans nouvel import
})();

// Utilisés par les modules d'écran (js/views/) : import circulaire, lu seulement à l'intérieur des fonctions.
export { bgRender, header, idle, keepUi, refreshBtn, render };
