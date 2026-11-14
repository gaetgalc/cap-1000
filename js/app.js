/* global Chess */
import { Chessground } from '../vendor/chessground.min.js';
import { dbGet, dbSet, dbDel, ls } from './store.js';
import { importPlayer } from './chesscom.js';
import { Engine, analyzeGame, winPct, fmtEval, uciMove } from './engine.js';
import * as st from './stats.js';
import { LESSONS, ENGINE_LESSONS } from './lessons.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = (san) => String(san).replace(/[NBRQK]/g, (c) => ({ N: 'C', B: 'F', R: 'T', Q: 'D', K: 'R' }[c]));
const dfmt = (t) => new Date(t * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const TC = { rapid: 'Rapide', blitz: 'Blitz', bullet: 'Bullet', daily: 'Différé', all: 'Toutes cadences' };
const HOW = { checkmated: 'mat', timeout: 'temps', resigned: 'abandon', abandoned: 'partie quittée', stalemate: 'pat', agreed: 'nulle par accord', repetition: 'répétition', insufficient: 'matériel insuffisant', '50move': '50 coups', timevsinsufficient: 'temps contre matériel insuffisant' };
const MOBILE = matchMedia('(pointer: coarse)').matches;
const DEPTH = MOBILE ? 10 : 12;

const S = {
  user: ls.get('user', null), data: null, an: {},
  f: ls.get('filter', { tc: 'rapid', days: 0 }),
  job: { running: false, done: 0, total: 0, stop: false, msg: '' },
  engine: null, play: null, white: true, path: [], pz: null, boards: [], importing: null,
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
}
async function doImport(user) {
  S.importing = { done: 0, total: 0, err: null };
  render();
  try {
    const prev = user === S.user ? S.data : await dbGet('data:' + user);
    const d = await importPlayer(user, prev, (a, b) => { S.importing = { done: a, total: b, err: null }; paintJob(); const el = $('#imp'); if (el) el.textContent = b ? `Import des parties : ${a} mois sur ${b}` : 'Connexion à Chess.com'; });
    S.user = d.user; S.data = d; ls.set('user', d.user);
    await dbSet('data:' + d.user, d);
    S.an = (await dbGet('an:' + d.user)) || {};
    S.importing = null;
    if (!d.games.some((g) => g.tc === S.f.tc) && S.f.tc !== 'all') { S.f = { tc: 'all', days: 0 }; ls.set('filter', S.f); }
    render();
    const fresh = d.games.filter((g) => g.tc === targetTc()).slice(-20).filter((g) => !S.an[g.id]).length;
    if (fresh) runAnalysis(fresh);
  } catch (e) {
    S.importing = { err: e.message || String(e) };
    render();
  }
}

// ---------- Analyse moteur en arrière-plan ----------
async function runAnalysis(count, only) {
  if (S.job.running || !S.data) return;
  let pool = S.data.games.filter((g) => g.tc === targetTc());
  if (!pool.length) pool = S.data.games;
  const queue = only ? [only] : pool.filter((g) => !S.an[g.id]).sort((a, b) => b.t - a.t).slice(0, count);
  if (!queue.length) return;
  S.job = { running: true, done: 0, total: queue.length, stop: false, msg: '' };
  paintJob();
  try {
    S.engine ||= new Engine();
    await S.engine.ready;
    for (const g of queue) {
      if (S.job.stop) break;
      const a = await analyzeGame(S.engine, g, DEPTH, () => !S.job.stop);
      S.an[g.id] = a || { ev: [], errs: [], nb: 0, acc: null, maxAdv: 0, last: 0, bad: true };
      if (S.job.stop && !a) { delete S.an[g.id]; break; }
      S.job.done++;
      if (S.job.done % 3 === 0 || S.job.done === queue.length) await dbSet('an:' + S.user, S.an);
      paintJob();
      const r = route()[0];
      if ((r === 'puzzles' && !S.pz?.cur) || (r === 'partie' && only)) render();
    }
    await dbSet('an:' + S.user, S.an);
  } catch (e) {
    S.job.msg = 'Le moteur d’analyse n’a pas pu démarrer sur ce navigateur. Les statistiques restent disponibles.';
    S.engine = null;
  }
  S.job.running = false;
  paintJob();
  render();
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
function destsOf(ch) {
  const d = new Map();
  for (const m of ch.moves({ verbose: true })) { if (!d.has(m.from)) d.set(m.from, []); d.get(m.from).push(m.to); }
  return d;
}
function board(el, cfg) {
  const cg = Chessground(el, { coordinates: true, animation: { duration: 180 }, drawable: { enabled: false, visible: true, autoShapes: cfg.shapes || [] }, ...cfg });
  S.boards.push(cg);
  return cg;
}
const arrow = (uci, brush) => (uci ? { orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush } : null);
const errShapes = (e) => [arrow(e.playedUci, 'red'), arrow(e.best, 'green')].filter(Boolean);

// ---------- Graphiques ----------
function lineChart(el, pts, o = {}) {
  if (pts.length < 2) { el.innerHTML = '<p class="small">Pas encore assez de données pour tracer la courbe.</p>'; return; }
  const W = Math.max(280, el.clientWidth), H = o.h || 200, m = { l: 36, r: 16, t: 14, b: 22 };
  const ys = pts.map((p) => p.y).concat(o.ref != null ? [o.ref] : []);
  let y0 = o.min ?? Math.min(...ys), y1 = o.max ?? Math.max(...ys);
  if (o.min == null) { const pad = Math.max(10, (y1 - y0) * 0.08); y0 -= pad; y1 += pad; }
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x === x0 ? x0 + 1 : pts[pts.length - 1].x;
  const sx = (x) => m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r), sy = (y) => H - m.b - ((y - y0) / (y1 - y0)) * (H - m.t - m.b);
  const step = o.step || niceStep((y1 - y0) / 4);
  let grid = '';
  for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) grid += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="var(--line)" stroke-width="1"/><text x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${o.yfmt ? o.yfmt(v) : Math.round(v)}</text>`;
  const d = pts.map((p, i) => (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join('');
  const base = sy(o.base != null ? o.base : y0);
  const area = `${d}L${sx(x1).toFixed(1)} ${base}L${sx(x0).toFixed(1)} ${base}Z`;
  const ref = o.ref != null ? `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(o.ref)}" y2="${sy(o.ref)}" stroke="var(--ink2)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - m.r}" y="${sy(o.ref) - 6}" text-anchor="end" style="fill:var(--ink2);font-weight:600">${esc(o.refLabel || '')}</text>` : '';
  const marks = (o.marks || []).map((k) => `<circle cx="${sx(pts[k.i].x)}" cy="${sy(pts[k.i].y)}" r="4.5" fill="var(--${k.c})" stroke="var(--surface)" stroke-width="2"/>`).join('');
  const last = pts[pts.length - 1];
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(o.label || '')}">${grid}
    <path d="${area}" fill="var(--accent)" opacity=".1"/>${ref}
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>${marks}
    ${o.marks ? '' : `<circle cx="${sx(last.x)}" cy="${sy(last.y)}" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`}
    <text x="${m.l}" y="${H - 5}">${esc(o.x0 || '')}</text><text x="${W - m.r}" y="${H - 5}" text-anchor="end">${esc(o.x1 || '')}</text>
    <g class="hov" visibility="hidden"><line y1="${m.t}" y2="${H - m.b}" stroke="var(--ink3)" stroke-width="1"/><circle r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/></g>
    ${o.cursor != null ? `<line x1="${sx(pts[o.cursor].x)}" x2="${sx(pts[o.cursor].x)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--ink)" stroke-width="1.5"/>` : ''}
    <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent" style="cursor:${o.onPick ? 'pointer' : 'crosshair'}"/></svg>`;
  const svg = $('svg', el), hov = $('.hov', el), tip = $('#tip');
  const near = (ev) => {
    const r = svg.getBoundingClientRect(); const x = ((ev.clientX - r.left) / r.width) * W;
    let bi = 0, bd = Infinity; pts.forEach((p, i) => { const dd = Math.abs(sx(p.x) - x); if (dd < bd) { bd = dd; bi = i; } });
    return bi;
  };
  const rect = $('rect', el);
  rect.onpointermove = (ev) => {
    const i = near(ev), p = pts[i];
    hov.setAttribute('visibility', 'visible');
    $('line', hov).setAttribute('x1', sx(p.x)); $('line', hov).setAttribute('x2', sx(p.x));
    $('circle', hov).setAttribute('cx', sx(p.x)); $('circle', hov).setAttribute('cy', sy(p.y));
    tip.hidden = false; tip.textContent = p.tip;
    const tw = tip.offsetWidth; tip.style.left = Math.max(4, Math.min(innerWidth - tw - 4, ev.clientX - tw / 2)) + 'px'; tip.style.top = Math.max(4, ev.clientY - 40) + 'px';
  };
  rect.onpointerleave = () => { hov.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  if (o.onPick) rect.onclick = (ev) => { tip.hidden = true; o.onPick(near(ev)); };
}
function niceStep(raw) { const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1))); const n = raw / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
function wdl(s) {
  if (!s.n) return '';
  return `<span class="wdl" title="${s.w} victoires, ${s.d} nulles, ${s.l} défaites">${s.w ? `<i class="w" style="flex:${s.w}"></i>` : ''}${s.d ? `<i class="d" style="flex:${s.d}"></i>` : ''}${s.l ? `<i class="l" style="flex:${s.l}"></i>` : ''}</span>`;
}
const WDL_LEGEND = '<div class="legend"><span style="--c:var(--good)">Victoires</span><span style="--c:var(--neutral)">Nulles</span><span style="--c:var(--bad)">Défaites</span></div>';

// ---------- Puzzles (tes propres erreurs) ----------
function allPuzzles() {
  const out = [];
  if (!S.data) return out;
  for (const g of S.data.games) {
    const a = S.an[g.id];
    if (!a) continue;
    for (const e of a.errs) if (e.theme && e.best && e.e0 > -500) out.push({ id: g.t + ':' + e.ply, g, e });
  }
  return out;
}
const DAY = 86400000, STEPS = [1, 3, 7, 21, 60];
function pzQueue(theme, free) {
  const prog = ls.get('pz', {}), now = Date.now();
  let list = allPuzzles().filter((p) => !theme || p.e.theme === theme);
  if (!free) list = list.filter((p) => (prog[p.id]?.due || 0) <= now);
  return list.sort((a, b) => ((prog[a.id] ? 0 : 1) - (prog[b.id] ? 0 : 1)) || (b.g.t - a.g.t) || (b.e.drop - a.e.drop));
}
function pzMark(id, ok) {
  const prog = ls.get('pz', {});
  const box = ok ? Math.min(STEPS.length - 1, (prog[id]?.box ?? -1) + 1) : 0;
  prog[id] = { box, due: Date.now() + (ok ? STEPS[box] * DAY : 5 * 60000), ok: (prog[id]?.ok || 0) + (ok ? 1 : 0) };
  ls.set('pz', prog);
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

function viewPuzzles() {
  const total = allPuzzles();
  if (!total.length) {
    return `<h1>Puzzles sur tes erreurs</h1><div class="card"><p class="prose">${S.job.running ? 'L’analyse de tes parties est en cours. Les premiers puzzles apparaissent ici dès qu’une partie est terminée.' : 'Aucune partie analysée pour le moment. Lance l’analyse pour transformer tes erreurs en puzzles.'}</p>${S.job.running ? '' : '<div><button class="btn pri" data-act="analyse">Analyser mes 20 dernières parties</button></div>'}</div>`;
  }
  S.pz ||= { theme: '', free: false, cur: null };
  const prog = ls.get('pz', {});
  const q = pzQueue(S.pz.theme, S.pz.free);
  if (!S.pz.cur || !q.some((p) => p.id === S.pz.cur.id)) S.pz.cur = q[0] ? { id: q[0].id, tries: 0, shown: false, done: false } : null;
  const themes = [...new Set(total.map((p) => p.e.theme))];
  const mastered = total.filter((p) => (prog[p.id]?.box || 0) >= 2).length;
  const head = `<div class="row" style="justify-content:space-between"><h1>Puzzles sur tes erreurs</h1>
    <div class="row"><label class="small" for="pzt">Thème</label><select id="pzt"><option value="">Tous les thèmes</option>${themes.map((t) => `<option value="${t}" ${S.pz.theme === t ? 'selected' : ''}>${st.THEMES[t]}</option>`).join('')}</select></div></div>
    <div class="row"><span class="chip">${q.length} à faire</span><span class="chip good">${mastered} maîtrisés</span><span class="chip">${total.length} au total</span></div>`;
  if (!S.pz.cur) {
    return head + `<div class="card"><p class="prose">Tout est à jour. Les puzzles réussis reviennent après 1, 3, 7 puis 21 jours pour ancrer le réflexe.</p><div class="row"><button class="btn pri" data-act="pzfree">S’entraîner quand même</button>${S.job.running ? '' : '<button class="btn" data-act="analyse">Analyser 20 parties de plus</button>'}</div></div>`;
  }
  const p = q.find((x) => x.id === S.pz.cur.id);
  const side = p.g.w ? 'Blancs' : 'Noirs';
  return head + `<div class="split"><div class="board" id="pzb"></div>
    <div class="card"><h2>Trait aux ${side}<span class="chip">${st.THEMES[p.e.theme]}</span></h2>
      <p class="sub">Coup ${moveNo(p.e)} de ta ${gameRef(p.g)}. Ici tu as perdu ${p.e.drop} points de chances de gain. Trouve mieux.</p>
      <div class="fb" id="pzf">Joue le coup sur l’échiquier.</div>
      <div class="row"><button class="btn" data-act="pzhint">Indice</button><button class="btn" data-act="pzshow">Voir la solution</button><button class="btn pri" data-act="pznext" id="pznext" hidden>Puzzle suivant</button></div>
      <p class="small"><a href="#partie/${p.g.t}">Revoir la partie complète</a> · <a href="#cours/${p.e.theme}">Cours associé</a></p>
    </div></div>`;
}
function mountPuzzle() {
  const el = $('#pzb');
  if (!el || !S.pz?.cur) return;
  const p = allPuzzles().find((x) => x.id === S.pz.cur.id);
  if (!p) return;
  const cur = S.pz.cur, e = p.e, ch = new Chess(e.fen), color = p.g.w ? 'white' : 'black', fb = $('#pzf');
  const arm = () => ({ fen: ch.fen(), turnColor: color, movable: { free: false, color, dests: destsOf(ch), showDests: true } });
  const cg = board(el, { ...arm(), orientation: color, lastMove: e.prev ? [e.prev.slice(0, 2), e.prev.slice(2, 4)] : undefined, movable: { ...arm().movable, events: { after: onMove } } });
  const finish = (ok, html) => {
    if (!cur.done) { pzMark(p.id, ok && cur.tries === 0 && !cur.shown); cur.done = true; }
    fb.className = 'fb ' + (ok ? 'ok' : ''); fb.innerHTML = html + `<br>${explain(e)}`;
    cg.set({ movable: { color: undefined }, drawable: { autoShapes: [arrow(e.best, 'green')] } });
    $('#pznext').hidden = false;
  };
  async function onMove(from, to) {
    const m = ch.move({ from, to, promotion: 'q' });
    if (!m) return;
    cg.set({ fen: ch.fen(), movable: { color: undefined } });
    const uci = from + to;
    if (uci === e.best.slice(0, 4) || ch.in_checkmate()) return finish(true, `<b class="ok">Bien vu.</b> ${fr(m.san)} est le meilleur coup.`);
    fb.className = 'fb'; fb.textContent = 'Vérification de ton coup…';
    let drop = 100;
    try { S.play ||= new Engine(); const r = await S.play.evalFen(ch.fen(), DEPTH); drop = winPct(e.e0) - winPct(-r.cp); } catch { /* moteur indisponible : seul le meilleur coup compte */ }
    if (drop < 6) return finish(true, `<b class="ok">Bon coup.</b> ${fr(m.san)} tient la position (le moteur préférait ${fr(e.bestSan)}).`);
    cur.tries++;
    fb.className = 'fb ko';
    fb.innerHTML = `<b class="ko">Pas celui-là.</b> ${fr(m.san)} ${uci === e.playedUci.slice(0, 4) ? 'est le coup que tu avais joué en partie' : `fait perdre ${Math.round(drop)} points de chances de gain`}. Réessaie.`;
    setTimeout(() => { ch.undo(); cg.set({ ...arm(), movable: { ...arm().movable, events: { after: onMove } } }); }, 700);
  }
  S.pz.api = {
    hint: () => { cur.shown = true; cg.set({ drawable: { autoShapes: [{ orig: e.best.slice(0, 2), brush: 'green' }] } }); fb.className = 'fb'; fb.textContent = 'La pièce entourée doit jouer.'; },
    show: () => { cur.shown = true; ch.load(e.fen); uciMove(ch, e.best); cg.set({ fen: ch.fen() }); finish(false, `La solution était <b>${fr(e.bestSan)}</b>.`); },
  };
}

// ---------- Vues ----------
function header() {
  const t = $('#tools');
  if (!S.data) { t.innerHTML = ''; return; }
  const has = new Set(S.data.games.map((g) => g.tc));
  t.innerHTML = `<select id="ftc" aria-label="Cadence">${['rapid', 'blitz', 'bullet', 'daily'].filter((k) => has.has(k)).map((k) => `<option value="${k}" ${S.f.tc === k ? 'selected' : ''}>${TC[k]}</option>`).join('')}<option value="all" ${S.f.tc === 'all' ? 'selected' : ''}>Toutes cadences</option></select>
    <select id="fd" aria-label="Période"><option value="0">Depuis le début</option><option value="90" ${S.f.days === 90 ? 'selected' : ''}>90 derniers jours</option><option value="30" ${S.f.days === 30 ? 'selected' : ''}>30 derniers jours</option></select>
    <button class="btn sm" data-act="refresh" title="Récupérer les nouvelles parties de ${esc(S.user)}">Mettre à jour</button>`;
  $('#ftc').onchange = (e) => { S.f.tc = e.target.value; ls.set('filter', S.f); S.path = []; S.pz = null; render(); };
  $('#fd').onchange = (e) => { S.f.days = +e.target.value; ls.set('filter', S.f); S.path = []; render(); };
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
    <dl class="kv"><dt>Échéance</dt><dd>${new Date(g.date).toLocaleDateString('fr-FR')} (${days} j)</dd>
    ${gap > 0 ? `<dt>Rythme nécessaire</dt><dd>+${Math.ceil(gap / weeks)} pts / semaine</dd>` : ''}
    <dt>30 derniers jours</dt><dd>${tr.delta30 == null ? 'aucune partie' : (tr.delta30 >= 0 ? '+' : '') + tr.delta30 + ' pts sur ' + tr.recent + ' parties'}</dd>
    ${proj != null ? `<dt>Projection à l’échéance</dt><dd>${proj}</dd>` : ''}
    <dt>Record</dt><dd>${tr.peak}</dd></dl>
    ${proj != null ? '<p class="small">Projection : tendance linéaire des 30 derniers jours prolongée. C’est un repère, pas une prévision.</p>' : ''}</div>`;
  return { html, tr, g };
}

function priorityLessons() {
  const gs = games(), es = st.engineStats(gs, S.an), sig = st.signals(gs, S.an);
  const ids = es.themes.map((t) => t.id);
  for (const w of sig.faiblesses) if (w.lesson && LESSONS[w.lesson] && !ids.includes(w.lesson)) ids.push(w.lesson);
  return { ids, es, sig };
}

function viewAccueil() {
  const gs = games();
  const gb = goalBlock();
  if (!gs.length) return `<h1>Bonjour ${esc(S.data.profile.username)}</h1>${gb.html}<div class="card"><p class="sub">Aucune partie pour ce filtre (${TC[S.f.tc]}). Change la cadence ou la période en haut de page.</p></div>`;
  const all = st.tally(gs), wh = st.tally(gs.filter((g) => g.w)), bl = st.tally(gs.filter((g) => !g.w));
  const { ids, es, sig } = priorityLessons();
  const due = pzQueue('', false).length;
  const next = ids[0];
  const sigHtml = (arr, c, empty) => (arr.length ? arr.slice(0, 5).map((s) => `<div class="sig" style="--c:var(--${c})"><b>${esc(s.t)}</b><span>${esc(s.d)}</span>${s.lesson ? `<a href="#${s.lesson === 'ouvertures' ? 'ouvertures' : 'cours/' + s.lesson}">${s.lesson === 'ouvertures' ? 'Voir tes ouvertures' : 'Ouvrir le cours'}</a>` : ''}</div>`).join('') : `<p class="sub">${empty}</p>`);
  const maxT = Math.max(1, ...es.themes.map((t) => t.n));
  return `<h1>Bonjour ${esc(S.data.profile.username)}</h1>
  <div class="hero">${gb.html}
    <div class="card"><h2>Ton classement ${TC[S.f.tc] === TC.all ? 'Rapide' : TC[S.f.tc]}</h2><div class="chart" id="rc"></div></div></div>
  <div class="grid">
    <div class="card"><h2>À faire maintenant</h2>
      <div class="stack">
        <div class="row" style="justify-content:space-between"><span><b class="num">${due}</b> puzzle${due > 1 ? 's' : ''} tiré${due > 1 ? 's' : ''} de tes erreurs</span><a class="btn pri sm" href="#puzzles">S’entraîner</a></div>
        ${next ? `<div class="row" style="justify-content:space-between"><span>Cours prioritaire : <b>${LESSONS[next].titre}</b></span><a class="btn sm" href="#cours/${next}">Ouvrir</a></div>` : ''}
        <div class="row" style="justify-content:space-between"><span>${es.n} partie${es.n > 1 ? 's' : ''} analysée${es.n > 1 ? 's' : ''} sur ${gs.length}</span>${S.job.running ? '<span class="chip">Analyse en cours</span>' : '<button class="btn sm" data-act="analyse">Analyser 20 de plus</button>'}</div>
      </div></div>
    <div class="card"><h2>Bilan <span class="small">${all.n} parties</span></h2>
      <table><tbody>
        <tr><td>Toutes</td><td style="width:45%">${wdl(all)}</td><td class="r"><b>${st.score(all)} %</b></td></tr>
        <tr><td><span class="row" style="gap:6px"><i class="dot w"></i>Blancs</span></td><td>${wdl(wh)}</td><td class="r">${st.score(wh)} %</td></tr>
        <tr><td><span class="row" style="gap:6px"><i class="dot b"></i>Noirs</span></td><td>${wdl(bl)}</td><td class="r">${st.score(bl)} %</td></tr>
      </tbody></table>${WDL_LEGEND}
      ${es.n ? `<dl class="kv"><dt>Précision moyenne (parties analysées)</dt><dd>${es.acc.toFixed(1)} %</dd><dt>Gaffes par partie</dt><dd>${(es.gaffes / es.n).toFixed(1)}</dd></dl>` : ''}</div>
  </div>
  <div class="grid">
    <div class="card"><h2>Points forts</h2>${sigHtml(sig.forces, 'good', 'Pas encore assez de parties pour dégager un point fort net.')}</div>
    <div class="card"><h2>Points faibles</h2>${sigHtml(sig.faiblesses, 'bad', 'Aucune faiblesse nette détectée pour ce filtre.')}</div>
  </div>
  ${es.themes.length ? `<div class="card"><h2>Tes erreurs graves par type <span class="small">${es.n} parties analysées</span></h2>
    ${es.themes.map((t) => `<a class="hbar" href="#cours/${t.id}"><span>${st.THEMES[t.id]}</span><span class="track"><i style="width:${(100 * t.n) / maxT}%"></i></span><span class="v">${t.n}</span></a>`).join('')}
    <p class="small">Chaque ligne ouvre le cours correspondant, illustré par tes propres positions.</p></div>` : ''}`;
}
function mountAccueil() {
  const el = $('#rc'); if (!el) return;
  const tc = targetTc();
  const pts = S.data.games.filter((g) => g.tc === tc && g.rated && g.r && (!S.f.days || g.t >= Date.now() / 1000 - S.f.days * 86400)).map((g) => ({ x: g.t, y: g.r, tip: `${dfmt(g.t)} : ${g.r}` }));
  const g = goal();
  const o = { label: 'Évolution du classement', x0: pts[0] ? dfmt(pts[0].x) : '', x1: pts.length ? dfmt(pts[pts.length - 1].x) : '' };
  if (tc === 'rapid') { o.ref = g.elo; o.refLabel = 'Objectif ' + g.elo; }
  o.h = innerWidth >= 860 ? 280 : 200;
  lineChart(el, pts, o);
}

function viewCours() {
  const { ids, es } = priorityLessons();
  const read = ls.get('lus', {});
  const cnt = Object.fromEntries(es.themes.map((t) => [t.id, t.n]));
  const card = (id, prio) => `<a class="card" href="#cours/${id}" style="text-decoration:none;color:inherit">
    <h2>${LESSONS[id].titre}</h2><div class="row">${prio ? `<span class="chip bad">Priorité ${prio}</span>` : ''}${cnt[id] ? `<span class="chip">${cnt[id]} exemple${cnt[id] > 1 ? 's' : ''} dans tes parties</span>` : ''}${read[id] ? '<span class="chip good">Lu</span>' : ''}</div>
    <p class="sub">${LESSONS[id].principe.split('. ')[0]}.</p></a>`;
  const others = Object.keys(LESSONS).filter((id) => !ids.includes(id));
  return `<h1>Cours</h1><p class="sub prose">Les cours sont classés selon ce que tes erreurs te coûtent réellement. Chaque cours montre tes propres positions, puis te les fait rejouer.</p>
    ${ids.length ? `<div class="grid">${ids.map((id, i) => card(id, i < 3 ? i + 1 : 0)).join('')}</div>` : `<div class="card"><p class="sub">${S.job.running ? 'Analyse en cours : le classement des cours arrive.' : 'Lance l’analyse de tes parties pour classer les cours selon tes erreurs.'}</p></div>`}
    <h2>Autres cours</h2><div class="grid">${others.map((id) => card(id, 0)).join('')}</div>`;
}

function lessonNumbers(id, gs) {
  const row = (a, b) => `<dt>${a}</dt><dd>${b}</dd>`;
  if (id === 'temps') { const t = st.timeStats(gs); return row('Défaites au temps', `${t.flag} sur ${t.losses} (${st.pct(t.flag, t.losses)} %)`) + (t.leftLoss != null ? row('Temps restant à la fin d’une défaite type', Math.round(t.leftLoss * 100) + ' %') : ''); }
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
function viewLecon(id) {
  const L = LESSONS[id];
  if (!L) return viewCours();
  const gs = games(), ex = ENGINE_LESSONS.includes(id) ? lessonExamples(id) : [];
  const nums = lessonNumbers(id, gs);
  const blown = id === 'conversion' ? gs.filter((g) => S.an[g.id]?.maxAdv >= 500 && g.out !== 'W').slice(-6).reverse() : [];
  const read = ls.get('lus', {});
  S.lessonEx = ex;
  return `<p class="small"><a href="#cours">Tous les cours</a></p><h1>${L.titre}</h1>
  <div class="card"><h2>Le principe</h2><p class="prose">${L.principe}</p>
    ${nums ? `<h3>Tes chiffres</h3><dl class="kv prose">${nums}</dl>` : ''}
    <h3>La routine à appliquer</h3><ol class="routine">${L.routine.map((r) => `<li>${r}</li>`).join('')}</ol></div>
  ${ex.length ? `<div class="card"><h2>Dans tes parties</h2><p class="small">Flèche rouge : ton coup. Flèche verte : le meilleur coup.</p>
    ${ex.map((x, i) => `<div class="ex"><div class="board mini" data-ex="${i}"></div><div class="stack">
      <b>Coup ${moveNo(x.e)}, ${gameRef(x.g)}</b><p class="prose">${explain(x.e)}</p>
      <span class="row"><span class="chip bad">−${x.e.drop} pts de chances de gain</span><a class="btn sm" href="#partie/${x.g.t}/${x.e.ply}">Revoir dans la partie</a></span></div></div>`).join('')}
    <div><button class="btn pri" data-act="pztheme" data-theme="${id}">M’entraîner sur ce thème</button></div></div>`
    : ENGINE_LESSONS.includes(id) ? '<div class="card"><p class="sub">Aucun exemple de ce type dans tes parties analysées. Soit tu ne fais pas cette erreur, soit il faut analyser davantage de parties.</p></div>' : ''}
  ${blown.length ? `<div class="card"><h2>Parties qui t’ont échappé</h2>${blown.map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or})</span><span class="chip ${g.out === 'L' ? 'bad' : ''}">${g.out === 'L' ? 'Défaite' : 'Nulle'}</span></a>`).join('')}</div>` : ''}
  <div><button class="btn ${read[id] ? '' : 'pri'}" data-act="lu" data-id="${id}">${read[id] ? 'Marquer comme non lu' : 'J’ai compris, marquer comme lu'}</button></div>`;
}
function mountLecon() {
  document.querySelectorAll('[data-ex]').forEach((el) => {
    const x = S.lessonEx[+el.dataset.ex];
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
  let node = st.tree(gs, S.white); const ch = new Chess();
  const path = [];
  for (const s of S.path) { const k = node.kids.get(s); if (!k || !ch.move(s)) break; node = k; path.push(s); }
  S.path = path; S.exFen = ch.fen();
  const kids = [...node.kids.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  const myTurn = (path.length % 2 === 0) === S.white;
  const first = S.white ? [...st.tree(gs, true).kids.entries()].sort((a, b) => b[1].n - a[1].n)[0] : null;
  const side = st.tally(gs.filter((g) => g.w === S.white));
  const crumbs = path.map((s, i) => `<button class="btn sm" data-act="expath" data-n="${i + 1}">${i % 2 === 0 ? i / 2 + 1 + '. ' : ''}${fr(s)}</button>`).join('');
  return `<div class="row" style="justify-content:space-between"><h1>Ouvertures</h1><div class="row" role="group" aria-label="Couleur">
    <button class="btn ${S.white ? 'pri' : ''}" data-act="color" data-w="1"><i class="dot w"></i>Blancs</button><button class="btn ${S.white ? '' : 'pri'}" data-act="color" data-w="0"><i class="dot b"></i>Noirs</button></div></div>
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

function viewPartie(t, plyArg) {
  const g = S.data.games.find((x) => String(x.t) === String(t));
  if (!g) return viewParties();
  const a = S.an[g.id] && !S.an[g.id].bad ? S.an[g.id] : null;
  const ch = new Chess(), fens = [ch.fen()], mv = [];
  for (const s of g.san) { const m = ch.move(s, { sloppy: true }); if (!m) break; mv.push(m); fens.push(ch.fen()); }
  if (!S.gv || S.gv.t !== g.t) S.gv = { t: g.t, k: plyArg != null ? Math.min(+plyArg, mv.length) : 0 };
  S.gv.fens = fens; S.gv.mv = mv; S.gv.g = g; S.gv.a = a;
  const errAt = a ? Object.fromEntries(a.errs.map((e) => [e.ply, e])) : {};
  S.gv.errAt = errAt;
  const k = S.gv.k, e = errAt[k];
  const moves = mv.map((m, i) => `${i % 2 === 0 ? `<span class="n">${i / 2 + 1}.</span>` : ''}<button data-act="goto" data-k="${i + 1}" class="${k === i + 1 ? 'cur' : ''} ${errAt[i]?.kind || ''}">${fr(m.san)}</button>`).join('');
  const serious = a ? a.errs.filter((x) => x.theme) : [];
  return `<p class="small"><a href="#parties">Toutes les parties</a></p>
  <div class="row" style="justify-content:space-between"><h1>${g.w ? 'Blancs' : 'Noirs'} contre ${esc(g.opp)} <span class="small num">${g.or}</span></h1>
    <span class="row"><span class="chip ${g.out === 'W' ? 'good' : g.out === 'L' ? 'bad' : ''}">${g.out === 'W' ? 'Victoire' : g.out === 'L' ? 'Défaite' : 'Nulle'}${HOW[g.how] ? ' (' + HOW[g.how] + ')' : ''}</span><span class="chip">${dfmt(g.t)}</span><span class="chip">${esc(g.fam)}</span><a class="btn sm" href="${esc(g.id)}" target="_blank" rel="noopener">Ouvrir sur Chess.com</a></span></div>
  <div class="split"><div class="stack"><div class="board" id="gvb"></div>
      <div class="row"><button class="btn" data-act="goto" data-k="0" aria-label="Début">⏮</button><button class="btn" data-act="goto" data-k="${Math.max(0, k - 1)}" aria-label="Coup précédent">◀</button><button class="btn" data-act="goto" data-k="${Math.min(mv.length, k + 1)}" aria-label="Coup suivant">▶</button><button class="btn" data-act="goto" data-k="${mv.length}" aria-label="Fin">⏭</button>
      ${a ? `<span class="chip num">Évaluation ${fmtEval(g.w ? a.ev[k] : -a.ev[k])}</span>` : ''}</div></div>
    <div class="stack">
      ${e ? `<div class="fb ko"><b class="ko">${e.kind === 'gaffe' ? 'Gaffe' : e.kind === 'erreur' ? 'Erreur' : 'Imprécision'} au coup ${moveNo(e)}.</b> ${explain(e)}${e.theme ? ` <a href="#cours/${e.theme}">Cours : ${LESSONS[e.theme].titre}</a>` : ''}</div>` : ''}
      ${a ? `<div class="card"><h2>Tes chances de gain <span class="small">précision ${a.acc?.toFixed(0)} %</span></h2><div class="chart" id="evc"></div><p class="small">Points rouges : gaffes. Points orange : erreurs. Clique sur la courbe pour aller au coup.</p></div>`
    : `<div class="card"><p class="sub">Cette partie n’est pas encore analysée.</p><div><button class="btn pri" data-act="analyse1" ${S.job.running ? 'disabled' : ''}>${S.job.running ? 'Analyse en cours' : 'Analyser cette partie'}</button></div></div>`}
      <div class="card"><h2>Coups</h2><div class="moves">${moves}</div></div>
      ${serious.length ? `<div class="card"><h2>Moments clés</h2>${serious.map((x) => `<a class="row" href="#" data-act="goto" data-k="${x.ply}" style="justify-content:space-between;text-decoration:none"><span>Coup ${moveNo(x)} : ${fr(x.played)}, mieux ${fr(x.bestSan)}</span><span class="chip ${x.kind === 'gaffe' ? 'bad' : 'warn'}">${st.THEMES[x.theme]}</span></a>`).join('')}</div>` : ''}
    </div></div>`;
}
function mountPartie() {
  const v = S.gv, el = $('#gvb'); if (!el || !v) return;
  const k = v.k, last = k > 0 ? [v.mv[k - 1].from, v.mv[k - 1].to] : undefined, e = v.errAt[k];
  board(el, { fen: v.fens[k], orientation: v.g.w ? 'white' : 'black', viewOnly: true, lastMove: last, shapes: e ? errShapes(e) : [] });
  const c = $('#evc');
  if (c && v.a) {
    const pts = v.a.ev.map((cp, i) => ({ x: i, y: winPct(v.g.w ? cp : -cp), tip: (i ? `Coup ${Math.ceil(i / 2)} (${fr(v.mv[i - 1]?.san || '')}) : ` : 'Début : ') + Math.round(winPct(v.g.w ? cp : -cp)) + ' %' }));
    const marks = v.a.errs.filter((x) => x.kind !== 'imprecision').map((x) => ({ i: x.ply, c: x.kind === 'gaffe' ? 'bad' : 'warn' }));
    lineChart(c, pts, { h: 170, min: 0, max: 100, step: 25, base: 0, yfmt: (y) => y + ' %', marks, cursor: Math.min(k, pts.length - 1), label: 'Chances de gain au fil de la partie', x0: 'Début', x1: 'Fin', onPick: (i) => { S.gv.k = i; render(true); } });
  }
  $('.moves .cur')?.scrollIntoView({ block: 'nearest' });
}

function weekKey() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function viewPlan() {
  const gb = goalBlock(), hours = ls.get('hours', 6), wk = weekKey(), done = ls.get('plan:' + wk, {});
  const { ids } = priorityLessons();
  const monday = new Date(wk + 'T00:00:00').getTime() / 1000;
  const played = rapidAll().filter((g) => g.t >= monday).length;
  const target = Math.max(4, Math.round((hours * 60 * 0.5) / 25));
  const sessions = Math.max(3, Math.min(7, Math.round((hours * 60 * 0.25) / 15)));
  const weakOp = [true, false].flatMap((w) => st.openings(rapidAll(), w).filter((o) => o.n >= 5 && st.score(o) <= 42).map((o) => `${o.fam} (${w ? 'Blancs' : 'Noirs'})`))[0];
  const items = [
    ...Array.from({ length: sessions }, (_, i) => [`pz${i}`, `Séance de puzzles ${i + 1} : 15 minutes sur tes erreurs`, '#puzzles']),
    ids[0] ? ['l1', `Cours de la semaine : ${LESSONS[ids[0]].titre}`, '#cours/' + ids[0]] : null,
    ids[1] ? ['l2', `Deuxième cours : ${LESSONS[ids[1]].titre}`, '#cours/' + ids[1]] : null,
    ['rev', 'Revoir tes 3 dernières défaites coup par coup', '#parties'],
    weakOp ? ['op', `Explorer ton ouverture la plus fragile : ${weakOp}`, '#ouvertures'] : null,
  ].filter(Boolean);
  const g = gb.g;
  return `<h1>Plan de la semaine</h1>
  <div class="hero">${gb.html}
    <div class="card"><h2>Semaine du ${new Date(wk).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</h2>
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
  </div>`;
}

// ---------- Routage et événements ----------
const route = () => (location.hash.slice(1) || 'accueil').split('/');
function render(keepScroll) {
  const y = scrollY;
  for (const b of S.boards) { try { b.destroy(); } catch { /* rien */ } }
  S.boards = []; $('#tip').hidden = true;
  const v = $('#view'), [r, a, b] = route();
  header(); paintJob();
  $('#nav').hidden = !S.data;
  document.querySelectorAll('#nav a').forEach((x) => x.classList.toggle('on', x.getAttribute('href') === '#' + (r === 'partie' ? 'parties' : r)));
  if (!S.data) { v.innerHTML = viewWelcome(); const f = $('#wf'); f.onsubmit = (ev) => { ev.preventDefault(); const u = $('#wu').value.trim(); if (u) doImport(u); }; return; }
  if (r !== 'partie') S.gv = null;
  const html = r === 'puzzles' ? viewPuzzles() : r === 'cours' ? (a ? viewLecon(a) : viewCours()) : r === 'ouvertures' ? viewOuvertures() : r === 'parties' ? viewParties() : r === 'partie' ? viewPartie(a, b) : r === 'plan' ? viewPlan() : viewAccueil();
  v.innerHTML = html;
  if (r === 'puzzles') { mountPuzzle(); const s = $('#pzt'); if (s) s.onchange = () => { S.pz.theme = s.value; S.pz.cur = null; render(); }; }
  else if (r === 'cours' && a) mountLecon();
  else if (r === 'ouvertures') board($('#exb'), { fen: S.exFen, orientation: S.white ? 'white' : 'black', viewOnly: true });
  else if (r === 'partie') mountPartie();
  else if (r === 'plan') {
    $('#hrs').onchange = (e) => { ls.set('hours', +e.target.value); render(true); };
    const save = () => { const elo = +$('#gelo').value, date = $('#gdate').value; if (elo >= 100 && date) { ls.set('goal', { elo, date }); render(true); } };
    $('#gelo').onchange = save; $('#gdate').onchange = save;
    document.querySelectorAll('[data-plan]').forEach((c) => { c.onchange = () => { const k = 'plan:' + weekKey(), d = ls.get(k, {}); d[c.dataset.plan] = c.checked; ls.set(k, d); c.closest('.check').classList.toggle('done', c.checked); }; });
  } else mountAccueil();
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'A') ev.preventDefault();
  if (act === 'refresh') doImport(S.user);
  else if (act === 'analyse') runAnalysis(20);
  else if (act === 'analyse1') runAnalysis(1, S.gv.g);
  else if (act === 'pzfree') { S.pz.free = true; S.pz.cur = null; render(); }
  else if (act === 'pzhint') S.pz.api?.hint();
  else if (act === 'pzshow') S.pz.api?.show();
  else if (act === 'pznext') { const q = pzQueue(S.pz.theme, S.pz.free).filter((p) => p.id !== S.pz.cur.id); S.pz.cur = q[0] ? { id: q[0].id, tries: 0, shown: false, done: false } : null; if (!q[0]) S.pz.free = false; render(); }
  else if (act === 'pztheme') { S.pz = { theme: el.dataset.theme, free: true, cur: null }; location.hash = '#puzzles'; }
  else if (act === 'lu') { const d = ls.get('lus', {}); d[el.dataset.id] = !d[el.dataset.id]; ls.set('lus', d); render(true); }
  else if (act === 'color') { S.white = el.dataset.w === '1'; S.path = []; render(true); }
  else if (act === 'exmove') { S.path.push(el.dataset.san); render(true); }
  else if (act === 'expath') { S.path = S.path.slice(0, +el.dataset.n); render(true); }
  else if (act === 'open') location.hash = '#partie/' + el.dataset.t;
  else if (act === 'more') { S.listN += 50; render(true); }
  else if (act === 'goto') { S.gv.k = +el.dataset.k; render(true); }
  else if (act === 'reset') {
    if (el.dataset.sure) { const u = S.user; ['user', 'pz', 'lus', 'filter'].forEach(ls.del); dbDel('data:' + u); dbDel('an:' + u); S.job.stop = true; S.user = null; S.data = null; S.an = {}; S.pz = null; location.hash = '#accueil'; render(); }
    else { el.dataset.sure = '1'; el.textContent = 'Confirmer : effacer les données de cet appareil'; }
  }
});
document.addEventListener('keydown', (ev) => {
  if (route()[0] !== 'partie' || !S.gv || /INPUT|SELECT/.test(ev.target.tagName)) return;
  if (ev.key === 'ArrowLeft') { S.gv.k = Math.max(0, S.gv.k - 1); render(true); } else if (ev.key === 'ArrowRight') { S.gv.k = Math.min(S.gv.mv.length, S.gv.k + 1); render(true); }
});
addEventListener('hashchange', () => render());
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const r = route()[0]; if (r === 'accueil') mountAccueil(); }, 200); });

window.__cap = S;
(async function init() {
  await load();
  render();
  const u = new URLSearchParams(location.search).get('u');
  if (!S.data && (S.user || u)) doImport(S.user || u);
  else if (S.data && Date.now() - (S.data.fetchedAt || 0) > 6 * 3600000) doImport(S.user);
})();
