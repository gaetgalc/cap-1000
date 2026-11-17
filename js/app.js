/* global Chess */
import { dbGet, dbSet, dbDel, ls } from './store.js';
import { importPlayer } from './chesscom.js';
import { Engine, evaluateGame, multiPass } from './engine.js';
import { classify, VERSION, winPct, fmtEval, uciMove, isPuzzle, replay } from './classify.js';
import * as st from './stats.js';
import { LESSONS, ENGINE_LESSONS, RULES } from './lessons.js';
import { viewStats, mountStats } from './alltime.js';
import { fr, settle, buildLine, insight, hintFor, lastMoveText, moveText, material, describeAt, justPlayed, PLAN_RULE } from './explain.js';
import { $, esc, dfmt, TC, HOW, coach, txt, pl, f1, ico, wdl, WDL_LEGEND, setHtml } from './ui.js';
import { lineChart, sparkline } from './charts.js';
import { progress, DAY } from './progress.js';
import { board, destroyBoards, destsOf, arrow, errShapes, REDUCED } from './board.js';
import { moveMark, evalShare, errStep, gaffeTrail, moveTimes, clockFmt, clocksAt } from './review.js';
import * as exo from './exercise.js';
import { LI_ANGLES, LI_FOR, LI_DIFF, fetchPuzzle } from './lichess.js';
import { DRILLS, DRILL_FOR, makeRound } from './drills.js';
import { OPENINGS, GROUPS, byId, lineKey, movesOf, matchGame } from './openings.js';
import { MODELS, coachKey, coachModel, facts, genLesson, askCoach, buildPrompt, parseLesson, askPosition, positionText } from './coach.js';
import { coachBrief, briefFacts, CAUSES, mainCause, selfVerdict } from './brief.js';
import { ideaPositions, ideaChoices } from './ideas.js';
import { STAGES, programWeek, weekStats, reviewText } from './program.js';
import { portrait } from './portrait.js';
import { theoryExits, planOf } from './theory.js';
import { moments } from './debrief.js';
import { intent } from './plan.js';
import * as backup from './backup.js';
import { toast } from './toast.js';
import * as sound from './sound.js';
import * as look from './look.js';
import { ENDGAMES, egById, GOAL_TXT } from './endgames.js';
import { phaseStats, pieceStats, hourStats, sessionStats, perfRef, gameRating, insightText } from './insights.js';
import { fetchExplorer, explorerRows, LEVEL } from './explorer.js';

const DEPTH = 12; // même profondeur sur tous les appareils : une erreur est classée pareil partout

const { dkey, dayStart, act, streak } = progress;

const S = {
  user: ls.get('user', null), data: null, an: {},
  f: ls.get('filter', { tc: 'rapid', days: 0 }),
  job: { running: false, done: 0, total: 0, stop: false, msg: '' },
  engine: null, play: null, ai: {}, gen: null, cl: null, white: true, path: [], pz: null, importing: null,
};

// ---------- Données ----------
const goal = () => ls.get('goal', { elo: 1000, date: new Date().getFullYear() + '-12-31' });
const rapidAll = () => (S.data ? S.data.games.filter((g) => g.tc === 'rapid') : []);
const games = () => (S.data ? st.filterGames(S.data.games, S.f) : []);
const targetTc = () => (S.f.tc === 'all' ? 'rapid' : S.f.tc);

async function load() {
  if (!S.user) return;
  S.data = (await dbGet('data:' + S.user)) || null;
  S.an = (await dbGet('an:' + S.user)) || {};
  S.ai = (await dbGet('ai:' + S.user)) || {};
}
async function doImport(user, manual) {
  const first = !S.data;
  S.importing = { done: 0, total: 0, err: null };
  if (first) render(); else paintJob();
  try {
    const prev = user === S.user ? S.data : await dbGet('data:' + user);
    const d = await importPlayer(user, prev, (a, b) => { S.importing = { done: a, total: b, err: null }; paintJob(); const el = $('#imp'); if (el) el.textContent = b ? `Import des parties : ${a} mois sur ${b}` : 'Connexion à Chess.com'; });
    const n = d.games.length - (prev?.games?.length || 0);
    S.user = d.user; S.data = d; ls.set('user', d.user);
    await dbSet('data:' + d.user, d);
    S.an = (await dbGet('an:' + d.user)) || {};
    S.ai = (await dbGet('ai:' + d.user)) || {};
    S.importing = null;
    if (!d.games.some((g) => g.tc === S.f.tc) && S.f.tc !== 'all') { S.f = { tc: 'all', days: 0 }; ls.set('filter', S.f); }
    if (first) render(); else bgRender();
    if (first || manual || n > 0) toast(first ? `${pl(d.games.length, 'partie')} importée${d.games.length > 1 ? 's' : ''}` : n > 1 ? `${n} nouvelles parties importées` : n ? '1 nouvelle partie importée' : 'Aucune nouvelle partie');
    reclassify();
    autoAnalyse();
  } catch (e) {
    if (first) { S.importing = { err: e.message || String(e) }; render(); }
    else { S.importing = null; S.job.msg = 'Mise à jour impossible : ' + (e.message || String(e)); paintJob(); }
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
    if (i < todo.length) setTimeout(step, 0); else { dbSet('an:' + user, S.an); bgRender(); }
  })();
}
// Parties rejouées d'avance, par tranches de 10 ms quand le navigateur est libre (17/11) : « Mon jeu » et la relecture
// trouvent alors leurs positions déjà calculées (replay garde chaque partie), au lieu de figer l'écran à l'ouverture.
function warmReplays() {
  if (!S.data) return;
  const user = S.user, todo = S.data.games.filter((g) => S.an[g.id] && !S.an[g.id].bad).reverse();
  const idle = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 10 }), 50));
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
async function runAnalysis(count, only, list) {
  if (S.job.running || !S.data) return;
  const pool = analysisPool();
  const queue = list || (only ? [only] : [...pool.filter((g) => !S.an[g.id]), ...pool.filter((g) => toRedo(S.an[g.id]))].slice(0, count));
  if (!queue.length) return;
  S.job = { running: true, done: 0, part: 0, total: queue.length, stop: false, msg: '' };
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
  if (n && !S.job.msg && S.user === user) toast(`${pl(n, 'partie')} analysée${n > 1 ? 's' : ''}`);
}
// Bandeau d'avancement : import, puis analyse (parties finies + avancée dans la partie en cours).
// La barre est mise à jour sur place (transform), sans reconstruire le bouton de pause sous le doigt.
function paintJob() {
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

// Blocs gris de chargement à la place d'un texte « en cours » : largeurs des lignes en %, libellé pour les lecteurs d'écran.
const skel = (label, ...w) => `<span class="skel-g">${label ? `<span class="vh">${esc(label)}</span>` : ''}${w.map((x) => `<span class="skel" style="width:${x}%" aria-hidden="true"></span>`).join('')}</span>`;

// ---------- Échiquier ----------


// ---------- Graphiques ----------

// ---------- Puzzles (tes propres erreurs) ----------
function allPuzzles() {
  const out = [];
  if (!S.data) return out;
  for (const g of S.data.games) {
    const a = S.an[g.id];
    if (!a) continue;
    for (const e of a.errs) if (isPuzzle(e)) out.push({ id: g.t + ':' + e.ply, g, e });
  }
  return out;
}
const pzQueue = (theme, free) => progress.queue(allPuzzles(), theme, free);
// Un puzzle terminé est noté tout de suite (répétition espacée, journal, séance), puis l'avancée affichée est rafraîchie.
// Le rond qui vient de se remplir rebondit (pzDots) ; l'objectif atteint émet le retour 'goal', après celui du coup.
function pzRecord(p, res) {
  const fresh = progress.recordPuzzle(p, res);
  if (fresh) S.popT = Date.now();
  const d = pzDay();
  const el = $('#pzdayi'); if (el) el.innerHTML = pzDayHtml(d);
  header();
  if (fresh && d.done === d.goal) setTimeout(() => exo.feedback('goal'), 450);
  return fresh;
}
// Après une réussite du premier coup : l'élève dit si le puzzle était facile ou difficile, ce qui avance ou rapproche son retour.
function rateRow(id) {
  const r = id && progress.rateInfo(id);
  if (!r) return '';
  const b = (q, l) => `<button class="${r.q === q ? 'on' : ''}" data-x="rate" data-v="${q}" aria-pressed="${r.q === q}">${l} · ${r.days[q]} j</button>`;
  return `<div class="rate"><span class="small">Pour toi, ce puzzle était… (prochain retour)</span><div class="seg2 mini">${b('e', 'Facile')}${b('', 'Normal')}${b('h', 'Difficile')}</div></div>`;
}
const pzById = (id) => { const [t, ply] = String(id).split(':'); return S.data ? findErr(t, ply) : null; };
const failedToday = () => progress.failedToday((id) => !!pzById(id));
const pzDay = () => progress.day(allPuzzles(), ls.get('focus', null)?.id);
function pzDots(d) {
  const n = Math.min(12, Math.max(d.goal, d.done)), res = d.t.map((h) => h.r);
  while (res.length < d.done) res.unshift(-1); // faits avant l'existence du journal : résultat inconnu
  const shown = res.slice(-n), pop = Date.now() - (S.popT || 0) < 1200 ? shown.length - 1 : -1; // rond rempli à l'instant
  return `<span class="dots" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k < shown.length ? 'r' + (shown[k] < 0 ? 'x' : shown[k]) : ''}${k === pop ? ' pop' : ''}"></i>`).join('')}</span>`;
}
// Série en cours : à partir de 3 réussites du premier coup d'affilée dans la journée.
const runChip = () => { const n = progress.run().cur; return n >= 3 ? `<span class="chip good run">${n} d’affilée</span>` : ''; };
const pzProg = (d, cls = '') => `<a class="pzprog ${cls}" href="#historique" title="Voir l’historique du jour">${pzDots(d)}<b class="num">${d.done >= d.goal ? d.done + ' fait' + (d.done > 1 ? 's' : '') : d.done + ' / ' + d.goal}</b>${runChip()}</a>`;
const pzDayHtml = (d = pzDay()) => `${pzProg(d)}<span class="small">aujourd’hui</span><span class="chip">${d.due} en attente</span>`;
function pzReset(theme, free) { S.pz = { theme, free, cur: null, redo: [], recap: S.pz?.recap, show: null }; }
// Bouton vers la prochaine étape non faite de la séance du jour.
function nextStep(skip) {
  const nx = session().steps.find((x) => !x.done && x.k !== skip && x.cta);
  if (!nx) return '<a class="btn pri lg" href="#accueil">Séance du jour terminée · Retour à l’accueil</a>';
  const label = 'Étape suivante : ' + nx.t[0].toLowerCase() + nx.t.slice(1);
  return nx.cta[2] ? `<button class="btn pri lg" data-act="${nx.cta[2]}">${label}</button>` : `<a class="btn pri lg" href="${nx.cta[1]}" ${nx.cta[1].startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${label}</a>`;
}
function explain(e) {
  const p = `<b>${fr(e.played)}</b>`, b = `<b>${fr(e.bestSan)}</b>`, pun = e.punish.map(fr), line = e.line.map(fr);
  switch (e.theme) {
    case 'en_prise_pose': return `Tu as joué ${p} : la pièce se fait prendre par ${pun[0] || 'le coup suivant'}. Le bon coup était ${b}.`;
    case 'en_prise_ignore': return `Tu as joué ${p} sans voir ${pun[0] || 'la menace'}, qui gagne du matériel. Le bon coup était ${b}.`;
    case 'cadeau_rate': return `${b} gagnait du matériel tout de suite. Tu as joué ${p}.`;
    case 'mat_autorise': return `Après ${p}, l’adversaire a un mat forcé qui commence par ${pun[0] || '…'}. ${b} tenait la position.`;
    case 'mat_rate': return `La suite ${line.join(' ')} menait au mat. Tu as joué ${p}.`;
    case 'tactique_subie': return `Après ${p}, la suite ${pun.join(' ')} gagne du matériel. Le bon coup était ${b}.`;
    case 'tactique_ratee': return `La suite ${line.join(' ')} gagnait du matériel. Tu as joué ${p}.`;
    default: return `Tu as joué ${p} (évaluation ${fmtEval(e.e0)} → ${fmtEval(e.e1)}). Le moteur préfère ${b}.`;
  }
}
const moveNo = (e) => Math.floor(e.ply / 2) + 1;
const gameRef = (g) => `partie du ${dfmt(g.t)} contre ${esc(g.opp)} (${g.or})`;

const pzTabs = (on) => `<div class="seg2 pztabs"><a class="${on === 'mine' ? 'on' : ''}" href="#puzzles">Mes erreurs</a><a class="${on === 'li' ? 'on' : ''}" href="#inedits">Inédits</a><a class="${on === 'hist' ? 'on' : ''}" href="#historique">Historique</a></div>`;
const LI_NAME = Object.fromEntries(LI_ANGLES);

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
  const head = pzTabs('li') + `<div class="pzhead main"><h1>Positions inédites</h1><div class="row">${sels}
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
    panel: `<div class="row m-only lisel">${sels}</div><div class="meta small">Puzzle Lichess n° ${esc(P.id)} · niveau ${P.rating} · <a href="${P.url}" target="_blank" rel="noopener">Voir sur Lichess</a></div>
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
      exit: '<button class="btn" data-act="linext">Suivant ›</button>',
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

function findErr(t, ply) {
  const g = S.data.games.find((x) => String(x.t) === String(t));
  const e = g && S.an[g.id]?.errs.find((x) => String(x.ply) === String(ply));
  return e && e.best ? { id: g.t + ':' + e.ply, g, e } : null;
}
// Combien de coups tiennent la position : un seul, ou plusieurs (connu pour les parties analysées depuis le 15/11).
const altText = (e) => (e.alt === 1 ? 'Un seul coup tient la position : trouve-le.' : e.alt >= 2 ? 'Plusieurs coups tiennent la position : trouve-en un.' : 'Trouve mieux.');
const SOLVE_BAR = '<button class="btn" data-x="hint">Indice</button><button class="btn" data-x="real">Mon coup</button><button class="btn" data-x="show">Solution</button>';
// Écran d'exercice sur une de tes erreurs. o : { head, side, next (bouton de sortie), top }.
function workScreen(p, o) {
  const me = p.g.w ? 'w' : 'b', side = p.g.w ? 'Blancs' : 'Noirs';
  const last = lastMoveText(p.g, p.e.ply, me);
  return exo.screen({
    live: true, top: o.top, exit: o.next,
    head: o.head + coach(`${last ? esc(last) + ' ' : ''}<b>À toi de jouer avec les ${side}.</b> En partie, ton coup ici t’a coûté ${p.e.drop} points de chances de gain. ${altText(p.e)}`, 'intro'),
    cap: `<p><i class="dot ${p.g.w ? 'w' : 'b'}"></i> <span class="m-txt">${last ? esc(last) + ' ' : ''}</span>Trait aux ${side}. <span class="d-txt">Joue ton coup sur l’échiquier.</span><span class="m-txt">Trouve mieux qu’en partie.</span></p>`,
    panel: `${o.side || ''}
      <div class="meta small">Coup ${moveNo(p.e)} de ta ${gameRef(p.g)}${p.e.theme ? ` · ${st.THEMES[p.e.theme]}` : ''} · <a href="#partie/${p.g.t}/${p.e.ply}">Ouvrir la partie</a></div>
      <div id="pzx"><div class="card ghost"><h3>Comment chercher</h3><ol class="routine"><li>Que vient de faire ton adversaire ? Que menace son coup ?</li><li>As-tu un échec, une capture ou une menace ?</li><li>La case où tu vas est-elle attaquée ?</li></ol></div></div>`,
    bar: SOLVE_BAR,
  });
}
function viewPuzzles(force) {
  if (force) {
    const p = findErr(force[0], force[1]);
    if (!p) return `<h1>Position introuvable</h1><div class="card"><p class="sub">Cette position n’est plus dans tes analyses.</p><div><a class="btn" href="#parties">Retour aux parties</a></div></div>`;
    S.pzOne = p;
    return workScreen(p, { head: '<div class="pzhead"><h1>Comprendre cette erreur</h1></div>', next: '<button class="btn" data-act="back">Retour</button>' });
  }
  S.pzOne = null;
  const total = allPuzzles();
  if (!total.length) {
    return pzTabs('mine') + `<h1>Puzzles sur tes erreurs</h1><div class="card"><p class="prose">${S.job.running ? 'L’analyse de tes parties est en cours. Les premiers puzzles apparaissent ici dès qu’une partie est terminée.' : 'Aucune partie analysée pour le moment. Lance l’analyse pour transformer tes erreurs en puzzles.'}</p>${S.job.running ? '' : '<div><button class="btn pri" data-act="analyse">Analyser mes 20 dernières parties</button></div>'}</div>`;
  }
  if (!S.pz) pzReset('', false);
  const z = S.pz, themes = [...new Set(total.map((p) => p.e.theme))];
  const head = pzTabs('mine') + `<div class="pzhead main"><h1>Puzzles sur tes erreurs</h1><span class="row" id="pzdayi">${pzDayHtml()}</span></div>`;
  const plain = pzTabs('mine') + '<h1>Puzzles sur tes erreurs</h1>';
  const filter = `<div class="row pzfilter"><label class="small" for="pzt">Thème travaillé</label><select id="pzt"><option value="">Tous les thèmes</option>${themes.map((t) => `<option value="${t}" ${z.theme === t ? 'selected' : ''}>${st.THEMES[t]}</option>`).join('')}</select></div>`;
  // Révision des ratés du jour : une liste fixe, sans effet sur le calendrier de répétition.
  z.redo = (z.redo || []).filter((id) => pzById(id));
  if (z.redo.length) {
    return workScreen(pzById(z.redo[0]), {
      head: pzTabs('mine') + `<div class="pzhead"><h1>Tes ratés du jour</h1><div class="row"><span class="chip warn">Révision : encore ${z.redo.length}</span><button class="btn sm" data-act="pzredostop">Arrêter</button></div></div>`,
      next: `<button class="btn" data-act="pznext">${z.redo.length > 1 ? 'Raté suivant ›' : 'Terminer ›'}</button>`,
    });
  }
  if (z.show === dkey()) return plain + pzRecap('Objectif du jour atteint', 'Tu peux t’arrêter là. Les puzzles ratés reviennent demain, les réussis dans quelques jours : c’est cet espacement qui transforme une correction en réflexe.', false, filter);
  const q = pzQueue(z.theme, z.free);
  if (!z.cur || !q.some((p) => p.id === z.cur.id)) z.cur = q[0] ? { id: q[0].id } : null;
  if (!z.cur) return plain + pzRecap(z.theme ? 'Ce thème est à jour' : 'Tout est à jour', `Plus aucun puzzle en attente aujourd’hui${z.theme ? ' sur ce thème' : ''}. Les puzzles réussis reviennent après 1, 3, 7 puis 21 jours, les ratés dès demain : c’est la répétition espacée qui transforme une correction en réflexe.`, true, filter);
  const p = q.find((x) => x.id === z.cur.id);
  return workScreen(p, { head, next: '<button class="btn" data-act="pznext">Suivant ›</button>', side: filter, top: () => pzProg(pzDay()) });
}
// Bilan des puzzles du jour : résultats, étape suivante, ratés à refaire.
// Anneau de l'objectif : il se ferme en animation jusqu'à la part faite ; au centre, les puzzles du jour.
function goalRing(d) {
  const p = Math.min(1, d.done / d.goal);
  return `<div class="ring" role="img" aria-label="${d.done} puzzles faits sur un objectif de ${d.goal}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="trk" cx="60" cy="60" r="52"/>${p ? `<circle class="arc" cx="60" cy="60" r="52" pathLength="100" style="stroke-dashoffset:${(100 - 100 * p).toFixed(1)}"/>` : ''}</svg>
    <span class="ringc"><b class="num">${d.done}</b><span>sur ${d.goal}</span></span></div>`;
}
function pzRecap(title, msg, empty, filter) {
  const d = pzDay(), t = d.t, c = (r) => t.filter((h) => h.r === r).length, redo = failedToday(), best = progress.run().best;
  const stat = (n, l) => `<div class="rstat"><b class="num">${n}</b><span>${l}</span></div>`;
  return `<div class="card recap"><h2>${title}</h2>
    ${t.length ? `<div class="rcp">${goalRing(d)}<div class="rstats">${stat(c(2), 'du premier coup')}${stat(best, 'd’affilée au mieux')}${stat(c(1), 'avec aide')}${stat(c(0), 'solution vue')}</div></div>` : ''}
    <div class="next">${nextStep('pz')}</div>
    ${coach(msg)}
    <div class="row acts">${redo.length ? `<button class="btn" data-act="pzredo">Refaire ${redo.length > 1 ? 'mes ' + redo.length + ' ratés' : 'mon raté'} du jour</button>` : ''}
      ${empty ? '<button class="btn" data-act="pzfree">M’entraîner quand même</button>' : `<button class="btn" data-act="pzmore">Continuer les puzzles (${d.due} en attente)</button>`}
      <a class="btn" href="#historique">Historique</a>${empty && !S.job.running ? '<button class="btn" data-act="analyse">Analyser 20 parties de plus</button>' : ''}</div>${filter}</div>`;
}
const RES = { 2: ['r2', 'Du premier coup'], 1: ['r1', 'Trouvé avec aide'], 0: ['r0', 'Solution vue'] };
function viewHistory() {
  const all = progress.hist(), h = all.slice().reverse(), head = pzTabs('hist') + '<h1>Historique</h1>';
  if (!h.length) return head + `<div class="card">${coach('Chaque puzzle, chaque position inédite, chaque échauffement et chaque partie rejouée que tu termines est noté ici avec son résultat. Tu peux quitter la page ou fermer le site : rien ne se perd, et tu peux refaire une position d’un clic.')}<div><a class="btn pri" href="#puzzles">Faire mes puzzles</a></div></div>`;
  S.histN ||= 60;
  const pz = all.filter((x) => (x.k === 'm' || x.k === 'l') && !x.re), d0 = dayStart(), today = dkey();
  const acq = progress.acquired();
  const tiles = `<div class="tiles"><div class="tile"><b class="num">${pz.filter((x) => x.t >= d0).length}</b><span>puzzles aujourd’hui</span></div>
    <div class="tile"><b class="num">${pz.filter((x) => x.t >= d0 - 6 * DAY).length}</b><span>sur 7 jours</span></div>
    <div class="tile"><b class="num">${pz.length ? st.pct(pz.filter((x) => x.r === 2).length, pz.length) + ' %' : '—'}</b><span>trouvés du premier coup</span></div>
    <div class="tile"><b class="num">${acq}</b><span>acquis (réussis 3 fois, à plusieurs jours d’écart)</span></div></div>`;
  const hm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const row = (x) => {
    if (x.k === 'd') { const D = DRILLS[x.ty]; return `<div class="hrow"><i class="hres ${x.ok >= x.n * 0.8 ? 'r2' : x.ok >= x.n * 0.5 ? 'r1' : 'r0'}"></i><span class="stepc"><b>Échauffement${D ? ' : ' + D.t : ''}</b><span>${x.ok} / ${x.n} justes · ${hm(x.t)}</span></span>${D ? `<a class="btn sm" href="#drill/${x.ty}">Refaire</a>` : ''}</div>`; }
    if (x.k === 'o') { const [oid, ok] = String(x.id).split(':'), o = byId(oid), l = o?.lines[+ok]; const [cls, lab] = RES[x.r] || RES[0]; return `<div class="hrow"><i class="hres ${cls}"></i><span class="stepc"><b>Ligne d’ouverture${o ? ` : ${o.nom}` : ''}</b><span>${l ? esc(l.n) + ' · ' : ''}${x.r === 2 ? 'Sans faute' : x.r === 1 ? 'Avec aide' : 'Suite vue'}${x.re ? ' (révision)' : ''} · ${hm(x.t)}</span></span>${l ? `<a class="btn sm" href="${lineHref(x.id)}">Refaire</a>` : ''}</div>`; }
    if (x.k === 'i') { const p = pzById(x.id); return `<div class="hrow"><i class="hres ${x.r === 2 ? 'r2' : 'r0'}"></i><span class="stepc"><b>Idée de plan${p ? ` · coup ${moveNo(p.e)} contre ${esc(p.g.opp)}` : ''}</b><span>${x.r === 2 ? 'Bon plan trouvé' : 'Autre plan choisi'} · ${hm(x.t)}</span></span></div>`; }
    if (x.k === 'f') { const e = egById(x.id), [cls] = RES[x.r] || RES[0]; return `<div class="hrow"><i class="hres ${cls}"></i><span class="stepc"><b>Finale${e ? ' : ' + esc(e.t) : ''}</b><span>${x.r === 2 ? 'Réussie' : x.r === 1 ? 'Réussie avec indice' : 'Manquée'}${x.re ? ' (révision)' : ''} · ${hm(x.t)}</span></span>${e ? `<a class="btn sm" href="#finale/${e.id}">Refaire</a>` : ''}</div>`; }
    if (x.k === 'r') return `<div class="hrow"><i class="hres ${x.n && x.ok / x.n >= 0.8 ? 'r2' : x.n && x.ok / x.n >= 0.5 ? 'r1' : 'r0'}"></i><span class="stepc"><b>Rush ${RUSH[x.m] ? RUSH[x.m].t.toLowerCase() : ''}</b><span>${x.ok} / ${x.n} justes${x.rec ? ' · record' : ''} · ${hm(x.t)}</span></span><a class="btn sm" href="#rush/${x.m}">Refaire</a></div>`;
    if (x.k === 'j') { const g = S.data.games.find((y) => String(y.t) === x.id); return `<div class="hrow"><i class="hres ${x.why === 'gagne' ? 'r2' : x.why === 'mat_subi' || x.why === 'abandon' ? 'r0' : 'r1'}"></i><span class="stepc"><b>Position rejouée${g ? ` · ${dfmt(g.t)} contre ${esc(g.opp)}` : ''}</b><span>${{ gagne: 'Gagnée', mat_subi: 'Perdue', abandon: 'Abandonnée' }[x.why] || 'Nulle'} en ${Math.ceil(x.n / 2)} coups · ${hm(x.t)}</span></span>${g ? `<a class="btn sm" href="#partie/${g.t}${x.ply === 'v' ? '' : '/' + x.ply}">Partie</a>` : ''}</div>`; }
    if (x.k === 'c') { const g = S.data.games.find((y) => String(y.t) === x.id); return `<div class="hrow"><i class="hres ${x.r === 2 ? 'r2' : 'r0'}"></i><span class="stepc"><b>Partie gagnante rejouée${g ? ` · ${dfmt(g.t)} contre ${esc(g.opp)}` : ''}</b><span>${x.r === 2 ? 'Gagnée' : 'Pas gagnée'} en ${Math.ceil(x.n / 2)} coups · ${hm(x.t)}</span></span>${g ? `<a class="btn sm" href="#gagner/${g.t}">Refaire</a>` : ''}</div>`; }
    const [cls, lab] = RES[x.r] || RES[0], sub = `${lab}${x.q ? (x.q === 'e' ? ', jugé facile' : ', jugé difficile') : ''}${x.re ? ' (révision)' : ''} · ${hm(x.t)}`;
    if (x.k === 'l') return `<div class="hrow"><i class="hres ${cls}"></i><span class="stepc"><b>Position inédite${LI_NAME[x.a] ? ' : ' + LI_NAME[x.a] : ''}</b><span>${sub}${x.rt ? ' · niveau ' + x.rt : ''}</span></span>${x.p ? `<button class="btn sm" data-act="lireplay" data-t="${x.t}">Refaire</button>` : `<a class="btn sm" href="https://lichess.org/training/${esc(x.id)}" target="_blank" rel="noopener">Lichess</a>`}</div>`;
    const p = pzById(x.id);
    return `<div class="hrow"><i class="hres ${cls}"></i><span class="stepc"><b>${p ? `Coup ${moveNo(p.e)} · ${dfmt(p.g.t)} contre ${esc(p.g.opp)}` : 'Position d’une partie'}</b><span>${st.THEMES[x.th] ? st.THEMES[x.th] + ' · ' : ''}${sub}</span></span>${p ? `<a class="btn sm" href="#erreur/${p.g.t}/${p.e.ply}">Refaire</a>` : ''}</div>`;
  };
  const days = new Map();
  for (const x of h.slice(0, S.histN)) { const k = dkey(new Date(x.t)); if (!days.has(k)) days.set(k, []); days.get(k).push(x); }
  const yest = dkey(new Date(d0 - DAY / 2));
  const label = (k) => (k === today ? 'Aujourd’hui' : k === yest ? 'Hier' : new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const isPz = (x) => x.k === 'm' || x.k === 'l';
  const sum = (l) => { const z = l.filter((x) => isPz(x) && !x.re), dr = l.filter((x) => x.k === 'd').length, cv = l.filter((x) => x.k === 'c').length, ol = l.filter((x) => x.k === 'o').length, ii = l.filter((x) => x.k === 'i').length, fi = l.filter((x) => x.k === 'f').length, ru = l.filter((x) => x.k === 'r').length, rv = l.filter((x) => isPz(x) && x.re).length; return [z.length ? `${pl(z.length, 'puzzle')}, ${z.filter((x) => x.r === 2).length} du premier coup` : '', rv ? pl(rv, 'révision') : '', dr ? pl(dr, 'échauffement') : '', cv ? pl(cv, 'partie rejouée').replace('parties rejouée', 'parties rejouées') : '', ol ? `${ol} ligne${ol > 1 ? 's' : ''} d’ouverture` : '', ii ? pl(ii, 'idée') + ' de plan' : '', fi ? pl(fi, 'finale') : '', ru ? pl(ru, 'rush') : ''].filter(Boolean).join(' · '); };
  return head + tiles + `<div class="legend"><span style="--c:var(--good)">Du premier coup</span><span style="--c:var(--warn)">Trouvé avec aide</span><span style="--c:var(--bad)">Solution vue</span></div>`
    + [...days].map(([k, l]) => `<div class="card hday"><h2><span class="hcap">${label(k)}</span><span class="small">${sum(l)}</span></h2>${l.map(row).join('')}</div>`).join('')
    + (h.length > S.histN ? '<div><button class="btn" data-act="histmore">Afficher les exercices plus anciens</button></div>' : '');
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

// Échiquier jouable sur une de tes erreurs : vérifie ton coup, montre l'indice, la solution ou ton coup réel.
function solveBoard(X, g, e, o = {}) {
  const ch = new Chess(e.fen), color = g.w ? 'white' : 'black', stt = { tries: 0, shown: false, done: false, real: false, tk: 0 };
  const lastMv = e.prev ? [e.prev.slice(0, 2), e.prev.slice(2, 4)] : undefined;
  const mov = () => ({ free: false, color, dests: destsOf(ch), showDests: true, events: { after: onMove } });
  const cg = X.board({ fen: ch.fen(), orientation: color, turnColor: color, lastMove: lastMv, movable: mov() }), say = X.say;
  const hintShape = () => (stt.hints >= 2 && !stt.done ? [{ orig: e.best.slice(0, 2), brush: 'green' }] : []);
  // found : le coup a été trouvé. exact : le meilleur coup du moteur est sur l'échiquier.
  const finish = (found, html, exact) => {
    const first = !stt.done; stt.done = true; stt.tk++;
    say(found ? 'ok' : '', html);
    cg.set({ movable: { color: undefined }, drawable: { autoShapes: exact ? [] : [arrow(e.best, 'green')] } });
    o.done?.(!found ? 0 : stt.tries === 0 && !stt.shown ? 2 : 1, first, html, exact);
  };
  async function onMove(from, to) {
    const m = ch.move({ from, to, promotion: (from + to === e.best.slice(0, 4) && e.best[4]) || 'q' });
    if (!m) { cg.set({ fen: ch.fen(), movable: mov() }); return; }
    cg.set({ fen: ch.fen(), movable: { color: undefined } });
    const uci = from + to, tk = ++stt.tk; // jeton : annule la suite si la solution ou « Mon coup » est demandé entre-temps
    // Bon coup : pastille verte qui reste sur la case tant que la position ne change pas.
    const good = () => { stt.mfen = ch.fen(); X.mark(to, true, true); };
    if (uci === e.best.slice(0, 4) || ch.in_checkmate()) return good(), finish(true, `<b class="ok">Bien vu.</b> ${fr(m.san)} est le meilleur coup.`, uci === e.best.slice(0, 4));
    say('', 'Vérification de ton coup…');
    let drop = 100;
    try { S.play ||= new Engine(); const r = await S.play.evalFen(ch.fen(), DEPTH, true); drop = winPct(e.e0) - winPct(-r.cp); } catch { S.play = null; /* moteur indisponible : seul le meilleur coup compte */ }
    if (!X.alive()) return; // l'utilisateur a quitté l'écran pendant la vérification
    if (stt.done || stt.tk !== tk) return;
    if (drop < 6) return good(), finish(true, `<b class="ok">Bon coup.</b> ${fr(m.san)} tient la position (le moteur préférait ${fr(e.bestSan)}).`, false);
    stt.tries++;
    X.mark(to, false); // croix rouge sur la case, 600 ms
    say('ko', `<b class="ko">Pas celui-là.</b> ${fr(m.san)} ${uci === e.playedUci.slice(0, 4) ? 'est le coup que tu avais joué en partie' : `fait perdre ${Math.round(drop)} points de chances de gain`}. Réessaie.`);
    if (stt.tries >= 2 && !stt.hints) X.btn('hint')?.classList.add('pulse'); // deux essais ratés : l'indice se signale
    // La pièce revient à sa place en glissant (chessground anime le changement de position), le bandeau perd sa teinte rouge.
    setTimeout(() => { if (stt.tk !== tk || !X.alive()) return; ch.undo(); cg.set({ fen: ch.fen(), lastMove: lastMv, turnColor: color, movable: mov() }); cg.setAutoShapes(hintShape()); X.cap.classList.remove('ko'); }, 900);
  }
  const api = {
    stt,
    ask(fen, cb) { const c = new Chess(fen), col = c.turn() === 'w' ? 'white' : 'black'; cg.set({ turnColor: col, movable: { free: false, color: col, dests: destsOf(c), showDests: true, events: { after: cb } } }); },
    view(fen, last, shapes) { if (fen !== stt.mfen) X.unmark(); cg.set({ fen, lastMove: last, turnColor: fen.split(' ')[1] === 'w' ? 'white' : 'black', movable: { color: undefined }, drawable: { autoShapes: (shapes || []).filter(Boolean) } }); },
    arrows(list) { cg.setAutoShapes(list); },
    real(btn) {
      stt.tk++; X.unmark();
      if (stt.real) {
        stt.real = false; if (btn) btn.textContent = 'Mon coup';
        ch.load(e.fen);
        cg.set({ fen: ch.fen(), lastMove: lastMv, turnColor: color, drawable: { autoShapes: stt.done ? [arrow(e.best, 'green')] : hintShape() }, movable: stt.done ? { color: undefined } : mov() });
        X.cap.className = stt.fbClass; X.cap.innerHTML = stt.fbHtml;
        return;
      }
      stt.real = true; if (btn) btn.textContent = 'Revenir';
      stt.fbClass = X.cap.className; stt.fbHtml = X.cap.innerHTML;
      ch.load(e.fen);
      const m = uciMove(ch, e.playedUci); if (!m) return;
      cg.set({ fen: ch.fen(), lastMove: [m.from, m.to], movable: { color: undefined }, drawable: { autoShapes: [arrow(e.playedUci, 'red')] } });
      const replySan = g.san[e.ply + 1];
      say('', `En partie, tu as joué <b>${fr(e.played)}</b>` + (replySan ? ` et ton adversaire a répondu <b>${fr(replySan)}</b>.` : '.') + (e.punish[0] && e.punish[0] !== replySan ? ` La réponse la plus forte était ${fr(e.punish[0])}.` : '') + ` <a href="#partie/${g.t}/${e.ply + 2}">Voir la suite</a>`);
      if (replySan) setTimeout(() => { if (!stt.real || !X.alive()) return; const r = ch.move(replySan, { sloppy: true }); if (r) cg.set({ fen: ch.fen(), lastMove: [r.from, r.to], drawable: { autoShapes: [] } }); }, 900);
    },
    hint() {
      if (stt.real) api.real(X.btn('real')); if (stt.done) return;
      stt.shown = true; stt.hints = (stt.hints || 0) + 1;
      X.btn('hint')?.classList.remove('pulse');
      const q = txt(o.hintText || hintFor(e.fen, e.best, g.w ? 'w' : 'b'));
      if (stt.hints === 1) say('', `<b>Indice 1.</b> ${q} <span class="small">Touche encore « Indice » pour voir quelle pièce joue.</span>`);
      else { cg.set({ drawable: { autoShapes: [{ orig: e.best.slice(0, 2), brush: 'green' }] } }); say('', `<b>Indice 2.</b> ${q} La pièce entourée doit jouer.`); }
    },
    show() { if (stt.real) api.real(X.btn('real')); if (stt.done) return; stt.shown = true; X.unmark(); ch.load(e.fen); const m = uciMove(ch, e.best); cg.set({ fen: ch.fen(), lastMove: m ? [m.from, m.to] : undefined }); finish(false, `La solution était <b>${fr(e.bestSan)}</b>.`, true); },
  };
  X.on({ hint: () => api.hint(), real: (_, btn) => api.real(btn), show: () => api.show() });
  return api;
}
function mountPuzzle() {
  const X = exo.current();
  if (!X) return;
  const p = S.pzOne || pzById(S.pz?.redo?.[0] || S.pz?.cur?.id || '');
  if (!p) return;
  getLines(p.g, p.e); // prépare l'explication pendant que tu cherches
  const api = solveBoard(X, p.g, p.e, {
    done: (res, first, html, exact) => {
      if (first) pzRecord(p, res); // noté tout de suite : quitter la page ne fait rien perdre
      explainUI(X, { g: p.g, e: p.e, api, panel: $('#pzx'), verdict: html, exact, rate: res === 2 ? p.id : null, why: p.id });
    },
  });
}

// ---------- Apprendre les ouvertures ----------
// Fiches (histoire, idées, pièges, lignes) et lignes récitées de mémoire, en révision espacée comme les puzzles.
// Onglets internes (refonte du 16/11) : Cours / Ouvertures, Parties / Mes ouvertures. Ils doublent le volet de la navigation, utile sur téléphone.
const tabs = (on, items) => `<div class="seg2 pztabs">${items.map(([k, href, t]) => `<a class="${on === k ? 'on' : ''}" href="${href}">${t}</a>`).join('')}</div>`;
const LEARN_TABS = (on) => tabs(on, [['cours', '#cours', 'Cours'], ['ouv', '#ouvertures/apprendre', 'Ouvertures']]);
const GAMES_TABS = (on) => tabs(on, [['parties', '#parties', 'Parties'], ['ouv', '#ouvertures', 'Mes ouvertures']]);
const allLineKeys = () => OPENINGS.flatMap((o) => o.lines.map((_, k) => lineKey(o, k)));
const lineHref = (key, voir) => '#ligne/' + key.replace(':', '/') + (voir ? '/voir' : '');
const opGames = (o) => (S.data ? S.data.games.filter((g) => matchGame(o, g)) : []);
const dshort = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
function lineChip(key) {
  const s = progress.lineState(key);
  if (!s) return ''; // ligne jamais jouée : rien à signaler, la liste reste serrée
  if (s.aReviser) return '<span class="chip warn">À réviser</span>';
  return `<span class="chip ${s.acquise ? 'good' : ''}">${s.acquise ? 'Acquise' : 'Apprise'} · révision le ${dshort(s.due)}</span>`;
}
// Ligne suivante : une ligne à réviser d'abord, sinon la ligne d'après dans la même ouverture, sinon la fiche.
function nextLine(key) {
  const due = progress.linesDue(allLineKeys()).filter((k) => k !== key);
  if (due.length) return [lineHref(due[0]), 'Ligne à réviser suivante'];
  const [id, k] = key.split(':'), o = byId(id);
  return o.lines[+k + 1] ? [lineHref(lineKey(o, +k + 1)), 'Ligne suivante'] : [`#ouvertures/${id}`, 'Retour à la fiche'];
}
// Catalogue : une liste serrée, filtrée par couleur ; ton répertoire puis tes ouvertures les plus jouées d'abord.
function viewApprendre() {
  const due = progress.linesDue(allLineKeys()), grp = S.opGrp || 'w';
  const info = (o) => { const keys = o.lines.map((_, k) => lineKey(o, k)); return { o, n: opGames(o).length, learned: keys.filter((k) => progress.lineState(k)).length, total: keys.length }; };
  const rows = OPENINGS.filter((o) => o.group === grp).map(info).sort((a, b) => (b.o.rep ? 1 : 0) - (a.o.rep ? 1 : 0) || b.n - a.n);
  const tab = ([g, t]) => `<button class="${g === grp ? 'on' : ''}" data-act="opgrp" data-g="${g}">${t.replace('Avec les ', '').replace('contre', 'c.')}</button>`;
  return LEARN_TABS('ouv') + `<h1>Apprendre les ouvertures</h1>
    <p class="sub">Une fiche par ouverture. Ses lignes se rejouent de mémoire et reviennent en révision, comme tes puzzles.</p>
    ${due.length ? `<a class="opdue" href="${lineHref(due[0])}"><b>${pl(due.length, 'ligne')} à réviser aujourd’hui</b><span>Réviser ›</span></a>` : ''}
    <div class="seg2 mini opgrp">${GROUPS.map(tab).join('')}</div>
    <div class="oplist">${rows.map(({ o, n, learned, total }) => `<a class="oprow" href="#ouvertures/${o.id}">
      <span><b>${o.nom}</b>${o.rep ? '<i class="optag">Répertoire</i>' : ''}</span>
      <span class="opmeta">${o.eco}${n ? ` · ${pl(n, 'partie')}` : ''} · ${learned}/${total} lignes</span>
      <span class="opprog" aria-hidden="true"><i style="width:${(100 * learned) / total}%"></i></span>
      <span class="chev" aria-hidden="true">›</span></a>`).join('')}</div>`;
}
// Fiche : en-tête compact (position, coups, résumé), puis un seul bloc à la fois : lignes, plans, histoire, pièges, tes parties.
const OP_SECTIONS = [['lignes', 'Lignes'], ['plans', 'Plans'], ['histoire', 'Histoire'], ['pieges', 'Pièges'], ['parties', 'Parties']];
function viewOpening(id) {
  const o = byId(id);
  if (!o) return viewApprendre();
  if (S.opTabFor !== id) { S.opTabFor = id; S.opTab = 'lignes'; }
  const tab = S.opTab;
  const gs = opGames(o).sort((a, b) => a.t - b.t), wG = gs.filter((g) => g.w), bG = gs.filter((g) => !g.w);
  const startSan = o.start ? o.start.split(' ') : ['d4', 'd5', 'Bf4'];
  const ch = new Chess(); for (const m of startSan) ch.move(m);
  S.op = { o, fen: ch.fen(), gs, tab };
  const res = (l) => (l.length ? `${pl(l.length, 'partie')}, ${st.score(st.tally(l))} % de score` : 'aucune partie');
  const body = {
    lignes: () => `<div class="oplist">${o.lines.map((l, k) => { const key = lineKey(o, k); return `<div class="lnrow"><i class="dot ${l.side}" title="${l.side === 'w' ? 'Tu joues les Blancs' : 'Tu joues les Noirs'}"></i>
      <span class="lnc"><b>${esc(l.n)}</b><span class="lnmv">${esc(st.lineText(movesOf(l)))}</span>${lineChip(key)}</span>
      <span class="lna"><a class="btn sm" href="${lineHref(key, true)}">Voir</a><a class="btn sm" href="${lineHref(key)}">Jouer</a></span></div>`; }).join('')}</div>
      <p class="small">Point blanc : tu joues les Blancs, point noir : les Noirs. « Voir » déroule la ligne commentée, « Jouer » te la fait rejouer de mémoire.</p>`,
    plans: () => `<div class="card"><h3><i class="dot w"></i> Les Blancs</h3><p class="prose">${esc(o.idees.w)}</p><h3><i class="dot b"></i> Les Noirs</h3><p class="prose">${esc(o.idees.b)}</p></div>`,
    histoire: () => `<div class="card"><div class="prose stack">${o.histoire.map((x) => `<p>${esc(x)}</p>`).join('')}</div></div>`,
    pieges: () => `<div class="card"><ol class="routine">${o.pieges.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>`,
    parties: () => `<div class="card">${gs.length ? `<dl class="kv"><dt>Avec les Blancs</dt><dd>${res(wG)}</dd><dt>Avec les Noirs</dt><dd>${res(bG)}</dd><dt>Première et dernière fois</dt><dd>${dfmt(gs[0].t)} · ${dfmt(gs[gs.length - 1].t)}</dd></dl>
      ${opSeq(gs, o)}
      <div class="chart" id="opc"></div>
      <div class="stack">${gs.slice(-3).reverse().map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or}), ${g.w ? 'Blancs' : 'Noirs'}</span><span class="chip ${g.out === 'W' ? 'good' : g.out === 'L' ? 'bad' : ''}">${g.out === 'W' ? 'Victoire' : g.out === 'L' ? 'Défaite' : 'Nulle'}</span></a>`).join('')}</div>`
      : '<p class="sub">Tu ne l’as jamais jouée ni rencontrée dans tes parties importées.</p>'}</div>`,
  };
  return `<p class="small"><a href="#ouvertures/apprendre">‹ Toutes les ouvertures</a></p>
  <div class="ophero"><div class="board" id="opb"></div><div class="stack">
    <h1>${o.nom}</h1>
    <p class="opmoves">${esc(st.lineText(startSan))}${o.start ? '' : ' (ou 1…Cf6)'}</p>
    <p class="sub">${esc(o.tag)}</p>
    <div class="row">${o.rep ? '<span class="chip good">Ton répertoire</span>' : ''}<span class="chip">${o.eco}</span>${gs.length ? `<span class="chip">${pl(gs.length, 'partie')}</span>` : ''}</div></div></div>
  <div class="seg2 mini optabs" role="tablist">${OP_SECTIONS.map(([k, t]) => `<button role="tab" class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}" data-act="optab" data-tab="${k}">${t}${k === 'lignes' ? ` (${o.lines.length})` : ''}</button>`).join('')}</div>
  ${body[tab]()}`;
}
// Tes suites les plus fréquentes dans cette ouverture (jusqu'au 5e coup), avec ton score : calculé sur les parties de l'utilisateur.
function opSeq(gs, o) {
  const n = Math.max(6, (o.start ? o.start.split(' ').length : 3) + 4), m = new Map();
  for (const g of gs) { if (g.san.length < n) continue; const k = (g.w ? 'w' : 'b') + g.san.slice(0, n).join(' '); const r = m.get(k) || { w: g.w, san: g.san.slice(0, n), l: [] }; r.l.push(g); m.set(k, r); }
  const top = [...m.values()].filter((r) => r.l.length >= 2).sort((a, b) => b.l.length - a.l.length).slice(0, 4);
  if (!top.length) return '';
  return `<h3>Tes suites les plus fréquentes</h3><table><tbody>${top.map((r) => { const t = st.tally(r.l), sc = st.score(t); return `<tr><td><i class="dot ${r.w ? 'w' : 'b'}"></i> ${esc(st.lineText(r.san))}</td><td class="r">${r.l.length}</td><td class="r"><span class="chip ${sc >= 55 ? 'good' : sc <= 42 ? 'bad' : ''}">${sc} %</span></td></tr>`; }).join('')}</tbody></table>
    <p class="small">Point blanc : tu avais les Blancs. Score : victoire 1, nulle ½. Une suite à moins de 42 % mérite un passage par les onglets Lignes et Pièges.</p>`;
}
function mountOpening() {
  const P = S.op; if (!P) return;
  board($('#opb'), { fen: P.fen, orientation: P.o.group === 'w' ? 'white' : 'black', viewOnly: true, coordinates: false });
  const el = $('#opc'); if (!el || !S.data.games.length) return; // présent sur l'onglet « Tes parties » seulement
  // Parties dans cette ouverture, par trimestre, depuis ta première partie importée.
  const q = (t) => { const d = new Date(t * 1000); return d.getFullYear() * 4 + Math.floor(d.getMonth() / 3); };
  const all = S.data.games, q0 = q(all[0].t), q1 = q(all[all.length - 1].t), cnt = new Map();
  for (const g of P.gs) cnt.set(q(g.t), (cnt.get(q(g.t)) || 0) + 1);
  const name = (k) => `T${(k % 4) + 1} ${Math.floor(k / 4)}`, pts = [];
  for (let k = q0; k <= q1; k++) pts.push({ x: k, y: cnt.get(k) || 0, tip: `${name(k)} : ${pl(cnt.get(k) || 0, 'partie')}` });
  lineChart(el, pts, { h: 130, min: 0, label: 'Tes parties dans cette ouverture, par trimestre', x0: name(q0), x1: name(q1), yfmt: (v) => String(Math.round(v)) });
}
// Écran d'une ligne : « voir » la joue commentée, sinon l'élève la récite de mémoire (les coups adverses viennent seuls).
function viewLigne(id, k, mode) {
  const o = byId(id), l = o?.lines[+k];
  if (!l) return viewApprendre();
  const key = lineKey(o, +k), voir = mode === 'voir', mv = movesOf(l), side = l.side === 'w' ? 'Blancs' : 'Noirs';
  const mine = mv.filter((_, i) => (i % 2 === 0) === (l.side === 'w')).length;
  S.lnCur = { o, l, k: +k, key, voir };
  const chips = `<span class="chip">${voir ? 'Découverte' : 'De mémoire'}</span><span class="chip">Ligne ${+k + 1} / ${o.lines.length}</span>`;
  return exo.screen({
    live: true, top: () => chips,
    head: `<div class="pzhead main"><h1>${esc(o.nom)}</h1><div class="row">${chips}</div></div>`
      + coach(voir ? `<b>${esc(l.n)}.</b> ${esc(l.idee)}` : `<b>${esc(l.n)}.</b> Joue les ${mine} coups des ${side} de mémoire. Les réponses adverses viennent toutes seules.`, 'intro'),
    cap: voir ? `<p><b>${esc(l.n)}.</b> Regarde la ligne se dérouler, coup par coup.</p>` : `<p><i class="dot ${l.side}"></i> Tu as les ${side}. <span class="m-txt">${esc(l.n)} : </span>joue ${mine} coups de mémoire.</p>`,
    panel: (voir ? '<div id="lnp"></div>' : `<div class="card ghost"><h3>L’idée</h3><p class="sub">${esc(l.idee)}</p></div><div class="card ghost"><h3>Coups joués</h3><p class="small" id="lnmoves">Aucun pour l’instant.</p></div>`)
      + `<div class="meta small"><a href="#ouvertures/${o.id}">Fiche de l’ouverture</a>${voir ? '' : ` · <a href="${lineHref(key, true)}">Revoir la ligne</a>`}</div>`,
    bar: voir ? '' : '<button class="btn" data-x="hint">Indice</button><button class="btn" data-x="show">Voir la suite</button><button class="btn" data-act="back">Retour</button>',
  });
}
function mountLigne() {
  const X = exo.current(), c = S.lnCur;
  if (!X || !c) return;
  const { o, l, key } = c, mv = movesOf(l), me = l.side, color = me === 'w' ? 'white' : 'black', START = new Chess().fen();
  if (c.voir) {
    const steps = buildLine(START, mv, me, true).map((q, i) => (l.notes?.[i] ? { ...q, text: l.notes[i] + ' ' + q.text } : q));
    const cg = X.board({ fen: START, orientation: color, viewOnly: true });
    X.player({
      view: (fen, last, shapes) => cg.set({ fen, lastMove: last, drawable: { autoShapes: (shapes || []).filter(Boolean) } }), arrows: (a) => cg.setAutoShapes(a),
      films: { line: { steps, start: { fen: START, shape: null }, startText: 'Position de départ.', tone: 'ok', brush: (i) => (steps[i].tags.mine ? 'green' : 'blue') } },
      exit: `<a class="btn" href="${lineHref(key)}">M’entraîner</a>`, from: 0,
      panel: $('#lnp'), panelHtml: () => `<ol class="line">${steps.map((q, i) => `<li data-x="jump" data-v="${i + 1}"><b>${q.white ? q.no + '.' : (i === 0 ? q.no + '…' : '')} ${fr(q.san)}</b><span>${esc(q.text)}</span></li>`).join('')}</ol>`,
    });
    return;
  }
  const ch = new Chess(), stt = { i: 0, errs: 0, hints: 0, shown: false, done: false, tk: 0 };
  const mov = () => ({ free: false, color, dests: destsOf(ch), showDests: true, events: { after: onMove } });
  const cg = X.board({ fen: START, orientation: color, turnColor: 'white', movable: me === 'w' ? mov() : { color: undefined } });
  const paint = () => { const el = $('#lnmoves'); if (el) el.textContent = ch.history().length ? st.lineText(ch.history()) : 'Aucun pour l’instant.'; };
  const want = () => new Chess(ch.fen()).move(mv[stt.i]);
  function finish() {
    if (stt.done) return;
    stt.done = true; stt.tk++;
    const res = stt.shown ? 0 : stt.errs || stt.hints ? 1 : 2;
    progress.recordLine(key, res); header();
    cg.set({ movable: { color: undefined } });
    const s = progress.lineState(key), [href, label] = nextLine(key);
    X.say(res ? 'ok' : '', `<p>${res === 2 ? '<b class="ok">Ligne récitée sans faute.</b>' : res === 1 ? `<b class="ok">Ligne terminée</b> avec ${pl(stt.errs + stt.hints, 'aide')}.` : 'Voici la ligne complète.'} ${s ? `Prochaine révision le ${dshort(s.due)}.` : ''}</p><p class="small">${esc(l.idee)}</p>`);
    X.solved();
    X.setBar(`<button class="btn" data-x="again">Recommencer</button><a class="btn" href="${lineHref(key, true)}">Revoir</a><a class="btn pri" href="${href}">${label}</a>`);
  }
  // Coups adverses joués seuls, jusqu'à ton tour ou la fin de la ligne.
  function opp() {
    if (stt.i >= mv.length) return finish();
    if (ch.turn() === me) { cg.set({ turnColor: color, movable: mov() }); return; }
    const t = stt.tk;
    setTimeout(() => {
      if (!X.alive() || t !== stt.tk || stt.done) return;
      const m = ch.move(mv[stt.i]); stt.i++; paint();
      cg.set({ fen: ch.fen(), lastMove: [m.from, m.to], turnColor: color, movable: mov() });
      if (stt.i >= mv.length) return finish();
      const note = l.notes?.[stt.i - 1];
      X.say(stt.ok ? 'ok' : '', `${stt.ok || ''}<p>Réponse : <b>${fr(m.san)}</b>${note ? ' : ' + esc(note) : '.'} À toi.</p>`);
      stt.ok = '';
    }, 550);
  }
  function onMove(from, to) {
    const w = want(), m = ch.move({ from, to, promotion: 'q' });
    if (!m) { cg.set({ fen: ch.fen(), movable: mov() }); return; }
    if (m.san === w.san) {
      stt.i++; paint();
      const note = l.notes?.[stt.i - 1];
      stt.ok = `<p><b class="ok">${fr(m.san)}</b>${note ? ' : ' + esc(note) : '.'}</p>`;
      X.say('ok', stt.ok);
      cg.set({ fen: ch.fen(), movable: { color: undefined }, drawable: { autoShapes: [] } });
      return opp();
    }
    stt.errs++; ch.undo();
    const t = ++stt.tk;
    cg.set({ movable: { color: undefined } }); cg.setAutoShapes([{ orig: to, brush: 'red' }]);
    X.say('ko', `<p><b class="ko">Pas le coup de la ligne.</b> Après ${fr(m.san)}, la ligne continue par <b>${fr(w.san)}</b> : joue-le.</p>`);
    setTimeout(() => { if (!X.alive() || t !== stt.tk || stt.done) return; cg.set({ fen: ch.fen(), turnColor: color, movable: mov(), drawable: { autoShapes: [arrow(w.from + w.to, 'green')] } }); }, 900);
  }
  X.on({
    hint() {
      if (stt.done || ch.turn() !== me) return;
      const w = want(); stt.hints++;
      cg.setAutoShapes(stt.hints % 2 ? [{ orig: w.from, brush: 'green' }] : [arrow(w.from + w.to, 'green')]);
      X.say('', `<p><b>Indice.</b> ${stt.hints % 2 ? 'La pièce entourée joue. Touche encore « Indice » pour voir le coup.' : `La ligne continue par ${fr(w.san)}.`}</p>`);
    },
    show() { if (stt.done) return; stt.shown = true; while (stt.i < mv.length) { ch.move(mv[stt.i]); stt.i++; } paint(); cg.set({ fen: ch.fen(), lastMove: undefined, drawable: { autoShapes: [] } }); finish(); },
    again() { render(); },
  });
  X.say('', `<p><i class="dot ${me}"></i> ${me === 'w' ? 'À toi de commencer.' : 'Les Blancs commencent.'}</p>`);
  if (me === 'b') opp();
}

// ---------- Gagner les parties gagnées ----------
// Parties où tu as eu au moins +5 sans gagner : tu reprends la position et tu la joues jusqu'au mat contre un moteur bridé.
const CV_MIN = 500, BOT = { 'Skill Level': 6 }, BOT_DEPTH = 10;
function cvList() {
  if (!S.data) return [];
  const out = [];
  for (const g of S.data.games) {
    const a = S.an[g.id];
    if (!a || a.bad || g.out === 'W' || !(a.maxAdv >= CV_MIN)) continue;
    const pov = (cp) => (g.w ? cp : -cp);
    const ply = a.ev.findIndex((cp, k) => k < g.san.length && (k % 2 === 0) === g.w && pov(cp) >= CV_MIN); // premier moment où tu gagnais
    if (ply >= 0) out.push({ g, ply, ev: pov(a.ev[ply]) });
  }
  return out.sort((x, y) => y.g.t - x.g.t);
}
const CV_END = {
  gagne: ['ok', '<b class="ok">Gagné.</b> Tu as converti l’avantage jusqu’au mat.'],
  mat_subi: ['ko', '<b class="ko">Échec et mat contre toi.</b> L’avantage s’est retourné : vérifie les menaces sur ton roi avant d’attaquer.'],
  pat: ['ko', '<b class="ko">Pat : partie nulle.</b> Avec beaucoup de matériel, laisse toujours une case au roi adverse.'],
  rep: ['ko', '<b class="ko">Nulle par répétition.</b> Quand tu mènes, change de plan plutôt que de répéter les coups.'],
  nulle: ['ko', '<b class="ko">Partie nulle.</b> Garde des pions : sans eux, tu ne peux plus mater.'],
  abandon: ['ko', 'Partie abandonnée. Recommence quand tu veux : la position t’attend.'],
};
function cvEnd(ch, me) {
  if (ch.in_checkmate()) return ch.turn() === me ? 'mat_subi' : 'gagne';
  if (ch.in_stalemate()) return 'pat';
  if (ch.in_threefold_repetition()) return 'rep';
  if (ch.in_draw()) return 'nulle';
  return null;
}
function viewGagner(t) {
  const list = cvList(), won = new Set(progress.conversions().filter((h) => h.r === 2).map((h) => h.id));
  if (t == null) {
    const head = `<h1>Gagner les parties gagnées</h1>${coach('Ces parties, tu les as eues gagnantes, avec au moins +5 d’avantage, et elles t’ont échappé. Reprends-les au moment où tu gagnais et va jusqu’au mat contre le moteur. Il défend sérieusement : c’est l’entraînement à la conversion qui manque le plus sous 1000.')}`;
    if (!list.length) return head + `<div class="card"><p class="sub">${Object.keys(S.an).length ? 'Aucune partie analysée où tu as eu +5 sans gagner. Bonne nouvelle, ou analyse plus de parties.' : 'Analyse tes parties pour trouver celles qui t’ont échappé.'}</p>${S.job.running ? '' : '<div><button class="btn" data-act="analyse">Analyser 20 parties de plus</button></div>'}</div>`;
    return head + `<div class="menu">${list.slice(0, 30).map((x) => `<a class="mrow" href="#gagner/${x.g.t}"><span class="mico">${won.has(String(x.g.t)) ? '✓' : ico('play')}</span><span class="stepc"><b>${dfmt(x.g.t)} contre ${esc(x.g.opp)} (${x.g.or})</b><span>${fmtEval(x.ev)} au coup ${Math.floor(x.ply / 2) + 1} · finie en ${x.g.out === 'L' ? 'défaite' : 'nulle'}${won.has(String(x.g.t)) ? ' · déjà gagnée ici' : ''}</span></span><span class="chev" aria-hidden="true">›</span></a>`).join('')}</div>`;
  }
  const it = list.find((x) => String(x.g.t) === String(t));
  if (!it) return `<h1>Position introuvable</h1><div class="card"><p class="sub">Cette partie n’est plus dans la liste.</p><div><a class="btn" href="#gagner">Voir les parties</a></div></div>`;
  if (!S.cv || String(S.cv.t) !== String(it.g.t)) S.cv = { t: it.g.t, moves: [], over: null };
  const r = replay(it.g), side = it.g.w ? 'Blancs' : 'Noirs', prev = r.mv[it.ply - 1];
  S.cvCur = { it, fen: r.fens[it.ply], last: prev ? [prev.from, prev.to] : undefined };
  const idx = list.indexOf(it), nx = list[idx + 1] || list[0];
  const chips = `<span class="chip good">${fmtEval(it.ev)}</span><span class="chip">${idx + 1} / ${list.length}</span>`;
  return exo.screen({
    live: true, top: () => chips,
    head: `<div class="pzhead main"><h1>Gagne cette partie</h1><div class="row">${chips}</div></div>`
      + coach(`Coup ${Math.floor(it.ply / 2) + 1} de ta ${gameRef(it.g)} : tu gagnais, la partie s’est finie en ${it.g.out === 'L' ? 'défaite' : 'nulle'}. <b>Joue avec les ${side} jusqu’au mat.</b>`, 'intro'),
    cap: `<p><i class="dot ${it.g.w ? 'w' : 'b'}"></i> Trait aux ${side}. Tu as ${fmtEval(it.ev)} : simplifie et va au mat.</p>`,
    panel: `<div class="meta small"><a href="#partie/${it.g.t}/${it.ply}">Voir la partie d’origine</a> · <a href="#gagner">Toutes les parties</a></div>
      <div class="card ghost"><h3>${LESSONS.conversion.titre}</h3><ol class="routine">${LESSONS.conversion.routine.map((x) => `<li>${x}</li>`).join('')}</ol></div>
      <div class="card ghost"><h3>Coups joués</h3><p class="small" id="cvmoves">Aucun pour l’instant.</p></div>`,
    bar: '',
    nextT: nx && nx !== it ? nx.g.t : null,
  });
}
// Partie contre le moteur sur un écran d'exercice : #gagner, #jouer (depuis la relecture) et #finale.
// o : { fen, last, me, st: { moves, over, hints }, from (demi-coups joués avant, pour la notation), engine(), depth,
//       judge(ch, m, cpMe, mine) → raison de fin ou null (cpMe : éval de ton point de vue, connue avant chaque coup du moteur),
//       end(why, record) : affichage et enregistrement de la fin, bar(), keep() }
function botGame(X, o) {
  const st0 = o.st, me = o.me, color = me === 'w' ? 'white' : 'black';
  const ch = new Chess(o.fen); let last = o.last;
  for (const u of st0.moves) { const m = uciMove(ch, u); if (!m) break; last = [m.from, m.to]; }
  let tk = 0;
  const mov = () => ({ free: false, color, dests: destsOf(ch), showDests: true, events: { after: onMove } });
  const turn = () => (ch.turn() === 'w' ? 'white' : 'black');
  const cg = X.board({ fen: ch.fen(), orientation: color, turnColor: turn(), lastMove: last, movable: st0.over || ch.turn() !== me ? { color: undefined } : mov() });
  const moves = () => { const el = $('#cvmoves'); if (el) el.textContent = ch.history().length ? st.lineText([...Array(o.from || 0).fill(''), ...ch.history()], o.from || 0) : 'Aucun pour l’instant.'; };
  function over(why, record = true) {
    st0.over = why; tk++;
    cg.set({ movable: { color: undefined } });
    o.end(why, record, ch);
    o.keep();
  }
  async function botMove() {
    const k = ++tk;
    X.say('', '<p>Ton adversaire réfléchit…</p>');
    let r;
    try { r = await o.engine().evalFen(ch.fen(), o.depth, true); } catch { o.engine(true); if (X.alive()) X.say('ko', '<p>Le moteur ne répond pas sur ce navigateur. Recharge la page pour réessayer.</p>'); return; }
    if (!X.alive() || k !== tk || st0.over || !r.best) return;
    const cpMe = -r.cp, before = ch.fen();
    const pre = o.judge(ch, null, cpMe, false); if (pre) return over(pre);
    const m = uciMove(ch, r.best);
    if (!m) return;
    st0.moves.push(r.best); o.keep(); moves();
    cg.set({ fen: ch.fen(), lastMove: [m.from, m.to], turnColor: color, movable: mov(), drawable: { autoShapes: [] } });
    const why = o.judge(ch, m, null, false); if (why) return over(why);
    X.say('', `<p>${esc(justPlayed(describeAt(before, m.san, me)))} <b>À toi.</b></p>`);
  }
  function onMove(from, to) {
    const m = ch.move({ from, to, promotion: 'q' });
    if (!m) { cg.set({ fen: ch.fen(), movable: mov() }); return; }
    st0.moves.push(from + to + (m.promotion || '')); o.keep(); moves();
    cg.set({ fen: ch.fen(), turnColor: turn(), movable: { color: undefined }, drawable: { autoShapes: [] } });
    const why = o.judge(ch, m, null, true); if (why) return over(why);
    botMove();
  }
  X.on({
    async hint() {
      if (st0.over || ch.turn() !== me) return;
      const k = tk, fen = ch.fen();
      X.say('', '<p>Je cherche le meilleur coup…</p>');
      try { S.play ||= new Engine(); const r = await S.play.evalFen(fen, DEPTH, true); if (!X.alive() || k !== tk || ch.fen() !== fen || !r.best) return; st0.hints = (st0.hints || 0) + 1; o.keep(); cg.setAutoShapes([arrow(r.best, 'green')]); X.say('', `<p><b>Indice.</b> ${esc(hintFor(fen, r.best, me))} La flèche verte montre le coup du moteur.</p>`); } catch { S.play = null; }
    },
    resign() { if (!st0.over) over('abandon'); },
  });
  moves();
  if (st0.over) { over(st0.over, false); return; }
  X.setBar(o.bar());
  if (ch.turn() !== me) botMove();
  else if (st0.moves.length) X.say('', '<p>Partie reprise là où tu l’avais laissée. <b>À toi.</b></p>');
}
const botBar = () => '<button class="btn" data-x="hint">Indice</button><button class="btn" data-x="resign">Abandonner</button><button class="btn" data-act="back">Retour</button>';
const sideBot = (fresh) => { if (fresh) S.bot = null; return (S.bot ||= new Engine(BOT)); };
function mountGagner() {
  const X = exo.current(), c = S.cvCur, cv = S.cv;
  if (!X || !c || !cv) return;
  const { it } = c, me = it.g.w ? 'w' : 'b';
  const endBar = () => X.setBar(`<button class="btn ${cv.over === 'gagne' ? '' : 'pri'}" data-x="restart">Recommencer</button>${X.spec.nextT ? `<a class="btn ${cv.over === 'gagne' ? 'pri' : ''}" href="#gagner/${X.spec.nextT}">Partie suivante ›</a>` : '<a class="btn" href="#gagner">Toutes les parties</a>'}`);
  X.on({ restart() { S.cv = { t: it.g.t, moves: [], over: null }; keepUi(); render(); } });
  botGame(X, {
    fen: c.fen, last: c.last, me, st: cv, from: it.ply, engine: sideBot, depth: BOT_DEPTH, bar: botBar, keep: keepUi,
    judge: (ch) => cvEnd(ch, me),
    end(why, record) {
      if (record) { progress.recordConversion(it.g.t, why === 'gagne' ? 2 : 0, cv.moves.length); header(); }
      const [cls, html] = CV_END[why] || CV_END.nulle;
      X.say(cls, `<p>${html} <span class="small">${pl(Math.ceil(cv.moves.length / 2), 'coup')} joués.</span></p>`);
      X.solved(); endBar();
    },
  });
}

// ---------- Jouer à partir d'une position de la relecture (#jouer/<t>/<k>) ----------
// k : demi-coup de la partie, ou 'v' pour la variante jouée dans la relecture (sa position est gardée dans S.jp).
// Tu reprends ton camp de la partie contre le même moteur bridé que #gagner.
const JP_END = {
  gagne: ['ok', '<b class="ok">Échec et mat : gagné.</b>'], mat_subi: ['ko', '<b class="ko">Échec et mat contre toi.</b> Regarde où la défense a lâché : la relecture de la partie t’attend.'],
  pat: ['ko', '<b>Pat : partie nulle.</b>'], rep: ['ko', '<b>Nulle par répétition.</b>'], nulle: ['ko', '<b>Partie nulle.</b>'], abandon: ['ko', 'Partie abandonnée.'],
};
function viewJouer(t, k) {
  const g = S.data.games.find((x) => String(x.t) === String(t));
  if (!g) return viewParties();
  if (!S.jp || String(S.jp.t) !== String(t) || String(S.jp.k) !== String(k)) {
    if (k === 'v') return `<h1>Variante introuvable</h1><div class="card"><p class="sub">La variante n’a pas été gardée. Rejoue-la dans la relecture, puis touche « Jouer d’ici ».</p><div><a class="btn pri" href="#partie/${g.t}">Revenir à la partie</a></div></div>`;
    const r = replay(g); if (!r) return viewParties();
    const ply = Math.max(0, Math.min(+k || 0, r.mv.length)), prev = r.mv[ply - 1];
    S.jp = { t: g.t, k: String(k), from: ply, fen: r.fens[ply], last: prev ? [prev.from, prev.to] : undefined, moves: [], over: null };
  }
  const P = S.jp, side = g.w ? 'Blancs' : 'Noirs', back = `#partie/${g.t}${k === 'v' ? '' : '/' + P.from}`;
  const chips = `<span class="chip">${k === 'v' ? 'Ta variante' : `Coup ${Math.floor(P.from / 2) + 1}`}</span>`;
  return exo.screen({
    live: true, top: () => chips,
    head: `<div class="pzhead main"><h1>Joue cette position</h1><div class="row">${chips}</div></div>`
      + coach(`Position de ta ${gameRef(g)}${k === 'v' ? ', après ta variante' : ''}. <b>Tu as les ${side}</b> contre un moteur bridé : rejoue-la jusqu’au bout, autrement.`, 'intro'),
    cap: `<p><i class="dot ${g.w ? 'w' : 'b'}"></i> Tu as les ${side}.</p>`,
    panel: `<div class="meta small"><a href="${back}">Revenir à la partie</a></div>
      <div class="card ghost"><h3>Avant chaque coup</h3><ol class="routine">${LESSONS.en_prise_pose.routine.map((x) => `<li>${x}</li>`).join('')}</ol></div>
      <div class="card ghost"><h3>Coups joués</h3><p class="small" id="cvmoves">Aucun pour l’instant.</p></div>`,
    bar: '',
  });
}
function mountJouer() {
  const X = exo.current(), P = S.jp;
  if (!X || !P) return;
  const g = S.data.games.find((x) => String(x.t) === String(P.t)); if (!g) return;
  X.on({ restart() { Object.assign(P, { moves: [], over: null }); keepUi(); render(); } });
  botGame(X, {
    fen: P.fen, last: P.last, me: g.w ? 'w' : 'b', st: P, from: P.from, engine: sideBot, depth: BOT_DEPTH, bar: botBar, keep: keepUi,
    judge: (ch) => cvEnd(ch, g.w ? 'w' : 'b'),
    end(why, record) {
      if (record) { progress.recordPlay(g.t, P.k === 'v' ? 'v' : P.from, why, P.moves.length); header(); }
      const [cls, html] = JP_END[why] || JP_END.nulle;
      X.say(cls, `<p>${html} <span class="small">${pl(Math.ceil(P.moves.length / 2), 'coup')} joués.</span></p>`);
      X.solved();
      X.setBar(`<button class="btn pri" data-x="restart">Rejouer la position</button><a class="btn" href="#partie/${g.t}${P.k === 'v' ? '' : '/' + P.from}">Revenir à la partie</a>`);
    },
  });
}

// ---------- Finales de base contre le moteur (#finales, #finale/<id>), comme « Practice » sur Chess.com ----------
// Le moteur défend à pleine force. Réussite : 2 sans indice, 1 avec indice, 0 manquée ; répétition espacée (progress.recordEndgame).
const EG_OK = new Set(['gagne', 'promu', 'tenu']);
const egEnd = (e, why) => ({
  gagne: ['ok', '<b class="ok">Échec et mat.</b> Finale réussie.'],
  promu: ['ok', '<b class="ok">Dame !</b> Le pion est passé et la nouvelle dame ne peut pas être prise.'],
  tenu: ['ok', e.stop ? '<b class="ok">Pion rattrapé.</b> Roi contre roi : nulle.' : '<b class="ok">Nulle tenue.</b> Tu as appliqué la défense jusqu’au bout.'],
  pat: ['ko', '<b class="ko">Pat : nulle.</b> Laisse toujours une case libre au roi adverse.'],
  rep: ['ko', '<b class="ko">Nulle par répétition.</b> Change de plan plutôt que de répéter.'],
  nulle: ['ko', '<b class="ko">Nulle.</b> Le matériel ne suffit plus pour gagner.'],
  long: ['ko', `<b class="ko">Trop long.</b> Le but était d’y arriver en ${e.limit} coups : relis le plan et recommence.`],
  perdu: ['ko', e.goal === 'nulle' ? '<b class="ko">La position est perdue.</b> Relis la règle de défense et recommence.' : '<b class="ko">L’avantage a disparu.</b> Relis le plan et recommence.'],
  mat_subi: ['ko', '<b class="ko">Échec et mat contre toi.</b>'],
  abandon: ['ko', 'Finale abandonnée. Recommence quand tu veux.'],
}[why] || ['ko', 'Finale terminée.']);
function egJudge(e, P) {
  const me = e.fen.split(' ')[1];
  return (ch, m, cpMe, mine) => {
    const end = cvEnd(ch, me);
    if (end) return end === 'gagne' || end === 'mat_subi' ? end : e.goal === 'nulle' ? 'tenu' : end;
    if (cpMe != null) { // avant un coup du moteur : éval de ton point de vue
      if (e.goal !== 'nulle' && cpMe < 150) return 'perdu';
      if (e.goal === 'nulle' && !e.noEval && cpMe <= -500) return 'perdu';
      return null;
    }
    if (m?.promotion) {
      if (mine && e.goal === 'promo' && !ch.moves({ verbose: true }).some((x) => x.to === m.to)) return 'promu';
      if (!mine && e.goal === 'nulle') return 'perdu';
    }
    if (mine && Math.ceil(P.moves.length / 2) >= e.limit) return e.goal === 'nulle' ? 'tenu' : 'long';
    return null;
  };
}
function egChip(id) {
  const s = progress.endgameState(id);
  if (!s) return '<span class="chip">Nouvelle</span>';
  return s.aReviser ? '<span class="chip warn">À refaire</span>' : `<span class="chip ${s.acquise ? 'good' : ''}">${s.acquise ? 'Acquise' : 'Réussie'} · revient le ${dshort(s.due)}</span>`;
}
function viewFinales() {
  const due = progress.endgamesDue(ENDGAMES.map((e) => e.id));
  return `<h1>Finales de base</h1>${coach('Les positions que tout joueur doit savoir gagner ou tenir, à jouer contre le moteur à pleine force. Sous 1000, des parties gagnées finissent nulles faute de connaître le mat avec la tour ou l’opposition : une fois apprises, elles reviennent en révision comme tes puzzles.')}
  ${due.length ? `<div><a class="btn pri" href="#finale/${due[0]}">Refaire ${due.length > 1 ? `mes ${due.length} finales à réviser` : 'ma finale à réviser'}</a></div>` : ''}
  ${[1, 2, 3].map((lvl) => `<h2 class="ent-h">${['', 'Les bases', 'Finales de pions', 'Finales de tours'][lvl]}</h2><div class="menu">${ENDGAMES.filter((e) => e.lvl === lvl).map((e) => `<a class="mrow" href="#finale/${e.id}"><span class="mico">${progress.endgameState(e.id) ? '✓' : ico('flag')}</span><span class="stepc"><b>${esc(e.t)}</b><span>${GOAL_TXT[e.goal]} · ${esc(e.intro)}</span></span>${egChip(e.id)}<span class="chev" aria-hidden="true">›</span></a>`).join('')}</div>`).join('')}`;
}
function viewFinale(id) {
  const e = egById(id);
  if (!e) return viewFinales();
  if (!S.fg || S.fg.id !== id) S.fg = { id, moves: [], over: null, hints: 0 };
  const me = e.fen.split(' ')[1], side = me === 'w' ? 'Blancs' : 'Noirs', i = ENDGAMES.indexOf(e), nx = ENDGAMES[(i + 1) % ENDGAMES.length];
  const chips = `<span class="chip good">${GOAL_TXT[e.goal]}</span><span class="chip">${e.goal === 'nulle' ? `${e.limit} coups à tenir` : `en ${e.limit} coups`}</span>`;
  return exo.screen({
    live: true, top: () => chips,
    head: `<div class="pzhead main"><h1>${esc(e.t)}</h1><div class="row">${chips}</div></div>` + coach(`${esc(e.intro)} <b>Tu as les ${side}.</b>`, 'intro'),
    cap: `<p><i class="dot ${me}"></i> Trait aux ${side}. ${esc(e.intro)}</p>`,
    panel: `<div class="meta small"><a href="#finales">Toutes les finales</a></div>
      <div class="card ghost"><h3>La règle</h3><p class="small">${esc(e.rule)}</p></div>
      <div class="card ghost"><h3>Le plan</h3><ol class="routine">${e.plan.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
      <div class="card ghost"><h3>Coups joués</h3><p class="small" id="cvmoves">Aucun pour l’instant.</p></div>`,
    bar: '', nextId: nx.id,
  });
}
function mountFinale() {
  const X = exo.current(), P = S.fg, e = P && egById(P.id);
  if (!X || !e) return;
  X.on({ restart() { S.fg = { id: e.id, moves: [], over: null, hints: 0 }; keepUi(); render(); } });
  botGame(X, {
    fen: e.fen, me: e.fen.split(' ')[1], st: P, from: 0, depth: DEPTH, bar: botBar, keep: keepUi,
    engine: (fresh) => { if (fresh) S.fin = null; return (S.fin ||= new Engine()); },
    judge: egJudge(e, P),
    end(why, record) {
      const ok = EG_OK.has(why);
      if (record) { progress.recordEndgame(e.id, ok ? (P.hints ? 1 : 2) : 0); header(); exo.feedback(ok ? 'good' : 'bad'); }
      const [cls, html] = egEnd(e, why);
      X.say(cls, `<p>${html}${ok && P.hints ? ` <span class="small">Avec ${pl(P.hints, 'indice')} : elle reviendra plus tôt.</span>` : ''}</p>`);
      X.solved();
      X.setBar(`<button class="btn ${ok ? '' : 'pri'}" data-x="restart">Recommencer</button><a class="btn ${ok ? 'pri' : ''}" href="#finale/${X.spec.nextId}">Finale suivante ›</a>`);
    },
  });
}

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
    <div class="menu">${Object.entries(RUSH).map(([k, x]) => `<a class="mrow" href="#rush/${k}"><span class="mico">${ico(k === 't3' ? 'clock' : 'bolt')}</span><span class="stepc"><b>${x.t}</b><span>${x.d}</span></span><span class="chip ${best[k] ? 'good' : ''}">Record : ${best[k] || '—'}</span><span class="chev" aria-hidden="true">›</span></a>`).join('')}</div>`;
  }
  let R = S.rush;
  if (!R || R.m !== m) { R = S.rush = { m, items: [], i: 0, ok: 0, ko: 0, n: 0, t0: 0, done: false, missed: [] }; rushFill(R); }
  if (R.items.length < 3) return `<h1>Rush</h1><div class="card"><p class="sub">Pas assez de positions dans tes parties pour l’instant. Reviens après quelques parties de plus.</p><div><a class="btn" href="#exos">Échauffements</a></div></div>`;
  if (R.m === 't3' && R.t0 && !rushLeft(R)) rushFinish(R);
  if (R.done) {
    return `<h1>Rush ${RUSH[m].t.toLowerCase()}</h1><div class="card"><div class="row" style="align-items:baseline"><span class="big num">${R.ok}</span><span class="sub">bonne${R.ok > 1 ? 's' : ''} réponse${R.ok > 1 ? 's' : ''} sur ${R.n}${R.rec ? ' · nouveau record' : ` · record : ${best[m]}`}</span></div>
      ${coach(R.rec ? 'Nouveau record. Le réflexe s’installe : garde-le en partie, à chaque coup.' : R.n && R.ok / R.n < 0.7 ? 'Trop de fautes : ralentis un peu, la justesse compte plus que le nombre.' : 'Bonne série. Refais-en une demain pour fixer le réflexe.')}
      <div class="row"><button class="btn pri" data-act="rushagain">Rejouer</button><a class="btn" href="#rush">Autre mode</a></div></div>
      ${R.missed.length ? `<div class="card"><h2>Tes fautes</h2>${R.missed.slice(0, 8).map((x) => `<div class="hrow"><i class="hres r0"></i><span class="stepc"><b>${x.q}</b><span>${esc(x.text)}</span></span></div>`).join('')}</div>` : ''}`;
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

// ---------- Vues ----------
function filtersHtml() {
  const has = new Set(S.data.games.map((g) => g.tc));
  return `<select data-f="tc" aria-label="Cadence">${['rapid', 'blitz', 'bullet', 'daily'].filter((k) => has.has(k)).map((k) => `<option value="${k}" ${S.f.tc === k ? 'selected' : ''}>${TC[k]}</option>`).join('')}<option value="all" ${S.f.tc === 'all' ? 'selected' : ''}>Toutes cadences</option></select>
    <select data-f="days" aria-label="Période"><option value="0">Depuis le début</option><option value="90" ${S.f.days === 90 ? 'selected' : ''}>90 derniers jours</option><option value="30" ${S.f.days === 30 ? 'selected' : ''}>30 derniers jours</option></select>
    <button class="btn sm" data-act="refresh" title="Récupérer les nouvelles parties de ${esc(S.user)}">Mettre à jour</button>`;
}
const TITLES = { idees: 'Idées de plan', avantpartie: 'Avant de jouer', ouvertures: 'Ouverture', ligne: 'Ouverture', puzzles: 'Puzzles', erreur: 'Comprendre', partie: 'Partie', cours: 'Cours', drill: 'Échauffement', inedits: 'Positions inédites', gagner: 'Gagner', monouv: 'Mon ouverture', rush: 'Rush', finale: 'Finale', jouer: 'Jouer' };
function header() {
  const t = $('#tools'), [r, a] = route();
  const imm = !!S.data && (!!exo.current() || r === 'erreur' || (r === 'cours' && !!a) || (r === 'ouvertures' && !!a && a !== 'apprendre') || r === 'monouv' || r === 'avantpartie'); // écran d'exercice ou page de cours : barre du haut avec retour
  document.body.classList.toggle('imm', imm);
  document.body.classList.toggle('homefit', !!S.data && r === 'accueil');
  $('#ttl').textContent = imm ? TITLES[r] : '';
  if (!S.data) { t.innerHTML = ''; return; }
  const tr = st.trend(rapidAll()), stk = streak();
  // Sur téléphone, pendant un exercice, la barre du haut montre l'avancée (puzzles du jour, position de la série).
  const top = exo.top();
  t.innerHTML = `${top ? `<span class="m-only row chips">${top}</span>` : `<span class="m-only row chips">${tr ? `<span class="chip">${tr.cur} Elo</span>` : ''}<span class="chip ${stk ? 'warn' : ''}">Série ${stk} j</span></span>`}${exo.current() ? sndBtn() : ''}<span class="d-only filters">${filtersHtml()}</span>`;
  navBadges();
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
    <p class="small">Aucun compte ni mot de passe : seules tes parties publiques sont lues. Tout reste enregistré sur cet appareil.</p></div>`;
}

function goalBlock() {
  const g = goal(), tr = st.trend(rapidAll());
  if (!tr) return { html: '<div class="card"><h2>Objectif</h2><p class="sub">Aucune partie rapide classée trouvée. Joue quelques parties en Rapide pour démarrer le suivi.</p></div>', tr: null, g };
  const days = Math.max(0, Math.ceil((new Date(g.date + 'T23:59:59') - Date.now()) / DAY));
  const gap = g.elo - tr.cur, weeks = Math.max(days / 7, 1 / 7);
  const proj = tr.slope != null ? Math.round(tr.cur + tr.slope * days) : null;
  const status = gap <= 0 ? '<span class="chip good">Objectif atteint</span>' : proj == null ? '<span class="chip">Tendance inconnue</span>' : proj >= g.elo ? '<span class="chip good">En avance sur le rythme</span>' : '<span class="chip warn">En retard sur le rythme</span>';
  const html = `<div class="card"><h2>Objectif ${g.elo} en Rapide ${status}</h2>
    <div class="row" style="align-items:baseline"><span class="big num">${tr.cur}</span><span class="sub">Elo actuel${gap > 0 ? `, il manque <b class="num">${gap}</b> points` : ''}</span></div>
    <div class="goalbar" aria-hidden="true"><i style="width:${Math.max(3, Math.min(100, (100 * tr.cur) / g.elo))}%"></i></div>
    <details class="gd" ${innerWidth >= 860 ? 'open' : ''}><summary>Détail de l’objectif</summary><dl class="kv"><dt>Échéance</dt><dd>${new Date(g.date).toLocaleDateString('fr-FR')} (${days} j)</dd>
    ${gap > 0 ? `<dt>Rythme nécessaire</dt><dd>+${Math.ceil(gap / weeks)} pts / semaine</dd>` : ''}
    <dt>30 derniers jours</dt><dd>${tr.delta30 == null ? 'aucune partie' : (tr.delta30 >= 0 ? '+' : '') + tr.delta30 + ' pts sur ' + tr.recent + ' parties'}</dd>
    ${proj != null ? `<dt>Projection à l’échéance</dt><dd>${proj}</dd>` : ''}
    <dt>Record</dt><dd>${tr.peak}</dd></dl>
    ${proj != null ? '<p class="small">Projection : tendance linéaire des 30 derniers jours prolongée. C’est un repère, pas une prévision.</p>' : ''}</details></div>`;
  return { html, tr, g };
}

function priorityLessons() {
  const gs = games(), es = st.engineStats(gs, S.an), sig = st.signals(gs, S.an);
  const ids = es.themes.map((t) => t.id);
  for (const w of sig.faiblesses) if (w.lesson && LESSONS[w.lesson] && !ids.includes(w.lesson)) ids.push(w.lesson);
  return { ids, es, sig };
}

function nextLesson(ids) {
  const read = progress.lessonsRead();
  return ids.find((id) => !read[id]) || ids[0] || 'principes';
}
// Chantier : un seul type d'erreur travaillé à la fois, jusqu'à ce que son taux baisse de moitié.
function focus(es) {
  let f = ls.get('focus', null);
  if (f && st.THEMES[f.id]) return f;
  const all = S.f.days ? st.engineStats(S.data.games.filter((g) => g.tc === targetTc()), S.an) : es;
  const top = all.themes[0]?.id;
  if (!top) return null;
  f = { id: top, since: Math.floor(Date.now() / 1000) };
  ls.set('focus', f);
  return f;
}
function focusStats(f) {
  const done = S.data.games.filter((g) => g.tc === targetTc() && S.an[g.id] && !S.an[g.id].bad).sort((a, b) => a.t - b.t);
  const rate = (l) => (l.length ? l.reduce((n, g) => n + S.an[g.id].errs.filter((e) => e.theme === f.id).length, 0) / l.length : null);
  const before = done.filter((g) => g.t < f.since).slice(-10), after = done.filter((g) => g.t >= f.since);
  const base = rate(before), now = rate(after), target = base == null ? null : Math.max(0.2, base / 2);
  return { base, now, nAfter: after.length, target, ok: after.length >= 5 && target != null && now <= target, done };
}
function session() {
  const { ids, es, sig } = priorityLessons();
  const fc = focus(es), a = act()[dkey()] || {};
  const { done: pzDone, due, goal: pzGoal } = pzDay();
  const mid = new Date(); mid.setHours(0, 0, 0, 0);
  const played = rapidAll().filter((g) => g.t >= mid.getTime() / 1000).length;
  const cz = mainCause(progress.causes()); // la cause que l'élève donne à ses erreurs choisit l'échauffement, quand elle en a un
  const les = fc ? fc.id : nextLesson(ids), dr = (cz && CAUSES[cz].drill) || (fc ? DRILL_FOR[fc.id] : 'sur');
  // Un exercice commencé puis quitté se reprend là où il s'est arrêté.
  const drOn = S.dr && S.dr.type === dr && S.dr.day === dkey() && S.dr.i > 0 && S.dr.i < S.dr.items.length;
  const clOn = S.cl && S.cl.id === les && S.cl.step > 0 && S.ai[les];
  const steps = [
    { k: 'dr', done: !!a.dr, t: 'Échauffe ton regard', d: drOn ? `« ${DRILLS[dr].t} » : série en cours, position ${S.dr.i + 1} sur ${S.dr.items.length}.` : `« ${DRILLS[dr].t} » : 10 positions, 2 minutes.`, cta: [drOn ? 'Reprendre l’échauffement' : 'Lancer l’échauffement', '#drill/' + dr], p: drOn ? S.dr.i / S.dr.items.length : 0 },
    { k: 'pz', done: es.n > 0 && (pzDone >= pzGoal || due === 0), t: 'Corrige tes erreurs', d: es.n ? `${Math.min(pzDone, pzGoal)} / ${pzGoal} puzzles tirés de tes parties${fc ? ', ton chantier d’abord' : ''}` : (S.job.running ? `Analyse de tes parties en cours (${S.job.done}/${S.job.total}). Les puzzles arrivent.` : 'Lance l’analyse pour créer tes puzzles.'), cta: es.n ? [pzDone ? 'Continuer mes puzzles' : 'Résoudre mes puzzles', null, 'pzfocus'] : (S.job.running ? null : ['Analyser mes parties', null, 'analyse']), p: es.n ? pzDone / pzGoal : 0, x: es.n && pzDone ? pzDots(pzDay()) : '' },
    { k: 'les', done: !!a.les, t: 'Prends ton cours', d: (S.ai[les] ? S.ai[les].titre : LESSONS[les].titre) + (S.ai[les] ? ' · cours privé prêt' : ''), cta: [clOn ? 'Reprendre le cours' : 'Ouvrir le cours', '#cours/' + les], p: a.les ? 1 : 0 },
    { k: 'play', done: played >= 2, t: 'Joue 2 parties rapides', d: `${Math.min(played, 2)} / 2 jouées aujourd’hui.${fc ? ' Avant chaque coup : « ' + RULES[fc.id] + ' »' : ''}`, cta: ['Préparer ma partie', '#avantpartie'], p: Math.min(played, 2) / 2 },
  ];
  return { steps, ids, es, sig, fc, nDone: steps.filter((x) => x.done).length };
}
function focusCard(fc, es) {
  if (!fc) return '';
  const fs = focusStats(fc), nEx = es.themes.find((t) => t.id === fc.id)?.n || 0;
  const state = fs.ok ? '<span class="chip good">Chantier validé</span>' : fs.nAfter < 5 ? `<span class="chip">${fs.nAfter} / 5 parties depuis le début</span>` : '<span class="chip warn">En cours</span>';
  const others = es.themes.filter((t) => t.id !== fc.id);
  return `<section class="card focus"><div class="row" style="justify-content:space-between"><span class="small">Ton chantier du moment</span>${state}</div>
    <h2>${st.THEMES[fc.id]}</h2>
    <p class="rulet">« ${RULES[fc.id]} »</p>
    <div class="fmet"><div><span>Avant</span><b>${fs.base == null ? '—' : f1(fs.base)}</b><span>par partie</span></div>
      <div><span>Depuis</span><b class="${fs.now != null && fs.base != null ? (fs.now < fs.base ? 'ok' : fs.now > fs.base ? 'ko' : '') : ''}">${fs.nAfter ? f1(fs.now) : '—'}</b><span>${fs.nAfter ? 'sur ' + pl(fs.nAfter, 'partie') : 'joue pour mesurer'}</span></div>
      <div><span>Objectif</span><b>${fs.target == null ? '—' : f1(fs.target)}</b><span>par partie</span></div></div>
    <div class="chart" id="fchart"></div>
    <p class="small">${fs.ok ? 'Tu as divisé cette erreur par deux sur tes dernières parties. Tu peux passer au chantier suivant.' : `Un seul type d’erreur à la fois : on passe au suivant quand celle-ci est divisée par deux sur au moins 5 parties. ${nEx} exemple${nEx > 1 ? 's' : ''} dans tes parties analysées.`}</p>
    <div><button class="btn" data-act="lifocus">Travailler ce thème sur des positions inédites</button></div>
    <div class="row">${fs.ok && others[0] ? `<button class="btn pri" data-act="focusnext" data-id="${others[0].id}">Chantier suivant : ${st.THEMES[others[0].id]}</button>` : ''}
      ${others.length ? `<label class="small" for="fsel">Changer</label><select id="fsel" data-f="focus"><option value="${fc.id}">${st.THEMES[fc.id]}</option>${others.map((t) => `<option value="${t.id}">${st.THEMES[t.id]} (${t.n})</option>`).join('')}</select>` : ''}</div></section>`;
}
// Ton portrait : où, quand et comment tu perds tes points (portrait.js).
function portraitCard() {
  const p = portrait(S.data.games.filter((g) => g.tc === targetTc()), S.an);
  return p.length ? `<div class="card"><h2>Ton portrait</h2><ul class="portrait">${p.map((x) => `<li>${esc(x.t)}</li>`).join('')}</ul></div>` : '';
}
// Programme de 4 semaines du chantier et bilan de la semaine passée (program.js).
function programCard(fc) {
  if (!fc) return '';
  const w = programWeek(fc.since), gs = S.data.games.filter((g) => g.tc === targetTc()), hist = progress.hist();
  const wk = (from, to) => weekStats({ games: gs, an: S.an, hist, themeId: fc.id, from, to });
  return `<div class="card"><h2>Ton programme <span class="small">${w.i < 4 ? `semaine ${w.i + 1} sur 4` : 'terminé'}</span></h2>
    <ol class="dayplan">${STAGES.map((x, i) => `<li class="${i < w.i ? 'done' : i === w.i ? 'on' : ''}"><i aria-hidden="true">${i < w.i ? '✓' : i + 1}</i><span><b>Semaine ${i + 1} · ${x.t}${i === w.i ? ' <span class="chip">en cours</span>' : ''}</b><span>${x.d}</span></span></li>`).join('')}</ol>
    <p class="sub">${w.i === 0 ? 'Premier bilan lundi prochain, ici et sur l’accueil.' : esc(reviewText(wk(w.prev, w.start), wk(w.prev - 7 * DAY, w.prev), st.THEMES[fc.id]))}</p>
    ${w.i >= 4 ? `<p class="small">${focusStats(fc).ok ? 'Chantier validé : passe au suivant.' : 'Quatre semaines passées sans diviser l’erreur par deux : le chantier continue, reprends à la semaine 1.'}</p>` : ''}</div>`;
}
// Où tu sors de la théorie dans les ouvertures du catalogue (theory.js) : une ligne précise à revoir.
function theoryCard() {
  const x = theoryExits(S.data.games.filter((g) => g.tc === targetTc()), OPENINGS, S.an).slice(0, 3);
  if (!x.length) return '';
  const mv = (r, s) => `${Math.floor(r.ply / 2) + 1}${r.ply % 2 ? '…' : '.'}${fr(s)}`;
  return `<div class="card"><h2>Où tu sors de la théorie</h2>${x.map((r) => `<a class="mrow" href="${lineHref(lineKey(r.o, r.k), true)}"><span class="mico">${ico('lines')}</span><span class="stepc"><b>${esc(r.o.nom)} · ${esc(r.o.lines[r.k].n)}</b><span>${r.n} fois sur ${r.of}, tu joues ${r.played.map(([s, n]) => mv(r, s) + (n > 1 ? ` (${n} fois)` : '')).join(', ')} au lieu de ${mv(r, r.book)} : le moteur juge ton coup moins bon.</span></span><span class="chev" aria-hidden="true">›</span></a>`).join('')}
    <p class="small">Seuls comptent tes écarts que le moteur juge coûteux, sur tes parties analysées : jouer une autre ligne correcte n’est pas une faute. Ouvre la ligne pour la revoir commentée, puis récite-la.</p></div>`;
}
// Pourquoi tu te trompes : les réponses données après les puzzles tirés de tes parties (progress.causes).
function causesCard() {
  const c = progress.causes(), top = mainCause(c);
  if (!c.n) return `<div class="card"><h2>Pourquoi tu te trompes</h2><p class="sub">Après chaque puzzle tiré de tes parties, dis-moi pourquoi tu avais joué ce coup. Je m’en sers pour choisir tes conseils et ton échauffement.</p></div>`;
  return `<div class="card"><h2>Pourquoi tu te trompes <span class="small">${pl(c.n, 'réponse')}</span></h2>
    <table><tbody>${Object.entries(CAUSES).map(([k, x]) => `<tr><td>${x.label}</td><td class="r"><b>${c.by[k] || 0}</b></td></tr>`).join('')}</tbody></table>
    ${top ? `<p class="rulet">« ${esc(CAUSES[top].tip)} »</p><p class="small">C’est la consigne de ton brief${CAUSES[top].drill ? ` ; l’échauffement du jour devient « ${DRILLS[CAUSES[top].drill].t} »` : ''}.</p>` : '<p class="small">Pas encore de cause dominante : il faut au moins 3 réponses, dont 40 % identiques.</p>'}</div>`;
}
function trendCard(gs) {
  const tr = st.themeTrend(gs, S.an);
  if (!tr.rows.length) return '';
  const chip = (r) => (r.before == null ? '' : r.now < r.before - 0.05 ? '<span class="chip good">En baisse</span>' : r.now > r.before + 0.05 ? '<span class="chip bad">En hausse</span>' : '<span class="chip">Stable</span>');
  return `<div class="card"><h2>Tes erreurs graves par partie</h2>
    <div class="scroll"><table><thead><tr><th>Type d’erreur</th><th class="r">${tr.nPrev >= 5 ? 'Avant' : ''}</th><th class="r">Maintenant</th><th></th></tr></thead><tbody>
    ${tr.rows.map((r) => `<tr class="click" data-act="goto-cours" data-id="${r.id}"><td>${st.THEMES[r.id]}</td><td class="r">${r.before == null ? '' : f1(r.before)}</td><td class="r"><b>${f1(r.now || 0)}</b></td><td class="r">${chip(r)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="small">« Maintenant » : tes ${tr.nCur} dernières parties analysées.${tr.nPrev >= 5 ? ` « Avant » : les ${tr.nPrev} précédentes.` : ' Analyse au moins 15 parties pour voir l’évolution.'} C’est ce tableau qui dit si l’entraînement paie.</p>
    ${S.job.running ? '' : '<div><button class="btn sm" data-act="analyse">Analyser 20 parties de plus</button></div>'}</div>`;
}
// ---------- Accueil : une seule décision par écran ----------
// Objectif sur une ligne, l'étape en cours de la séance, le chantier en bref, la dernière partie. Le détail est dans « Mon jeu ».
const STEP_SHORT = { dr: 'Échauffement', pz: 'Puzzles', les: 'Cours', play: 'Parties' };
const stepLink = (x, cls, label) => (!x.cta ? `<span class="${cls}">${label}</span>` : x.cta[2] ? `<button class="${cls}" data-act="${x.cta[2]}">${label}</button>`
  : `<a class="${cls}" href="${x.cta[1]}" ${x.cta[1].startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${label}</a>`);
function goalStrip() {
  const g = goal(), tr = st.trend(rapidAll()), stk = streak();
  const serie = `<span class="chip d-only ${stk ? 'warn' : ''}" title="Jours consécutifs avec au moins un puzzle ou un cours">Série ${stk} j</span>`;
  if (!tr) return `<section class="gstrip"><span class="sub">Joue quelques parties rapides classées pour suivre ton objectif ${g.elo}.</span>${serie}</section>`;
  const days = Math.max(0, Math.ceil((new Date(g.date + 'T23:59:59') - Date.now()) / DAY)), gap = g.elo - tr.cur;
  const pace = gap > 0 ? `+${Math.ceil(gap / Math.max(days / 7, 1 / 7))} pts / sem.` : 'Objectif atteint';
  const d30 = !tr.delta30 ? '' : `<span class="chip ${tr.delta30 > 0 ? 'good' : tr.delta30 < 0 ? 'bad' : ''}">${tr.delta30 >= 0 ? '+' : ''}${tr.delta30} sur 30 j</span>`;
  // Ordinateur (17/11) : les chiffres de l'objectif dans des encarts sous la barre, comme le bilan de « Parties » ;
  // téléphone : une ligne, la série est dans la barre du haut.
  const tile = (lab, v, sub = '', cls = '', tip = '') => `<div class="glt"${tip ? ` title="${tip}"` : ''}><span class="small">${lab}</span><b class="num ${cls}">${v}</b>${sub ? `<span class="small">${sub}</span>` : ''}</div>`;
  const tiles = `<div class="glsum gtiles d-only">${tile('Il manque', gap > 0 ? `${gap} pts` : 'Atteint', `pour atteindre ${g.elo}`, gap > 0 ? '' : 'up')}${tile('Échéance', `${days} j`, new Date(g.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }))}${gap > 0 ? tile('Rythme nécessaire', pace.replace(' pts / sem.', ''), 'points par semaine') : ''}${tile('30 derniers jours', tr.delta30 ? `${tr.delta30 > 0 ? '+' : ''}${tr.delta30}` : '0', elo30(), tr.delta30 > 0 ? 'up' : tr.delta30 < 0 ? 'dn' : '')}${tile('Série', `${stk} j`, weekDots(), stk ? 'warn' : '', 'Jours consécutifs avec au moins un puzzle ou un cours')}${nextReview()}</div>`;
  return `<section class="gstrip"><a class="gnum" href="#bilan" title="Détail de l’objectif"><b class="num">${tr.cur}</b><span class="goalbar" aria-hidden="true"><i style="width:${Math.max(3, Math.min(100, (100 * tr.cur) / g.elo))}%"></i></span><b class="num">${g.elo}</b></a>
    <span class="gmeta m-only">${gap > 0 ? `<span>Il manque <b class="num">${gap}</b></span><span>${days} j</span>` : ''}<span>${pace}</span>${d30}</span>${tiles}</section>`;
}
// Accueil, encarts de l'objectif (17/11) : courbe de l'Elo sur 30 jours et semaine d'entraînement en 7 cases.
function elo30() {
  const t0 = Date.now() / 1000 - 30 * 86400, gs = rapidAll().filter((g) => g.rated && g.r).sort((a, b) => a.t - b.t);
  const before = gs.filter((g) => g.t < t0).pop(), vals = [...(before ? [before] : []), ...gs.filter((g) => g.t >= t0)].map((g) => g.r);
  return sparkline(vals, 'Ton Elo sur les 30 derniers jours') || 'points';
}
function weekDots() {
  const played = {}; for (const g of S.data?.games || []) { const k = dkey(new Date(g.t * 1000)); played[k] = (played[k] || 0) + 1; }
  const today = dkey();
  return `<span class="week">${progress.week().map((x) => { const p = played[x.d] || 0, lab = new Date(x.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }); return `<i class="${x.n ? 'on' : p ? 'pl' : ''}${x.d === today ? ' now' : ''}" title="${lab} : ${x.n ? pl(x.n, 'exercice') : 'pas d’entraînement'}${p ? ', ' + pl(p, 'partie') : ''}"></i>`; }).join('')}</span>`;
}
// Prochaine révision (accueil, ordinateur) : lignes d'ouverture et finales dues aujourd'hui, sinon la prochaine à venir.
function nextReview() {
  const lines = allLineKeys().map((k) => { const [id, i] = k.split(':'), o = byId(id), st0 = progress.lineState(k); return st0 && { due: st0.due, href: lineHref(k), t: `${o.nom} : ${o.lines[+i].n}`, k: 'Ligne' }; });
  const fins = ENDGAMES.map((e) => { const st0 = progress.endgameState(e.id); return st0 && { due: st0.due, href: '#finale/' + e.id, t: e.t, k: 'Finale' }; });
  const all = [...lines, ...fins].filter(Boolean).sort((a, b) => a.due - b.due), now = Date.now(), due = all.filter((x) => x.due <= now);
  // Encart cliquable, sixième de la carte de l'objectif : la page d'accueil n'a pas de place pour une ligne de plus.
  const box = (lab, v, sub, href, tip, cls = '') => `<a class="glt revue" href="${href}" title="${esc(tip)}"><span class="small">${lab}</span><b class="num ${cls}">${v}</b><span class="small">${esc(sub)}</span></a>`;
  if (due.length) return box('À réviser', due.length, `${due[0].k} · ${due[0].t}`, due[0].href, due.map((x) => `${x.k} : ${x.t}`).join('\n'), 'warn');
  if (all.length) { const x = all[0], d = Math.max(1, Math.ceil((x.due - now) / DAY)); return box('Prochaine révision', `${d} j`, `${x.k} · ${x.t}`, x.href, `${x.k} : ${x.t}`); }
  return box('Révisions', '—', 'Apprends une ligne', '#ouvertures/apprendre', 'Une ligne apprise revient ici le jour où il faut la réviser');
}
function sessionCard(steps, nDone) {
  const cur = steps.find((x) => !x.done), all = nDone === steps.length;
  const dots = `<ol class="stepper">${steps.map((x) => `<li>${stepLink(x, x.done ? 'done' : x === cur ? 'on' : '', `<i aria-hidden="true">${x.done ? '✓' : ''}</i>${STEP_SHORT[x.k]}`)}</li>`).join('')}</ol>`;
  let body;
  if (cur) {
    const lab = cur.cta ? (cur.done ? 'Refaire' : cur.cta[0]) : '';
    body = `<div class="now"><b>${cur.t}</b><span>${esc(cur.d)}</span>${cur.x || (cur.p > 0 && cur.p < 1 ? `<span class="goalbar"><i style="width:${100 * cur.p}%"></i></span>` : '')}</div>
      <div class="row">${cur.cta ? stepLink(cur, 'btn pri lg', lab) : ''}${cur.k === 'play' ? '<button class="btn" data-act="refresh">J’ai joué, mettre à jour</button>' : ''}</div>`;
  } else {
    const redo = failedToday().length, lines = progress.linesDue(allLineKeys()).length;
    body = coach('Séance bouclée. Reviens demain : les puzzles réussis reviendront au bon moment pour ancrer le réflexe.')
      + (redo || lines ? `<div class="row">${redo ? `<button class="btn" data-act="pzredo">Refaire mes ${pl(redo, 'raté')} du jour</button>` : ''}${lines ? `<a class="btn" href="${lineHref(progress.linesDue(allLineKeys())[0])}">Réviser ${pl(lines, 'ligne')} d’ouverture</a>` : ''}</div>` : '');
  }
  // Sur ordinateur, le programme complet sous le bouton : chaque étape, son état, sa consigne.
  const prog = `<ul class="dayplan d-only">${steps.map((x) => `<li class="${x.done ? 'done' : x === cur ? 'on' : ''}"><i aria-hidden="true">${x.done ? '✓' : ''}</i><span><b>${x.t}${x === cur ? ' <span class="chip">en cours</span>' : ''}</b>${x === cur ? '' : `<span>${esc(x.d)}</span>`}</span></li>`).join('')}</ul>`;
  return `<section class="card today"><div class="row d-flex" style="justify-content:space-between"><h2>${all ? 'Séance du jour terminée' : 'Ta séance du jour'}</h2><span class="chip ${all ? 'good' : ''}">${nDone} / ${steps.length}</span></div>${dots}${body}${prog}</section>`;
}
// Mot du coach : ce que je vois dans tes parties, ce qu'on fait aujourd'hui, à quoi on saura que ça marche (brief.js).
// Le détail chiffré reste dans « Mon jeu ».
const STEP_NEXT = { dr: 'l’échauffement', pz: 'les puzzles de ton chantier', les: 'ton cours', play: 'tes 2 parties' };
// Partie récente à faire juger par l'élève (« As-tu appliqué la règle ? ») : la dernière partie analysée de la cadence
// suivie, jouée depuis le début du chantier et depuis moins de 3 jours. ans : réponse déjà donnée (null sinon).
function selfGame(fc) {
  const g = S.data.games.filter((x) => x.tc === targetTc() && S.an[x.id] && !S.an[x.id].bad && x.t >= fc.since && x.t * 1000 > Date.now() - 3 * DAY).sort((x, y) => y.t - x.t)[0];
  return g ? { g, ans: progress.selfOf(g.id) } : null;
}
function briefCard(fc, steps) {
  if (!fc) return '';
  const fs = focusStats(fc), cur = steps.find((x) => !x.done), th = st.THEMES[fc.id], sg = selfGame(fc);
  if (sg && !sg.ans) return `<section class="card fmini brief"><span class="hlab">Le mot du coach · ta partie contre ${esc(sg.g.opp)}</span>
    <span class="selfrow"><span class="bdiag">As-tu appliqué ta règle dans cette partie ?<span class="d-only"> « ${esc(RULES[fc.id])} »</span></span>
    <span class="selfq"><button class="btn" data-act="selfck" data-id="${esc(sg.g.id)}" data-v="1">Oui</button><button class="btn" data-act="selfck" data-id="${esc(sg.g.id)}" data-v="0">Non</button></span></span></section>`;
  const gs = S.data.games.filter((g) => g.tc === targetTc());
  const b = coachBrief({ facts: briefFacts(gs, S.an, fc.id), theme: th, rule: RULES[fc.id], fs, cause: progress.causes(), next: cur ? STEP_NEXT[cur.k] : null });
  const w = programWeek(fc.since);
  // Réponse du jour à « As-tu appliqué la règle ? » : le verdict de l'analyse remplace le diagnostic pendant 20 heures.
  if (sg?.ans && Date.now() - sg.ans.t < 20 * 3600000) b.diag = selfVerdict(sg.ans.y, S.an[sg.g.id].errs.filter((e) => e.theme === fc.id && e.kind !== 'imprecision').map(moveNo), th);
  // Le lundi, le bilan de la semaine passée remplace le diagnostic.
  else if (new Date().getDay() === 1 && w.i >= 1) b.diag = reviewText(weekStats({ games: gs, an: S.an, hist: progress.hist(), themeId: fc.id, from: w.prev, to: w.start }), weekStats({ games: gs, an: S.an, hist: progress.hist(), themeId: fc.id, from: w.prev - 7 * DAY, to: w.prev }), th);
  const stage = w.i < 4 ? ` Semaine ${w.i + 1} sur 4 : ${STAGES[w.i].t.toLowerCase()}.` : '';
  return `<a class="card fmini brief" href="#bilan"><span class="hlab">Le mot du coach · chantier ${esc(th.toLowerCase())}${fs.ok ? ' <span class="chip good">validé</span>' : ''}<span class="chev" aria-hidden="true">›</span></span>
    <span class="bdiag">${esc(b.diag)}</span><span class="btodo d-only">${esc(b.todo + stage)}</span><span class="sub fnums">${esc(b.goal)}</span></a>`;
}
// Dernière partie de la cadence suivie : résultat et pire faute, à revoir ou à rejouer en un clic.
// Dernière partie de la cadence suivie : résultat et pire faute, à revoir ou à rejouer en un clic.
// Fil des gaffes (review.gaffeTrail) : flèches pour remonter dans les parties, une gaffe par clic ; « Gaffe 2 sur 3 »
// quand une partie en a plusieurs. S.lg : étape affichée (0 = la plus récente).
function lastGameCard() {
  const trail = gaffeTrail(S.data.games, S.an, targetTc());
  if (!trail.length) return '';
  const k = Math.max(0, Math.min(trail.length - 1, S.lg || 0)), { g, e, i, n, pending } = trail[k], a = S.an[g.id];
  const out = g.out === 'W' ? ['good', 'Victoire'] : g.out === 'L' ? ['bad', 'Défaite'] : ['', 'Nulle'];
  const body = pending ? (S.job.running ? skel('Analyse en cours', 80, 55) : '<span class="sub">Pas encore analysée.</span>')
    : !e ? `<span class="sub">Aucune gaffe ni erreur grave${a.acc != null ? `, précision ${a.acc.toFixed(0)} %` : ''}.</span>`
    : `<span class="lgerr"><span class="chip ${e.kind === 'gaffe' ? 'bad' : 'warn'}">${e.kind !== 'gaffe' ? 'Erreur' : n > 1 ? `Gaffe ${i} sur ${n}` : 'Gaffe'}</span><span>Coup ${moveNo(e)} : <b>${esc(fr(e.played))}</b>, il fallait <b>${esc(fr(e.bestSan))}</b></span></span>`;
  const head = `<span class="htitle"><span class="chip ${out[0]}">${out[1]}</span> contre ${esc(g.opp)} <span class="sub">(${g.or}), ${g.w ? 'Blancs' : 'Noirs'}<span class="m-only-i">, ${dfmt(g.t)}</span></span></span>`;
  // Ordinateur : la position de la faute, coup joué en rouge (la solution reste à trouver dans « Rejouer l'erreur »).
  const pos = e ? `<a class="lgpos d-only" href="#partie/${g.t}/${e.ply}" aria-label="Position avant ${esc(fr(e.played))}"><span class="board" id="lgb" data-t="${g.t}" data-ply="${e.ply}"></span></a>` : '';
  const nav = (d, lab, icon) => `<button class="btn ico" data-act="lgnav" data-d="${d}" aria-label="${lab}" title="${lab}" ${k + d < 0 || k + d >= trail.length ? 'disabled' : ''}>${ico(icon)}</button>`;
  const mid = e ? `<a class="btn" href="#partie/${g.t}/${e.ply}"><span class="d-only">Voir mon coup</span><span class="m-only">Mon coup</span></a><a class="btn" href="#erreur/${g.t}/${e.ply}"><span class="d-only">Rejouer l’erreur</span><span class="m-only">Rejouer</span></a>`
    : `<a class="btn wide" href="#partie/${g.t}">Revoir la partie</a>`;
  return `<section class="card lgame"><span class="hlab d-flex">${k ? `Partie du ${dfmt(g.t)}` : 'Ta dernière partie'}<span class="small">${k + 1} / ${trail.length}${!k ? ` · ${dfmt(g.t)}` : ''}${a && !a.bad ? ` · <a href="#partie/${g.t}/d">Débrief</a>` : ''}</span></span>
    ${e ? `<div class="lgrow">${pos}<div class="lgtxt">${head}${body}</div></div>` : head + body}
    <div class="lgbtn">${nav(-1, 'Gaffe plus récente', 'prev')}${mid}${nav(1, 'Gaffe plus ancienne', 'next')}</div></section>`;
}
// Mini-échiquier de la dernière partie : non interactif, créé seulement s'il est affiché (ordinateur).
function mountAccueil() {
  const el = $('#lgb');
  if (!el || !el.offsetWidth || el.firstChild) return;
  const g = S.data.games.find((x) => String(x.t) === el.dataset.t), e = g && S.an[g.id]?.errs.find((x) => x.ply === +el.dataset.ply);
  if (!e) return;
  board(el, { fen: e.fen, orientation: g.w ? 'white' : 'black', viewOnly: true, coordinates: false, shapes: [arrow(e.playedUci, 'red')].filter(Boolean) });
}
function viewAccueil() {
  const { steps, fc, nDone } = session();
  return `<div class="home">${goalStrip()}${sessionCard(steps, nDone)}<div class="hside">${briefCard(fc, steps)}${lastGameCard()}</div></div>`;
}

// ---------- Mon jeu : objectif, chantier, points forts et faibles, tendance, bilan ----------
// Quand et comment tu perds (insights.js, comme les « Insights » de Chess.com) : phase, pièce, heure, rang dans la session.
// Calcul gardé tant que les parties et les analyses ne changent pas (la phase demande de rejouer chaque partie).
let insMemo = { key: '', v: null };
function insightsOf(gs) {
  const key = gs.length + ':' + (gs[gs.length - 1]?.t || 0) + ':' + Object.keys(S.an).length + ':' + S.f.tc + ':' + S.f.days;
  if (insMemo.key !== key) insMemo = { key, v: { phases: phaseStats(gs, S.an), pieces: pieceStats(gs, S.an), hours: hourStats(gs), sessions: sessionStats(gs) } };
  return insMemo.v;
}
function insightsCard(gs) {
  const I = insightsOf(gs), lines = insightText(I), every = (r) => (r ? `1 tous les ${Math.round(1 / r)} coups` : 'aucune');
  const row = (label, n, val, cls = '') => `<tr><td>${label}</td><td class="r small">${n}</td><td class="r ${cls}"><b>${val}</b></td></tr>`;
  const sc = (x) => (x.n >= 5 ? (x.score >= 55 ? 'ok' : x.score <= 42 ? 'ko' : '') : '');
  const pcs = I.pieces.filter((p) => p.moves >= 10).slice(0, 4);
  return `<div class="card"><h2>Quand et comment tu perds <span class="small">${TC[S.f.tc] || 'toutes cadences'}</span></h2>
    ${lines.length ? `<div class="stack">${lines.map((t) => `<p class="ins">${esc(t)}</p>`).join('')}</div>` : '<p class="small">Pas encore d’écart net : il faut au moins 8 parties de chaque côté pour en tirer une règle.</p>'}
    <div class="grid ins-grid">
      <div><h3>Par phase <span class="small">fautes graves</span></h3><table><tbody>${I.phases.map((x) => row(x.label, x.n ? x.n + ' coups' : '—', x.n ? every(x.rate) : '—')).join('')}</tbody></table></div>
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
  return `<h1>Mon jeu</h1>
  <div class="hero">${gb.html}
    <div class="card"><h2>Ton classement ${S.f.tc === 'all' ? 'Rapide' : TC[S.f.tc]}</h2><div class="chart" id="rc"></div></div></div>
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
  ${insightsCard(gs)}` : `<div class="card"><p class="sub">Aucune partie pour ce filtre (${TC[S.f.tc]}). Change la cadence ou la période.</p></div>`}`;
}
function mountBilan() {

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

function keyForm() {
  return `<form data-form="key" class="row"><input type="text" id="keyin" placeholder="sk-ant-…" autocomplete="off" spellcheck="false" style="flex:1;min-width:200px" aria-label="Clé API Anthropic"><button class="btn">Activer le coach</button></form>
    <p class="small">Crée une clé sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. Elle reste sur cet appareil et n’est envoyée qu’à l’API Claude. Un cours coûte quelques centimes.</p>`;
}
function viewCours() {
  const { ids, es } = priorityLessons();
  const read = progress.lessonsRead();
  const cnt = Object.fromEntries(es.themes.map((t) => [t.id, t.n]));
  const card = (id, prio) => `<a class="card lesson" href="#cours/${id}">
    <div class="row">${prio ? `<span class="chip bad">Priorité ${prio}</span>` : ''}${S.ai[id] ? '<span class="chip good">Cours privé prêt</span>' : ''}${read[id] ? '<span class="chip">Terminé</span>' : ''}</div>
    <h2>${esc(S.ai[id]?.titre || LESSONS[id].titre)}</h2>
    <p class="sub">${cnt[id] ? `${cnt[id]} exemple${cnt[id] > 1 ? 's' : ''} dans tes parties. ` : ''}${LESSONS[id].principe.split('. ')[0]}.</p></a>`;
  const others = Object.keys(LESSONS).filter((id) => !ids.includes(id));
  return `${LEARN_TABS('cours')}<h1>Cours</h1>
    ${coachKey() ? coach('Je prépare chaque cours à partir de tes propres positions : une idée, tes erreurs à rejouer, une règle à emporter. Ouvre un cours et demande-moi de le préparer.')
    : `<div class="card"><h2>Ton coach privé</h2><p class="prose">Chaque cours peut devenir une leçon particulière : Claude étudie tes positions, te pose les bonnes questions avant de te laisser jouer, puis t’explique pourquoi ton coup échouait. Deux façons de faire : avec ton abonnement Claude (un copier-coller, proposé dans chaque cours), ou en un clic avec une clé API facturée à l’usage.</p><details class="manual"><summary>Activer la génération en un clic (clé API)</summary>${keyForm()}</details></div>`}
    ${ids.length ? `<h2>Tes priorités</h2><div class="grid">${ids.map((id, i) => card(id, i < 3 ? i + 1 : 0)).join('')}</div>` : S.job.running ? `<h2>Tes priorités</h2><div class="grid">${[0, 1, 2].map((i) => `<div class="card">${skel(i ? '' : 'Analyse en cours : le classement des cours arrive.', 30, 75, 90, 60)}</div>`).join('')}</div>` : '<div class="card"><p class="sub">Lance l’analyse de tes parties pour classer les cours selon tes erreurs.</p></div>'}
    <h2>Autres cours</h2><div class="grid">${others.map((id) => card(id, 0)).join('')}</div>`;
}

function lessonNumbers(id, gs) {
  const row = (a, b) => `<dt>${a}</dt><dd>${b}</dd>`;
  if (id === 'temps') {
    const t = st.timeStats(gs), ce = st.clockErrors(gs, S.an), r = (b) => (b.n >= 10 ? `${st.pct(b.bad, b.n)} % de tes coups (${b.n} coups)` : 'trop peu de coups');
    return row('Défaites au temps', `${t.flag} sur ${t.losses} (${st.pct(t.flag, t.losses)} %)`) + (t.leftLoss != null ? row('Temps restant à la fin d’une défaite type', Math.round(t.leftLoss * 100) + ' %') : '')
      + (ce.games ? row('Erreurs graves avec moins d’une minute', r(ce.left[3])) + row('Erreurs graves avec plus de 5 minutes', r(ce.left[0])) + row('Erreurs graves sur les coups joués en moins de 5 s', r(ce.think[0])) + row('Erreurs graves quand tu prends plus de 15 s', r({ n: ce.think[2].n + ce.think[3].n, bad: ce.think[2].bad + ce.think[3].bad })) : '');
  }
  if (id === 'tilt') { const t = st.tilt(gs); return row('Score après une victoire', `${st.score(t.afterW)} % (${t.afterW.n} parties)`) + row('Score après une défaite', `${st.score(t.afterL)} % (${t.afterL.n} parties)`) + row('Plus longue série de défaites', t.streakMax); }
  if (id === 'principes' || id === 'ouverture') { const h = st.habits(gs); return row('Score quand tu roques tôt', `${st.score(h.castled)} % (${h.castled.n} parties)`) + row('Score sans roque avant le 12e coup', `${st.score(h.notCastled)} % (${h.notCastled.n} parties)`) + row('Score avec la dame sortie avant le 7e coup', `${st.score(h.earlyQ)} % (${h.earlyQ.n} parties)`); }
  if (id === 'conversion') { const e = st.engineStats(gs, S.an); return row('Parties avec au moins +5 d’avantage', e.ahead) + row('Gagnées', `${e.converted} (${st.pct(e.converted, e.ahead)} %)`); }
  return '';
}
function lessonExamples(id) {
  const gs = games().slice().sort((a, b) => b.t - a.t), out = [];
  for (const g of gs) {
    const a = S.an[g.id]; if (!a) continue;
    for (const e of a.errs) if (e.theme === id) out.push({ g, e });
    if (out.length >= 30) break;
  }
  return out.sort((x, y) => y.e.drop - x.e.drop).slice(0, 4);
}
function lessonArgs(id) {
  const ex = ENGINE_LESSONS.includes(id) ? lessonExamples(id) : [];
  const numbers = lessonNumbers(id, games()).replace(/<\/dd>/g, '\n').replace(/<[^>]+>/g, ' ').trim();
  return { ex, args: { theme: st.THEMES[id] || LESSONS[id].titre, base: LESSONS[id], elo: st.trend(rapidAll())?.cur, goal: goal().elo, numbers, examples: ex.map((x) => facts(x.g, x.e)) } };
}
// Sans clé API : le brief part dans une conversation Claude (abonnement), la réponse revient par copier-coller.
function manualBlock(id) {
  return `<details class="manual" ${coachKey() ? '' : 'open'}><summary>Avec ton abonnement Claude, sans clé API</summary><ol class="routine">
      <li><button class="btn" data-act="brief" data-id="${id}">Copier le brief du cours</button> <span class="small" id="briefok"></span></li>
      <li>Colle-le dans une nouvelle conversation Claude (app ou claude.ai) et envoie.</li>
      <li>Copie toute la réponse de Claude et colle-la ici :<form data-form="paste" data-id="${id}" class="stack" style="margin-top:8px"><textarea id="pastein" rows="4" placeholder="Réponse de Claude (elle commence par une accolade)" aria-label="Réponse de Claude"></textarea><div><button class="btn">Importer le cours</button> <span class="err" id="pasteerr"></span></div></form></li></ol>
      <textarea id="briefraw" rows="6" hidden readonly aria-label="Brief à copier"></textarea></details>`;
}
async function genCourse(id) {
  if (S.gen && !S.gen.err) return;
  S.gen = { id }; render(true);
  try {
    const { ex, args } = lessonArgs(id);
    const L = await genLesson(args);
    L.ex = ex.map((x) => ({ t: x.g.t, ply: x.e.ply }));
    S.ai[id] = L; await dbSet('ai:' + S.user, S.ai);
    S.gen = null; S.cl = null;
  } catch (e) { S.gen = { id, err: e.message || String(e) }; }
  if (route()[0] === 'cours') bgRender();
}
function resolveEx(r) {
  const g = r && S.data.games.find((x) => x.t === r.t);
  const e = g && S.an[g.id]?.errs.find((x) => x.ply === r.ply);
  return e ? { g, e } : null;
}
function viewCoachLesson(id, L) {
  if (!S.cl || S.cl.id !== id) S.cl = { id, step: 0, quiz: {} };
  const steps = ['intro', ...L.positions.map((_, i) => 'p' + i), 'methode', ...(L.quiz.length ? ['quiz'] : [])];
  const k = Math.min(S.cl.step, steps.length - 1), stp = steps[k];
  const seg = `<div class="seg" role="progressbar" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${k + 1}">${steps.map((_, i) => `<i class="${i < k ? 'done' : i === k ? 'cur' : ''}"></i>`).join('')}</div>`;
  const head = `<p class="small"><a href="#cours">Tous les cours</a> · <a href="#cours/${id}/fiche">Fiche classique</a></p><h1>${esc(L.titre)}</h1>${seg}`;
  const next = (label = 'Continuer', hidden = false) => `<div><button class="btn pri lg" data-act="clnext" id="clnext" ${hidden ? 'hidden' : ''}>${label}</button></div>`;
  S.clPos = null;
  if (stp === 'intro') {
    return head + coach(txt(L.accroche)) + `<div class="card"><h2>L’idée du cours</h2><p class="prose">${txt(L.idee)}</p></div>
      <div class="row">${next(L.positions.length ? 'Commencer par ma première position' : 'Continuer')}<button class="btn" data-act="gen" data-id="${id}">Régénérer le cours</button></div>`;
  }
  if (stp[0] === 'p') {
    const i = +stp.slice(1), pos = L.positions[i], x = resolveEx(L.ex[pos.i]);
    if (!x) return head + `<div class="card"><p class="sub">Cette position n’est plus disponible dans tes analyses.</p></div>` + next();
    S.clPos = { x, pos };
    const me = x.g.w ? 'w' : 'b', lm = lastMoveText(x.g, x.e.ply, me);
    return exo.screen({
      live: true, exit: '<button class="btn" data-act="clnext">Continuer ›</button>',
      head: `<i class="xwide" hidden></i>${head}` + coach(`<b>Position ${i + 1} sur ${L.positions.length}.</b> Coup ${moveNo(x.e)} de ta ${gameRef(x.g)}. ${lm ? esc(lm) + ' ' : ''}<br>${txt(pos.question)}`),
      cap: `<p><i class="dot ${x.g.w ? 'w' : 'b'}"></i> <span class="m-txt"><b>Position ${i + 1} sur ${L.positions.length}.</b> ${txt(pos.question)} </span>Trait aux ${x.g.w ? 'Blancs' : 'Noirs'}.<span class="d-txt"> Joue le coup que tu aurais dû jouer.</span></p>`,
      panel: `<div id="clx" hidden>${coach(`${txt(pos.explication)}<br><b>À retenir :</b> ${txt(pos.retenir)}`)}</div>
        <div id="clp"></div>
        ${coachKey() ? `<form data-form="ask" class="row"><input type="text" id="askq" placeholder="Une question sur cette position ?" style="flex:1;min-width:180px" aria-label="Question au coach"><button class="btn">Demander au coach</button></form><div id="aska"></div>` : ''}`,
      bar: SOLVE_BAR,
    });
  }
  if (stp === 'methode') {
    return head + `<div class="card rule"><span class="small">La règle du cours</span><p class="rulet">${txt(L.regle)}</p></div>
      <div class="card"><h2>Ta routine avant chaque coup</h2><ol class="routine">${L.methode.map((m) => `<li>${txt(m)}</li>`).join('')}</ol></div>` + next(L.quiz.length ? 'Vérifier que j’ai compris' : 'Terminer le cours');
  }
  const answered = Object.keys(S.cl.quiz).length;
  return head + L.quiz.map((q, qi) => {
    const a = S.cl.quiz[qi];
    return `<div class="card"><h2>${qi + 1}. ${txt(q.q)}</h2><div class="stack">${q.choix.map((c, ci) => `<button class="btn choice ${a != null && ci === q.bonne ? 'right' : ''} ${a === ci && ci !== q.bonne ? 'wrong' : ''}" data-act="clq" data-q="${qi}" data-c="${ci}" ${a != null ? 'disabled' : ''}>${txt(c)}</button>`).join('')}</div>
      ${a != null ? `<div class="fb ${a === q.bonne ? 'ok' : 'ko'}"><b class="${a === q.bonne ? 'ok' : 'ko'}">${a === q.bonne ? 'Exact.' : 'Pas tout à fait.'}</b> ${txt(q.pourquoi || '')}</div>` : ''}</div>`;
  }).join('') + (answered >= L.quiz.length ? next('Terminer le cours') : '');
}
function mountCoachLesson() {
  const X = exo.current(), c = S.clPos;
  if (!X || !c) return;
  getLines(c.x.g, c.x.e);
  const api = solveBoard(X, c.x.g, c.x.e, { hintText: c.pos.indice, done: (res, first, html, exact) => {
    $('#clx').hidden = false;
    const id = c.x.g.t + ':' + c.x.e.ply;
    if (first) pzRecord({ id, e: c.x.e }, res);
    explainUI(X, { g: c.x.g, e: c.x.e, api, panel: $('#clp'), verdict: html, exact, rate: res === 2 ? id : null });
  } });
}
function viewLecon(id, mode) {
  const L = LESSONS[id];
  if (!L) return viewCours();
  if (S.ai[id] && mode !== 'fiche' && !(S.gen && S.gen.id === id && !S.gen.err)) return viewCoachLesson(id, S.ai[id]);
  const gs = games(), ex = ENGINE_LESSONS.includes(id) ? lessonExamples(id) : [];
  const nums = lessonNumbers(id, gs);
  const blown = id === 'conversion' ? gs.filter((g) => S.an[g.id]?.maxAdv >= 500 && g.out !== 'W').slice(-6).reverse() : [];
  const read = progress.lessonsRead();
  const busy = S.gen && S.gen.id === id && !S.gen.err;
  S.lessonEx = ex;
  const coachCard = busy ? coach('Je prépare ton cours à partir de tes positions. Compte 20 à 40 secondes.') + `<div class="card">${skel('', 40, 95, 85, 70)}</div>`
    : S.ai[id] ? `<div><a class="btn pri lg" href="#cours/${id}">Revenir au cours privé</a></div>`
    : coachKey() ? `<div class="card"><h2>Cours privé</h2><p class="prose">Claude prépare une leçon particulière sur ce thème à partir de ${ex.length ? `tes ${ex.length} positions les plus coûteuses` : 'tes statistiques'} : questions guidées, explications, règle à retenir, quiz.</p>
        ${S.gen?.id === id && S.gen.err ? `<p class="err">${esc(S.gen.err)}</p>` : ''}<div><button class="btn pri lg" data-act="gen" data-id="${id}">Préparer mon cours privé</button></div>${manualBlock(id)}</div>`
    : `<div class="card"><h2>Cours privé par Claude</h2><p class="prose">Claude transforme cette fiche en leçon particulière construite sur tes positions : questions guidées, explications, règle à retenir, quiz.</p>${manualBlock(id)}
      <details class="manual"><summary>Ou en un clic, avec une clé API (payante à l’usage)</summary>${keyForm()}</details></div>`;
  return `<p class="small"><a href="#cours">Tous les cours</a></p><h1>${L.titre}</h1>${coachCard}
  <div class="card"><h2>Le principe</h2><p class="prose">${L.principe}</p>
    ${nums ? `<h3>Tes chiffres</h3><dl class="kv prose">${nums}</dl>` : ''}
    <h3>La routine à appliquer</h3><ol class="routine">${L.routine.map((r) => `<li>${r}</li>`).join('')}</ol></div>
  ${ex.length ? `<div class="card"><h2>Dans tes parties</h2><p class="small">Flèche rouge : ton coup. Flèche verte : le meilleur coup.</p>
    ${ex.map((x, i) => `<div class="ex"><div class="board mini" data-mini="${i}"></div><div class="stack">
      <b>Coup ${moveNo(x.e)}, ${gameRef(x.g)}</b><p class="prose">${explain(x.e)}</p>
      <span class="row"><span class="chip bad">−${x.e.drop} pts de chances de gain</span><a class="btn sm" href="#erreur/${x.g.t}/${x.e.ply}">Travailler cette position</a><a class="btn sm" href="#partie/${x.g.t}/${x.e.ply}">Revoir dans la partie</a></span></div></div>`).join('')}
    <div><button class="btn" data-act="pztheme" data-theme="${id}">M’entraîner sur ce thème</button></div></div>`
    : ENGINE_LESSONS.includes(id) ? '<div class="card"><p class="sub">Aucun exemple de ce type dans tes parties analysées. Soit tu ne fais pas cette erreur, soit il faut analyser davantage de parties.</p></div>' : ''}
  ${blown.length ? `<div class="card"><h2>Parties qui t’ont échappé</h2><div><a class="btn" href="#gagner">Les rejouer pour les gagner</a></div>${blown.map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or})</span><span class="chip ${g.out === 'L' ? 'bad' : ''}">${g.out === 'L' ? 'Défaite' : 'Nulle'}</span></a>`).join('')}</div>` : ''}
  <div class="row">${read[id] ? nextStep('les') : ''}<button class="btn ${read[id] ? '' : 'pri'}" data-act="lu" data-id="${id}">${read[id] ? 'Marquer comme non terminé' : 'J’ai compris, marquer comme terminé'}</button></div>`;
}
function mountLecon() {
  mountCoachLesson();
  document.querySelectorAll('[data-mini]').forEach((el) => {
    const x = S.lessonEx[+el.dataset.mini];
    board(el, { fen: x.e.fen, orientation: x.g.w ? 'white' : 'black', viewOnly: true, coordinates: false, shapes: errShapes(x.e) });
  });
}

function verdict(o) {
  if (o.n < 5) return '<span class="chip">Trop peu de parties</span>';
  const s = st.score(o);
  return s >= 55 ? '<span class="chip good">À garder</span>' : s <= 42 ? '<span class="chip bad">À travailler</span>' : '<span class="chip">Correct</span>';
}
function viewOuvertures() {
  const gs = games(), ops = st.openings(gs, S.white);
  const exitEval = (fam) => {
    const v = gs.filter((g) => g.w === S.white && g.fam === fam && S.an[g.id]?.ev.length > 20).map((g) => (g.w ? 1 : -1) * S.an[g.id].ev[20]);
    return v.length >= 3 ? fmtEval(Math.round(v.reduce((a, b) => a + b, 0) / v.length)) : '';
  };
  const root = st.tree(gs, S.white); let node = root; const ch = new Chess();
  const path = [];
  // Au-delà de tes parties (coup choisi dans l'explorateur Lichess), la ligne continue avec un nœud vide.
  for (const s of S.path) { if (!ch.move(s)) break; node = node.kids.get(s) || { n: 0, w: 0, d: 0, l: 0, kids: new Map() }; path.push(s); }
  S.path = path; S.exFen = ch.fen();
  const kids = [...node.kids.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const myTurn = (path.length % 2 === 0) === S.white;
  const first = S.white ? [...root.kids.entries()].sort((a, b) => b[1].n - a[1].n)[0] : null;
  const side = st.tally(gs.filter((g) => g.w === S.white));
  const crumbs = path.map((s, i) => `<button class="btn sm" data-act="expath" data-n="${i + 1}">${i % 2 === 0 ? i / 2 + 1 + '. ' : ''}${fr(s)}</button>`).join('');
  const reps = st.repeatedErrors(gs, S.an).slice(0, 6);
  const repCard = reps.length ? `<div class="card"><h2>Tes erreurs qui reviennent</h2><p class="small">Même position, même faute, dans plusieurs parties. Une position travaillée ici, c’est une erreur de moins dans toutes les parties qui y passent.</p>
    ${reps.map((r) => `<div class="hrow"><i class="dot ${r.w ? 'w' : 'b'}"></i><span class="stepc"><b>${esc(st.lineText(r.line, Math.max(0, r.line.length - 6)))}</b><span>${r.games} parties : ${esc(st.repText(r))}</span></span><a class="btn sm" href="#erreur/${r.last.g.t}/${r.last.e.ply}">Travailler</a></div>`).join('')}</div>` : '';
  return `${GAMES_TABS('ouv')}<div class="row" style="justify-content:space-between"><h1>Ouvertures</h1><div class="row" role="group" aria-label="Couleur">
    <button class="btn ${S.white ? 'on' : ''}" aria-pressed="${!!S.white}" data-act="color" data-w="1"><i class="dot w"></i>Blancs</button><button class="btn ${S.white ? '' : 'on'}" aria-pressed="${!S.white}" data-act="color" data-w="0"><i class="dot b"></i>Noirs</button></div></div>
  ${repCard}
  <div class="card"><h2>Tes ouvertures avec les ${S.white ? 'Blancs' : 'Noirs'} <span class="small">${side.n} parties, ${st.score(side)} % de score</span></h2>
    ${ops.length ? `<div class="scroll"><table><thead><tr><th>Ouverture</th><th class="r">Parties</th><th>Résultats</th><th class="r">Score</th><th class="r" title="Évaluation moyenne du moteur après 10 coups, de ton point de vue">Après 10 coups</th><th>Verdict</th></tr></thead><tbody>
    ${ops.slice(0, 12).map((o) => `<tr class="click" data-act="opfam" data-fam="${esc(o.fam)}" title="Détail de cette ouverture"><td><b>${esc(o.fam)}</b> <span class="chev" aria-hidden="true">›</span>${o.vars.size > 1 ? `<br><span class="small">${[...o.vars.values()].sort((a, b) => b.n - a.n).slice(0, 2).map((v) => esc(v.op.replace(o.fam, '').trim() || 'ligne principale') + ' (' + v.n + ')').join(', ')}</span>` : ''}</td>
      <td class="r">${o.n}</td><td style="min-width:110px">${wdl(o)}</td><td class="r"><b>${st.score(o)} %</b></td><td class="r">${exitEval(o.fam)}</td><td>${verdict(o)}</td></tr>`).join('')}
    </tbody></table></div>${WDL_LEGEND}<p class="small">Touche une ouverture pour son détail : usage dans le temps, suites jouées, erreurs, dernières parties.</p>` : '<p class="sub">Aucune partie avec cette couleur pour ce filtre.</p>'}</div>
  <div class="split"><div class="board" id="exb"></div>
    <div class="card"><h2>Explorateur de tes parties</h2>
      <div class="row"><button class="btn sm" data-act="expath" data-n="0">Début</button>${crumbs}</div>
      <p class="small">${node.n} partie${node.n > 1 ? 's' : ''} dans cette position, ${st.score(node)} % de score. ${kids.length ? (myTurn ? 'Tes coups ici :' : 'Les réponses de tes adversaires :') : ''}</p>
      ${kids.length ? `<table><tbody>${kids.map(([s, k]) => `<tr class="click" data-act="exmove" data-san="${esc(s)}"><td><b>${fr(s)}</b></td><td class="r">${k.n}</td><td style="width:40%">${wdl(k)}</td><td class="r">${st.score(k)} %</td></tr>`).join('')}</tbody></table>` : `<p class="sub">${node.n ? 'Fin des coups enregistrés pour cette ligne.' : 'Tu n’as jamais eu cette position.'}</p>`}
      <h3 class="lexh">À ton niveau sur Lichess</h3><div id="lexp" aria-live="polite"><p class="small">Chargement…</p></div>
    </div></div>
  <div class="card"><h2>Répertoire conseillé sous 1000</h2><div class="row"><a class="btn pri sm" href="#ouvertures/italienne">Apprendre l’italienne</a><a class="btn sm" href="#ouvertures/gambitdame">Apprendre le gambit Dame</a></div><div class="prose stack">
    ${first ? `<p>Tu ouvres par <b>${fr(first[0])}</b> dans ${st.pct(first[1].n, side.n)} % de tes parties avec les Blancs (${st.score(first[1])} % de score).</p>` : ''}
    <p><b>Un seul système par couleur.</b> À ce niveau, les parties se décident sur les pièces en prise, pas sur la théorie. Jouer toujours la même structure te donne des positions connues et libère du temps pour vérifier tes coups.</p>
    <p><b>Avec les Blancs :</b> 1.e4, puis Cf3, Fc4, petit roque, d3 (partie italienne). Développement naturel, roi en sécurité en cinq coups.</p>
    <p><b>Avec les Noirs contre 1.e4 :</b> 1...e5, puis Cc6, Fc5 ou Cf6, petit roque. <b>Contre 1.d4 :</b> 1...d5, puis Cf6, e6, Fe7, petit roque.</p>
    <p>Dans le tableau ci-dessus, garde les lignes marquées « À garder » et remplace celles marquées « À travailler » par ce répertoire.</p></div></div>`;
}

// Explorateur Lichess filtré par niveau (explorer.js), sous l'explorateur de tes parties : ce que jouent ici des joueurs
// de ton niveau, avec leur score. Un coup s'ajoute à la ligne explorée, même si tu ne l'as jamais joué.
async function lexpLoad(fen) {
  const el = () => (S.exFen === fen && route()[0] === 'ouvertures' && !route()[1] ? $('#lexp') : null);
  let d;
  try { d = await fetchExplorer(fen); } catch (e) { if (el()) el().innerHTML = `<p class="small">${esc(e.message)}</p>`; return; }
  const box = el(); if (!box) return;
  const r = explorerRows(d, fen.split(' ')[1]), mine = (fen.split(' ')[1] === 'w') === S.white;
  if (!r.total) { box.innerHTML = '<p class="small">Aucune partie à ce niveau dans cette position.</p>'; return; }
  box.innerHTML = `<p class="small">${r.total.toLocaleString('fr-FR')} parties (${LEVEL})${r.opening ? ` · ${esc(r.opening)}` : ''}. ${mine ? 'Score de ton camp après chaque coup.' : 'Score de ton adversaire après chaque coup.'}</p>
    <table><thead><tr><th>Coup</th><th class="r">Joué</th><th class="r">Parties</th><th class="r">Score</th></tr></thead><tbody>${r.rows.filter((x) => x.n).map((x) => { const san = d.moves.find((m) => m.uci === x.uci)?.san || ''; return `<tr class="click" data-act="exmove" data-san="${esc(san)}"><td><b>${esc(x.san)}</b></td><td class="r">${x.pct} %</td><td class="r">${x.n.toLocaleString('fr-FR')}</td><td class="r">${x.score} %</td></tr>`; }).join('')}</tbody></table>`;
}
// Liste des parties (demande du 16/11) : une ligne par partie, joueurs et Elo à gauche comme sur un échiquier
// (adversaire en haut, toi en bas), puis résultat, ouverture et chiffres. Synthèse de la sélection au-dessus.
const sgn = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x);
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function partiesSummary(gs) {
  const s = st.listSummary(gs); if (!s.n) return '';
  const tile = (lab, v, sub = '') => `<div class="glt"><span class="small">${lab}</span><b class="num">${v}</b>${sub ? `<span class="small num">${sub}</span>` : ''}</div>`;
  return `<div class="glsum">${tile('Parties', s.n, `${s.w} V · ${s.d} N · ${s.l} D`)}${tile('Score', s.score + ' %')}
    ${s.from != null ? tile('Mon Elo', `${s.to} <span class="${s.to > s.from ? 'up' : s.to < s.from ? 'dn' : ''}">${sgn(s.to - s.from)}</span>`, `depuis ${s.from}`) : ''}
    ${s.opp ? tile('Adversaires', s.opp, 'Elo moyen') : ''}${s.perf ? tile('Performance', s.perf, 'Elo estimé') : ''}</div>${wdl(s)}`;
}
function partieRow(g, fx, allTc) {
  const a = S.an[g.id], ok = a && !a.bad, acc = ok && a.acc != null ? a.acc : g.acc;
  const nG = ok ? a.errs.filter((e) => e.kind === 'gaffe').length : null, nE = ok ? a.errs.filter((e) => e.kind === 'erreur').length : null;
  const res = g.out === 'W' ? ['good', 'Victoire'] : g.out === 'L' ? ['bad', 'Défaite'] : ['', 'Nulle'];
  const d = new Date(g.t * 1000), hh = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  // Fautes (17/11) : deux pastilles de largeur fixe, toujours présentes (0 en gris), pour qu'elles s'alignent d'une ligne à l'autre
  const flt = (n, sym, cls, lab) => `<span class="flt ${n ? cls : ''}" title="${pl(n, lab)}"><b>${n}</b>${sym}</span>`;
  const fau = !ok ? '<span class="small">non analysée</span>' : flt(nG, '??', 'bad', 'gaffe') + flt(nE, '?', 'warn', 'erreur');
  return `<a class="gl ${g.out}" href="#partie/${g.t}" aria-label="${res[1]} contre ${esc(g.opp)}, ${dfmt(g.t)}">
    <span class="gl-pl"><span class="gl-p"><i class="dot ${g.w ? 'b' : 'w'}"></i><span class="gl-n">${esc(g.opp)}</span><b class="num">${g.or || '?'}</b>${fx.gap != null ? `<span class="small num" title="Écart avec ton Elo">${sgn(fx.gap)}</span>` : ''}</span>
      <span class="gl-p me"><i class="dot ${g.w ? 'w' : 'b'}"></i><span class="gl-n">Moi</span><b class="num">${g.r || '?'}</b>${fx.d != null ? `<span class="num ${fx.d > 0 ? 'up' : fx.d < 0 ? 'dn' : ''}" title="Variation de ton Elo sur cette partie">${sgn(fx.d)}</span>` : g.rated ? '' : '<span class="small">amicale</span>'}</span></span>
    <span class="gl-res"><span class="chip ${res[0]}">${res[1]}</span><span class="small">${esc(HOW[g.how] || g.how || '')}</span></span>
    <span class="gl-meta"><span class="gl-op">${esc(g.fam)}</span><span class="gl-c num"><b>${Math.ceil(g.san.length / 2)}</b><span class="gl-u"> coups</span></span>
      <span class="gl-c num">${acc != null ? `<b>${Math.round(acc)} %</b><span class="vh"> de précision</span>` : '<span class="small">–</span>'}</span>
      <span class="gl-c gl-f">${fau}</span><span class="gl-c num">${fx.left != null ? `<b>${mmss(fx.left)}</b><span class="vh"> restant à la pendule</span>` : '<span class="small">–</span>'}</span>
      <span class="gl-d small num">${dfmt(g.t)} ${hh}${allTc ? ` · ${TC[g.tc] || g.tc}` : ''}</span></span></a>`;
}
// Détail d'une ouverture jouée (#monouv/<w|b>/<famille>) : chiffres, usage dans le temps, suites, variantes, erreurs, parties.
const famHref = (fam, w) => `#monouv/${w ? 'w' : 'b'}/${encodeURIComponent(fam)}`;
const perName = (k, unit) => (unit === 'semaine' ? 'sem. du ' + new Date(((k * 7) - 3) * 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : unit === 'mois' ? new Date(Date.UTC(Math.floor(k / 12), k % 12, 1)).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : `T${(k % 12) / 3 + 1} ${Math.floor(k / 12)}`);
const scoreChip = (s) => { const sc = st.score(s); return `<span class="chip ${s.n >= 2 && sc >= 55 ? 'good' : s.n >= 2 && sc <= 42 ? 'bad' : ''}">${sc} %</span>`; };
const resChip = (g) => `<span class="chip ${g.out === 'W' ? 'good' : g.out === 'L' ? 'bad' : ''}">${g.out === 'W' ? 'Victoire' : g.out === 'L' ? 'Défaite' : 'Nulle'}</span>`;
function viewMonOuv(c, enc) {
  let fam; try { fam = decodeURIComponent(enc || ''); } catch { fam = ''; }
  const white = c === 'w', d = st.famDetail(games(), fam, white), gs = d.games;
  const back = '<p class="small"><a href="#ouvertures">‹ Mes ouvertures</a></p>';
  if (!gs.length) return `${back}<h1>${esc(fam || 'Ouverture')}</h1><p class="sub">Aucune partie dans cette ouverture avec les ${white ? 'Blancs' : 'Noirs'} pour le filtre choisi.</p>`;
  const ch = new Chess(); for (const m of d.prefix) ch.move(m);
  S.mo = { fen: ch.fen(), white, d };
  const an = gs.map((g) => S.an[g.id]).filter((a) => a && !a.bad);
  const avg = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const acc = avg(an.filter((a) => a.acc != null).map((a) => a.acc));
  const ev10 = gs.filter((g) => S.an[g.id]?.ev?.length > 20).map((g) => (white ? 1 : -1) * S.an[g.id].ev[20]);
  const opErrs = gs.flatMap((g) => { const a = S.an[g.id]; return a && !a.bad ? a.errs.filter((e) => e.ply < 24 && e.kind !== 'imprecision').map((e) => ({ g, e })) : []; });
  const themes = new Map(); for (const x of opErrs) themes.set(x.e.theme, (themes.get(x.e.theme) || 0) + 1);
  const topTh = [...themes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([t]) => st.THEMES[t]);
  const cat = OPENINGS.find((o) => (o.group === 'w') === white && gs.filter((g) => matchGame(o, g)).length * 2 >= gs.length);
  const recent = gs.slice(-6).reverse();
  const elo = Math.round(avg(gs.map((g) => g.or).filter(Boolean)) || 0);
  const exBtn = (san, label, cls = 'btn sm') => `<button class="${cls}" data-act="exline" data-w="${white ? 1 : 0}" data-san="${esc(san.join(' '))}">${label}</button>`;
  return `${back}
  <div class="ophero"><div class="board" id="mob"></div><div class="stack">
    <h1>${esc(fam)}</h1>
    <p class="opmoves">${d.prefix.length ? esc(st.lineText(d.prefix)) : 'Premiers coups variables'}</p>
    <div class="row"><span class="chip"><i class="dot ${white ? 'w' : 'b'}"></i>${white ? 'Blancs' : 'Noirs'}</span><span class="chip">${pl(gs.length, 'partie')}</span>${verdict(d.tally)}</div>
    <div class="mowdl">${wdl(d.tally)}</div>
    <div class="row">${exBtn(d.prefix, 'Explorer mes coups', 'btn pri sm')}${cat ? `<a class="btn sm" href="#ouvertures/${cat.id}">Fiche : ${esc(cat.nom)}</a>` : ''}</div></div></div>
  <div class="mogrid">
  <div class="card"><h2>En chiffres</h2><dl class="kv">
    <dt>Score</dt><dd>${st.score(d.tally)} % (${d.tally.w} V · ${d.tally.d} N · ${d.tally.l} D)</dd>
    <dt>Part de tes parties ${white ? 'avec les Blancs' : 'avec les Noirs'}</dt><dd>${st.pct(gs.length, games().filter((g) => g.w === white).length)} %</dd>
    <dt>Première et dernière fois</dt><dd>${dfmt(gs[0].t)} · ${dfmt(gs[gs.length - 1].t)}</dd>
    ${elo ? `<dt>Classement moyen des adversaires</dt><dd>${elo}</dd>` : ''}
    ${ev10.length >= 2 ? `<dt>Évaluation après 10 coups (moyenne)</dt><dd>${fmtEval(Math.round(avg(ev10)))}</dd>` : ''}
    ${acc != null ? `<dt>Précision moyenne</dt><dd>${acc.toFixed(0)} %</dd>` : ''}
    ${an.length ? `<dt>Fautes avant le 12e coup</dt><dd>${f1(opErrs.length / an.length)} par partie</dd>` : ''}
  </dl>${an.length < gs.length ? `<p class="small">${an.length} partie${an.length > 1 ? 's' : ''} analysée${an.length > 1 ? 's' : ''} sur ${gs.length} : précision et fautes portent sur celles-là.</p>` : ''}</div>
  <div class="card"><h2>Dans le temps <span class="small">par ${d.periods.unit}</span></h2><div class="chart" id="moc"></div>
    <p class="small">Nombre de parties dans cette ouverture. Survole un point pour le score et la part de tes parties.</p></div>
  </div>
  ${d.lines.length ? `<div class="card"><h2>Tes suites les plus jouées</h2><table><tbody>${d.lines.map((l) => `<tr class="click" data-act="exline" data-w="${white ? 1 : 0}" data-san="${esc(l.san.join(' '))}" title="Ouvrir dans l’explorateur"><td>${esc(st.lineText(l.san, d.prefix.length))}</td><td class="r">${l.n}</td><td style="width:28%">${wdl(l)}</td><td class="r">${scoreChip(l)}</td></tr>`).join('')}</tbody></table>
    <p class="small">Après ${d.prefix.length ? esc(st.lineText(d.prefix)) : 'le début'}. Touche une suite pour la suivre coup par coup dans l’explorateur.</p></div>` : ''}
  ${d.vars.length > 1 ? `<div class="card"><h2>Variantes</h2><table><tbody>${d.vars.map((v) => `<tr><td>${esc(v.op.replace(fam, '').trim() || 'Ligne principale')}</td><td class="r">${v.n}</td><td style="width:28%">${wdl(v)}</td><td class="r">${scoreChip(v)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  ${opErrs.length ? `<div class="card"><h2>Tes fautes dans l’ouverture</h2>${topTh.length ? `<p class="small">Le plus souvent : ${topTh.map(([t, n]) => `${st.THEMES[t]} (${n})`).join(', ')}.</p>` : ''}
    ${opErrs.slice(-4).reverse().map(({ g, e }) => `<div class="hrow"><i class="hres ${e.kind === 'gaffe' ? 'r0' : 'r1'}"></i><span class="stepc"><b>Coup ${moveNo(e)} : ${fr(e.played)} au lieu de ${fr(e.bestSan)}</b><span>${dfmt(g.t)} contre ${esc(g.opp)}${st.THEMES[e.theme] ? ' · ' + st.THEMES[e.theme] : ''}</span></span><a class="btn sm" href="#erreur/${g.t}/${e.ply}">Rejouer</a></div>`).join('')}</div>` : ''}
  <div class="card"><h2>Dernières parties</h2><div class="stack">${recent.map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or}) · ${Math.ceil(g.san.length / 2)} coups</span>${resChip(g)}</a>`).join('')}</div></div>`;
}
function mountMonOuv() {
  const P = S.mo; if (!P || !$('#mob')) return;
  board($('#mob'), { fen: P.fen, orientation: P.white ? 'white' : 'black', viewOnly: true, coordinates: false });
  const el = $('#moc'), { unit, list } = P.d.periods;
  if (el) lineChart(el, list.map((p, i) => ({ x: i, y: p.n, tip: `${perName(p.k, unit)} : ${pl(p.n, 'partie')}${p.n ? `, ${st.score(p)} % de score` : ''}${p.all ? ` (${st.pct(p.n, p.all)} % de tes parties)` : ''}` })),
    { h: 130, min: 0, label: 'Tes parties dans cette ouverture, par ' + unit, x0: perName(list[0].k, unit), x1: perName(list[list.length - 1].k, unit), yfmt: (v) => String(Math.round(v)) });
}

function viewParties() {
  const gs = games().slice().reverse(), fx = st.gameFacts(S.data?.games || []), allTc = S.f.tc === 'all';
  S.listN ||= 50;
  const head = '<div class="gl head" aria-hidden="true"><span>Joueurs et Elo</span><span>Résultat</span><span class="gl-meta"><span>Ouverture</span><span class="gl-c">Coups</span><span class="gl-c">Précision</span><span class="gl-c">Fautes</span><span class="gl-c">Pendule</span><span class="gl-d">Date</span></span></div><p class="gl-leg small">Elo : écart de l’adversaire avec toi, puis ce que la partie t’a fait gagner ou perdre. Dessous : coups, précision, temps restant, fautes (?? gaffe, ? erreur).</p>';
  return `${GAMES_TABS('parties')}<h1>Parties</h1>${gs.length ? `<div class="card">${partiesSummary(gs)}</div>` : ''}<div class="card gll">${head}
    ${gs.slice(0, S.listN).map((g) => partieRow(g, fx[g.id] || {}, allTc)).join('')}
    ${gs.length > S.listN ? '<div><button class="btn" data-act="more">Afficher 50 parties de plus</button></div>' : ''}</div>`;
}

// Symbole du coup qui mène à la position k : ?? ? ?! sur une erreur classée, ! si le joueur a trouvé le seul coup qui tenait.
// Seuls les coups du joueur sont classés ; mp vient de l'analyse stockée ou du calcul fait pendant la relecture (gvOnly).
function gvMark(v, k) {
  const i = k - 1, m = v.mv[i];
  if (!v.a || !m || (i % 2 === 0) !== v.g.w) return null;
  return moveMark(v.errAt[i], { played: m.from + m.to + (m.promotion || ''), best: v.a.best?.[i], mp: v.a.mp?.[i] || v.mp[i] });
}
// Pastille du symbole, dans le coin haut droit de la case d'arrivée (repère de chessground : la case fait 100 × 100).
const markSvg = (mk) => `<g><circle cx="81" cy="19" r="19" fill="var(--${mk.c})" stroke="var(--bg)" stroke-width="3"/><text x="81" y="20" text-anchor="middle" dominant-baseline="central" font-family="Geist Mono, monospace" font-size="${mk.s.length > 1 ? 17 : 22}" font-weight="600" fill="var(--bg)">${mk.s}</text></g>`;
// Formes de la position k : flèches, puis symbole du dernier coup.
function gvAuto(v) {
  const k = v.k, mk = gvMark(v, k);
  return [...gvShapes(v, k), ...(mk ? [{ orig: v.mv[k - 1].to, customSvg: { html: markSvg(mk) } }] : [])];
}
// « ! » : quand le joueur a joué le meilleur coup, le moteur cherche si d'autres coups tenaient (3 meilleurs coups).
// Calcul gardé en mémoire pour la partie affichée, jamais pendant une analyse en cours ; un seul à la fois.
async function gvOnly(v) {
  const i = v.k - 1, m = v.mv[i], best = v.a?.best?.[i];
  if (v.busy || S.job.running || !best || !m || v.errAt[i] || (i % 2 === 0) !== v.g.w || i in v.mp || v.a.mp?.[i]) return;
  if (m.from + m.to !== best.slice(0, 4)) return;
  v.busy = true;
  try { S.play ||= new Engine(); const r = await S.play.evalFen(v.fens[i], DEPTH, false, 3); v.mp[i] = r.lines.map((l) => l.cp); } catch { S.play = null; v.mp[i] = null; }
  v.busy = false;
  if (S.gv !== v || !v.x?.alive()) return;
  if (v.k === i + 1) v.cg.setAutoShapes(gvAuto(v)); else gvOnly(v);
}
// Meilleur coup du moteur dans la position k de la relecture (null si partie non analysée ou terminée).
function gvBest(v, k) {
  const uci = v.a?.best?.[k]; if (!uci) return null;
  const m = uciMove(new Chess(v.fens[k]), uci);
  return m ? { uci, san: m.san, played: v.mv[k] && v.mv[k].from + v.mv[k].to === uci.slice(0, 4) } : null;
}
// Flèches de la relecture : coup joué en partie depuis cette position (rouge) et meilleur coup (vert, par-dessus).
function gvShapes(v, k) {
  const e = v.errAt[k]; if (e) return errShapes(e);
  const b = gvBest(v, k); if (!b) return [];
  const m = v.mv[k];
  return [b.played || !m ? null : { orig: m.from, dest: m.to, brush: 'red' }, arrow(b.uci, 'green')].filter(Boolean);
}
// « Jouer d'ici » : reprendre la position affichée contre le moteur (#jouer), sauf partie finie.
const playB = (v) => (new Chess(gvFen(v)).game_over() ? '' : '<button class="btn sm capplay" data-act="playhere" title="Reprends cette position contre le moteur">Jouer<span class="d-txt"> d’ici</span></button>');
// Bandeau de la relecture : cls est la classe d'état du bandeau (sans « cap »).
function gvCap(v) {
  const k = v.k, g = v.g, a = v.a, e = v.errAt[k], prevErr = v.errAt[k - 1], me = g.w ? 'w' : 'b';
  if (v.db != null) { const L = gvDbList(v), m = L[v.db]; return { cls: 'db', html: `<div class="capm"><span class="capn">Débrief ${v.db + 1} / ${L.length}</span><span class="chip">${m.title}</span></div><p>${esc(m.text)}</p>` }; }
  if (v.ask?.k === k) return { cls: 'coachq', html: `<div class="capm"><span class="capn">Le coach</span><button class="btn sm gvwhy" data-act="askclose">Fermer</button></div>${v.ask.err ? `<p>${esc(v.ask.err)}</p>` : v.ask.html ? `<p>${txt(v.ask.html)}</p>` : '<p>Je regarde la position…</p>'}` };
  const askB = `<span class="capacts"><button class="btn sm capask" data-act="askpos" title="${coachKey() ? 'Demande au coach de commenter cette position' : 'Copie la question pour la coller dans Claude'}">Coach</button>${playB(v)}</span>`; // Coach et Jouer passent à la ligne ensemble
  const kindChip = (x) => `<span class="chip ${x.kind === 'gaffe' ? 'bad' : x.kind === 'erreur' ? 'warn' : ''}">${x.kind === 'gaffe' ? 'Gaffe' : x.kind === 'erreur' ? 'Erreur' : 'Imprécision'}</span>`;
  if (e) return { cls: 'ko', html: `<div class="capm"><span class="capn">Moment clé, coup ${moveNo(e)}</span>${kindChip(e)}<a class="btn pri sm gvwhy" href="#erreur/${g.t}/${e.ply}">Comprendre<span class="d-txt">cette erreur</span></a>${askB}</div><p>${explain(e)}</p>` };
  const dbB = a ? ' <button class="btn sm" data-act="dbgo" data-i="0">Débrief de la partie</button>' : '';
  const txtK = k > 0 ? moveText(g, k, me) : 'Position de départ. Avance coup par coup : chaque coup est commenté ici.';
  const b = gvBest(v, k), it = b && !b.played ? intent(v.fens[k], a.pv?.[k]?.[0] === b.uci ? a.pv[k] : [b.uci], me) : null, bestP = b ? `<span class="capbest">Meilleur <b>${fr(b.san)}</b>${b.played ? ' (joué)' : ''}</span>${!b.played && v.mv[k] ? `<span class="capbest ko">Joué <b>${fr(v.mv[k].san)}</b></span>` : ''}` : '';
  const evp = a ? `<span class="chip evnum" title="Évaluation du moteur, de ton point de vue">${fmtEval(g.w ? a.ev[k] : -a.ev[k])}</span>` : '';
  return { cls: '', html: `<div class="capm"><span class="capn">${k > 0 ? `<i class="dot ${k % 2 ? 'w' : 'b'}"></i>${Math.ceil(k / 2)}${k % 2 ? '.' : '…'} ${fr(v.mv[k - 1].san)}` : 'Début'}</span>${evp}${prevErr ? kindChip(prevErr) : ''}${bestP}${askB}</div><p>${esc(txtK)}${it ? `<span class="d-txt"> Idée de ${fr(b.san)} : ${esc(it.text.replace(/^Ce coup /, ''))}</span>` : ''}${k === 0 || k === v.mv.length ? dbB : ''}</p>` };
}
// Barre : début et fin (ordinateur seulement : sur téléphone, la bande de coups commence par « Début »), coup précédent et
// suivant, erreur précédente et suivante (gaffes et erreurs du joueur, sans boucler). Sur un moment clé, le bouton plein
// est « Comprendre » dans le bandeau : « Coup suivant » passe en secondaire.
function gvBar(v) {
  if (v.db != null) {
    const i = v.db, last = i === gvDbList(v).length - 1;
    return `<button class="btn ico" data-act="dbgo" data-i="${i - 1}" aria-label="Moment précédent" ${i === 0 ? 'disabled' : ''}>${ico('prev')}</button>${last ? '<button class="btn pri" data-act="dbend">Terminer le débrief</button>' : `<button class="btn pri" data-act="dbgo" data-i="${i + 1}">Moment suivant${ico('next')}</button><button class="btn" data-act="dbend">Quitter</button>`}`;
  }
  const k = v.k, n = v.mv.length, pe = errStep(v.keys, k, -1), ne = errStep(v.keys, k, 1);
  return `<button class="btn ico gvfl" data-act="goto" data-k="0" aria-label="Début" ${k === 0 ? 'disabled' : ''}>${ico('first')}</button><button class="btn ico" data-act="goto" data-k="${Math.max(0, k - 1)}" aria-label="Coup précédent" ${k === 0 ? 'disabled' : ''}>${ico('prev')}</button><button class="btn ico ${v.errAt[k] ? '' : 'pri'}" data-act="goto" data-k="${Math.min(n, k + 1)}" aria-label="Coup suivant" ${k === n ? 'disabled' : ''}>${ico('next')}</button><button class="btn ico gvfl" data-act="goto" data-k="${n}" aria-label="Fin" ${k === n ? 'disabled' : ''}>${ico('last')}</button>`
    + (v.keys.length ? `<button class="btn gve" data-act="goto" data-k="${pe ?? 0}" aria-label="Erreur précédente" title="Erreur précédente" ${pe == null ? 'disabled' : ''}>${ico('prev')}Erreur</button><button class="btn gve" data-act="goto" data-k="${ne ?? 0}" aria-label="Erreur suivante" title="Erreur suivante" ${ne == null ? 'disabled' : ''}>Erreur${ico('next')}</button>` : '');
}
// Liste des coups : grille numéro / Blancs / Noirs sur ordinateur, bande d'une ligne sur téléphone (styles .gvm).
// Sur ordinateur, chaque gaffe ou erreur du joueur est rappelée sous son coup (.gvnote) : un clic mène au moment clé.
function gvMoves(v) {
  const { mv, errAt } = v, note = (e) => (e?.theme ? `<button class="gvnote" data-act="goto" data-k="${e.ply}"><span class="chip ${e.kind === 'gaffe' ? 'bad' : 'warn'}">${e.kind === 'gaffe' ? '??' : '?'}</span><span>Coup ${moveNo(e)} : ${fr(e.played)}, mieux <b>${fr(e.bestSan)}</b> · ${esc(st.THEMES[e.theme])}</span></button>` : '');
  // Une ligne par coup complet (ordinateur), comme Chess.com : numéro, coup blanc, coup noir, temps passé par chaque camp
  // (barre proportionnelle au coup le plus long de la partie). Sur téléphone, les lignes s'effacent (display: contents).
  const tm = moveTimes(v.g), top = tm ? Math.max(...tm, 1) : 1;
  const time = (i) => (tm && i < tm.length ? `<span class="gvtm ${i % 2 ? 'b' : 'w'}"><i style="width:${Math.max(4, Math.round((100 * tm[i]) / top))}%"></i><em class="num">${clockFmt(tm[i])}</em></span>` : '');
  const btn = (i) => { const m = mv[i], mk = errAt[i] ? moveMark(errAt[i]) : null; return `<button class="mv ${errAt[i]?.kind || ''}" data-act="goto" data-k="${i + 1}">${fr(m.san)}${mk ? `<sup>${mk.s}</sup>` : ''}</button>`; };
  let h = '<button class="mv gvst" data-act="goto" data-k="0">Début</button>';
  for (let i = 0; i < mv.length; i += 2) {
    h += `<div class="gvr"><span class="n">${i / 2 + 1}.</span>${btn(i)}${i + 1 < mv.length ? btn(i + 1) : '<span></span>'}${tm ? `<span class="gvt">${time(i)}${time(i + 1)}</span>` : ''}</div>`;
    h += note(errAt[i]) + note(errAt[i + 1]);
  }
  return h;
}
// Elo estimé de la partie (insights.js) : repère personnel, d'après ta précision moyenne et ton classement moyen dans cette cadence.
function perfOf(g, a) {
  const ref = perfRef(S.data.games.filter((x) => x.tc === g.tc), S.an), e = gameRating(a.acc, ref);
  return e ? { e, tip: `Repère : ta précision moyenne (${ref.acc} %) vaut ton classement moyen (${ref.elo}) ; chaque point de précision en plus ou en moins compte pour 25 points.` } : null;
}
function perfChip(g, a) { const p = perfOf(g, a); return p ? `<span class="chip" title="${p.tip}">Elo estimé ${p.e}</span>` : ''; }
// ---------- Idées de plan : sur une position calme de tes parties, choisir la bonne idée (ideas.js) ----------
function ideaPool() { return ideaPositions(S.data.games.filter((g) => g.tc === targetTc()), S.an).sort((a, b) => b.g.t - a.g.t || b.e.ply - a.e.ply); }
function ideaCur() {
  const pool = ideaPool(); if (!pool.length) return null;
  if (!S.idea || !pool.some((p) => p.id === S.idea.cur)) {
    const done = new Set(progress.hist().filter((h) => h.k === 'i').map((h) => h.id));
    S.idea = { cur: (pool.find((x) => !done.has(x.id)) || pool[0]).id };
  }
  return pool.find((p) => p.id === S.idea.cur);
}
function ideaNext() {
  const pool = ideaPool(), done = new Set(progress.hist().filter((h) => h.k === 'i').map((h) => h.id)), i = pool.findIndex((p) => p.id === S.idea?.cur);
  const rest = [...pool.slice(i + 1), ...pool.slice(0, Math.max(0, i))];
  S.idea = { cur: (rest.find((x) => !done.has(x.id)) || rest[0] || pool[0])?.id };
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
// Débrief : le coach raconte la partie en moments clés (debrief.js), l'échiquier suit.
const gvDbList = (v) => { if (!v.a) return []; if (!v.dbl) { const p = planOf(v.g, OPENINGS); v.dbl = moments(v.g, v.a, p ? { plan: p.text, name: p.o.nom } : {}); } return v.dbl; };
function gvDb(i) {
  const v = S.gv, L = v ? gvDbList(v) : []; if (!L.length) return;
  v.var = null; v.ask = null; v.db = Math.max(0, Math.min(L.length - 1, i)); v.k = Math.min(v.mv.length, L[v.db].ply);
  if (v.x?.alive() && v.cg) gvSync(); else render(true);
}
// « Coach » dans la relecture : Claude commente la position affichée, la réponse s'affiche dans le bandeau.
async function gvAsk() {
  const v = S.gv; if (!v || v.var) return;
  const k = v.k, g = v.g, a = v.a, key = v.fens[k] + '|' + (v.mv[k]?.san || '');
  const p = { fen: v.fens[k], me: g.w ? 'w' : 'b', played: v.mv[k]?.san, best: a?.best?.[k] || undefined, pv: a?.pv?.[k], ev: a ? (g.w ? a.ev[k] : -a.ev[k]) : null, context: `Partie du ${dfmt(g.t)} contre ${g.opp} (${g.or} Elo), ouverture ${g.fam}.` };
  if (!coachKey() && !ASK.has(key)) { await askRun(key, p, null); return; }
  v.db = null; v.ask = { k, html: ASK.get(key) || null }; gvSync();
  if (v.ask.html) return;
  try { const r = await askRun(key, p, null); if (S.gv === v && v.ask?.k === k) { v.ask.html = r; gvSync(); } }
  catch (err) { if (S.gv === v && v.ask?.k === k) { v.ask.err = err.message || String(err); gvSync(); } }
}
function viewPartie(t, plyArg) {
  const g = S.data.games.find((x) => String(x.t) === String(t));
  if (!g) return viewParties();
  const a = S.an[g.id] && !S.an[g.id].bad ? S.an[g.id] : null;
  const ch = new Chess(), fens = [ch.fen()], mv = [];
  for (const s of g.san) { const m = ch.move(s, { sloppy: true }); if (!m) break; mv.push(m); fens.push(ch.fen()); }
  const fresh = !S.gv || S.gv.t !== g.t;
  if (fresh) S.gv = { t: g.t, k: plyArg != null && plyArg !== 'd' ? Math.min(+plyArg, mv.length) : 0, mp: {} };
  const serious = a ? a.errs.filter((x) => x.theme) : [];
  const v = Object.assign(S.gv, { fens, mv, g, a, errAt: a ? Object.fromEntries(a.errs.map((e) => [e.ply, e])) : {}, keys: serious.map((x) => x.ply).sort((p, q) => p - q) });
  // #partie/<t>/d : débrief d'entrée, puis l'adresse redevient celle de la partie (un rendu suivant ne le relance pas).
  if (plyArg === 'd') { if (gvDbList(v).length) { v.var = null; v.ask = null; v.db = 0; v.k = Math.min(mv.length, v.dbl[0].ply); } history.replaceState(null, '', '#partie/' + g.t); }
  const cap = gvCap(v);
  const res = `<span class="chip ${g.out === 'W' ? 'good' : g.out === 'L' ? 'bad' : ''}">${g.out === 'W' ? 'Victoire' : g.out === 'L' ? 'Défaite' : 'Nulle'}${HOW[g.how] ? ' (' + HOW[g.how] + ')' : ''}</span>`;
  const link = `<a class="btn sm" href="${esc(g.id)}" target="_blank" rel="noopener">Chess.com</a>`;
  // Téléphone : l'Elo estimé de la partie prend la place du classement et de la série dans la barre du haut (demande du 16/11).
  const perf = a ? perfChip(g, a) : '';
  return exo.screen({
    top: perf ? () => perf : undefined,
    // En-tête (17/11, « comme Chess.com ») : les deux joueurs l'un sous l'autre, adversaire en haut comme sur l'échiquier,
    // résultat sur ta ligne ; ouverture, date et cadence en dessous ; Débrief et Chess.com à droite.
    // Ordinateur (17/11, « comme Chess.com ») : les joueurs encadrent l'échiquier (adversaire en haut, toi en bas, pendule
    // au coup affiché), le commentaire passe en tête de la colonne de droite ; l'en-tête ne garde que l'ouverture et les liens.
    above: gvPlayer(v, false), below: gvPlayer(v, true), capSide: true,
    head: `<div class="gvhead"><h1 class="sr">${g.w ? 'Blancs' : 'Noirs'} contre ${esc(g.opp)}</h1>
      <p class="gvmeta"><b>${esc(g.fam)}</b><span class="small">· ${dfmt(g.t)}${TC[g.tc] ? ' · ' + TC[g.tc] : ''}</span></p>
      <div class="gvact">${a ? '<button class="btn sm" data-act="dbgo" data-i="0">Débrief</button>' : ''}${link}</div></div>`,
    wrap: 'gv',
    rail: a ? `<div class="evbar ${g.w ? '' : 'flip'}" id="gvev" aria-hidden="true" style="--ev:${evalShare(a.ev[v.k])}"><i></i></div>` : '',
    cap: cap.html, capClass: cap.cls,
    panel: `${a ? `${gvTiles(g, a)}
      <div class="gvch" title="Tes chances de gain. Points rouges : gaffes, orange : erreurs. Touche la courbe pour aller au coup."><p class="small">Tes chances de gain. Points rouges : gaffes, orange : erreurs. Touche la courbe pour aller au coup.</p><div class="chart" id="evc"></div></div>`
    : `<div class="card"><p class="sub">Cette partie n’est pas encore analysée.</p><div><button class="btn pri" data-act="analyse1" ${S.job.running ? 'disabled' : ''}>${S.job.running ? 'Analyse en cours' : 'Analyser cette partie'}</button></div></div>`}
      <div class="gvm" id="gvm" data-edge>${gvMoves(v)}</div>
      <div class="gvmore stack"><div class="row">${res}<span class="chip">${dfmt(g.t)}</span>${link}</div>
      <p class="small">Joue tes propres coups sur l’échiquier pour tester une autre suite : le moteur l’évalue. Clic droit pour tracer des flèches.</p>
      ${serious.length ? `<div class="card"><h2>Moments clés</h2>${serious.map((x) => `<a class="row" href="#" data-act="goto" data-k="${x.ply}" style="justify-content:space-between;text-decoration:none"><span>Coup ${moveNo(x)} : ${fr(x.played)}, mieux ${fr(x.bestSan)}</span><span class="chip ${x.kind === 'gaffe' ? 'bad' : 'warn'}">${st.THEMES[x.theme]}</span></a>`).join('')}</div>` : ''}</div>`,
    bar: gvBar(v),
  });
}
// Bandeau d'un joueur au-dessus ou au-dessous de l'échiquier (ordinateur) : couleur, nom, Elo, résultat, pendule au coup affiché.
function gvPlayer(v, me) {
  const g = v.g, white = me === g.w, res = g.out === 'D' ? 'Nulle' : (g.out === 'W') === me ? 'Victoire' : 'Défaite';
  const cls = g.out === 'D' ? '' : (g.out === 'W') === me ? 'good' : 'bad';
  return `<div class="gvbar ${me ? 'me' : ''}"><i class="dot ${white ? 'w' : 'b'}"></i><b>${me ? 'Toi' : esc(g.opp)}</b><span class="num">${me ? g.r : g.or}</span>${me ? `<span class="chip ${cls}">${res}${me && HOW[g.how] ? ' (' + HOW[g.how] + ')' : ''}</span>` : ''}<span class="gvclk num" data-side="${white ? 'w' : 'b'}"></span></div>`;
}
function gvClocks(v) {
  const c = clocksAt(v.g, v.var ? v.var.k0 : v.k), turn = (v.var ? v.var.k0 : v.k) % 2 ? 'b' : 'w';
  document.querySelectorAll('.gvclk').forEach((el) => { el.textContent = c ? mmss(c[el.dataset.side]) : ''; el.hidden = !c; el.classList.toggle('on', el.dataset.side === turn); });
}
// Bilan de la partie en encarts (17/11) : précision, Elo estimé, puis les fautes par gravité avec leur symbole.
function gvTiles(g, a) {
  const n = (k) => a.errs.filter((x) => x.kind === k).length, p = perfOf(g, a);
  const tile = (lab, v, cls = '', tip = '') => `<div class="glt"${tip ? ` title="${tip}"` : ''}><span class="small">${lab}</span><b class="num ${cls}">${v}</b></div>`;
  const f = (k, sym, cls, lab) => `<span class="gvf ${n(k) ? cls : ''}" title="${pl(n(k), lab)}">${n(k)}<small>${sym}</small></span>`;
  return `<div class="glsum gvsum">${tile('Précision', a.acc != null ? a.acc.toFixed(0) + ' %' : '—')}${p ? tile('Elo estimé', p.e, '', p.tip) : ''}${tile('Fautes', f('gaffe', '??', 'ko', 'gaffe') + f('erreur', '?', 'warn', 'erreur') + f('imprecision', '?!', '', 'imprécision'))}</div>`;
}
// Variante jouée par l'élève depuis la position k0 de la partie : { k0, mv, fens, i, ev }.
// L'échiquier de la relecture se joue librement (les deux camps) ; un coup différent de la partie ouvre une variante.
const gvFen = (v) => (v.var ? v.var.fens[v.var.i] : v.fens[v.k]);
function gvMov(v) {
  const ch = new Chess(gvFen(v));
  return { free: false, color: ch.turn() === 'w' ? 'white' : 'black', dests: destsOf(ch), showDests: true, events: { after: gvMove } };
}
function gvMove(from, to) {
  const v = S.gv; if (!v) return;
  const ch = new Chess(gvFen(v)), p = ch.get(from), promo = p?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined;
  const m = ch.move({ from, to, promotion: promo });
  if (!m) { gvSync(); return; }
  const real = v.mv[v.k];
  if (!v.var && real && real.from === from && real.to === to) { gvGo(v.k + 1); return; } // même coup qu'en partie : on avance
  if (!v.var) v.var = { k0: v.k, mv: [], fens: [v.fens[v.k]], i: 0, ev: {} };
  const w = v.var;
  w.mv.length = w.i; w.fens.length = w.i + 1; // un nouveau coup au milieu de la variante la remplace
  w.mv.push(m); w.fens.push(ch.fen()); w.i++;
  gvSync();
}
function gvVarGo(i) {
  const w = S.gv?.var; if (!w) return;
  w.i = Math.max(0, Math.min(w.mv.length, i));
  gvSync();
}
// Éval de la variante, calculée à la demande (Stockfish, prioritaire) et gardée par position.
async function gvVarEval(v) {
  const w = v.var, i = w.i, fen = w.fens[i];
  if (w.ev[i] !== undefined) return;
  w.ev[i] = null;
  try {
    S.play ||= new Engine();
    const r = await S.play.evalFen(fen, DEPTH, true);
    const white = fen.split(' ')[1] === 'w';
    w.ev[i] = { cp: white ? r.cp : -r.cp, best: r.best };
  } catch { S.play = null; delete w.ev[i]; return; }
  if (S.gv === v && v.var === w && w.i === i && v.x?.alive()) gvSync();
}
function gvVarCap(v) {
  const w = v.var, me = v.g.w ? 'w' : 'b', i = w.i, e = w.ev[i];
  const base = w.k0, no = (j) => base + j; // demi-coups joués avant le coup j de la variante
  const line = w.mv.map((m, j) => `${no(j) % 2 === 0 || j === 0 ? `<span class="n">${Math.floor(no(j) / 2) + 1}${no(j) % 2 ? '…' : '.'}</span>` : ''}<button data-act="vgo" data-i="${j + 1}" class="${j + 1 === i ? 'cur' : ''}">${fr(m.san)}</button>`).join('');
  const last = i > 0 ? w.mv[i - 1] : null;
  const txtK = last ? describeAt(w.fens[i - 1], last.san, me) : 'Point de départ de ta variante. Joue un coup sur l’échiquier.';
  const ch = new Chess(w.fens[i]), over = ch.in_checkmate() ? 'Échec et mat.' : ch.in_stalemate() ? 'Pat.' : ch.in_draw() ? 'Nulle.' : '';
  let evalP = '<span class="small">éval…</span>';
  if (over) evalP = `<span class="chip">${over}</span>`;
  else if (e) { const b = e.best ? uciMove(new Chess(w.fens[i]), e.best) : null; evalP = `<span class="small">éval ${fmtEval(v.g.w ? e.cp : -e.cp)}</span>${b ? `<span class="capbest">Meilleur <b>${fr(b.san)}</b></span>` : ''}`; }
  return { cls: 'var', html: `<div class="capm"><span class="capn">Variante</span>${evalP}${playB(v)}</div><div class="moves vline">${line || '<span class="small">Aucun coup encore</span>'}</div><p>${esc(txtK)}</p>` };
}
function gvVarBar(v) {
  const w = v.var, i = w.i, n = w.mv.length;
  return `<button class="btn ico" data-act="vgo" data-i="${i - 1}" aria-label="Coup précédent" ${i === 0 ? 'disabled' : ''}>${ico('prev')}</button><button class="btn ico" data-act="vgo" data-i="${i + 1}" aria-label="Coup suivant" ${i === n ? 'disabled' : ''}>${ico('next')}</button><button class="btn pri" data-act="vexit">Revenir à la partie</button>`;
}
// Met à jour l'écran de relecture sans le reconstruire : les pièces s'animent d'un coup à l'autre.
function gvSync() {
  const v = S.gv, k = v.k, w = v.var;
  gvClocks(v);
  if (w) {
    const e = w.ev[w.i], last = w.i > 0 ? w.mv[w.i - 1] : (k > 0 ? v.mv[k - 1] : null), cap = gvVarCap(v);
    v.cg.set({ fen: gvFen(v), turnColor: gvFen(v).split(' ')[1] === 'w' ? 'white' : 'black', lastMove: last ? [last.from, last.to] : undefined, movable: gvMov(v), drawable: { autoShapes: e?.best ? [arrow(e.best, 'green')] : [] } });
    v.x.say(cap.cls, cap.html);
    v.x.setBar(gvVarBar(v));
    document.querySelectorAll('#gvm .mv').forEach((b) => b.classList.toggle('cur', +b.dataset.k === w.k0));
    gvVarEval(v);
    return;
  }
  const cap = gvCap(v);
  v.cg.set({ fen: v.fens[k], turnColor: v.fens[k].split(' ')[1] === 'w' ? 'white' : 'black', lastMove: k > 0 ? [v.mv[k - 1].from, v.mv[k - 1].to] : undefined, movable: gvMov(v), drawable: { autoShapes: gvAuto(v) } });
  v.x.say(cap.cls, cap.html);
  v.x.setBar(gvBar(v));
  const box = $('#gvm');
  if (box) { // coup courant surligné et gardé au centre de la liste, qui défile seule (jamais la page)
    box.querySelectorAll('.mv').forEach((b) => b.classList.toggle('cur', +b.dataset.k === k));
    const c = box.querySelector('.mv.cur');
    // Défilement doux, sauf quand les coups s'enchaînent (flèche maintenue) : un défilement relancé à chaque coup saccade
    const now = performance.now(), quick = now - (v.lastSync || 0) < 250; v.lastSync = now;
    if (c) box.scrollTo({ top: c.offsetTop - (box.clientHeight - c.offsetHeight) / 2, left: c.offsetLeft - (box.clientWidth - c.offsetWidth) / 2, behavior: REDUCED || quick ? 'auto' : 'smooth' });
  }
  v.chart?.cursor(k);
  if (v.a) $('#gvev')?.style.setProperty('--ev', evalShare(v.a.ev[k]));
  gvOnly(v);
}
function gvGo(k) {
  const v = S.gv; if (!v) return;
  v.var = null; v.db = null; v.ask = null; // aller à un coup de la partie quitte la variante, le débrief et la réponse du coach
  v.k = Math.max(0, Math.min(v.mv.length, k));
  if (v.x?.alive() && v.cg) gvSync(); else render(true);
}
function mountPartie() {
  const v = S.gv, X = exo.current(); if (!X || !v) return;
  v.x = X;
  v.cg = X.board({ fen: gvFen(v), orientation: v.g.w ? 'white' : 'black', movable: gvMov(v), drawable: { enabled: true } }); // clic droit : flèches et cases, comme sur Chess.com
  v.chart = null;
  const c = $('#evc');
  if (c && v.a) { // courbe dessinée une fois ; seul le curseur suit le coup affiché
    const pts = v.a.ev.map((cp, i) => ({ x: i, y: winPct(v.g.w ? cp : -cp), tip: (i ? `Coup ${Math.ceil(i / 2)} (${fr(v.mv[i - 1]?.san || '')}) : ` : 'Début : ') + Math.round(winPct(v.g.w ? cp : -cp)) + ' %' }));
    const marks = v.a.errs.filter((x) => x.kind !== 'imprecision').map((x) => ({ i: x.ply, c: x.kind === 'gaffe' ? 'bad' : 'warn' }));
    const o = { min: 0, max: 100, base: 0, marks, cursor: Math.min(v.k, pts.length - 1), label: 'Chances de gain au fil de la partie', onPick: gvGo };
    v.chart = lineChart(c, pts, matchMedia('(min-width: 860px)').matches ? { ...o, h: 104, step: 50, yfmt: (y) => y + ' %', x0: 'Début', x1: 'Fin' } : { ...o, h: 48, compact: true, mid: 50 });
  }
  X.on({ first: () => gvGo(0), prev: () => gvGo(v.k - 1), next: () => gvGo(v.k + 1), last: () => gvGo(v.mv.length) });
  // Clavier : géré par l'écouteur global (variante comprise), voir keydown plus bas
  gvSync();
}

function viewExos() {
  const hist = progress.drills();
  return `<h1>Échauffements</h1>${coach('Sous 1000 Elo, la plupart des parties se perdent sur une vérification oubliée. Ces exercices entraînent le geste lui-même, sur des positions tirées de tes parties : 10 positions, 2 minutes. La justesse d’abord, la vitesse vient ensuite.')}
  <div class="menu">${Object.entries(DRILLS).map(([k, d]) => {
    const h = hist.filter((x) => x.type === k), last = h[h.length - 1];
    return `<a class="mrow" href="#drill/${k}"><span class="mico">${h.length ? Math.round((100 * last.ok) / last.n) + '%' : ico('play')}</span><span class="stepc"><b>${d.t}</b><span>${d.d}${h.length ? ` · ${pl(h.length, 'série')}` : ''}</span></span><span class="chev" aria-hidden="true">›</span></a>`;
  }).join('')}
  <a class="mrow" href="#rush"><span class="mico">${ico('bolt')}</span><span class="stepc"><b>Rush</b><span>Les mêmes questions à la chaîne, contre la montre ou en survie</span></span><span class="chev" aria-hidden="true">›</span></a>
  <a class="mrow" href="#finales"><span class="mico">${ico('king')}</span><span class="stepc"><b>Finales de base</b><span>Mater, faire dame, tenir la nulle contre le moteur · ${ENDGAMES.length} positions</span></span><span class="chev" aria-hidden="true">›</span></a>
  <a class="mrow" href="#gagner"><span class="mico">${ico('play')}</span><span class="stepc"><b>Gagner les parties gagnées</b><span>Reprends une partie où tu avais +5 et va jusqu’au mat contre le moteur · ${pl(cvList().length, 'partie')}</span></span><span class="chev" aria-hidden="true">›</span></a></div>`;
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
    X.setBar(`<button class="btn pri" data-act="drnext">${d.i === d.items.length - 1 ? 'Voir mon score' : 'Suivant ›'}</button>`);
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
      <div class="ent-t"><span class="ent-k">À faire maintenant</span><h2>${left === d.goal ? 'Tes puzzles du jour' : `Encore ${pl(left, 'puzzle')} aujourd’hui`}</h2>
      <p>Coup ${moveNo(e)} contre ${esc(g.opp)} : ton coup t’a coûté ${e.drop} points de chances de gain. ${st.THEMES[e.theme] ? `Thème : ${esc(st.THEMES[e.theme].toLowerCase())}.` : ''}</p>
      ${pzProg(d)}<button class="btn pri lg" data-act="pzfocus">${d.done ? 'Continuer mes puzzles' : 'Résoudre mes puzzles'}</button></div></section>`;
  } else if (n.kind === 'ln') {
    hero = `<section class="ent-now noboard"><div class="ent-t"><span class="ent-k">À faire maintenant</span><h2>${pl(n.n, 'ligne')} d’ouverture à réviser</h2><p>Puzzles du jour faits. Récite tes lignes de mémoire : la répétition espacée les fixe.</p><a class="btn pri lg" href="${n.href}">Réciter mes lignes</a></div></section>`;
  } else {
    hero = `<section class="ent-now noboard"><div class="ent-t"><span class="ent-k">À faire maintenant</span><h2>${d.done >= d.goal ? 'Objectif du jour atteint' : 'Échauffe ton regard'}</h2><p>${d.done >= d.goal ? 'Tes puzzles sont faits. Deux minutes de vérification gardent le réflexe.' : 'Dix positions tirées de tes parties, deux minutes, pour vérifier avant de jouer.'}</p><a class="btn pri lg" href="#exos">Lancer un échauffement</a></div></section>`;
  }
  const tile = (href, icon, t, desc, tag, sec) => `<a class="ent-tile" href="${href}" style="--sec:var(${sec})"><span class="ent-i">${ico(icon)}</span><b>${t}</b><span class="ent-d">${desc}</span>${tag ? `<span class="ent-tag">${tag}</span>` : ''}</a>`;
  return `<h1>S’entraîner</h1>${hero}
  <h2 class="ent-h">Pratiquer</h2><div class="ent-grid">
    ${n.kind === 'pz' ? '' : tile('#puzzles', 'tgt', 'Puzzles sur mes erreurs', 'Tes propres fautes, à corriger', d.due ? `${d.due} en attente` : '', '--c-train')}
    ${tile('#exos', 'clock', 'Échauffements', 'Vérifier avant de jouer, 2 minutes', '', '--c-train')}
    ${tile(due.length ? lineHref(due[0]) : '#ouvertures/apprendre', 'lines', 'Réciter mes lignes', 'Tes ouvertures, de mémoire', due.length ? `${due.length} à réviser` : '', '--c-learn')}
    ${tile('#rush', 'bolt', 'Rush', 'Vérifier vite, contre la montre', progress.rushBest().t3 ? 'Record : ' + progress.rushBest().t3 : '', '--c-train')}
    ${tile('#gagner', 'flag', 'Finir les parties gagnées', 'Convertir l’avantage contre le moteur', cv ? pl(cv, 'partie') : '', '--c-train')}
    ${tile('#finales', 'king', 'Finales de base', 'Mater, faire dame, tenir la nulle', egDue ? `${egDue} à refaire` : '', '--c-train')}
    ${tile('#inedits', 'spark', 'Positions inédites', 'Puzzles neufs sur ton chantier', '', '--c-train')}
    ${tile('#idees', 'bulb', 'Idées de plan', 'Choisir le bon plan dans tes positions calmes', '', '--c-train')}
  </div>
  <h2 class="ent-h">Apprendre</h2><div class="ent-grid two">
    ${tile('#cours', 'book', 'Cours', les?.d ? esc(les.d) : 'Leçons illustrées par tes positions', '', '--c-learn')}
    ${tile('#ouvertures/apprendre', 'tree', 'Ouvertures', `${OPENINGS.length} fiches : idées, pièges, lignes`, '', '--c-learn')}
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
// Sauvegarde : rien n'est synchronisé entre appareils, le fichier sert de copie de sécurité et de transfert.
function backupCard() {
  const at = ls.get('bak', null), ago = at ? Math.floor((Date.now() - at) / DAY) : null;
  return `<div class="card"><h2>Sauvegarde</h2><p class="sub">Tes puzzles, ton journal, tes analyses et tes cours ne vivent que dans ce navigateur. Garde une copie, ou passe-les sur un autre appareil.</p>
    <p class="small">${at ? `Dernière sauvegarde ${ago === 0 ? 'aujourd’hui' : ago === 1 ? 'hier' : `il y a ${ago} jours`}.` : 'Aucune sauvegarde depuis cet appareil.'} La clé du coach n’est jamais mise dans le fichier.</p>
    <div class="row"><button class="btn ${!at || ago >= 14 ? 'pri' : ''}" data-act="bakexp">Télécharger ma sauvegarde</button><button class="btn" data-act="bakimp">Restaurer un fichier</button><input type="file" id="bakfile" accept="application/json,.json" hidden></div>
    <p class="small" id="bakmsg" role="status"></p></div>`;
}
// Apparence de l'échiquier (lot 8 du 16/11) : palette, pièces, coordonnées, vitesse des suites ; js/look.js.
const LOOK_FEN = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'; // mat du berger : dernier coup, échec, coordonnées
function lookCard() {
  const l = look.look();
  const seg = (k, label, opts) => `<div class="stack lookrow"><span class="small" id="lk-${k}">${label}</span><div class="seg2" role="group" aria-labelledby="lk-${k}">${opts.map(([v, t]) => {
    const on = String(l[k]) === String(v);
    return `<button type="button" class="${on ? 'on' : ''}" aria-pressed="${on}" data-act="look" data-k="${k}" data-v="${v}">${t}</button>`;
  }).join('')}</div></div>`;
  return `<div class="card look"><h2>Apparence</h2><div class="lookgrid"><div class="board mini lookb" id="lookb" aria-label="Aperçu de l’échiquier"></div><div class="stack">
    ${seg('pal', 'Échiquier', look.PALETTES)}${seg('pc', 'Pièces', look.PIECES)}${seg('coords', 'Coordonnées', [[true, 'Oui'], [false, 'Non']])}${seg('speed', 'Lecture des suites', look.SPEEDS)}
    <p class="small">Sur ordinateur, glisse le coin bas droit de l’échiquier d’un exercice pour le redimensionner.${l.size ? ` Taille choisie : ${l.size} px. <a href="#" data-act="look" data-k="size" data-v="">Revenir à la taille automatique</a>` : ''}</p></div></div></div>`;
}
function weekKey() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }
function viewPlan() {
  const hours = ls.get('hours', 6), wk = weekKey(), done = ls.get('plan:' + wk, {});
  const fcs = ls.get('focus', null), pri = priorityLessons().ids;
  const ids = fcs && LESSONS[fcs.id] ? [fcs.id, ...pri.filter((x) => x !== fcs.id)] : pri;
  const monday = new Date(wk + 'T00:00:00').getTime() / 1000;
  const played = rapidAll().filter((g) => g.t >= monday).length;
  const target = Math.max(4, Math.round((hours * 60 * 0.5) / 25));
  const sessions = Math.max(3, Math.min(7, Math.round((hours * 60 * 0.25) / 15)));
  const weakOp = [true, false].flatMap((w) => st.openings(rapidAll(), w).filter((o) => o.n >= 5 && st.score(o) <= 42).map((o) => `${o.fam} (${w ? 'Blancs' : 'Noirs'})`))[0];
  const items = [
    ['dr', 'Un échauffement de 2 minutes avant chaque session de parties', '#exos'],
    ...Array.from({ length: sessions }, (_, i) => [`pz${i}`, `Séance de puzzles ${i + 1} : 15 minutes sur tes erreurs`, '#puzzles']),
    ids[0] ? ['l1', `${fcs ? 'Cours de ton chantier' : 'Cours de la semaine'} : ${LESSONS[ids[0]].titre}`, '#cours/' + ids[0]] : null,
    ids[1] ? ['l2', `Deuxième cours : ${LESSONS[ids[1]].titre}`, '#cours/' + ids[1]] : null,
    ['rev', 'Revoir tes 3 dernières défaites coup par coup', '#parties'],
    weakOp ? ['op', `Explorer ton ouverture la plus fragile : ${weakOp}`, '#ouvertures'] : null,
  ].filter(Boolean);
  const g = goal();
  return `<h1>Plan et réglages</h1>
  <div class="card m-only stack"><h2>Tes données</h2><p class="sub">Compte ${esc(S.user)}. Dernière mise à jour le ${new Date(S.data.fetchedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.</p><div class="stack filters">${filtersHtml()}</div></div>
  <div class="card"><h2>Semaine du ${new Date(wk + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</h2>
      <div class="row"><label for="hrs" class="sub">Temps disponible</label><select id="hrs">${[3, 4, 5, 6, 8, 10].map((h) => `<option value="${h}" ${h === hours ? 'selected' : ''}>${h} h par semaine</option>`).join('')}</select></div>
      <div class="stack"><b>Jouer : <span class="num">${played} / ${target}</span> parties rapides cette semaine</b>
        <div class="goalbar" aria-hidden="true"><i style="width:${Math.min(100, (100 * played) / target)}%"></i></div>
        <p class="small">Compté automatiquement à chaque mise à jour. Cadence conseillée : 15|10, l’incrément laisse le temps de vérifier chaque coup.</p></div>
      <div class="stack">${items.map(([id, label, href]) => `<label class="check ${done[id] ? 'done' : ''}"><input type="checkbox" data-plan="${id}" ${done[id] ? 'checked' : ''}><span>${esc(label)} <a href="${href}">Ouvrir</a></span></label>`).join('')}</div>
    </div>
  <div class="grid">
    <div class="card"><h2>Avant chaque coup</h2><ol class="routine"><li>Que menace le dernier coup adverse ?</li><li>Ai-je un échec, une capture ou une menace ?</li><li>La case où je vais est-elle attaquée ?</li><li>Après mon coup, qu’est-ce que je laisse sans défense ?</li></ol></div>
    <div class="card"><h2>Règles de session</h2><ol class="routine"><li>Deux défaites de suite : fin des parties pour aujourd’hui, place aux puzzles.</li><li>Jamais de partie classée en étant pressé ou fatigué.</li><li>Après chaque défaite, mise à jour ici et relecture des moments clés.</li></ol></div>
    <div class="card"><h2>Ton objectif</h2><div class="row"><label for="gelo" class="sub">Elo visé</label><input type="number" id="gelo" value="${g.elo}" min="100" max="3000" step="50" style="width:100px"></div>
      <div class="row"><label for="gdate" class="sub">Échéance</label><input type="date" id="gdate" value="${g.date}"></div>
      <div><button class="btn sm" data-act="reset">Changer de pseudo ou effacer les données</button></div></div>
    <div class="card"><h2>Sons</h2><label class="check"><input type="checkbox" data-f="snd" ${sound.enabled() ? 'checked' : ''}><span>Sons des coups, des bonnes réponses et de l’objectif atteint <span class="small">Coupés par défaut. Aussi réglables pendant un exercice.</span></span></label></div>
    ${lookCard()}
    ${backupCard()}
    <div class="card"><h2>Coach Claude</h2>${coachKey() ? `<p class="sub">Coach activé. Clé enregistrée sur cet appareil (…${esc(coachKey().slice(-4))}).</p>
      <div class="row"><label for="cmodel" class="sub">Modèle</label><select id="cmodel">${MODELS.map(([v, l]) => `<option value="${v}" ${coachModel() === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><button class="btn sm" data-act="keydel">Supprimer la clé de cet appareil</button></div>` : keyForm()}</div>
  </div>`;
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
    const ok = confirm(`Remplacer les données de cet appareil par la sauvegarde de ${b.user}${x.date ? ' du ' + x.date.toLocaleDateString('fr-FR') : ''} ?\n${x.games} parties, ${x.an} analysées, ${x.pz} puzzles suivis, ${x.h} exercices au journal.\nLa clé du coach reste celle de cet appareil.`);
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

// ---------- Routage et événements ----------
const route = () => (location.hash.slice(1) || 'accueil').split('/');
function render(keepScroll) {
  const y = scrollY;
  destroyBoards();
  $('#tip').hidden = true;
  if (location.hash === '#plus') { history.replaceState(null, '', '#plan'); } // ancien menu Plus : ses entrées sont dans S'entraîner et Plan
  const v = $('#view'), [r, a, b, c] = route();
  paintJob();
  $('#nav').hidden = !S.data;
  const navKey = r === 'ouvertures' ? (a ? 'apprendre' : 'mesouvertures') : r; // les 4 sections : data-grp de index.html
  const here = '#' + route().join('/');
  // Entrée de section : d'après data-grp ; page d'un volet : son adresse exacte, ou sa route pour une page à une seule partie (#cours/x allume « Cours »)
  document.querySelectorAll('#nav a').forEach((x) => { const h = x.getAttribute('href'); x.classList.toggle('on', x.dataset.grp ? x.dataset.grp.split(' ').includes(navKey) : h === here || (h === '#' + r && r !== 'ouvertures' && !x.dataset.fill)); });
  if (!S.data) { v.innerHTML = viewWelcome(); exo.attach(); header(); const f = $('#wf'); f.onsubmit = (ev) => { ev.preventDefault(); const u = $('#wu').value.trim(); if (u) doImport(u); }; return; }
  if (r !== 'partie') S.gv = null;
  if (r !== 'rush') clearInterval(rushTimer);
  if (r !== 'drill' && S.dr && S.dr.i >= S.dr.items.length) S.dr = null; // une série en cours se reprend, une série finie repart de zéro
  const html = r === 'idees' ? viewIdees() : r === 'avantpartie' ? viewAvant() : r === 'puzzles' ? viewPuzzles() : r === 'erreur' ? viewPuzzles([a, b]) : r === 'entrainer' ? viewEntrainer() : r === 'historique' ? viewHistory() : r === 'exos' ? viewExos() : r === 'inedits' ? viewInedits() : r === 'drill' ? viewDrill(a) : r === 'cours' ? (a ? viewLecon(a, b) : viewCours()) : r === 'ouvertures' ? (a === 'apprendre' ? viewApprendre() : a ? viewOpening(a) : viewOuvertures()) : r === 'monouv' ? viewMonOuv(a, b) : r === 'ligne' ? viewLigne(a, b, c) : r === 'parties' ? viewParties() : r === 'partie' ? viewPartie(a, b) : r === 'plan' ? viewPlan() : r === 'bilan' ? viewBilan() : r === 'stats' ? viewStats(S) : r === 'gagner' ? viewGagner(a) : r === 'jouer' ? viewJouer(a, b) : r === 'finales' ? viewFinales() : r === 'finale' ? viewFinale(a) : r === 'rush' ? viewRush(a) : viewAccueil();
  v.innerHTML = html;
  exo.attach(); // avant de créer les échiquiers : ils naissent à leur taille définitive
  if (r === 'puzzles' || r === 'erreur') { mountPuzzle(); const s = $('#pzt'); if (s) s.onchange = () => { S.pz.theme = s.value; S.pz.cur = null; S.pz.show = null; render(); }; }
  else if (r === 'cours' && a) mountLecon();
  else if (r === 'ouvertures' && !a) { board($('#exb'), { fen: S.exFen, orientation: S.white ? 'white' : 'black', viewOnly: true }); lexpLoad(S.exFen); }
  else if (r === 'ouvertures' && a !== 'apprendre') mountOpening();
  else if (r === 'monouv') mountMonOuv();
  else if (r === 'ligne') mountLigne();
  else if (r === 'partie') mountPartie();
  else if (r === 'drill') mountDrill();
  else if (r === 'inedits') mountInedits();
  else if (r === 'gagner') mountGagner();
  else if (r === 'jouer') mountJouer();
  else if (r === 'finale') mountFinale();
  else if (r === 'rush') mountRush();
  else if (r === 'idees') mountIdees();
  else if (r === 'stats') mountStats(S);
  else if (r === 'plan') {
    $('#hrs').onchange = (e) => { ls.set('hours', +e.target.value); render(true); toast('Temps par semaine enregistré'); };
    const save = () => { const elo = +$('#gelo').value, date = $('#gdate').value; if (elo >= 100 && date) { ls.set('goal', { elo, date }); render(true); toast('Objectif enregistré'); } };
    $('#gelo').onchange = save; $('#gdate').onchange = save;
    const cm = $('#cmodel'); if (cm) cm.onchange = () => ls.set('model', cm.value);
    board($('#lookb'), { fen: LOOK_FEN, viewOnly: true, lastMove: ['h5', 'f7'] });
    document.querySelectorAll('[data-plan]').forEach((c) => { c.onchange = () => { const k = 'plan:' + weekKey(), d = ls.get(k, {}); d[c.dataset.plan] = c.checked; ls.set(k, d); c.closest('.check').classList.toggle('done', c.checked); }; });
  } else if (r === 'bilan') mountBilan();
  else if (r === 'accueil') mountAccueil();
  else if (r === 'entrainer') mountEntrainer();
  header();
  keepUi();
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
}
// Volets de la navigation (16/11) : chaque entrée ouvre la liste de ses pages.
// Ordinateur (souris) : survol, focus clavier ou flèche bas ; le clic sur l'entrée mène à la page principale de la section.
// Téléphone : le premier appui ouvre le volet au-dessus de la barre du bas, un second appui ou un appui ailleurs le ferme.
const phoneNav = matchMedia('(max-width: 859px)');
const navGroups = () => [...document.querySelectorAll('#nav .grp')];
function navOpen(g, on) {
  if (on) { navFill(g); navGroups().forEach((o) => o !== g && navOpen(o, false)); }
  g.classList.toggle('open', on);
  g.querySelector('.grp-h').setAttribute('aria-expanded', on);
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
const navItems = (g) => [...g.querySelectorAll('.fly a')];
navGroups().forEach((g) => {
  const h = g.querySelector('.grp-h');
  g.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse' && !phoneNav.matches) navOpen(g, true); });
  g.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse' && !phoneNav.matches) navOpen(g, false); });
  // Focus au clavier (Tab) : le volet s'ouvre, sauf juste après Échap (g.shut, levé quand le focus sort de l'entrée)
  g.addEventListener('focusin', () => { if (!phoneNav.matches && !g.shut && !g.classList.contains('open') && h.matches(':focus-visible')) navOpen(g, true); });
  g.addEventListener('focusout', (ev) => { if (g.contains(ev.relatedTarget)) return; g.shut = false; if (!phoneNav.matches) navOpen(g, false); });
  // Appui au doigt (téléphone, ou tablette en grand) : l'entrée ouvre et ferme le volet ; souris et Entrée mènent à la page principale
  let pt = 'mouse';
  h.addEventListener('pointerdown', (ev) => { pt = ev.pointerType; });
  h.addEventListener('click', (ev) => { if (phoneNav.matches || (ev.detail > 0 && pt !== 'mouse')) { ev.preventDefault(); navOpen(g, !g.classList.contains('open')); } });
  g.addEventListener('click', (ev) => { if (ev.target.closest('.fly a')) { navOpen(g, false); document.activeElement?.blur(); } });
  g.addEventListener('keydown', (ev) => {
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
// Appui ailleurs : ferme le volet ouvert, sans déclencher ce qui est dessous (téléphone)
document.addEventListener('click', (ev) => {
  const g = document.querySelector('#nav .grp.open');
  if (!g || g.contains(ev.target)) return;
  navOpen(g, false);
  if (phoneNav.matches) { ev.preventDefault(); ev.stopPropagation(); }
}, true);
document.addEventListener('click', (ev) => {
  const x = ev.target.closest('[data-x]'); // action de l'exercice en cours : indice, solution, lecture d'une suite…
  if (x) { exo.act(x.dataset.x, x); return; }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'A') ev.preventDefault();
  if (act === 'refresh') doImport(S.user, true);
  else if (act === 'analyse') runAnalysis(20);
  else if (act === 'analyse1') runAnalysis(1, S.gv.g);
  else if (act === 'stattc') { S.statTc = el.dataset.tc; render(true); }
  else if (act === 'rushagain') { S.rush = null; render(); }
  else if (act === 'playhere') {
    const v = S.gv; if (!v) return;
    if (v.var) { const w = v.var, m = w.mv[w.i - 1] || v.mv[w.k0 - 1]; S.jp = { t: v.g.t, k: 'v', from: w.k0 + w.i, fen: w.fens[w.i], last: m ? [m.from, m.to] : undefined, moves: [], over: null }; location.hash = `#jouer/${v.g.t}/v`; }
    else { S.jp = null; location.hash = `#jouer/${v.g.t}/${v.k}`; }
  }
  else if (act === 'back') {
    const r = route()[0];
    if (r === 'erreur') { if (history.length > 1) history.back(); else location.hash = '#puzzles'; }
    else if (r === 'gagner') location.hash = route()[1] ? '#gagner' : '#exos';
    else if (r === 'jouer') location.hash = '#partie/' + route()[1];
    else if (r === 'finale') location.hash = '#finales';
    else if (r === 'rush') location.hash = route()[1] ? '#rush' : '#entrainer';
    else if (r === 'ligne') location.hash = '#ouvertures/' + route()[1];
    else if (r === 'ouvertures') location.hash = '#ouvertures/apprendre';
    else if (r === 'monouv') location.hash = '#ouvertures';
    else location.hash = { partie: '#parties', cours: '#cours', drill: '#exos', inedits: '#puzzles' }[r] || '#accueil';
  }
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
  else if (act === 'open') location.hash = '#partie/' + el.dataset.t;
  else if (act === 'more') { S.listN += 50; render(true); }
  else if (act === 'goto') gvGo(+el.dataset.k);
  else if (act === 'dbgo') gvDb(+el.dataset.i);
  else if (act === 'dbend') gvGo(S.gv?.k ?? 0);
  else if (act === 'askpos') gvAsk();
  else if (act === 'lgnav') { S.lg = Math.max(0, (S.lg || 0) + +el.dataset.d); render(true); }
  else if (act === 'selfck') { progress.recordSelf(el.dataset.id, el.dataset.v === '1'); render(true); }
  else if (act === 'askclose') { if (S.gv) { S.gv.ask = null; gvSync(); } }
  else if (act === 'vgo') gvVarGo(+el.dataset.i);
  else if (act === 'vexit') { const k0 = S.gv?.var?.k0; if (k0 != null) gvGo(k0); }
  else if (act === 'bakexp') { const m = $('#bakmsg'); backup.exportFile(S.user).then((n) => { if (m) m.textContent = `Fichier ${n} téléchargé. Range-le dans tes fichiers ou envoie-le sur ton autre appareil.`; toast('Sauvegarde téléchargée'); }).catch((e) => { if (m) m.textContent = 'Sauvegarde impossible : ' + (e.message || e); }); }
  else if (act === 'opgrp') { S.opGrp = el.dataset.g; render(true); }
  else if (act === 'optab') { S.opTab = el.dataset.tab; render(true); }
  else if (act === 'bakimp') $('#bakfile')?.click();
  else if (act === 'look') { const k = el.dataset.k, v = el.dataset.v; look.setLook({ [k]: k === 'coords' ? v === 'true' : k === 'size' ? null : v }); render(true); }
  else if (act === 'reset') {
    if (el.dataset.sure) { const u = S.user; ls.clear(['key', 'model', 'goal', 'hours', 'look']); dbDel('data:' + u); dbDel('an:' + u); dbDel('ai:' + u); S.ai = {}; S.li = null; S.liKeep = null; S.dr = null; S.cv = null; S.gen = null; S.cl = null; LINES.clear(); S.job.stop = true; S.user = null; S.data = null; S.an = {}; S.pz = null; location.hash = '#accueil'; render(); }
    else { el.dataset.sure = '1'; el.textContent = 'Confirmer : effacer parties, analyses et progression (réglages et clé du coach conservés)'; }
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'bakfile') { restoreFrom(ev.target.files[0]); ev.target.value = ''; return; }
  const el = ev.target.closest('[data-f]'); if (!el) return;
  if (el.dataset.f === 'liangle' || el.dataset.f === 'lidiff') { S.li[el.dataset.f === 'liangle' ? 'angle' : 'diff'] = el.value; ls.set('li', { angle: S.li.angle, diff: S.li.diff }); S.li.cur = null; S.li.err = null; render(true); return; }
  if (el.dataset.f === 'snd') { sound.setEnabled(el.checked); sound.play('good'); return; }
  if (el.dataset.f === 'focus') { ls.set('focus', { id: el.value, since: Math.floor(Date.now() / 1000) }); render(true); return; }
  if (el.dataset.f === 'tc') { S.f.tc = el.value; if (S.pz) pzReset('', false); } else S.f.days = +el.value;
  ls.set('filter', S.f); S.path = []; render(true);
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
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const r = route()[0]; if (r === 'bilan') mountBilan(); else if (r === 'accueil' && S.data) mountAccueil(); else if (r === 'entrainer' && S.data) mountEntrainer(); else if (r === 'stats') mountStats(S); else if (r === 'partie' && S.gv?.cg) { if (!!$('.fitside #xcap') !== exo.wide()) render(true); else gvSync(); } }, 200); }); // relecture : le bandeau change de colonne au passage ordinateur / téléphone

if (new URLSearchParams(location.search).has('debug')) window.__cap = S; // accès à l'état pour les tests
(async function init() {
  look.apply(); // palette, pièces, coordonnées et taille de l'échiquier avant le premier rendu
  await load();
  restoreUi();
  navigator.storage?.persist?.().catch(() => {}); // demande au navigateur de ne pas effacer les données de l'app
  render();
  const u = new URLSearchParams(location.search).get('u');
  reclassify(); warmReplays();
  if (!S.data && (S.user || u)) doImport(S.user || u);
  else if (S.data && Date.now() - (S.data.fetchedAt || 0) > 6 * 3600000) doImport(S.user);
  else if (S.data && Object.values(S.an).some(toRedo)) autoAnalyse(); // anciennes analyses à réévaluer ou compléter, même sans nouvel import
})();
