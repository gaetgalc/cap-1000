/* global Chess */
import { dbGet, dbSet, dbDel, ls } from './store.js';
import { importPlayer } from './chesscom.js';
import { Engine, evaluateGame, multiPass } from './engine.js';
import { classify, VERSION, winPct, fmtEval, uciMove, isPuzzle, replay } from './classify.js';
import * as st from './stats.js';
import { LESSONS, ENGINE_LESSONS, RULES } from './lessons.js';
import { viewStats, mountStats } from './alltime.js';
import { fr, settle, buildLine, insight, hintFor, lastMoveText, moveText, material, describeAt, justPlayed } from './explain.js';
import { $, esc, dfmt, TC, HOW, coach, txt, pl, f1, ico, wdl, WDL_LEGEND } from './ui.js';
import { lineChart } from './charts.js';
import { progress, DAY } from './progress.js';
import { board, destroyBoards, destsOf, arrow, errShapes } from './board.js';
import * as exo from './exercise.js';
import { LI_ANGLES, LI_FOR, LI_DIFF, fetchPuzzle } from './lichess.js';
import { DRILLS, DRILL_FOR, makeRound } from './drills.js';
import { MODELS, coachKey, coachModel, facts, genLesson, askCoach, buildPrompt, parseLesson } from './coach.js';
import * as backup from './backup.js';

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
async function doImport(user) {
  const first = !S.data;
  S.importing = { done: 0, total: 0, err: null };
  if (first) render(); else paintJob();
  try {
    const prev = user === S.user ? S.data : await dbGet('data:' + user);
    const d = await importPlayer(user, prev, (a, b) => { S.importing = { done: a, total: b, err: null }; paintJob(); const el = $('#imp'); if (el) el.textContent = b ? `Import des parties : ${a} mois sur ${b}` : 'Connexion à Chess.com'; });
    S.user = d.user; S.data = d; ls.set('user', d.user);
    await dbSet('data:' + d.user, d);
    S.an = (await dbGet('an:' + d.user)) || {};
    S.ai = (await dbGet('ai:' + d.user)) || {};
    S.importing = null;
    if (!d.games.some((g) => g.tc === S.f.tc) && S.f.tc !== 'all') { S.f = { tc: 'all', days: 0 }; ls.set('filter', S.f); }
    if (first) render(); else bgRender();
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
  S.job = { running: true, done: 0, total: queue.length, stop: false, msg: '' };
  const user = S.user, saveAn = () => (S.user === user ? dbSet('an:' + user, S.an) : null);
  paintJob();
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
        const raw = await evaluateGame(S.engine, g, DEPTH, alive);
        if (S.job.stop && !raw) break; // interrompue : l'ancienne analyse, s'il y en a une, reste en place
        S.an[g.id] = raw ? analysis(g, raw) : { ev: [], errs: [], nb: 0, acc: null, maxAdv: 0, last: 0, bad: true };
      }
      S.job.done++;
      if (S.job.done % 3 === 0 || S.job.done === queue.length) await saveAn();
      paintJob();
      const r = route()[0];
      if ((r === 'puzzles' && !exo.current()) || (r === 'partie' && only) || (r === 'accueil' && !only && (S.job.done === 3 || S.job.done % 5 === 0))) bgRender();
    }
    await saveAn();
  } catch (e) {
    S.job.msg = 'Le moteur d’analyse n’a pas pu démarrer sur ce navigateur. Les statistiques restent disponibles.';
    S.engine = null;
  }
  S.job.running = false;
  bgRender();
}
function paintJob() {
  const el = $('#job');
  const j = S.job;
  if (S.importing && !S.importing.err && S.data) {
    el.hidden = false; el.innerHTML = `<span>Mise à jour depuis Chess.com (${S.importing.done}/${S.importing.total || '?'} mois)</span>`;
  } else if (j.running) {
    el.hidden = false;
    el.innerHTML = `<span>Analyse de tes parties : <b class="num">${j.done}/${j.total}</b></span><span class="bar"><i style="width:${(100 * j.done) / j.total}%"></i></span><button class="btn sm" id="jobstop">Mettre en pause</button>`;
    $('#jobstop').onclick = () => { S.job.stop = true; };
  } else if (j.msg) { el.hidden = false; el.innerHTML = `<span class="err">${esc(j.msg)}</span>`; } else el.hidden = true;
}

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
function pzRecord(p, res) {
  const fresh = progress.recordPuzzle(p, res);
  const el = $('#pzdayi'); if (el) el.innerHTML = pzDayHtml();
  header();
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
  const shown = res.slice(-n);
  return `<span class="dots" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k < shown.length ? 'r' + (shown[k] < 0 ? 'x' : shown[k]) : ''}"></i>`).join('')}</span>`;
}
const pzProg = (d, cls = '') => `<a class="pzprog ${cls}" href="#historique" title="Voir l’historique du jour">${pzDots(d)}<b class="num">${d.done >= d.goal ? d.done + ' fait' + (d.done > 1 ? 's' : '') : d.done + ' / ' + d.goal}</b></a>`;
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
      if (L.step >= P.sol.length || ch.in_checkmate()) { cg.set({ fen: ch.fen() }); return finish(true); }
      const r = uciMove(ch, P.sol[L.step]); L.step++;
      cg.set({ fen: ch.fen(), lastMove: [r.from, r.to], turnColor: color, movable: mov() });
      if (L.step >= P.sol.length) return finish(true);
      X.say('ok', `<p><b class="ok">Bien.</b> Ton adversaire répond ${fr(r.san)}. Trouve la suite.</p>`);
    } else {
      L.failed = true;
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
function pzRecap(title, msg, empty, filter) {
  const d = pzDay(), t = d.t, c = (r) => t.filter((h) => h.r === r).length, redo = failedToday();
  return `<div class="card recap"><h2>${title}</h2>
    ${t.length ? `<div class="row">${pzDots(d)}<b>${pl(t.length, 'puzzle')} aujourd’hui</b></div><p class="sub">${c(2)} du premier coup · ${c(1)} avec aide · ${c(0)} solution vue</p>` : ''}
    ${coach(msg)}
    <div>${nextStep('pz')}</div>
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
  const sum = (l) => { const z = l.filter((x) => isPz(x) && !x.re), dr = l.filter((x) => x.k === 'd').length, cv = l.filter((x) => x.k === 'c').length, rv = l.filter((x) => isPz(x) && x.re).length; return [z.length ? `${pl(z.length, 'puzzle')}, ${z.filter((x) => x.r === 2).length} du premier coup` : '', rv ? pl(rv, 'révision') : '', dr ? pl(dr, 'échauffement') : '', cv ? pl(cv, 'partie rejouée').replace('parties rejouée', 'parties rejouées') : ''].filter(Boolean).join(' · '); };
  return head + tiles + `<div class="legend"><span style="--c:var(--good)">Du premier coup</span><span style="--c:var(--warn)">Trouvé avec aide</span><span style="--c:var(--bad)">Solution vue</span></div>`
    + [...days].map(([k, l]) => `<div class="card hday"><h2><span class="hcap">${label(k)}</span><span class="small">${sum(l)}</span></h2>${l.map(row).join('')}</div>`).join('')
    + (h.length > S.histN ? '<div><button class="btn" data-act="histmore">Afficher les exercices plus anciens</button></div>' : '');
}

// ---------- Explication : suites commentées, idée, comparaison ----------
const LINES = new Map();
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
  X.setBar(X.spec.exit);
  getLines(g, e).then((d) => {
    if (!X.alive()) return;
    // Bilan matériel cumulé depuis le début de la suite : dans un échange, on voit +9 puis « égalité », pas +9 puis −9.
    const chip = (L) => (i) => { if (!L.slice(0, i).some((q) => q.raw.captured)) return ''; const m = L[i - 1].mat - d.m0; return `<span class="chip ${m > 0 ? 'good' : m < 0 ? 'bad' : ''}">${m ? `Bilan ${m > 0 ? '+' : '−'}${Math.abs(m)}` : 'Bilan : égalité'}</span>`; };
    const bilan = (L, label, txt) => { const s = L[L.length - 1]; return !s ? '' : s.tags.mate ? `<b>Bilan :</b> échec et mat${s.tags.mine ? '' : ' contre toi'}.` : `<b>Bilan de ${label} :</b> ${txt}.`; };
    const real = g.san[e.ply + 1], refReply = d.ref[1];
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
        <div class="card idea"><h3>L’idée derrière ${fr(e.bestSan)}</h3><p>${esc(d.ins.idee)}</p></div>
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
    if (uci === e.best.slice(0, 4) || ch.in_checkmate()) return finish(true, `<b class="ok">Bien vu.</b> ${fr(m.san)} est le meilleur coup.`, uci === e.best.slice(0, 4));
    say('', 'Vérification de ton coup…');
    let drop = 100;
    try { S.play ||= new Engine(); const r = await S.play.evalFen(ch.fen(), DEPTH, true); drop = winPct(e.e0) - winPct(-r.cp); } catch { S.play = null; /* moteur indisponible : seul le meilleur coup compte */ }
    if (!X.alive()) return; // l'utilisateur a quitté l'écran pendant la vérification
    if (stt.done || stt.tk !== tk) return;
    if (drop < 6) return finish(true, `<b class="ok">Bon coup.</b> ${fr(m.san)} tient la position (le moteur préférait ${fr(e.bestSan)}).`, false);
    stt.tries++;
    cg.setAutoShapes([{ orig: to, brush: 'red' }]);
    say('ko', `<b class="ko">Pas celui-là.</b> ${fr(m.san)} ${uci === e.playedUci.slice(0, 4) ? 'est le coup que tu avais joué en partie' : `fait perdre ${Math.round(drop)} points de chances de gain`}. Réessaie.`);
    if (stt.tries >= 2 && !stt.hints) X.btn('hint')?.classList.add('pulse'); // deux essais ratés : l'indice se signale
    setTimeout(() => { if (stt.tk !== tk || !X.alive()) return; ch.undo(); cg.set({ fen: ch.fen(), turnColor: color, movable: mov() }); cg.setAutoShapes(hintShape()); }, 900);
  }
  const api = {
    stt,
    ask(fen, cb) { const c = new Chess(fen), col = c.turn() === 'w' ? 'white' : 'black'; cg.set({ turnColor: col, movable: { free: false, color: col, dests: destsOf(c), showDests: true, events: { after: cb } } }); },
    view(fen, last, shapes) { cg.set({ fen, lastMove: last, turnColor: fen.split(' ')[1] === 'w' ? 'white' : 'black', movable: { color: undefined }, drawable: { autoShapes: (shapes || []).filter(Boolean) } }); },
    arrows(list) { cg.setAutoShapes(list); },
    real(btn) {
      stt.tk++;
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
    show() { if (stt.real) api.real(X.btn('real')); if (stt.done) return; stt.shown = true; ch.load(e.fen); const m = uciMove(ch, e.best); cg.set({ fen: ch.fen(), lastMove: m ? [m.from, m.to] : undefined }); finish(false, `La solution était <b>${fr(e.bestSan)}</b>.`, true); },
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
      explainUI(X, { g: p.g, e: p.e, api, panel: $('#pzx'), verdict: html, exact, rate: res === 2 ? p.id : null });
    },
  });
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
function mountGagner() {
  const X = exo.current(), c = S.cvCur, cv = S.cv;
  if (!X || !c || !cv) return;
  const { it } = c, me = it.g.w ? 'w' : 'b', color = it.g.w ? 'white' : 'black';
  const ch = new Chess(c.fen); let last = c.last;
  for (const u of cv.moves) { const m = uciMove(ch, u); if (!m) break; last = [m.from, m.to]; }
  let tk = 0;
  const mov = () => ({ free: false, color, dests: destsOf(ch), showDests: true, events: { after: onMove } });
  const turn = () => (ch.turn() === 'w' ? 'white' : 'black');
  const cg = X.board({ fen: ch.fen(), orientation: color, turnColor: turn(), lastMove: last, movable: cv.over || ch.turn() !== me ? { color: undefined } : mov() });
  const moves = () => { const el = $('#cvmoves'); if (el) el.textContent = ch.history().length ? st.lineText([...Array(it.ply).fill(''), ...ch.history()], it.ply) : 'Aucun pour l’instant.'; };
  const playBar = () => X.setBar('<button class="btn" data-x="hint">Indice</button><button class="btn" data-x="resign">Abandonner</button><button class="btn" data-act="back">Retour</button>');
  const endBar = () => X.setBar(`<button class="btn ${cv.over === 'gagne' ? '' : 'pri'}" data-x="restart">Recommencer</button>${X.spec.nextT ? `<a class="btn ${cv.over === 'gagne' ? 'pri' : ''}" href="#gagner/${X.spec.nextT}">Partie suivante ›</a>` : '<a class="btn" href="#gagner">Toutes les parties</a>'}`);
  function over(why, record = true) {
    cv.over = why; tk++;
    if (record) { progress.recordConversion(it.g.t, why === 'gagne' ? 2 : 0, cv.moves.length); header(); }
    keepUi();
    cg.set({ movable: { color: undefined } });
    const [cls, html] = CV_END[why] || CV_END.nulle;
    X.say(cls, `<p>${html} <span class="small">${pl(Math.ceil(cv.moves.length / 2), 'coup')} joués.</span></p>`);
    X.solved(); endBar();
  }
  async function botMove() {
    const k = ++tk;
    X.say('', '<p>Ton adversaire réfléchit…</p>');
    let r;
    try { S.bot ||= new Engine(BOT); r = await S.bot.evalFen(ch.fen(), BOT_DEPTH, true); } catch { S.bot = null; if (X.alive()) X.say('ko', '<p>Le moteur ne répond pas sur ce navigateur. Recharge la page pour réessayer.</p>'); return; }
    if (!X.alive() || k !== tk || cv.over || !r.best) return;
    const before = ch.fen(), m = uciMove(ch, r.best);
    if (!m) return;
    cv.moves.push(r.best); keepUi(); moves();
    cg.set({ fen: ch.fen(), lastMove: [m.from, m.to], turnColor: color, movable: mov(), drawable: { autoShapes: [] } });
    const why = cvEnd(ch, me); if (why) return over(why);
    X.say('', `<p>${esc(justPlayed(describeAt(before, m.san, me)))} <b>À toi.</b></p>`);
  }
  function onMove(from, to) {
    const m = ch.move({ from, to, promotion: 'q' });
    if (!m) { cg.set({ fen: ch.fen(), movable: mov() }); return; }
    cv.moves.push(from + to + (m.promotion || '')); keepUi(); moves();
    cg.set({ fen: ch.fen(), turnColor: turn(), movable: { color: undefined }, drawable: { autoShapes: [] } });
    const why = cvEnd(ch, me); if (why) return over(why);
    botMove();
  }
  X.on({
    async hint() {
      if (cv.over || ch.turn() !== me) return;
      const k = tk, fen = ch.fen();
      X.say('', '<p>Je cherche le meilleur coup…</p>');
      try { S.play ||= new Engine(); const r = await S.play.evalFen(fen, DEPTH, true); if (!X.alive() || k !== tk || ch.fen() !== fen || !r.best) return; cg.setAutoShapes([arrow(r.best, 'green')]); X.say('', `<p><b>Indice.</b> ${esc(hintFor(fen, r.best, me))} La flèche verte montre le coup du moteur.</p>`); } catch { S.play = null; }
    },
    resign() { if (!cv.over) over('abandon'); },
    restart() { S.cv = { t: it.g.t, moves: [], over: null }; keepUi(); render(); },
  });
  moves();
  if (cv.over) return over(cv.over, false);
  playBar();
  if (ch.turn() !== me) botMove();
  else if (cv.moves.length) X.say('', '<p>Partie reprise là où tu l’avais laissée. <b>À toi.</b></p>');
}

// ---------- Vues ----------
function filtersHtml() {
  const has = new Set(S.data.games.map((g) => g.tc));
  return `<select data-f="tc" aria-label="Cadence">${['rapid', 'blitz', 'bullet', 'daily'].filter((k) => has.has(k)).map((k) => `<option value="${k}" ${S.f.tc === k ? 'selected' : ''}>${TC[k]}</option>`).join('')}<option value="all" ${S.f.tc === 'all' ? 'selected' : ''}>Toutes cadences</option></select>
    <select data-f="days" aria-label="Période"><option value="0">Depuis le début</option><option value="90" ${S.f.days === 90 ? 'selected' : ''}>90 derniers jours</option><option value="30" ${S.f.days === 30 ? 'selected' : ''}>30 derniers jours</option></select>
    <button class="btn sm" data-act="refresh" title="Récupérer les nouvelles parties de ${esc(S.user)}">Mettre à jour</button>`;
}
const TITLES = { puzzles: 'Puzzles', erreur: 'Comprendre', partie: 'Partie', cours: 'Cours', drill: 'Échauffement', inedits: 'Positions inédites', gagner: 'Gagner' };
function header() {
  const t = $('#tools'), [r, a] = route();
  const imm = !!S.data && (!!exo.current() || r === 'erreur' || (r === 'cours' && !!a)); // écran d'exercice ou page de cours : barre du haut avec retour
  document.body.classList.toggle('imm', imm);
  $('#ttl').textContent = imm ? TITLES[r] : '';
  if (!S.data) { t.innerHTML = ''; return; }
  const tr = st.trend(rapidAll()), stk = streak();
  // Sur téléphone, pendant un exercice, la barre du haut montre l'avancée (puzzles du jour, position de la série).
  const top = exo.top();
  t.innerHTML = `${top ? `<span class="m-only row chips">${top}</span>` : `<span class="m-only row chips">${tr ? `<span class="chip">${tr.cur} Elo</span>` : ''}<span class="chip ${stk ? 'warn' : ''}">Série ${stk} j</span></span>`}<span class="d-only filters">${filtersHtml()}</span>`;
}

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
  const les = fc ? fc.id : nextLesson(ids), dr = fc ? DRILL_FOR[fc.id] : 'sur';
  // Un exercice commencé puis quitté se reprend là où il s'est arrêté.
  const drOn = S.dr && S.dr.type === dr && S.dr.day === dkey() && S.dr.i > 0 && S.dr.i < S.dr.items.length;
  const clOn = S.cl && S.cl.id === les && S.cl.step > 0 && S.ai[les];
  const steps = [
    { k: 'dr', done: !!a.dr, t: 'Échauffe ton regard', d: drOn ? `« ${DRILLS[dr].t} » : série en cours, position ${S.dr.i + 1} sur ${S.dr.items.length}.` : `« ${DRILLS[dr].t} » : 10 positions, 2 minutes.`, cta: [drOn ? 'Reprendre l’échauffement' : 'Lancer l’échauffement', '#drill/' + dr], p: drOn ? S.dr.i / S.dr.items.length : 0 },
    { k: 'pz', done: es.n > 0 && (pzDone >= pzGoal || due === 0), t: 'Corrige tes erreurs', d: es.n ? `${Math.min(pzDone, pzGoal)} / ${pzGoal} puzzles tirés de tes parties${fc ? ', ton chantier d’abord' : ''}` : (S.job.running ? `Analyse de tes parties en cours (${S.job.done}/${S.job.total}). Les puzzles arrivent.` : 'Lance l’analyse pour créer tes puzzles.'), cta: es.n ? [pzDone ? 'Continuer mes puzzles' : 'Résoudre mes puzzles', null, 'pzfocus'] : (S.job.running ? null : ['Analyser mes parties', null, 'analyse']), p: es.n ? pzDone / pzGoal : 0, x: es.n && pzDone ? pzDots(pzDay()) : '' },
    { k: 'les', done: !!a.les, t: 'Prends ton cours', d: (S.ai[les] ? S.ai[les].titre : LESSONS[les].titre) + (S.ai[les] ? ' · cours privé prêt' : ''), cta: [clOn ? 'Reprendre le cours' : 'Ouvrir le cours', '#cours/' + les], p: a.les ? 1 : 0 },
    { k: 'play', done: played >= 2, t: 'Joue 2 parties rapides', d: `${Math.min(played, 2)} / 2 jouées aujourd’hui.${fc ? ' Avant chaque coup : « ' + RULES[fc.id] + ' »' : ''}`, cta: ['Jouer sur Chess.com', 'https://www.chess.com/play/online/new'], p: Math.min(played, 2) / 2 },
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
function viewAccueil() {
  const gs = games();
  const gb = goalBlock();
  const { steps, es, sig, nDone, fc } = session();
  const cur = steps.find((x) => !x.done);
  const stk = streak();
  const stepHtml = steps.map((x, i) => {
    const on = x === cur;
    const btn = !x.cta ? '' : x.cta[2] ? `<button class="btn ${on ? 'pri lg' : ''}" data-act="${x.cta[2]}">${x.cta[0]}</button>` : `<a class="btn ${on ? 'pri lg' : ''}" href="${x.cta[1]}" ${x.cta[1].startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${x.done ? 'Refaire' : x.cta[0]}</a>`;
    return `<div class="step ${x.done ? 'done' : on ? 'on' : ''}"><span class="stepn">${x.done ? '✓' : i + 1}</span>
      <div class="stepc"><b>${x.t}</b><span>${esc(x.d)}</span>${x.x || ''}${on && x.p > 0 && x.p < 1 && !x.x ? `<span class="goalbar"><i style="width:${100 * x.p}%"></i></span>` : ''}</div>
      <div class="stepa">${btn}${x.k === 'play' && on ? '<button class="btn" data-act="refresh">J’ai joué, mettre à jour</button>' : ''}</div></div>`;
  }).join('');
  const sigHtml = (arr, c, empty) => (arr.length ? arr.slice(0, 4).map((x) => `<div class="sig" style="--c:var(--${c})"><b>${esc(x.t)}</b><span>${esc(x.d)}</span>${x.lesson ? `<a href="#${x.lesson === 'ouvertures' ? 'ouvertures' : 'cours/' + x.lesson}">${x.lesson === 'ouvertures' ? 'Voir tes ouvertures' : 'Ouvrir le cours'}</a>` : ''}</div>`).join('') : `<p class="sub">${empty}</p>`);
  const all = st.tally(gs);
  return `<div class="row" style="justify-content:space-between"><h1>Bonjour ${esc(S.data.profile.username)}</h1>
    <span class="chip d-only ${stk ? 'warn' : ''}" title="Jours consécutifs avec au moins un puzzle ou un cours">Série : ${stk} jour${stk > 1 ? 's' : ''}</span></div>
  <section class="card today"><div class="row" style="justify-content:space-between"><h2>${nDone === steps.length ? 'Séance du jour terminée' : 'Ta séance du jour'}</h2><span class="chip ${nDone === steps.length ? 'good' : ''}">${nDone} / ${steps.length}</span></div>
    ${nDone === steps.length ? coach('Séance bouclée. Reviens demain : les puzzles réussis reviendront au bon moment pour ancrer le réflexe.') : ''}
    <div class="steps">${stepHtml}</div></section>
  ${focusCard(fc, es)}
  <div class="tilesnav">
    <a class="tnav" href="#puzzles"><b>Puzzles</b><span>${pzQueue('', false).length} à faire</span></a>
    <a class="tnav" href="#cours"><b>Cours</b><span>${es.themes.length ? es.themes.length + ' thèmes à travailler' : 'Fiches et cours privés'}</span></a>
    <a class="tnav" href="#parties"><b>Parties</b><span>${es.n} analysées sur ${gs.length}</span></a>
    <a class="tnav" href="#exos"><b>Échauffements</b><span>4 exercices de 2 minutes</span></a></div>
  <div class="hero">${gb.html}
    <div class="card"><h2>Ton classement ${S.f.tc === 'all' ? 'Rapide' : TC[S.f.tc]}</h2><div class="chart" id="rc"></div></div></div>
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
  </div>` : `<div class="card"><p class="sub">Aucune partie pour ce filtre (${TC[S.f.tc]}). Change la cadence ou la période.</p></div>`}`;
}
function mountAccueil() {
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
  return `<form data-form="key" class="row"><input type="text" id="keyin" placeholder="sk-ant-…" autocomplete="off" spellcheck="false" style="flex:1;min-width:200px" aria-label="Clé API Anthropic"><button class="btn pri">Activer le coach</button></form>
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
  return `<h1>Cours</h1>
    ${coachKey() ? coach('Je prépare chaque cours à partir de tes propres positions : une idée, tes erreurs à rejouer, une règle à emporter. Ouvre un cours et demande-moi de le préparer.')
    : `<div class="card"><h2>Ton coach privé</h2><p class="prose">Chaque cours peut devenir une leçon particulière : Claude étudie tes positions, te pose les bonnes questions avant de te laisser jouer, puis t’explique pourquoi ton coup échouait. Deux façons de faire : avec ton abonnement Claude (un copier-coller, proposé dans chaque cours), ou en un clic avec une clé API facturée à l’usage.</p><details class="manual"><summary>Activer la génération en un clic (clé API)</summary>${keyForm()}</details></div>`}
    ${ids.length ? `<h2>Tes priorités</h2><div class="grid">${ids.map((id, i) => card(id, i < 3 ? i + 1 : 0)).join('')}</div>` : `<div class="card"><p class="sub">${S.job.running ? 'Analyse en cours : le classement des cours arrive.' : 'Lance l’analyse de tes parties pour classer les cours selon tes erreurs.'}</p></div>`}
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
      <li><button class="btn pri" data-act="brief" data-id="${id}">Copier le brief du cours</button> <span class="small" id="briefok"></span></li>
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
      head: head + coach(`<b>Position ${i + 1} sur ${L.positions.length}.</b> Coup ${moveNo(x.e)} de ta ${gameRef(x.g)}. ${lm ? esc(lm) + ' ' : ''}<br>${txt(pos.question)}`),
      cap: `<p><i class="dot ${x.g.w ? 'w' : 'b'}"></i> Trait aux ${x.g.w ? 'Blancs' : 'Noirs'}. Joue le coup que tu aurais dû jouer.</p>`,
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
  const coachCard = busy ? coach('Je prépare ton cours à partir de tes positions. Compte 20 à 40 secondes.')
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
      <span class="row"><span class="chip bad">−${x.e.drop} pts de chances de gain</span><a class="btn pri sm" href="#erreur/${x.g.t}/${x.e.ply}">Travailler cette position</a><a class="btn sm" href="#partie/${x.g.t}/${x.e.ply}">Revoir dans la partie</a></span></div></div>`).join('')}
    <div><button class="btn pri" data-act="pztheme" data-theme="${id}">M’entraîner sur ce thème</button></div></div>`
    : ENGINE_LESSONS.includes(id) ? '<div class="card"><p class="sub">Aucun exemple de ce type dans tes parties analysées. Soit tu ne fais pas cette erreur, soit il faut analyser davantage de parties.</p></div>' : ''}
  ${blown.length ? `<div class="card"><h2>Parties qui t’ont échappé</h2><div><a class="btn pri" href="#gagner">Les rejouer pour les gagner</a></div>${blown.map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or})</span><span class="chip ${g.out === 'L' ? 'bad' : ''}">${g.out === 'L' ? 'Défaite' : 'Nulle'}</span></a>`).join('')}</div>` : ''}
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
  for (const s of S.path) { const k = node.kids.get(s); if (!k || !ch.move(s)) break; node = k; path.push(s); }
  S.path = path; S.exFen = ch.fen();
  const kids = [...node.kids.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const myTurn = (path.length % 2 === 0) === S.white;
  const first = S.white ? [...root.kids.entries()].sort((a, b) => b[1].n - a[1].n)[0] : null;
  const side = st.tally(gs.filter((g) => g.w === S.white));
  const crumbs = path.map((s, i) => `<button class="btn sm" data-act="expath" data-n="${i + 1}">${i % 2 === 0 ? i / 2 + 1 + '. ' : ''}${fr(s)}</button>`).join('');
  const reps = st.repeatedErrors(gs, S.an).slice(0, 6);
  const repCard = reps.length ? `<div class="card"><h2>Tes erreurs qui reviennent</h2><p class="small">Même position, même faute, dans plusieurs parties. Une position travaillée ici, c’est une erreur de moins dans toutes les parties qui y passent.</p>
    ${reps.map((r) => `<div class="hrow"><i class="dot ${r.w ? 'w' : 'b'}"></i><span class="stepc"><b>${esc(st.lineText(r.line, Math.max(0, r.line.length - 6)))}</b><span>${r.games} parties : ${esc(st.repText(r))}</span></span><a class="btn sm pri" href="#erreur/${r.last.g.t}/${r.last.e.ply}">Travailler</a></div>`).join('')}</div>` : '';
  return `<div class="row" style="justify-content:space-between"><h1>Ouvertures</h1><div class="row" role="group" aria-label="Couleur">
    <button class="btn ${S.white ? 'pri' : ''}" data-act="color" data-w="1"><i class="dot w"></i>Blancs</button><button class="btn ${S.white ? '' : 'pri'}" data-act="color" data-w="0"><i class="dot b"></i>Noirs</button></div></div>
  ${repCard}
  <div class="card"><h2>Tes ouvertures avec les ${S.white ? 'Blancs' : 'Noirs'} <span class="small">${side.n} parties, ${st.score(side)} % de score</span></h2>
    ${ops.length ? `<div class="scroll"><table><thead><tr><th>Ouverture</th><th class="r">Parties</th><th>Résultats</th><th class="r">Score</th><th class="r" title="Évaluation moyenne du moteur après 10 coups, de ton point de vue">Après 10 coups</th><th>Verdict</th></tr></thead><tbody>
    ${ops.slice(0, 12).map((o) => `<tr><td><b>${esc(o.fam)}</b>${o.vars.size > 1 ? `<br><span class="small">${[...o.vars.values()].sort((a, b) => b.n - a.n).slice(0, 2).map((v) => esc(v.op.replace(o.fam, '').trim() || 'ligne principale') + ' (' + v.n + ')').join(', ')}</span>` : ''}</td>
      <td class="r">${o.n}</td><td style="min-width:110px">${wdl(o)}</td><td class="r"><b>${st.score(o)} %</b></td><td class="r">${exitEval(o.fam)}</td><td>${verdict(o)}</td></tr>`).join('')}
    </tbody></table></div>${WDL_LEGEND}` : '<p class="sub">Aucune partie avec cette couleur pour ce filtre.</p>'}</div>
  <div class="split"><div class="board" id="exb"></div>
    <div class="card"><h2>Explorateur de tes parties</h2>
      <div class="row"><button class="btn sm" data-act="expath" data-n="0">Début</button>${crumbs}</div>
      <p class="small">${node.n} partie${node.n > 1 ? 's' : ''} dans cette position, ${st.score(node)} % de score. ${kids.length ? (myTurn ? 'Tes coups ici :' : 'Les réponses de tes adversaires :') : ''}</p>
      ${kids.length ? `<table><tbody>${kids.map(([s, k]) => `<tr class="click" data-act="exmove" data-san="${esc(s)}"><td><b>${fr(s)}</b></td><td class="r">${k.n}</td><td style="width:40%">${wdl(k)}</td><td class="r">${st.score(k)} %</td></tr>`).join('')}</tbody></table>` : '<p class="sub">Fin des coups enregistrés pour cette ligne.</p>'}
    </div></div>
  <div class="card"><h2>Répertoire conseillé sous 1000</h2><div class="prose stack">
    ${first ? `<p>Tu ouvres par <b>${fr(first[0])}</b> dans ${st.pct(first[1].n, side.n)} % de tes parties avec les Blancs (${st.score(first[1])} % de score).</p>` : ''}
    <p><b>Un seul système par couleur.</b> À ce niveau, les parties se décident sur les pièces en prise, pas sur la théorie. Jouer toujours la même structure te donne des positions connues et libère du temps pour vérifier tes coups.</p>
    <p><b>Avec les Blancs :</b> 1.e4, puis Cf3, Fc4, petit roque, d3 (partie italienne). Développement naturel, roi en sécurité en cinq coups.</p>
    <p><b>Avec les Noirs contre 1.e4 :</b> 1...e5, puis Cc6, Fc5 ou Cf6, petit roque. <b>Contre 1.d4 :</b> 1...d5, puis Cf6, e6, Fe7, petit roque.</p>
    <p>Dans le tableau ci-dessus, garde les lignes marquées « À garder » et remplace celles marquées « À travailler » par ce répertoire.</p></div></div>`;
}

function viewParties() {
  const gs = games().slice().reverse();
  S.listN ||= 50;
  return `<h1>Parties</h1><div class="card"><div class="scroll"><table><thead><tr><th>Date</th><th>Résultat</th><th>Adversaire</th><th>Ouverture</th><th class="r">Coups</th><th class="r">Précision</th><th class="r">Gaffes</th></tr></thead><tbody>
    ${gs.slice(0, S.listN).map((g) => { const a = S.an[g.id]; return `<tr class="click" data-act="open" data-t="${g.t}"><td class="num">${dfmt(g.t)}</td>
      <td><span class="row" style="gap:6px;flex-wrap:nowrap"><i class="dot ${g.w ? 'w' : 'b'}" title="${g.w ? 'Blancs' : 'Noirs'}"></i><span class="chip ${g.out === 'W' ? 'good' : g.out === 'L' ? 'bad' : ''}">${g.out === 'W' ? 'Victoire' : g.out === 'L' ? 'Défaite' : 'Nulle'}</span></span></td>
      <td>${esc(g.opp)} <span class="small num">${g.or}</span></td><td>${esc(g.fam)}</td><td class="r">${Math.ceil(g.san.length / 2)}</td>
      <td class="r">${a && a.acc != null ? a.acc.toFixed(0) + ' %' : '<span class="small">non analysée</span>'}</td><td class="r">${a && !a.bad ? a.errs.filter((e) => e.kind === 'gaffe').length : ''}</td></tr>`; }).join('')}
    </tbody></table></div>${gs.length > S.listN ? '<div><button class="btn" data-act="more">Afficher 50 parties de plus</button></div>' : ''}</div>`;
}

// Meilleur coup du moteur dans la position k de la relecture (null si partie non analysée ou terminée).
function gvBest(v, k) {
  const uci = v.a?.best?.[k]; if (!uci) return null;
  const m = uciMove(new Chess(v.fens[k]), uci);
  return m ? { uci, san: m.san, played: v.mv[k] && v.mv[k].from + v.mv[k].to === uci.slice(0, 4) } : null;
}
// Bandeau de la relecture : cls est la classe d'état du bandeau (sans « cap »).
function gvCap(v) {
  const k = v.k, g = v.g, a = v.a, e = v.errAt[k], prevErr = v.errAt[k - 1], me = g.w ? 'w' : 'b';
  const kindChip = (x) => `<span class="chip ${x.kind === 'gaffe' ? 'bad' : x.kind === 'erreur' ? 'warn' : ''}">${x.kind === 'gaffe' ? 'Gaffe' : x.kind === 'erreur' ? 'Erreur' : 'Imprécision'}</span>`;
  if (e) return { cls: 'ko', html: `<div class="capm"><span class="capn">Moment clé, coup ${moveNo(e)}</span>${kindChip(e)}</div><p>${explain(e)}</p><a class="btn pri sm" href="#erreur/${g.t}/${e.ply}">Comprendre cette erreur</a>` };
  const txtK = k > 0 ? moveText(g, k, me) : 'Position de départ. Avance coup par coup : chaque coup est commenté ici.';
  const b = gvBest(v, k), bestP = b ? `<span class="capbest">Meilleur <b>${fr(b.san)}</b>${b.played ? ' (joué)' : ''}</span>` : '';
  return { cls: '', html: `<div class="capm"><span class="capn">${k > 0 ? `<i class="dot ${k % 2 ? 'w' : 'b'}"></i>${Math.ceil(k / 2)}${k % 2 ? '.' : '…'} ${fr(v.mv[k - 1].san)}` : 'Début'}</span>${prevErr ? kindChip(prevErr) : ''}${a ? `<span class="small">éval ${fmtEval(g.w ? a.ev[k] : -a.ev[k])}</span>` : ''}${bestP}</div><p>${esc(txtK)}</p>` };
}
function gvBar(v) {
  const k = v.k, n = v.mv.length;
  return `<button class="btn ico" data-act="goto" data-k="0" aria-label="Début" ${k === 0 ? 'disabled' : ''}>${ico('first')}</button><button class="btn ico" data-act="goto" data-k="${Math.max(0, k - 1)}" aria-label="Coup précédent" ${k === 0 ? 'disabled' : ''}>${ico('prev')}</button><button class="btn ico pri" data-act="goto" data-k="${Math.min(n, k + 1)}" aria-label="Coup suivant" ${k === n ? 'disabled' : ''}>${ico('next')}</button><button class="btn ico" data-act="goto" data-k="${n}" aria-label="Fin" ${k === n ? 'disabled' : ''}>${ico('last')}</button>${v.a?.errs.some((x) => x.theme) ? '<button class="btn" data-act="nexterr">Erreur suivante</button>' : ''}`;
}
function viewPartie(t, plyArg) {
  const g = S.data.games.find((x) => String(x.t) === String(t));
  if (!g) return viewParties();
  const a = S.an[g.id] && !S.an[g.id].bad ? S.an[g.id] : null;
  const ch = new Chess(), fens = [ch.fen()], mv = [];
  for (const s of g.san) { const m = ch.move(s, { sloppy: true }); if (!m) break; mv.push(m); fens.push(ch.fen()); }
  if (!S.gv || S.gv.t !== g.t) S.gv = { t: g.t, k: plyArg != null ? Math.min(+plyArg, mv.length) : 0 };
  const v = Object.assign(S.gv, { fens, mv, g, a, errAt: a ? Object.fromEntries(a.errs.map((e) => [e.ply, e])) : {} });
  const errAt = v.errAt, cap = gvCap(v);
  const moves = mv.map((m, i) => `${i % 2 === 0 ? `<span class="n">${i / 2 + 1}.</span>` : ''}<button data-act="goto" data-k="${i + 1}" class="${errAt[i]?.kind || ''}">${fr(m.san)}${errAt[i] ? `<sup>${errAt[i].kind === 'gaffe' ? '??' : errAt[i].kind === 'erreur' ? '?' : '?!'}</sup>` : ''}</button>`).join('');
  const serious = a ? a.errs.filter((x) => x.theme) : [];
  const res = `<span class="chip ${g.out === 'W' ? 'good' : g.out === 'L' ? 'bad' : ''}">${g.out === 'W' ? 'Victoire' : g.out === 'L' ? 'Défaite' : 'Nulle'}${HOW[g.how] ? ' (' + HOW[g.how] + ')' : ''}</span>`;
  return exo.screen({
    head: `<div class="pzhead"><h1>${g.w ? 'Blancs' : 'Noirs'} contre ${esc(g.opp)} <span class="small num">${g.or}</span></h1>
      <div class="row">${res}<span class="chip">${dfmt(g.t)}</span><span class="chip">${esc(g.fam)}</span><a class="btn sm" href="${esc(g.id)}" target="_blank" rel="noopener">Chess.com</a></div></div>`,
    cap: cap.html, capClass: cap.cls,
    panel: `${a ? `<div class="row"><span class="chip bad">${pl(a.errs.filter((x) => x.kind === 'gaffe').length, 'gaffe')} ??</span><span class="chip warn">${pl(a.errs.filter((x) => x.kind === 'erreur').length, 'erreur')} ?</span><span class="chip">${pl(a.errs.filter((x) => x.kind === 'imprecision').length, 'imprécision')} ?!</span><span class="chip good">Précision ${a.acc?.toFixed(0)} %</span></div>
      <div class="card"><h2>Tes chances de gain</h2><div class="chart" id="evc"></div><p class="small">Points rouges : gaffes. Points orange : erreurs. Touche la courbe pour aller au coup.</p></div>`
    : `<div class="card"><p class="sub">Cette partie n’est pas encore analysée.</p><div><button class="btn pri" data-act="analyse1" ${S.job.running ? 'disabled' : ''}>${S.job.running ? 'Analyse en cours' : 'Analyser cette partie'}</button></div></div>`}
      <div class="card"><h2>Coups</h2><div class="moves">${moves}</div></div>
      ${serious.length ? `<div class="card"><h2>Moments clés</h2>${serious.map((x) => `<a class="row" href="#" data-act="goto" data-k="${x.ply}" style="justify-content:space-between;text-decoration:none"><span>Coup ${moveNo(x)} : ${fr(x.played)}, mieux ${fr(x.bestSan)}</span><span class="chip ${x.kind === 'gaffe' ? 'bad' : 'warn'}">${st.THEMES[x.theme]}</span></a>`).join('')}</div>` : ''}`,
    bar: gvBar(v),
  });
}
// Met à jour l'écran de relecture sans le reconstruire : les pièces s'animent d'un coup à l'autre.
function gvSync() {
  const v = S.gv, k = v.k, e = v.errAt[k], cap = gvCap(v);
  v.cg.set({ fen: v.fens[k], lastMove: k > 0 ? [v.mv[k - 1].from, v.mv[k - 1].to] : undefined, drawable: { autoShapes: e ? errShapes(e) : gvBest(v, k) ? [arrow(gvBest(v, k).uci, 'green')] : [] } });
  v.x.say(cap.cls, cap.html);
  v.x.setBar(gvBar(v));
  document.querySelectorAll('.moves button').forEach((b, i) => b.classList.toggle('cur', i + 1 === k));
  const box = $('.moves'), curB = $('.moves .cur'); // défile la liste des coups, jamais la page
  if (box && curB) box.scrollTop = curB.offsetTop - box.offsetTop - box.clientHeight / 2;
  const c = $('#evc');
  if (c && v.a) {
    const pts = v.a.ev.map((cp, i) => ({ x: i, y: winPct(v.g.w ? cp : -cp), tip: (i ? `Coup ${Math.ceil(i / 2)} (${fr(v.mv[i - 1]?.san || '')}) : ` : 'Début : ') + Math.round(winPct(v.g.w ? cp : -cp)) + ' %' }));
    const marks = v.a.errs.filter((x) => x.kind !== 'imprecision').map((x) => ({ i: x.ply, c: x.kind === 'gaffe' ? 'bad' : 'warn' }));
    lineChart(c, pts, { h: 170, min: 0, max: 100, step: 25, base: 0, yfmt: (y) => y + ' %', marks, cursor: Math.min(k, pts.length - 1), label: 'Chances de gain au fil de la partie', x0: 'Début', x1: 'Fin', onPick: gvGo });
  }
}
function gvGo(k) {
  const v = S.gv; if (!v) return;
  v.k = Math.max(0, Math.min(v.mv.length, k));
  if (v.x?.alive() && v.cg) gvSync(); else render(true);
}
function mountPartie() {
  const v = S.gv, X = exo.current(); if (!X || !v) return;
  v.x = X;
  v.cg = X.board({ fen: v.fens[v.k], orientation: v.g.w ? 'white' : 'black', viewOnly: true });
  gvSync();
}

function viewExos() {
  const hist = progress.drills();
  return `<h1>Échauffements</h1>${coach('Sous 1000 Elo, la plupart des parties se perdent sur une vérification oubliée. Ces exercices entraînent le geste lui-même, sur des positions tirées de tes parties : 10 positions, 2 minutes. La justesse d’abord, la vitesse vient ensuite.')}
  <div class="menu">${Object.entries(DRILLS).map(([k, d]) => {
    const h = hist.filter((x) => x.type === k), last = h[h.length - 1];
    return `<a class="mrow" href="#drill/${k}"><span class="mico">${h.length ? Math.round((100 * last.ok) / last.n) + '%' : ico('play')}</span><span class="stepc"><b>${d.t}</b><span>${d.d}${h.length ? ` · ${pl(h.length, 'série')}` : ''}</span></span><span class="chev" aria-hidden="true">›</span></a>`;
  }).join('')}
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
function viewPlus() {
  const row = (href, t, d, ic) => `<a class="mrow" href="${href}"><span class="mico">${ic}</span><span class="stepc"><b>${t}</b><span>${d}</span></span><span class="chev" aria-hidden="true">›</span></a>`;
  const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">${d}</svg>`;
  return `<h1>Plus</h1><div class="menu">
    ${row('#exos', 'Échauffements', '4 exercices rapides pour automatiser la vérification', svg('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>'))}
    ${row('#ouvertures', 'Ouvertures', 'Tes résultats par ouverture, ton répertoire', svg('<path d="M11 3h2v5h5v4h-2v-2h-3v3h3v8H8v-8h3v-3H8v2H6V8h5z"/>'))}
    ${row('#stats', 'Stats', 'Toutes tes données depuis ta première partie', svg('<path d="M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z"/>'))}
    ${row('#gagner', 'Gagner les parties gagnées', 'Rejoue tes avantages gâchés contre le moteur', svg('<path d="M5 3h14v3a5 5 0 0 1-4 4.900V14h2v3H7v-3h2v-3.100A5 5 0 0 1 5 6zm2 18h10v-2H7z"/>'))}
    ${row('#plan', 'Plan et réglages', 'Plan de la semaine, objectif, coach Claude, sauvegarde', svg('<path d="M7 2h2v2h6V2h2v2h3v17H4V4h3zm-1 7v10h12V9z"/>'))}</div>
  <div class="card"><h2>Tes données</h2><p class="sub">Compte ${esc(S.user)}. Dernière mise à jour le ${new Date(S.data.fetchedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.</p>
    <div class="stack filters">${filtersHtml()}</div></div>
  ${backupCard()}`;
}
// Sauvegarde : rien n'est synchronisé entre appareils, le fichier sert de copie de sécurité et de transfert.
function backupCard() {
  const at = ls.get('bak', null), ago = at ? Math.floor((Date.now() - at) / DAY) : null;
  return `<div class="card"><h2>Sauvegarde</h2><p class="sub">Tes puzzles, ton journal, tes analyses et tes cours ne vivent que dans ce navigateur. Garde une copie, ou passe-les sur un autre appareil.</p>
    <p class="small">${at ? `Dernière sauvegarde ${ago === 0 ? 'aujourd’hui' : ago === 1 ? 'hier' : `il y a ${ago} jours`}.` : 'Aucune sauvegarde depuis cet appareil.'} La clé du coach n’est jamais mise dans le fichier.</p>
    <div class="row"><button class="btn ${!at || ago >= 14 ? 'pri' : ''}" data-act="bakexp">Télécharger ma sauvegarde</button><button class="btn" data-act="bakimp">Restaurer un fichier</button><input type="file" id="bakfile" accept="application/json,.json" hidden></div>
    <p class="small" id="bakmsg" role="status"></p></div>`;
}
function weekKey() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }
function viewPlan() {
  const gb = goalBlock(), hours = ls.get('hours', 6), wk = weekKey(), done = ls.get('plan:' + wk, {});
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
  const g = gb.g;
  return `<h1>Plan de la semaine</h1>
  <div class="hero">${gb.html}
    <div class="card"><h2>Semaine du ${new Date(wk + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</h2>
      <div class="row"><label for="hrs" class="sub">Temps disponible</label><select id="hrs">${[3, 4, 5, 6, 8, 10].map((h) => `<option value="${h}" ${h === hours ? 'selected' : ''}>${h} h par semaine</option>`).join('')}</select></div>
      <div class="stack"><b>Jouer : <span class="num">${played} / ${target}</span> parties rapides cette semaine</b>
        <div class="goalbar" aria-hidden="true"><i style="width:${Math.min(100, (100 * played) / target)}%"></i></div>
        <p class="small">Compté automatiquement à chaque mise à jour. Cadence conseillée : 15|10, l’incrément laisse le temps de vérifier chaque coup.</p></div>
      <div class="stack">${items.map(([id, label, href]) => `<label class="check ${done[id] ? 'done' : ''}"><input type="checkbox" data-plan="${id}" ${done[id] ? 'checked' : ''}><span>${esc(label)} <a href="${href}">Ouvrir</a></span></label>`).join('')}</div>
    </div></div>
  <div class="grid">
    <div class="card"><h2>Avant chaque coup</h2><ol class="routine"><li>Que menace le dernier coup adverse ?</li><li>Ai-je un échec, une capture ou une menace ?</li><li>La case où je vais est-elle attaquée ?</li><li>Après mon coup, qu’est-ce que je laisse sans défense ?</li></ol></div>
    <div class="card"><h2>Règles de session</h2><ol class="routine"><li>Deux défaites de suite : fin des parties pour aujourd’hui, place aux puzzles.</li><li>Jamais de partie classée en étant pressé ou fatigué.</li><li>Après chaque défaite, mise à jour ici et relecture des moments clés.</li></ol></div>
    <div class="card"><h2>Ton objectif</h2><div class="row"><label for="gelo" class="sub">Elo visé</label><input type="number" id="gelo" value="${g.elo}" min="100" max="3000" step="50" style="width:100px"></div>
      <div class="row"><label for="gdate" class="sub">Échéance</label><input type="date" id="gdate" value="${g.date}"></div>
      <div><button class="btn sm" data-act="reset">Changer de pseudo ou effacer les données</button></div></div>
    ${backupCard()}
    <div class="card"><h2>Coach Claude</h2>${coachKey() ? `<p class="sub">Coach activé. Clé enregistrée sur cet appareil (…${esc(coachKey().slice(-4))}).</p>
      <div class="row"><label for="cmodel" class="sub">Modèle</label><select id="cmodel">${MODELS.map(([v, l]) => `<option value="${v}" ${coachModel() === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><button class="btn sm" data-act="keydel">Supprimer la clé de cet appareil</button></div>` : keyForm()}</div>
  </div>`;
}

// ---------- État de l'écran, conservé quand on quitte ou recharge la page ----------
function keepUi() {
  if (!S.data) return;
  ls.set('ui', { d: dkey(), pz: S.pz, cl: S.cl, cv: S.cv && !S.cv.over ? S.cv : null, dr: S.dr && S.dr.i < S.dr.items.length ? S.dr : null, li: S.li?.cur && !S.li.counted ? { cur: S.li.cur, failed: !!S.li.failed, replay: !!S.li.replay } : null });
}
function restoreUi() {
  const u = ls.get('ui', null); if (!u) return;
  const same = u.d === dkey();
  if (u.pz) S.pz = same ? u.pz : { ...u.pz, free: false, redo: [], show: null }; // un nouveau jour repart de la file normale
  S.cl = u.cl || null;
  S.cv = u.cv || null;
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
    await load(); restoreUi();
    location.hash = '#accueil'; render();
    reclassify(); autoAnalyse();
  } catch (e) { if (m) m.textContent = e.message || String(e); }
}

// ---------- Routage et événements ----------
const route = () => (location.hash.slice(1) || 'accueil').split('/');
function render(keepScroll) {
  const y = scrollY;
  destroyBoards();
  $('#tip').hidden = true;
  const v = $('#view'), [r, a, b] = route();
  paintJob();
  $('#nav').hidden = !S.data;
  document.querySelectorAll('#nav a').forEach((x) => x.classList.toggle('on', x.getAttribute('href') === '#' + ({ partie: 'parties', erreur: 'puzzles', inedits: 'puzzles', drill: 'puzzles', historique: 'puzzles' }[r] || r) || (x.getAttribute('href') === '#plus' && ['ouvertures', 'plan', 'stats', 'exos', 'gagner'].includes(r))));
  if (!S.data) { v.innerHTML = viewWelcome(); exo.attach(); header(); const f = $('#wf'); f.onsubmit = (ev) => { ev.preventDefault(); const u = $('#wu').value.trim(); if (u) doImport(u); }; return; }
  if (r !== 'partie') S.gv = null;
  if (r !== 'drill' && S.dr && S.dr.i >= S.dr.items.length) S.dr = null; // une série en cours se reprend, une série finie repart de zéro
  const html = r === 'puzzles' ? viewPuzzles() : r === 'erreur' ? viewPuzzles([a, b]) : r === 'plus' ? viewPlus() : r === 'historique' ? viewHistory() : r === 'exos' ? viewExos() : r === 'inedits' ? viewInedits() : r === 'drill' ? viewDrill(a) : r === 'cours' ? (a ? viewLecon(a, b) : viewCours()) : r === 'ouvertures' ? viewOuvertures() : r === 'parties' ? viewParties() : r === 'partie' ? viewPartie(a, b) : r === 'plan' ? viewPlan() : r === 'stats' ? viewStats(S) : r === 'gagner' ? viewGagner(a) : viewAccueil();
  v.innerHTML = html;
  exo.attach(); // avant de créer les échiquiers : ils naissent à leur taille définitive
  if (r === 'puzzles' || r === 'erreur') { mountPuzzle(); const s = $('#pzt'); if (s) s.onchange = () => { S.pz.theme = s.value; S.pz.cur = null; S.pz.show = null; render(); }; }
  else if (r === 'cours' && a) mountLecon();
  else if (r === 'ouvertures') board($('#exb'), { fen: S.exFen, orientation: S.white ? 'white' : 'black', viewOnly: true });
  else if (r === 'partie') mountPartie();
  else if (r === 'drill') mountDrill();
  else if (r === 'inedits') mountInedits();
  else if (r === 'gagner') mountGagner();
  else if (r === 'stats') mountStats(S);
  else if (r === 'plan') {
    $('#hrs').onchange = (e) => { ls.set('hours', +e.target.value); render(true); };
    const save = () => { const elo = +$('#gelo').value, date = $('#gdate').value; if (elo >= 100 && date) { ls.set('goal', { elo, date }); render(true); } };
    $('#gelo').onchange = save; $('#gdate').onchange = save;
    const cm = $('#cmodel'); if (cm) cm.onchange = () => ls.set('model', cm.value);
    document.querySelectorAll('[data-plan]').forEach((c) => { c.onchange = () => { const k = 'plan:' + weekKey(), d = ls.get(k, {}); d[c.dataset.plan] = c.checked; ls.set(k, d); c.closest('.check').classList.toggle('done', c.checked); }; });
  } else mountAccueil();
  header();
  keepUi();
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
}
document.addEventListener('click', (ev) => {
  const x = ev.target.closest('[data-x]'); // action de l'exercice en cours : indice, solution, lecture d'une suite…
  if (x) { exo.act(x.dataset.x, x); return; }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'A') ev.preventDefault();
  if (act === 'refresh') doImport(S.user);
  else if (act === 'analyse') runAnalysis(20);
  else if (act === 'analyse1') runAnalysis(1, S.gv.g);
  else if (act === 'stattc') { S.statTc = el.dataset.tc; render(true); }
  else if (act === 'back') {
    const r = route()[0];
    if (r === 'erreur') { if (history.length > 1) history.back(); else location.hash = '#puzzles'; }
    else if (r === 'gagner') location.hash = route()[1] ? '#gagner' : '#exos';
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
  else if (act === 'pzredo') { S.pz.redo = failedToday(); S.pz.show = null; render(); }
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
  else if (act === 'keydel') { ls.del('key'); render(true); }
  else if (act === 'nexterr') { const v = S.gv, list = v.a.errs.filter((x) => x.theme).map((x) => x.ply); const nx = list.find((p) => p > v.k) ?? list[0]; if (nx != null) gvGo(nx); }
  else if (act === 'color') { S.white = el.dataset.w === '1'; S.path = []; render(true); }
  else if (act === 'exmove') { S.path.push(el.dataset.san); render(true); }
  else if (act === 'expath') { S.path = S.path.slice(0, +el.dataset.n); render(true); }
  else if (act === 'open') location.hash = '#partie/' + el.dataset.t;
  else if (act === 'more') { S.listN += 50; render(true); }
  else if (act === 'goto') gvGo(+el.dataset.k);
  else if (act === 'bakexp') { const m = $('#bakmsg'); backup.exportFile(S.user).then((n) => { if (m) m.textContent = `Fichier ${n} téléchargé. Range-le dans tes fichiers ou envoie-le sur ton autre appareil.`; }).catch((e) => { if (m) m.textContent = 'Sauvegarde impossible : ' + (e.message || e); }); }
  else if (act === 'bakimp') $('#bakfile')?.click();
  else if (act === 'reset') {
    if (el.dataset.sure) { const u = S.user; ls.clear(['key', 'model', 'goal', 'hours']); dbDel('data:' + u); dbDel('an:' + u); dbDel('ai:' + u); S.ai = {}; S.li = null; S.liKeep = null; S.dr = null; S.cv = null; S.gen = null; S.cl = null; LINES.clear(); S.job.stop = true; S.user = null; S.data = null; S.an = {}; S.pz = null; location.hash = '#accueil'; render(); }
    else { el.dataset.sure = '1'; el.textContent = 'Confirmer : effacer parties, analyses et progression (réglages et clé du coach conservés)'; }
  }
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'bakfile') { restoreFrom(ev.target.files[0]); ev.target.value = ''; return; }
  const el = ev.target.closest('[data-f]'); if (!el) return;
  if (el.dataset.f === 'liangle' || el.dataset.f === 'lidiff') { S.li[el.dataset.f === 'liangle' ? 'angle' : 'diff'] = el.value; ls.set('li', { angle: S.li.angle, diff: S.li.diff }); S.li.cur = null; S.li.err = null; render(true); return; }
  if (el.dataset.f === 'focus') { ls.set('focus', { id: el.value, since: Math.floor(Date.now() / 1000) }); render(true); return; }
  if (el.dataset.f === 'tc') { S.f.tc = el.value; if (S.pz) pzReset('', false); } else S.f.days = +el.value;
  ls.set('filter', S.f); S.path = []; render(true);
});
document.addEventListener('submit', async (ev) => {
  const f = ev.target.closest('form[data-form]'); if (!f) return;
  ev.preventDefault();
  if (f.dataset.form === 'key') { const v = $('#keyin', f).value.trim(); if (v) { ls.set('key', v); render(true); } }
  else if (f.dataset.form === 'paste') {
    const id = f.dataset.id, refs = ls.get('brief:' + id, null) || lessonArgs(id).ex.map((x) => ({ t: x.g.t, ply: x.e.ply }));
    try { const L = parseLesson($('#pastein').value, refs.length); L.ex = refs; L.model = 'abonnement'; S.ai[id] = L; await dbSet('ai:' + S.user, S.ai); S.cl = null; S.gen = null; location.hash = '#cours/' + id; render(); }
    catch (e) { $('#pasteerr').textContent = e.message; }
  }
  else if (f.dataset.form === 'ask') {
    const q = $('#askq').value.trim(), out = $('#aska'), c = S.clPos; if (!q || !c) return;
    out.innerHTML = coach('Je regarde la position…');
    try { const L = S.ai[S.cl.id]; const ans = await askCoach(`Cours : ${L.titre}. Idée : ${L.idee}\n${facts(c.x.g, c.x.e)}\nExplication donnée : ${c.pos.explication}`, q); out.innerHTML = coach(txt(ans)); }
    catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
});
document.addEventListener('keydown', (ev) => {
  if (/INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
  if (exo.key(ev)) return; // lecture d'une suite : flèches pour avancer, espace pour lire ou mettre en pause
  if (route()[0] !== 'partie' || !S.gv) return;
  if (ev.key === 'ArrowLeft') gvGo(S.gv.k - 1); else if (ev.key === 'ArrowRight') gvGo(S.gv.k + 1);
});
addEventListener('hashchange', () => render());
document.addEventListener('pointerover', (ev) => {
  const el = ev.target.closest?.('[data-tip]'), tip = $('#tip');
  if (!el) return;
  tip.hidden = false; tip.textContent = el.dataset.tip;
  const r = el.getBoundingClientRect(), tw = tip.offsetWidth;
  tip.style.left = Math.max(4, Math.min(innerWidth - tw - 4, r.left + r.width / 2 - tw / 2)) + 'px'; tip.style.top = Math.max(4, r.top - 34) + 'px';
});
document.addEventListener('pointerout', (ev) => { if (ev.target.closest?.('[data-tip]')) $('#tip').hidden = true; });
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const r = route()[0]; if (r === 'accueil') mountAccueil(); else if (r === 'stats') mountStats(S); else if (r === 'partie' && S.gv?.cg) gvSync(); }, 200); });

if (new URLSearchParams(location.search).has('debug')) window.__cap = S; // accès à l'état pour les tests
(async function init() {
  await load();
  restoreUi();
  navigator.storage?.persist?.().catch(() => {}); // demande au navigateur de ne pas effacer les données de l'app
  render();
  const u = new URLSearchParams(location.search).get('u');
  reclassify();
  if (!S.data && (S.user || u)) doImport(S.user || u);
  else if (S.data && Date.now() - (S.data.fetchedAt || 0) > 6 * 3600000) doImport(S.user);
  else if (S.data && Object.values(S.an).some(toRedo)) autoAnalyse(); // anciennes analyses à réévaluer ou compléter, même sans nouvel import
})();
