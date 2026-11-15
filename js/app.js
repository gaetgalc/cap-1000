/* global Chess */
import { Chessground } from '../vendor/chessground.min.js';
import { dbGet, dbSet, dbDel, ls } from './store.js';
import { importPlayer } from './chesscom.js';
import { Engine, analyzeGame, winPct, fmtEval, uciMove } from './engine.js';
import * as st from './stats.js';
import { LESSONS, ENGINE_LESSONS, RULES } from './lessons.js';
import { viewStats, mountStats } from './alltime.js';
import { buildLine, insight, hintFor, lastMoveText, moveText, material, describeAt, justPlayed } from './explain.js';
import { LI_ANGLES, LI_FOR, LI_DIFF, fetchPuzzle } from './lichess.js';
import { DRILLS, DRILL_FOR, makeRound } from './drills.js';
import { MODELS, coachKey, coachModel, facts, genLesson, askCoach, buildPrompt, parseLesson } from './coach.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = (san) => String(san).replace(/[NBRQK]/g, (c) => ({ N: 'C', B: 'F', R: 'T', Q: 'D', K: 'R' }[c]));
const dfmt = (t) => new Date(t * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const TC = { rapid: 'Rapide', blitz: 'Blitz', bullet: 'Bullet', daily: 'Différé', all: 'Toutes cadences' };
const HOW = { checkmated: 'mat', timeout: 'temps', resigned: 'abandon', abandoned: 'partie quittée', stalemate: 'pat', agreed: 'nulle par accord', repetition: 'répétition', insufficient: 'matériel insuffisant', '50move': '50 coups', timevsinsufficient: 'temps contre matériel insuffisant' };
const DEPTH = 12; // même profondeur sur tous les appareils : une erreur est classée pareil partout
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; // pas de lecture automatique si l'appareil le demande
// Icônes dessinées : les flèches Unicode deviennent des émojis sur iPhone.
const LN = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
const IC = {
  prev: `<path d="M15 5l-7 7 7 7" ${LN}/>`, next: `<path d="M9 5l7 7-7 7" ${LN}/>`,
  first: `<path d="M18 5l-7 7 7 7M7 5v14" ${LN}/>`, last: `<path d="M6 5l7 7-7 7M17 5v14" ${LN}/>`,
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>', pause: '<path d="M7 5h3.500v14H7zM13.500 5H17v14h-3.500z" fill="currentColor"/>',
  replay: '<path d="M12 6V2.500L7 6.500l5 4V8a4.500 4.500 0 1 1-4.500 4.500h-2A6.500 6.500 0 1 0 12 6z" fill="currentColor"/>',
};
const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${IC[n]}</svg>`;
const setHtml = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } }; // ne reconstruit pas un bouton sous le doigt

const S = {
  user: ls.get('user', null), data: null, an: {},
  f: ls.get('filter', { tc: 'rapid', days: 0 }),
  job: { running: false, done: 0, total: 0, stop: false, msg: '' },
  engine: null, play: null, ai: {}, gen: null, cl: null, solve: null, white: true, path: [], pz: null, boards: [], importing: null,
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
    const fresh = d.games.filter((g) => g.tc === targetTc()).slice(-20).filter((g) => !S.an[g.id]).length;
    if (fresh) runAnalysis(fresh);
  } catch (e) {
    if (first) { S.importing = { err: e.message || String(e) }; render(); }
    else { S.importing = null; S.job.msg = 'Mise à jour impossible : ' + (e.message || String(e)); paintJob(); }
  }
}

// ---------- Activité quotidienne (séance du jour, série) ----------
const dkey = (d = new Date()) => d.toLocaleDateString('sv');
const act = () => ls.get('act', {});
function bump(k, n = 1) {
  const a = act(), d = dkey();
  a[d] ||= {}; a[d][k] = Math.max(0, (a[d][k] || 0) + n);
  if (!a[d][k]) delete a[d][k];
  if (!Object.keys(a[d]).length) delete a[d];
  const keys = Object.keys(a).sort(); // on garde un an d'historique
  for (const old of keys.slice(0, Math.max(0, keys.length - 370))) delete a[old];
  ls.set('act', a);
}
function streak() {
  const a = act(); let n = 0; const d = new Date();
  if (!a[dkey(d)]) d.setDate(d.getDate() - 1);
  while (a[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const coach = (html, cls = '') => `<div class="coach ${cls}"><span class="coach-av" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="7" r="3.6" fill="currentColor"/><path d="M8 20c0-4 1.5-6 4-8.5 2.5 2.5 4 4.500 4 8.500z" fill="currentColor"/><rect x="6" y="19.500" width="12" height="2.500" rx="1" fill="currentColor"/></svg></span><div class="coach-b">${html}</div></div>`;
const txt = (t) => esc(t).replace(/\n/g, '<br>');

// Rendu déclenché en arrière-plan (fin d'analyse, import, cours généré) : n'interrompt jamais un exercice en cours.
function bgRender() {
  if ($('#pzb, #clb, #drb, #lib')) { paintJob(); header(); return; }
  render(true);
}

// ---------- Analyse moteur en arrière-plan ----------
async function runAnalysis(count, only) {
  if (S.job.running || !S.data) return;
  let pool = S.data.games.filter((g) => g.tc === targetTc());
  if (!pool.length) pool = S.data.games;
  const queue = only ? [only] : pool.filter((g) => !S.an[g.id]).sort((a, b) => b.t - a.t).slice(0, count);
  if (!queue.length) return;
  S.job = { running: true, done: 0, total: queue.length, stop: false, msg: '' };
  const user = S.user, saveAn = () => (S.user === user ? dbSet('an:' + user, S.an) : null);
  paintJob();
  try {
    S.engine ||= new Engine();
    await S.engine.ready;
    for (const g of queue) {
      if (S.job.stop || S.user !== user) break;
      const a = await analyzeGame(S.engine, g, DEPTH, () => !S.job.stop);
      S.an[g.id] = a || { ev: [], errs: [], nb: 0, acc: null, maxAdv: 0, last: 0, bad: true };
      if (S.job.stop && !a) { delete S.an[g.id]; break; }
      S.job.done++;
      if (S.job.done % 3 === 0 || S.job.done === queue.length) await saveAn();
      paintJob();
      const r = route()[0];
      if ((r === 'puzzles' && !$('#pzb')) || (r === 'partie' && only) || (r === 'accueil' && !only && (S.job.done === 3 || S.job.done % 5 === 0))) bgRender();
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
function destsOf(ch) {
  const d = new Map();
  for (const m of ch.moves({ verbose: true })) { if (!d.has(m.from)) d.set(m.from, []); d.get(m.from).push(m.to); }
  return d;
}
const chkOf = (fen) => { try { const c = new Chess(fen); return c.in_check() ? (c.turn() === 'w' ? 'white' : 'black') : false; } catch { return false; } };
function board(el, cfg) {
  const cg = Chessground(el, { coordinates: true, animation: { duration: 220 }, drawable: { enabled: false, visible: true, autoShapes: cfg.shapes || [] }, ...(cfg.fen ? { check: chkOf(cfg.fen) } : {}), ...cfg });
  const set0 = cg.set; // le roi en échec est signalé à chaque changement de position
  cg.set = (c) => set0(c.fen ? { check: chkOf(c.fen), ...c } : c);
  S.boards.push(cg);
  return cg;
}
const arrow = (uci, brush) => (uci ? { orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush } : null);
const errShapes = (e) => [arrow(e.playedUci, 'red'), arrow(e.best, 'green')].filter(Boolean);
// Flèches d'un coup commenté : ce que la pièce jouée attaque (jaune : ta menace, rouge : celle de l'adversaire).
const stepShapes = (s) => (s.tags.shapes || []).map((q) => ({ orig: q.orig, ...(q.dest ? { dest: q.dest } : {}), brush: (q.by === 'mover') === s.tags.mine ? 'yellow' : 'red' }));
const capStep = (s, i, n, extra = '') => `<div class="capm"><span class="capn"><i class="dot ${s.white ? 'w' : 'b'}"></i>${s.no}${s.white ? '.' : '…'} ${fr(s.san)}</span><span class="small">coup ${i} sur ${n}</span>${extra}</div><div class="prog" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k < i - 1 ? 'done' : k === i - 1 ? 'cur' : ''}"></i>`).join('')}</div>`;

// Lecture animée d'une suite : la flèche annonce le coup, la pièce se déplace, le commentaire suit.
// o : { len(), step(k), brush(k), arrows(liste), show(), alive() }
function film(o) {
  const f = { i: 0, play: false, tm: 0 };
  const read = (s) => Math.max(1500, Math.min(3000, 700 + 21 * s.text.length)); // temps de lecture du commentaire
  f.stop = () => { clearTimeout(f.tm); f.play = false; };
  function tick() {
    if (!f.play) return;
    if (!o.alive()) { f.stop(); return; }
    if (f.i >= o.len()) { f.play = false; o.show(); return; }
    const nx = o.step(f.i);
    o.arrows([{ orig: nx.from, dest: nx.to, brush: o.brush(f.i) }]);
    f.tm = setTimeout(() => {
      if (!o.alive()) { f.stop(); return; }
      f.i++;
      if (f.i >= o.len()) f.play = false;
      o.show();
      if (f.play) f.tm = setTimeout(tick, read(nx));
    }, 750);
  }
  f.start = (from, delay) => {
    f.stop();
    if (from != null) f.i = from;
    f.i = Math.max(0, Math.min(f.i, o.len()));
    f.play = f.i < o.len();
    o.show();
    if (f.play) f.tm = setTimeout(tick, delay ?? (f.i ? read(o.step(f.i - 1)) : 700));
  };
  return f;
}

// ---------- Graphiques ----------
function lineChart(el, pts, o = {}) {
  if (pts.length < 2) { el.innerHTML = '<p class="small">Pas encore assez de données pour tracer la courbe.</p>'; return; }
  const W = Math.max(280, el.clientWidth), H = o.h || 200, m = { l: 36, r: 16, t: 14, b: 22 };
  const ys = pts.map((p) => p.y).concat(o.ref != null ? [o.ref] : []);
  let y0 = o.min ?? Math.min(...ys), y1 = o.max ?? Math.max(...ys);
  if (o.min == null) { const pad = Math.max(10, (y1 - y0) * 0.08); y0 -= pad; y1 += pad; }
  if (y1 <= y0) y1 = y0 + 1;
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
const dayStart = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
function pzQueue(theme, free) {
  const prog = ls.get('pz', {}), now = Date.now(), day = dkey();
  let list = allPuzzles().filter((p) => !theme || p.e.theme === theme);
  if (!free) list = list.filter((p) => (prog[p.id]?.due || 0) <= now);
  else { const rest = list.filter((p) => prog[p.id]?.d !== day); if (rest.length) list = rest; } // entraînement libre : pas ceux du jour
  return list.sort((a, b) => ((prog[a.id] ? 0 : 1) - (prog[b.id] ? 0 : 1)) || (b.g.t - a.g.t) || (b.e.drop - a.e.drop));
}
// res : 2 = trouvé du premier coup, 1 = trouvé après une erreur ou un indice, 0 = solution vue.
// Un seul résultat par jour et par puzzle compte. Un puzzle fait aujourd'hui ne revient pas aujourd'hui :
// raté, il revient demain ; réussi du premier coup, après 1, 3, 7, 21 puis 60 jours.
function pzMark(id, res) {
  const prog = ls.get('pz', {}), p = prog[id], day = dkey();
  if (p?.d === day) return false;
  const box = res === 2 ? Math.min(STEPS.length - 1, (p?.box ?? -1) + 1) : -1;
  prog[id] = { box, due: dayStart() + (box < 0 ? 1 : STEPS[box]) * DAY, ok: (p?.ok || 0) + (res === 2 ? 1 : 0), d: day };
  ls.set('pz', prog);
  return true;
}

// ---------- Journal d'entraînement : chaque exercice terminé est noté, rien ne se perd en quittant la page ----------
// k : 'm' puzzle sur une erreur, 'l' position inédite Lichess, 'd' série d'échauffement. re : 1 si déjà fait ce jour-là.
const hist = () => ls.get('hist', []);
function logHist(x) {
  const h = hist(); h.push({ t: Date.now(), ...x });
  let n = 0; // la position complète d'un puzzle Lichess n'est gardée que pour les 60 derniers
  for (let i = h.length - 1; i >= 0; i--) if (h[i].p && ++n > 60) delete h[i].p;
  ls.set('hist', h.slice(-600));
}
function pzRecord(p, res) {
  const fresh = pzMark(p.id, res);
  if (fresh) bump('pz');
  logHist({ k: 'm', id: p.id, r: res, th: p.e.theme || '', re: fresh ? 0 : 1 });
  const el = $('#pzdayi'); if (el) el.innerHTML = pzDayHtml();
  header();
}
const pzById = (id) => { const [t, ply] = String(id).split(':'); return S.data ? findErr(t, ply) : null; };
const todayPz = () => { const d0 = dayStart(); return hist().filter((h) => h.k === 'm' && !h.re && h.t >= d0); };
// Ratés du jour qui n'ont pas été réussis depuis.
function failedToday() {
  const d0 = dayStart(), last = new Map();
  for (const h of hist()) if (h.k === 'm' && h.t >= d0) last.set(h.id, h.r);
  return [...last].filter(([id, r]) => r < 2 && pzById(id)).map(([id]) => id);
}
// Objectif du jour : 8 puzzles, ou moins s'il n'y en a pas autant en attente.
function pzDay() {
  const f = ls.get('focus', null), t = todayPz();
  const done = Math.max(act()[dkey()]?.pz || 0, t.length);
  const due = (f && pzQueue(f.id, false).length) || pzQueue('', false).length;
  return { done, due, goal: Math.max(1, Math.min(8, done + due)), t };
}
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
const pl = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
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
  const L = S.li, stat = ls.get('listat', {})[L.angle] || { n: 0, ok: 0 };
  const sels = `<select data-f="liangle" aria-label="Thème">${LI_ANGLES.map(([v, l]) => `<option value="${v}" ${L.angle === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select data-f="lidiff" aria-label="Niveau">${LI_DIFF.map(([v, l]) => `<option value="${v}" ${L.diff === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const head = pzTabs('li') + `<div class="pzhead main"><h1>Positions inédites</h1><div class="row">${sels}
      <span data-top><span class="chip ${stat.n ? 'good' : ''}">${stat.ok} / ${stat.n} du premier coup</span></span></div></div>`;
  if (L.loading) return head + coach('Je vais chercher une position que tu n’as jamais vue…');
  if (L.err) return head + `<div class="card"><p class="err">${esc(L.err)}</p><div><button class="btn pri" data-act="linext">Réessayer</button></div></div>`;
  if (!L.cur) return head + `<div class="card">${coach('Ici, tu travailles le même motif que dans tes parties, mais sur des positions que tu ne peux pas reconnaître : c’est ce qui prouve que le réflexe est acquis. Les positions viennent de la base de puzzles de Lichess, libre de droits.')}<div><button class="btn pri lg" data-act="linext">Commencer</button></div></div>`;
  const P = L.cur, me = P.white ? 'w' : 'b', side = P.white ? 'Blancs' : 'Noirs';
  const last = justPlayed(describeAt(P.prevFen, P.lastSan, me));
  return head + coach(`${esc(last)} <b>À toi de jouer avec les ${side}.</b> Trouve le meilleur coup${P.sol.length > 2 ? `, puis la suite (${Math.ceil(P.sol.length / 2)} coups à trouver)` : ''}.`, 'intro') + `
    <div class="split work"><div class="bwrap"><div class="board" id="lib"></div><div class="cap" id="licap"><p><i class="dot ${P.white ? 'w' : 'b'}"></i> <span class="m-txt">${esc(last)} </span>Trait aux ${side}. ${P.sol.length > 2 ? `Trouve le meilleur coup puis la suite (${Math.ceil(P.sol.length / 2)} coups).` : 'Trouve le meilleur coup.'}</p></div></div>
      <div class="stack"><div class="row m-only lisel">${sels}</div><div class="meta small">Puzzle Lichess n° ${esc(P.id)} · niveau ${P.rating} · <a href="${P.url}" target="_blank" rel="noopener">Voir sur Lichess</a></div>
        <div id="lix"><div class="card ghost"><h3>Comment chercher</h3><ol class="routine"><li>Que vient de faire ton adversaire ? Que menace son coup ?</li><li>As-tu un échec, une capture ou une menace ?</li><li>La case où tu vas est-elle attaquée ?</li></ol></div></div></div></div>
    <div class="actbar" id="libar"><button class="btn" data-act="lihint">Indice</button><button class="btn" data-act="lishow">Solution</button></div>`;
}
function mountInedits() {
  const el = $('#lib'), L = S.li;
  if (!el || !L?.cur) return;
  const P = L.cur, me = P.white ? 'w' : 'b', color = P.white ? 'white' : 'black', cap = $('#licap'), ch = new Chess(P.fen);
  let hinted = false;
  L.step = 0; L.done = false; // l'échiquier repart toujours de la position initiale
  const mov = () => ({ free: false, color, dests: destsOf(ch), showDests: true, events: { after: onMove } });
  const cg = board(el, { fen: P.fen, orientation: color, turnColor: color, lastMove: P.last, movable: mov() });
  const say = (cls, html) => { cap.className = 'cap ' + cls; cap.innerHTML = `<p>${html}</p>`; };
  function finish(ok) {
    if (L.done) return;
    L.done = true;
    const res = !ok ? 0 : L.failed || hinted ? 1 : 2;
    if (!L.counted) {
      if (!L.replay) { const all = ls.get('listat', {}), stt = all[L.angle] || { n: 0, ok: 0 }; stt.n++; if (res === 2) stt.ok++; all[L.angle] = stt; ls.set('listat', all); bump('li'); }
      logHist({ k: 'l', id: P.id, r: res, a: L.angle, rt: P.rating, re: L.replay ? 1 : 0, p: { fen: P.fen, prevFen: P.prevFen, last: P.last, lastSan: P.lastSan, sol: P.sol, white: P.white, themes: P.themes } });
      L.counted = true; keepUi();
    }
    const steps = buildLine(P.fen, P.sol, me, true), ins = insight(P.fen, me, steps, []), n = steps.length;
    const verdict = res === 2 ? '<b class="ok">Résolu du premier coup.</b>' : res === 1 ? '<b class="ok">Résolu.</b>' : 'Voici la solution, coup par coup.';
    $('#lix').innerHTML = `<div class="card idea"><h3>L’idée</h3><p>${esc(ins.idee)}</p></div>
      <ol class="line">${steps.map((q, k) => `<li data-ex="jump" data-v="${k + 1}"><b>${q.white ? q.no + '.' : (k === 0 ? q.no + '…' : '')} ${fr(q.san)}</b><span>${esc(q.text)}</span></li>`).join('')}</ol>
      <p class="small">Puzzle de la base Lichess (domaine public). Thèmes : ${esc(P.themes.join(', '))}.</p>`;
    const F = film({ len: () => n, step: (k) => steps[k], brush: (k) => (steps[k].tags.mine ? 'green' : 'blue'), arrows: (a) => cg.setAutoShapes(a), alive: () => document.body.contains(el), show });
    function show() {
      const i = F.i, s = steps[i - 1];
      cg.set({ fen: s ? s.fen : P.fen, lastMove: s ? [s.from, s.to] : P.last, movable: { color: undefined }, drawable: { autoShapes: s ? stepShapes(s) : [arrow(P.sol[0], 'green')] } });
      cap.className = 'cap film ok';
      cap.innerHTML = `<div class="verdict">${verdict}</div>` + (s ? `${capStep(s, i, n)}<p>${esc(s.text)}</p>` : '<p><b>Position de départ.</b> Regarde la solution se dérouler.</p>');
      document.querySelectorAll('#lix ol.line li').forEach((li, k) => li.classList.toggle('cur', k + 1 === i));
      setHtml($('#libar'), `<button class="btn ico" data-ex="prev" aria-label="Coup précédent" ${i === 0 ? 'disabled' : ''}>${ico('prev')}</button><button class="btn ico" data-ex="next" aria-label="Coup suivant" ${i >= n ? 'disabled' : ''}>${ico('next')}</button><button class="btn" data-ex="play">${F.play ? ico('pause') + 'Pause' : i >= n ? ico('replay') + 'Revoir' : ico('play') + 'Lecture'}</button><button class="btn ${F.play ? '' : 'pri'}" data-act="linext">Suivant ›</button>`);
    }
    S.exui = (a, v) => {
      if (a === 'play') { if (F.play) { F.stop(); show(); } else F.start(F.i >= n ? 0 : null, 350); return; }
      F.stop();
      if (a === 'next') F.i++; else if (a === 'prev') F.i--; else if (a === 'jump') F.i = +v;
      F.i = Math.min(Math.max(F.i, 0), n); show();
    };
    document.body.classList.add('solved');
    F.i = n;
    if (res === 0 && !REDUCED) F.start(0); else show(); // solution demandée : elle se joue toute seule
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
      say('ok', `<b class="ok">Bien.</b> Ton adversaire répond ${fr(r.san)}. Trouve la suite.`);
    } else {
      L.failed = true;
      cg.set({ fen: ch.fen(), movable: { color: undefined } });
      cg.setAutoShapes([{ orig: to, brush: 'red' }]);
      say('ko', `<b class="ko">Pas celui-là.</b> ${fr(m.san)} n’est pas le meilleur coup. Réessaie.`);
      setTimeout(() => { if (L.done || !document.body.contains(el)) return; ch.undo(); cg.set({ fen: ch.fen(), turnColor: color, movable: mov() }); cg.setAutoShapes([]); }, 800);
    }
  }
  S.liapi = {
    hint() { if (L.done) return; hinted = true; const w = P.sol[L.step]; cg.set({ drawable: { autoShapes: [{ orig: w.slice(0, 2), brush: 'green' }] } }); say('', `<b>Indice.</b> ${esc(hintFor(ch.fen(), w, me))} La pièce entourée doit jouer.`); },
    show() { if (L.done) return; L.failed = true; finish(false); },
  };
}

function findErr(t, ply) {
  const g = S.data.games.find((x) => String(x.t) === String(t));
  const e = g && S.an[g.id]?.errs.find((x) => String(x.ply) === String(ply));
  return e && e.best ? { id: g.t + ':' + e.ply, g, e } : null;
}
// Écran de travail d'une position : coach, échiquier, bandeau de commentaire, barre d'actions.
function workScreen(p, o) {
  const me = p.g.w ? 'w' : 'b', side = p.g.w ? 'Blancs' : 'Noirs';
  const last = lastMoveText(p.g, p.e.ply, me);
  return `${coach(`${last ? esc(last) + ' ' : ''}<b>À toi de jouer avec les ${side}.</b> En partie, ton coup ici t’a coûté ${p.e.drop} points de chances de gain. Trouve mieux.`, 'intro')}
    <div class="split work"><div class="bwrap"><div class="board" id="pzb"></div>
      <div class="cap" id="pzcap" data-base="cap"><p><i class="dot ${p.g.w ? 'w' : 'b'}"></i> <span class="m-txt">${last ? esc(last) + ' ' : ''}</span>Trait aux ${side}. <span class="d-txt">Joue ton coup sur l’échiquier.</span><span class="m-txt">Trouve mieux qu’en partie.</span></p></div></div>
      <div class="stack" id="pzside">${o.side || ''}
        <div class="meta small">Coup ${moveNo(p.e)} de ta ${gameRef(p.g)}${p.e.theme ? ` · ${st.THEMES[p.e.theme]}` : ''} · <a href="#partie/${p.g.t}/${p.e.ply}">Ouvrir la partie</a></div>
        <div id="pzx"><div class="card ghost"><h3>Comment chercher</h3><ol class="routine"><li>Que vient de faire ton adversaire ? Que menace son coup ?</li><li>As-tu un échec, une capture ou une menace ?</li><li>La case où tu vas est-elle attaquée ?</li></ol></div></div>
      </div></div>
    <div class="actbar" id="pzbar"><button class="btn" data-act="pzhint">Indice</button><button class="btn" data-act="pzreal" id="pzreal">Mon coup</button><button class="btn" data-act="pzshow">Solution</button></div>
    <template id="pznextt">${o.next}</template>`;
}
function viewPuzzles(force) {
  if (force) {
    const p = findErr(force[0], force[1]);
    if (!p) return `<h1>Position introuvable</h1><div class="card"><p class="sub">Cette position n’est plus dans tes analyses.</p><div><a class="btn" href="#parties">Retour aux parties</a></div></div>`;
    S.pzOne = p;
    return `<div class="pzhead"><h1>Comprendre cette erreur</h1></div>` + workScreen(p, { next: '<button class="btn" data-act="back">Retour</button>' });
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
    return pzTabs('mine') + `<div class="pzhead"><h1>Tes ratés du jour</h1><div class="row"><span class="chip warn">Révision : encore ${z.redo.length}</span><button class="btn sm" data-act="pzredostop">Arrêter</button></div></div>`
      + workScreen(pzById(z.redo[0]), { next: `<button class="btn" data-act="pznext">${z.redo.length > 1 ? 'Raté suivant ›' : 'Terminer ›'}</button>` });
  }
  if (z.show === dkey()) return plain + pzRecap('Objectif du jour atteint', 'Tu peux t’arrêter là. Les puzzles ratés reviennent demain, les réussis dans quelques jours : c’est cet espacement qui transforme une correction en réflexe.', false, filter);
  const q = pzQueue(z.theme, z.free);
  if (!z.cur || !q.some((p) => p.id === z.cur.id)) z.cur = q[0] ? { id: q[0].id } : null;
  if (!z.cur) return plain + pzRecap(z.theme ? 'Ce thème est à jour' : 'Tout est à jour', `Plus aucun puzzle en attente aujourd’hui${z.theme ? ' sur ce thème' : ''}. Les puzzles réussis reviennent après 1, 3, 7 puis 21 jours, les ratés dès demain : c’est la répétition espacée qui transforme une correction en réflexe.`, true, filter);
  const p = q.find((x) => x.id === z.cur.id);
  return head + workScreen(p, { next: '<button class="btn" data-act="pznext">Suivant ›</button>', side: filter });
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
  const all = hist(), h = all.slice().reverse(), head = pzTabs('hist') + '<h1>Historique</h1>';
  if (!h.length) return head + `<div class="card">${coach('Chaque puzzle, chaque position inédite et chaque échauffement que tu termines est noté ici avec son résultat. Tu peux quitter la page ou fermer le site : rien ne se perd, et tu peux refaire une position d’un clic.')}<div><a class="btn pri" href="#puzzles">Faire mes puzzles</a></div></div>`;
  S.histN ||= 60;
  const pz = all.filter((x) => x.k !== 'd' && !x.re), d0 = dayStart(), today = dkey();
  const acq = Object.values(ls.get('pz', {})).filter((p) => p.box >= 2).length;
  const tiles = `<div class="tiles"><div class="tile"><b class="num">${pz.filter((x) => x.t >= d0).length}</b><span>puzzles aujourd’hui</span></div>
    <div class="tile"><b class="num">${pz.filter((x) => x.t >= d0 - 6 * DAY).length}</b><span>sur 7 jours</span></div>
    <div class="tile"><b class="num">${pz.length ? st.pct(pz.filter((x) => x.r === 2).length, pz.length) + ' %' : '—'}</b><span>trouvés du premier coup</span></div>
    <div class="tile"><b class="num">${acq}</b><span>acquis (réussis 3 fois, à plusieurs jours d’écart)</span></div></div>`;
  const hm = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const row = (x) => {
    if (x.k === 'd') { const D = DRILLS[x.ty]; return `<div class="hrow"><i class="hres ${x.ok >= x.n * 0.8 ? 'r2' : x.ok >= x.n * 0.5 ? 'r1' : 'r0'}"></i><span class="stepc"><b>Échauffement${D ? ' : ' + D.t : ''}</b><span>${x.ok} / ${x.n} justes · ${hm(x.t)}</span></span>${D ? `<a class="btn sm" href="#drill/${x.ty}">Refaire</a>` : ''}</div>`; }
    const [cls, lab] = RES[x.r] || RES[0], sub = `${lab}${x.re ? ' (révision)' : ''} · ${hm(x.t)}`;
    if (x.k === 'l') return `<div class="hrow"><i class="hres ${cls}"></i><span class="stepc"><b>Position inédite${LI_NAME[x.a] ? ' : ' + LI_NAME[x.a] : ''}</b><span>${sub}${x.rt ? ' · niveau ' + x.rt : ''}</span></span>${x.p ? `<button class="btn sm" data-act="lireplay" data-t="${x.t}">Refaire</button>` : `<a class="btn sm" href="https://lichess.org/training/${esc(x.id)}" target="_blank" rel="noopener">Lichess</a>`}</div>`;
    const p = pzById(x.id);
    return `<div class="hrow"><i class="hres ${cls}"></i><span class="stepc"><b>${p ? `Coup ${moveNo(p.e)} · ${dfmt(p.g.t)} contre ${esc(p.g.opp)}` : 'Position d’une partie'}</b><span>${st.THEMES[x.th] ? st.THEMES[x.th] + ' · ' : ''}${sub}</span></span>${p ? `<a class="btn sm" href="#erreur/${p.g.t}/${p.e.ply}">Refaire</a>` : ''}</div>`;
  };
  const days = new Map();
  for (const x of h.slice(0, S.histN)) { const k = dkey(new Date(x.t)); if (!days.has(k)) days.set(k, []); days.get(k).push(x); }
  const yest = dkey(new Date(d0 - DAY / 2));
  const label = (k) => (k === today ? 'Aujourd’hui' : k === yest ? 'Hier' : new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const sum = (l) => { const z = l.filter((x) => x.k !== 'd' && !x.re), dr = l.filter((x) => x.k === 'd').length, rv = l.filter((x) => x.k !== 'd' && x.re).length; return [z.length ? `${pl(z.length, 'puzzle')}, ${z.filter((x) => x.r === 2).length} du premier coup` : '', rv ? pl(rv, 'révision') : '', dr ? pl(dr, 'échauffement') : ''].filter(Boolean).join(' · '); };
  return head + tiles + `<div class="legend"><span style="--c:var(--good)">Du premier coup</span><span style="--c:var(--warn)">Trouvé avec aide</span><span style="--c:var(--bad)">Solution vue</span></div>`
    + [...days].map(([k, l]) => `<div class="card hday"><h2><span class="hcap">${label(k)}</span><span class="small">${sum(l)}</span></h2>${l.map(row).join('')}</div>`).join('')
    + (h.length > S.histN ? '<div><button class="btn" data-act="histmore">Afficher les exercices plus anciens</button></div>' : '');
}

// ---------- Explication : suites commentées, idée, comparaison ----------
const LINES = new Map();
// Coupe une suite sur une position calme : jamais au milieu d'un échange (une prise qui peut être reprise),
// sinon le bilan matériel affiché serait faux. Vise `base` coups, prolonge jusqu'à la fin de l'échange.
function settle(fen, moves, base = 5, max = 9) {
  const c = new Chess(fen), open = [];
  for (const u of moves.slice(0, max)) {
    const m = uciMove(c, u); if (!m) break;
    open.push(!!m.captured && c.moves({ verbose: true }).some((x) => x.to === m.to));
  }
  let n = Math.min(open.length, base);
  while (n < open.length && open[n - 1]) n++;
  while (n > 1 && open[n - 1]) n--;
  return moves.slice(0, Math.max(n, 1));
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
// o : { g, e, api, cap, panel, bar, next (html du bouton de sortie), verdict, exact (le meilleur coup est déjà sur l'échiquier) }
// Deux films : « La bonne suite » se joue toute seule après la solution, puis « Ton coup » montre ce que ton coup permettait.
function explainUI(o) {
  const e = o.e, g = o.g, x = { tab: 'best', d: null, seenRef: false, endBest: false, note: '', ptab: null };
  const lastMv = e.prev ? [e.prev.slice(0, 2), e.prev.slice(2, 4)] : undefined;
  // Bilan matériel cumulé depuis le début de la suite : dans un échange, on voit +9 puis « égalité », pas +9 puis −9.
  const matChip = (L, i, m0) => { if (!L.slice(0, i).some((q) => q.raw.captured)) return ''; const d = L[i - 1].mat - m0; return `<span class="chip ${d > 0 ? 'good' : d < 0 ? 'bad' : ''}">${d ? `Bilan ${d > 0 ? '+' : '−'}${Math.abs(d)}` : 'Bilan : égalité'}</span>`; };
  o.cap.className = 'cap'; o.cap.innerHTML = `<p>${o.verdict || ''} Je prépare l’explication…</p>`;
  document.body.classList.add('solved');
  if (innerWidth < 860) scrollTo(0, 0);
  o.bar.innerHTML = o.next;
  const line = () => x.d[x.tab];
  const F = film({
    len: () => line().length, step: (k) => line()[k],
    brush: (k) => (x.tab === 'best' ? (line()[k].tags.mine ? 'green' : 'blue') : (k === 0 || !line()[k].tags.mine ? 'red' : 'blue')),
    arrows: (a) => o.api.arrows(a), alive: () => document.body.contains(o.cap), show: draw,
  });
  function draw() {
    const d = x.d, L = line(), n = L.length, i = Math.min(F.i, n), s = L[i - 1], best = x.tab === 'best';
    if (!s) o.api.view(e.fen, lastMv, [arrow(best ? e.best : e.playedUci, best ? 'green' : 'red')]);
    else o.api.view(s.fen, [s.from, s.to], stepShapes(s));
    // En pas à pas, tu peux jouer toi-même la punition de ton coup ou tes coups de la bonne suite.
    const nx = L[i], guess = !F.play && i >= 1 && nx && ((!best && i === 1) || (best && nx.tags.mine));
    if (guess) o.api.ask(s.fen, (from, to) => {
      x.note = from === nx.from && to === nx.to ? '<b class="ok">Exact.</b>' : `<b class="ko">Pas le coup du moteur.</b> Il préférait ${fr(nx.san)}.`;
      F.i++; draw();
    });
    const note = x.note; x.note = '';
    const atEnd = i >= n;
    if (!best) x.seenRef = true;
    if (best && atEnd) x.endBest = true;
    if (!o.cap._film) {
      o.cap._film = true;
      o.cap.innerHTML = '<div class="capb"></div>';
    }
    o.cap.className = 'cap film ' + (best ? 'ok' : 'ko');
    const end = !atEnd || !s ? '' : s.tags.mate ? `<p class="bilan"><b>Bilan :</b> échec et mat${s.tags.mine ? '' : ' contre toi'}.</p>` : `<p class="bilan"><b>Bilan de ${best ? 'la bonne suite' : 'ton coup'} :</b> ${best ? d.ins.bestTxt : d.ins.refTxt}.</p>`;
    $('.capb', o.cap).innerHTML = (o.verdict && best && i <= 1 ? `<div class="verdict">${o.verdict}</div>` : '')
      + (s ? `${capStep(s, i, n, matChip(L, i, d.m0))}<p>${note ? note + ' ' : ''}${esc(s.text)}</p>${guess ? `<p class="ask">${best ? 'À toi : joue la suite sur l’échiquier.' : 'À toi de punir ce coup : joue la meilleure réponse de ton adversaire.'} <span class="small">Ou passe au coup suivant.</span></p>` : ''}${end}`
        : `<p><b>Position de départ.</b> ${best ? 'La flèche verte montre le meilleur coup.' : 'La flèche rouge montre le coup que tu as joué en partie.'}</p>`);
    if (x.ptab !== x.tab) { // le panneau n'est reconstruit qu'au changement de film
      x.ptab = x.tab;
      const real = g.san[e.ply + 1], refReply = d.ref[1];
      o.panel.innerHTML = `<div class="seg2 mini" role="tablist"><button role="tab" data-ex="tab" data-v="best" class="${best ? 'on' : ''}">La bonne suite</button><button role="tab" data-ex="tab" data-v="ref" class="${best ? '' : 'on'}">Ton coup : ${fr(e.played)}</button></div>
        <div class="card idea"><h3>L’idée derrière ${fr(e.bestSan)}</h3><p>${esc(d.ins.idee)}</p></div>
        <h3 class="lh">${best ? 'La bonne suite, coup par coup' : `Ce que permettait ${fr(e.played)}`}</h3>
        <ol class="line">${L.map((q, k) => `<li data-ex="jump" data-v="${k + 1}"><b>${q.white ? q.no + '.' : (k === 0 ? q.no + '…' : '')} ${fr(q.san)}</b><span>${esc(q.text)}</span></li>`).join('')}</ol>
        ${!best && real && refReply && real !== refReply.san ? `<p class="small">En partie, ton adversaire a répondu ${fr(real)} au lieu de ${fr(refReply.san)} : il n’a pas trouvé la meilleure réponse. Ton coup restait une erreur, un adversaire plus attentif l’aurait punie.</p>` : ''}
        <div class="card why"><h3>Pourquoi pas ${fr(e.played)} ?</h3><p>${esc(d.ins.pourquoi)}</p>
          <div class="cmp"><div class="ok"><span>Meilleur coup · ${fr(e.bestSan)}</span><b>${d.ins.bestTxt}</b><span>évaluation ${fmtEval(e.e0)}</span></div><div class="ko"><span>Ton coup · ${fr(e.played)}</span><b>${d.ins.refTxt}</b><span>évaluation ${fmtEval(e.e1)}</span></div></div>
          <p class="small">Bilan matériel au bout des suites montrées. Valeurs : pion 1, cavalier et fou 3, tour 5, dame 9. L’évaluation est celle du moteur, de ton point de vue : +1 vaut un pion d’avance.</p></div>
        ${e.theme ? `<div class="card rule"><span class="small">À retenir</span><p class="rulet">${RULES[e.theme]}</p><a href="#cours/${e.theme}">Cours : ${LESSONS[e.theme].titre}</a></div>` : ''}`;
    }
    o.panel.querySelectorAll('ol.line li').forEach((li, k) => li.classList.toggle('cur', k + 1 === i));
    const wantRef = best && x.endBest && !x.seenRef;
    const mid = F.play ? `<button class="btn" data-ex="play">${ico('pause')}Pause</button>`
      : !atEnd ? `<button class="btn pri" data-ex="play">${ico('play')}Lecture</button>`
      : wantRef ? '<button class="btn pri" data-ex="tab" data-v="ref">Voir mon erreur</button>'
      : `<button class="btn" data-ex="play">${ico('replay')}Revoir</button>`;
    setHtml(o.bar, `<button class="btn ico" data-ex="prev" aria-label="Coup précédent" ${i === 0 ? 'disabled' : ''}>${ico('prev')}</button><button class="btn ico" data-ex="next" aria-label="Coup suivant" ${atEnd ? 'disabled' : ''}>${ico('next')}</button>${mid}${o.next.replace('class="btn"', `class="btn ${atEnd && !wantRef ? 'pri' : ''}"`)}`);
  }
  S.exui = (a, v) => {
    if (!x.d) return;
    if (a === 'play') { if (F.play) { F.stop(); draw(); } else F.start(F.i >= line().length ? 0 : null, 350); return; }
    F.stop();
    if (a === 'tab') { x.tab = v; if (REDUCED) { F.i = 1; draw(); } else F.start(0); return; }
    if (a === 'next') F.i++; else if (a === 'prev') F.i = Math.max(0, F.i - 1); else if (a === 'jump') F.i = +v;
    F.i = Math.min(F.i, line().length);
    draw();
  };
  getLines(g, e).then((d) => {
    if (!document.body.contains(o.cap)) return;
    x.d = d;
    if (REDUCED) { F.i = 1; draw(); } else F.start(o.exact === false ? 0 : 1); // la suite se joue toute seule
  });
}

// Échiquier jouable sur une de tes erreurs : vérifie ton coup, montre l'indice, la solution ou ton coup réel.
function solveBoard(el, fb, g, e, o = {}) {
  const ch = new Chess(e.fen), color = g.w ? 'white' : 'black', stt = { tries: 0, shown: false, done: false, real: false, tk: 0 };
  const lastMv = e.prev ? [e.prev.slice(0, 2), e.prev.slice(2, 4)] : undefined;
  const mov = () => ({ free: false, color, dests: destsOf(ch), showDests: true, events: { after: onMove } });
  const cg = board(el, { fen: ch.fen(), orientation: color, turnColor: color, lastMove: lastMv, movable: mov() });
  const say = (cls, html) => { fb.className = (fb.dataset.base || 'fb') + ' ' + cls; fb.innerHTML = html; };
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
    if (!document.body.contains(el)) return; // l'utilisateur a quitté l'écran pendant la vérification
    if (stt.done || stt.tk !== tk) return;
    if (drop < 6) return finish(true, `<b class="ok">Bon coup.</b> ${fr(m.san)} tient la position (le moteur préférait ${fr(e.bestSan)}).`, false);
    stt.tries++;
    cg.setAutoShapes([{ orig: to, brush: 'red' }]);
    say('ko', `<b class="ko">Pas celui-là.</b> ${fr(m.san)} ${uci === e.playedUci.slice(0, 4) ? 'est le coup que tu avais joué en partie' : `fait perdre ${Math.round(drop)} points de chances de gain`}. Réessaie.`);
    if (stt.tries >= 2 && !stt.hints) $('[data-act="pzhint"]')?.classList.add('pulse'); // deux essais ratés : l'indice se signale
    setTimeout(() => { if (stt.tk !== tk || !document.body.contains(el)) return; ch.undo(); cg.set({ fen: ch.fen(), turnColor: color, movable: mov() }); cg.setAutoShapes(hintShape()); }, 900);
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
        fb.className = stt.fbClass; fb.innerHTML = stt.fbHtml;
        return;
      }
      stt.real = true; if (btn) btn.textContent = 'Revenir';
      stt.fbClass = fb.className; stt.fbHtml = fb.innerHTML;
      ch.load(e.fen);
      const m = uciMove(ch, e.playedUci); if (!m) return;
      cg.set({ fen: ch.fen(), lastMove: [m.from, m.to], movable: { color: undefined }, drawable: { autoShapes: [arrow(e.playedUci, 'red')] } });
      const replySan = g.san[e.ply + 1];
      say('', `En partie, tu as joué <b>${fr(e.played)}</b>` + (replySan ? ` et ton adversaire a répondu <b>${fr(replySan)}</b>.` : '.') + (e.punish[0] && e.punish[0] !== replySan ? ` La réponse la plus forte était ${fr(e.punish[0])}.` : '') + ` <a href="#partie/${g.t}/${e.ply + 2}">Voir la suite</a>`);
      if (replySan) setTimeout(() => { if (!stt.real || !document.body.contains(el)) return; const r = ch.move(replySan, { sloppy: true }); if (r) cg.set({ fen: ch.fen(), lastMove: [r.from, r.to], drawable: { autoShapes: [] } }); }, 900);
    },
    hint() {
      if (stt.real) api.real($('#pzreal')); if (stt.done) return;
      stt.shown = true; stt.hints = (stt.hints || 0) + 1;
      $('[data-act="pzhint"]')?.classList.remove('pulse');
      const q = txt(o.hintText || hintFor(e.fen, e.best, g.w ? 'w' : 'b'));
      if (stt.hints === 1) say('', `<b>Indice 1.</b> ${q} <span class="small">Touche encore « Indice » pour voir quelle pièce joue.</span>`);
      else { cg.set({ drawable: { autoShapes: [{ orig: e.best.slice(0, 2), brush: 'green' }] } }); say('', `<b>Indice 2.</b> ${q} La pièce entourée doit jouer.`); }
    },
    show() { if (stt.real) api.real($('#pzreal')); if (stt.done) return; stt.shown = true; ch.load(e.fen); const m = uciMove(ch, e.best); cg.set({ fen: ch.fen(), lastMove: m ? [m.from, m.to] : undefined }); finish(false, `La solution était <b>${fr(e.bestSan)}</b>.`, true); },
  };
  return api;
}
function mountPuzzle() {
  const el = $('#pzb');
  if (!el) return;
  const p = S.pzOne || pzById(S.pz?.redo?.[0] || S.pz?.cur?.id || '');
  if (!p) return;
  const cap = $('#pzcap');
  getLines(p.g, p.e); // prépare l'explication pendant que tu cherches
  S.solve = solveBoard(el, cap, p.g, p.e, {
    done: (res, first, html, exact) => {
      if (first) pzRecord(p, res); // noté tout de suite : quitter la page ne fait rien perdre
      explainUI({ g: p.g, e: p.e, api: S.solve, cap, panel: $('#pzx'), bar: $('#pzbar'), next: $('#pznextt').innerHTML, verdict: html, exact });
    },
  });
}

// ---------- Vues ----------
function filtersHtml() {
  const has = new Set(S.data.games.map((g) => g.tc));
  return `<select data-f="tc" aria-label="Cadence">${['rapid', 'blitz', 'bullet', 'daily'].filter((k) => has.has(k)).map((k) => `<option value="${k}" ${S.f.tc === k ? 'selected' : ''}>${TC[k]}</option>`).join('')}<option value="all" ${S.f.tc === 'all' ? 'selected' : ''}>Toutes cadences</option></select>
    <select data-f="days" aria-label="Période"><option value="0">Depuis le début</option><option value="90" ${S.f.days === 90 ? 'selected' : ''}>90 derniers jours</option><option value="30" ${S.f.days === 30 ? 'selected' : ''}>30 derniers jours</option></select>
    <button class="btn sm" data-act="refresh" title="Récupérer les nouvelles parties de ${esc(S.user)}">Mettre à jour</button>`;
}
const TITLES = { puzzles: 'Puzzles', erreur: 'Comprendre', partie: 'Partie', cours: 'Cours', drill: 'Échauffement', inedits: 'Positions inédites' };
function header() {
  const t = $('#tools'), [r, a] = route();
  const imm = !!S.data && (r === 'erreur' || r === 'partie' || (r === 'drill' && !!$('#drb')) || (r === 'inedits' && !!$('#lib')) || (r === 'cours' && !!a) || (r === 'puzzles' && !!$('#pzb')));
  document.body.classList.toggle('imm', imm);
  $('#ttl').textContent = imm ? TITLES[r] : '';
  if (!S.data) { t.innerHTML = ''; return; }
  const tr = st.trend(rapidAll()), stk = streak();
  // Sur téléphone, pendant un exercice, la barre du haut montre l'avancée (puzzles du jour, position de la série).
  const top = !imm ? '' : r === 'puzzles' && $('.pzhead.main') ? pzProg(pzDay(), 'm-only') : $('#view [data-top]') ? `<span class="m-only row chips">${$('#view [data-top]').innerHTML}</span>` : '';
  t.innerHTML = `${top || `<span class="m-only row chips">${tr ? `<span class="chip">${tr.cur} Elo</span>` : ''}<span class="chip ${stk ? 'warn' : ''}">Série ${stk} j</span></span>`}<span class="d-only filters">${filtersHtml()}</span>`;
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
  const read = ls.get('lus', {});
  return ids.find((id) => !read[id]) || ids[0] || 'principes';
}
// Chantier : un seul type d'erreur travaillé à la fois, jusqu'à ce que son taux baisse de moitié.
const f1 = (x) => x.toFixed(1).replace('.', ',');
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
  const read = ls.get('lus', {});
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
    return head + coach(`<b>Position ${i + 1} sur ${L.positions.length}.</b> Coup ${moveNo(x.e)} de ta ${gameRef(x.g)}. ${lm ? esc(lm) + ' ' : ''}<br>${txt(pos.question)}`) + `
    <div class="split work"><div class="bwrap"><div class="board" id="clb"></div>
      <div class="cap" id="clf" data-base="cap"><p><i class="dot ${x.g.w ? 'w' : 'b'}"></i> Trait aux ${x.g.w ? 'Blancs' : 'Noirs'}. Joue le coup que tu aurais dû jouer.</p></div></div>
      <div class="stack">
        <div id="clx" hidden>${coach(`${txt(pos.explication)}<br><b>À retenir :</b> ${txt(pos.retenir)}`)}</div>
        <div id="clp"></div>
        ${coachKey() ? `<form data-form="ask" class="row"><input type="text" id="askq" placeholder="Une question sur cette position ?" style="flex:1;min-width:180px" aria-label="Question au coach"><button class="btn">Demander au coach</button></form><div id="aska"></div>` : ''}
      </div></div>
    <div class="actbar" id="clbar"><button class="btn" data-act="pzhint">Indice</button><button class="btn" data-act="pzreal" id="pzreal">Mon coup</button><button class="btn" data-act="pzshow">Solution</button></div>
    <template id="clnextt"><button class="btn" data-act="clnext">Continuer ›</button></template>`;
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
  const el = $('#clb'), c = S.clPos;
  if (!el || !c) return;
  const cap = $('#clf');
  getLines(c.x.g, c.x.e);
  S.solve = solveBoard(el, cap, c.x.g, c.x.e, { hintText: c.pos.indice, done: (res, first, html, exact) => {
    $('#clx').hidden = false;
    if (first) pzRecord({ id: c.x.g.t + ':' + c.x.e.ply, e: c.x.e }, res);
    explainUI({ g: c.x.g, e: c.x.e, api: S.solve, cap, panel: $('#clp'), bar: $('#clbar'), next: $('#clnextt').innerHTML, verdict: html, exact });
  } });
}
function viewLecon(id, mode) {
  const L = LESSONS[id];
  if (!L) return viewCours();
  if (S.ai[id] && mode !== 'fiche' && !(S.gen && S.gen.id === id && !S.gen.err)) return viewCoachLesson(id, S.ai[id]);
  const gs = games(), ex = ENGINE_LESSONS.includes(id) ? lessonExamples(id) : [];
  const nums = lessonNumbers(id, gs);
  const blown = id === 'conversion' ? gs.filter((g) => S.an[g.id]?.maxAdv >= 500 && g.out !== 'W').slice(-6).reverse() : [];
  const read = ls.get('lus', {});
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
  ${blown.length ? `<div class="card"><h2>Parties qui t’ont échappé</h2>${blown.map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or})</span><span class="chip ${g.out === 'L' ? 'bad' : ''}">${g.out === 'L' ? 'Défaite' : 'Nulle'}</span></a>`).join('')}</div>` : ''}
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

function gvCap(v) {
  const k = v.k, g = v.g, a = v.a, e = v.errAt[k], prevErr = v.errAt[k - 1], me = g.w ? 'w' : 'b';
  const kindChip = (x) => `<span class="chip ${x.kind === 'gaffe' ? 'bad' : x.kind === 'erreur' ? 'warn' : ''}">${x.kind === 'gaffe' ? 'Gaffe' : x.kind === 'erreur' ? 'Erreur' : 'Imprécision'}</span>`;
  if (e) return { cls: 'cap ko', html: `<div class="capm"><span class="capn">Moment clé, coup ${moveNo(e)}</span>${kindChip(e)}</div><p>${explain(e)}</p><a class="btn pri sm" href="#erreur/${g.t}/${e.ply}">Comprendre cette erreur</a>` };
  const txtK = k > 0 ? moveText(g, k, me) : 'Position de départ. Avance coup par coup : chaque coup est commenté ici.';
  return { cls: 'cap', html: `<div class="capm"><span class="capn">${k > 0 ? `<i class="dot ${k % 2 ? 'w' : 'b'}"></i>${Math.ceil(k / 2)}${k % 2 ? '.' : '…'} ${fr(v.mv[k - 1].san)}` : 'Début'}</span>${prevErr ? kindChip(prevErr) : ''}${a ? `<span class="small">éval ${fmtEval(g.w ? a.ev[k] : -a.ev[k])}</span>` : ''}</div><p>${esc(txtK)}</p>` };
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
  return `<div class="pzhead"><h1>${g.w ? 'Blancs' : 'Noirs'} contre ${esc(g.opp)} <span class="small num">${g.or}</span></h1>
    <div class="row">${res}<span class="chip">${dfmt(g.t)}</span><span class="chip">${esc(g.fam)}</span><a class="btn sm" href="${esc(g.id)}" target="_blank" rel="noopener">Chess.com</a></div></div>
  <div class="split work"><div class="bwrap"><div class="board" id="gvb"></div><div class="${cap.cls}" id="gvcap">${cap.html}</div></div>
    <div class="stack">
      ${a ? `<div class="row"><span class="chip bad">${pl(a.errs.filter((x) => x.kind === 'gaffe').length, 'gaffe')} ??</span><span class="chip warn">${pl(a.errs.filter((x) => x.kind === 'erreur').length, 'erreur')} ?</span><span class="chip">${pl(a.errs.filter((x) => x.kind === 'imprecision').length, 'imprécision')} ?!</span><span class="chip good">Précision ${a.acc?.toFixed(0)} %</span></div>
      <div class="card"><h2>Tes chances de gain</h2><div class="chart" id="evc"></div><p class="small">Points rouges : gaffes. Points orange : erreurs. Touche la courbe pour aller au coup.</p></div>`
    : `<div class="card"><p class="sub">Cette partie n’est pas encore analysée.</p><div><button class="btn pri" data-act="analyse1" ${S.job.running ? 'disabled' : ''}>${S.job.running ? 'Analyse en cours' : 'Analyser cette partie'}</button></div></div>`}
      <div class="card"><h2>Coups</h2><div class="moves">${moves}</div></div>
      ${serious.length ? `<div class="card"><h2>Moments clés</h2>${serious.map((x) => `<a class="row" href="#" data-act="goto" data-k="${x.ply}" style="justify-content:space-between;text-decoration:none"><span>Coup ${moveNo(x)} : ${fr(x.played)}, mieux ${fr(x.bestSan)}</span><span class="chip ${x.kind === 'gaffe' ? 'bad' : 'warn'}">${st.THEMES[x.theme]}</span></a>`).join('')}</div>` : ''}
    </div></div>
  <div class="actbar" id="gvbar">${gvBar(v)}</div>`;
}
// Met à jour l'écran de relecture sans le reconstruire : les pièces s'animent d'un coup à l'autre.
function gvSync() {
  const v = S.gv, k = v.k, e = v.errAt[k], cap = gvCap(v), el = $('#gvcap');
  v.cg.set({ fen: v.fens[k], lastMove: k > 0 ? [v.mv[k - 1].from, v.mv[k - 1].to] : undefined, drawable: { autoShapes: e ? errShapes(e) : [] } });
  el.className = cap.cls; el.innerHTML = cap.html;
  $('#gvbar').innerHTML = gvBar(v);
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
  if ($('#gvb') && v.cg) gvSync(); else render(true);
}
function mountPartie() {
  const v = S.gv, el = $('#gvb'); if (!el || !v) return;
  v.cg = board(el, { fen: v.fens[v.k], orientation: v.g.w ? 'white' : 'black', viewOnly: true });
  gvSync();
}

function viewExos() {
  const hist = ls.get('drills', []);
  return `<h1>Échauffements</h1>${coach('Sous 1000 Elo, la plupart des parties se perdent sur une vérification oubliée. Ces exercices entraînent le geste lui-même, sur des positions tirées de tes parties : 10 positions, 2 minutes. La justesse d’abord, la vitesse vient ensuite.')}
  <div class="menu">${Object.entries(DRILLS).map(([k, d]) => {
    const h = hist.filter((x) => x.type === k), last = h[h.length - 1];
    return `<a class="mrow" href="#drill/${k}"><span class="mico">${h.length ? Math.round((100 * last.ok) / last.n) + '%' : ico('play')}</span><span class="stepc"><b>${d.t}</b><span>${d.d}${h.length ? ` · ${pl(h.length, 'série')}` : ''}</span></span><span class="chev" aria-hidden="true">›</span></a>`;
  }).join('')}</div>`;
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
    const sec = Math.round(d.ms / 1000 / n), hist = ls.get('drills', []).filter((x) => x.type === type), prev = hist[hist.length - 2];
    const msg = d.ok >= n - 1 ? 'Le réflexe est là. Garde ce rythme en partie : la même question, avant chaque coup.' : d.ok >= n * 0.6 ? 'C’est en bonne voie. Refais une série en prenant une seconde de plus par position.' : 'Ralentis : la justesse d’abord. Refais une série sans regarder le temps.';
    return `<h1>${D.t}</h1><div class="card"><div class="row" style="align-items:baseline"><span class="big num">${d.ok}/${n}</span><span class="sub">${sec} s par position${prev ? ` · série précédente : ${prev.ok}/${prev.n}` : ''}</span></div>${coach(msg)}
      <div>${nextStep('dr')}</div><div class="row"><button class="btn" data-act="dragain">Refaire une série</button><a class="btn" href="#exos">Autres échauffements</a></div></div>`;
  }
  const it = d.items[d.i];
  return `<div class="pzhead main"><h1>${D.t}</h1><div class="row" data-top><span class="chip">${d.i + 1} / ${n}</span><span class="chip good">${pl(d.ok, 'juste')}</span></div></div>
    <div class="seg">${d.items.map((_, k) => `<i class="${k < d.i ? 'done' : k === d.i ? 'cur' : ''}"></i>`).join('')}</div>
    ${coach(it.q)}
    <div class="split work"><div class="bwrap"><div class="board" id="drb"></div><div class="cap" id="drcap"><p><i class="dot ${it.white ? 'w' : 'b'}"></i> Tu as les ${it.white ? 'Blancs' : 'Noirs'}.${it.tap ? ' Touche une pièce sur l’échiquier.' : ''}</p></div></div>
      <div class="stack"><div class="card ghost"><h3>Pourquoi cet exercice</h3><p class="sub">${D.why}</p></div></div></div>
    <div class="actbar" id="drbar">${it.options.map(([v, l]) => `<button class="btn" data-act="drans" data-v="${v}">${l}</button>`).join('')}</div>`;
}
// Passe à la position suivante ; à la fin, la série est notée dans l'historique.
function drAdvance() {
  const d = S.dr; d.i++; d.ans = null;
  if (d.i < d.items.length) return;
  const h = ls.get('drills', []); h.push({ d: dkey(), type: d.type, ok: d.ok, n: d.items.length, ms: d.ms }); ls.set('drills', h.slice(-200));
  bump('dr'); logHist({ k: 'd', ty: d.type, ok: d.ok, n: d.items.length });
}
function drillAnswer(v) {
  const d = S.dr, it = d.items[d.i];
  if (d.ans != null) return;
  const ok = v === it.answer;
  d.ans = v; if (ok) d.ok++;
  d.ms += Math.min(60000, Date.now() - (d.t1 || Date.now()));
  keepUi();
  const cap = $('#drcap');
  cap.className = 'cap ' + (ok ? 'ok' : 'ko');
  cap.innerHTML = `<div class="capm"><span class="capn">${ok ? 'Juste' : 'Raté'}</span></div><p>${esc(it.text)}</p>`;
  const shapes = it.shapes.slice();
  if (it.tap && it.answer !== 'none' && it.answer !== 'skip') shapes.push({ orig: it.answer, brush: 'green' });
  if (it.tap && !ok && /^[a-h][1-8]$/.test(v)) shapes.push({ orig: v, brush: 'red' });
  S.drcg.set({ drawable: { autoShapes: shapes } });
  $('#drbar').innerHTML = `<button class="btn pri" data-act="drnext">${d.i === d.items.length - 1 ? 'Voir mon score' : 'Suivant ›'}</button>`;
}
function mountDrill() {
  const el = $('#drb'), d = S.dr;
  if (!el || !d || d.i >= d.items.length) return;
  const it = d.items[d.i];
  d.ans = null; d.t1 = Date.now();
  S.drcg = board(el, { fen: it.fen, orientation: it.white ? 'white' : 'black', lastMove: it.last, movable: { free: false, color: undefined }, draggable: { enabled: false }, selectable: { enabled: !!it.tap }, drawable: { enabled: false, visible: true, autoShapes: it.pre || [] }, events: it.tap ? { select: (key) => {
    const pc = S.drcg.state.pieces.get(key), mine = it.white ? 'white' : 'black';
    if (pc && (it.type === 'menace' ? pc.color === mine : pc.color !== mine)) drillAnswer(key);
  } } : {} });
}
function viewPlus() {
  const row = (href, t, d, ic) => `<a class="mrow" href="${href}"><span class="mico">${ic}</span><span class="stepc"><b>${t}</b><span>${d}</span></span><span class="chev" aria-hidden="true">›</span></a>`;
  const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">${d}</svg>`;
  return `<h1>Plus</h1><div class="menu">
    ${row('#exos', 'Échauffements', '4 exercices rapides pour automatiser la vérification', svg('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>'))}
    ${row('#ouvertures', 'Ouvertures', 'Tes résultats par ouverture, ton répertoire', svg('<path d="M11 3h2v5h5v4h-2v-2h-3v3h3v8H8v-8h3v-3H8v2H6V8h5z"/>'))}
    ${row('#stats', 'Stats', 'Toutes tes données depuis ta première partie', svg('<path d="M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z"/>'))}
    ${row('#plan', 'Plan et réglages', 'Plan de la semaine, objectif, coach Claude', svg('<path d="M7 2h2v2h6V2h2v2h3v17H4V4h3zm-1 7v10h12V9z"/>'))}</div>
  <div class="card"><h2>Tes données</h2><p class="sub">Compte ${esc(S.user)}. Dernière mise à jour le ${new Date(S.data.fetchedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.</p>
    <div class="stack filters">${filtersHtml()}</div></div>`;
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
    <div class="card"><h2>Coach Claude</h2>${coachKey() ? `<p class="sub">Coach activé. Clé enregistrée sur cet appareil (…${esc(coachKey().slice(-4))}).</p>
      <div class="row"><label for="cmodel" class="sub">Modèle</label><select id="cmodel">${MODELS.map(([v, l]) => `<option value="${v}" ${coachModel() === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><button class="btn sm" data-act="keydel">Supprimer la clé de cet appareil</button></div>` : keyForm()}</div>
  </div>`;
}

// ---------- État de l'écran, conservé quand on quitte ou recharge la page ----------
function keepUi() {
  if (!S.data) return;
  ls.set('ui', { d: dkey(), pz: S.pz, cl: S.cl, dr: S.dr && S.dr.i < S.dr.items.length ? S.dr : null, li: S.li?.cur && !S.li.counted ? { cur: S.li.cur, failed: !!S.li.failed, replay: !!S.li.replay } : null });
}
function restoreUi() {
  const u = ls.get('ui', null); if (!u) return;
  const same = u.d === dkey();
  if (u.pz) S.pz = same ? u.pz : { ...u.pz, free: false, redo: [], show: null }; // un nouveau jour repart de la file normale
  S.cl = u.cl || null;
  if (same) S.dr = u.dr || null;
  S.liKeep = u.li || null;
}

// ---------- Routage et événements ----------
const H = { esc, fr, dfmt, wdl, lineChart, TC, HOW, WDL: WDL_LEGEND };
const route = () => (location.hash.slice(1) || 'accueil').split('/');
function render(keepScroll) {
  const y = scrollY;
  for (const b of S.boards) { try { b.destroy(); } catch { /* rien */ } }
  S.boards = []; S.exui = null; $('#tip').hidden = true; document.body.classList.remove('solved');
  const v = $('#view'), [r, a, b] = route();
  paintJob();
  $('#nav').hidden = !S.data;
  document.querySelectorAll('#nav a').forEach((x) => x.classList.toggle('on', x.getAttribute('href') === '#' + ({ partie: 'parties', erreur: 'puzzles', inedits: 'puzzles', drill: 'puzzles', historique: 'puzzles' }[r] || r) || (x.getAttribute('href') === '#plus' && ['ouvertures', 'plan', 'stats', 'exos'].includes(r))));
  if (!S.data) { document.body.classList.remove('fit'); header(); v.innerHTML = viewWelcome(); const f = $('#wf'); f.onsubmit = (ev) => { ev.preventDefault(); const u = $('#wu').value.trim(); if (u) doImport(u); }; return; }
  if (r !== 'partie') S.gv = null;
  if (r !== 'drill' && S.dr && S.dr.i >= S.dr.items.length) S.dr = null; // une série en cours se reprend, une série finie repart de zéro
  const html = r === 'puzzles' ? viewPuzzles() : r === 'erreur' ? viewPuzzles([a, b]) : r === 'plus' ? viewPlus() : r === 'historique' ? viewHistory() : r === 'exos' ? viewExos() : r === 'inedits' ? viewInedits() : r === 'drill' ? viewDrill(a) : r === 'cours' ? (a ? viewLecon(a, b) : viewCours()) : r === 'ouvertures' ? viewOuvertures() : r === 'parties' ? viewParties() : r === 'partie' ? viewPartie(a, b) : r === 'plan' ? viewPlan() : r === 'stats' ? viewStats(S, H) : viewAccueil();
  v.innerHTML = html;
  fitLayout(); // avant de créer les échiquiers : ils naissent à leur taille définitive
  if (r === 'puzzles' || r === 'erreur') { mountPuzzle(); const s = $('#pzt'); if (s) s.onchange = () => { S.pz.theme = s.value; S.pz.cur = null; S.pz.show = null; render(); }; }
  else if (r === 'cours' && a) mountLecon();
  else if (r === 'ouvertures') board($('#exb'), { fen: S.exFen, orientation: S.white ? 'white' : 'black', viewOnly: true });
  else if (r === 'partie') mountPartie();
  else if (r === 'drill') mountDrill();
  else if (r === 'inedits') mountInedits();
  else if (r === 'stats') mountStats(S, H);
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
// Écrans avec échiquier : tout tient dans la fenêtre, sans défilement de la page.
// L'échiquier et son commentaire d'un côté, le reste dans une colonne qui défile seule si besoin.
function fitLayout() {
  const v = $('#view'), sw = v.querySelector(':scope > .split.work');
  const fit = !!sw?.querySelector('.board');
  document.body.classList.toggle('fit', fit);
  if (!fit) return;
  const bw = sw.querySelector(':scope > .bwrap'), stk = sw.querySelector(':scope > .stack'), side = document.createElement('div');
  side.className = 'fitside';
  let pre = true;
  for (const el of [...v.children]) {
    if (el === sw) { pre = false; if (stk) { stk.classList.add('fitpanel'); side.append(stk); } continue; }
    if (pre) el.dataset.pre = '';
    side.append(el);
  }
  sw.replaceWith(bw);
  v.append(side);
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]') || ev.target.closest('[data-ex]');
  if (!el) return;
  const ex = ev.target.closest('[data-ex]');
  if (ex && S.exui) { S.exui(ex.dataset.ex, ex.dataset.v, ex.dataset.t); return; }
  const act = el.dataset.act;
  if (el.tagName === 'A') ev.preventDefault();
  if (act === 'refresh') doImport(S.user);
  else if (act === 'analyse') runAnalysis(20);
  else if (act === 'analyse1') runAnalysis(1, S.gv.g);
  else if (act === 'stattc') { S.statTc = el.dataset.tc; render(true); }
  else if (act === 'back') {
    const r = route()[0];
    if (r === 'erreur') { if (history.length > 1) history.back(); else location.hash = '#puzzles'; }
    else location.hash = { partie: '#parties', cours: '#cours', drill: '#exos', inedits: '#puzzles' }[r] || '#accueil';
  }
  else if (act === 'linext') liLoad();
  else if (act === 'lihint') S.liapi?.hint();
  else if (act === 'lishow') S.liapi?.show();
  else if (act === 'lireplay') {
    const x = hist().find((h) => String(h.t) === el.dataset.t); if (!x?.p) return;
    S.li = { angle: x.a || 'mix', diff: ls.get('li', {}).diff || 'easiest', cur: { id: x.id, rating: x.rt, url: 'https://lichess.org/training/' + x.id, ...x.p }, failed: false, counted: false, replay: true, loading: false, err: null };
    location.hash = '#inedits';
  }
  else if (act === 'histmore') { S.histN += 60; render(true); }
  else if (act === 'lifocus') { const f = ls.get('focus', null); S.li = { angle: f ? LI_FOR[f.id] : 'mix', diff: ls.get('li', {}).diff || 'easiest', cur: null, loading: false, err: null }; location.hash = '#inedits'; }
  else if (act === 'drans') drillAnswer(el.dataset.v);
  else if (act === 'drnext') { drAdvance(); render(); }
  else if (act === 'dragain') { const t = S.dr.type; S.dr = null; location.hash = '#drill/' + t; render(); }
  else if (act === 'pzfocus') { const f = ls.get('focus', null); pzReset(f && pzQueue(f.id, false).length ? f.id : '', false); if (route()[0] === 'puzzles') render(); else location.hash = '#puzzles'; }
  else if (act === 'pzmore') { S.pz.show = null; render(); }
  else if (act === 'pzredo') { S.pz.redo = failedToday(); S.pz.show = null; render(); }
  else if (act === 'pzredostop') { S.pz.redo = []; S.pz.show = dkey(); render(); }
  else if (act === 'focusnext') { ls.set('focus', { id: el.dataset.id, since: Math.floor(Date.now() / 1000) }); render(true); }
  else if (act === 'goto-cours') location.hash = '#cours/' + el.dataset.id;
  else if (act === 'pzfree') { S.pz.free = true; S.pz.cur = null; S.pz.show = null; render(); }
  else if (act === 'pzreal') S.solve?.real(el);
  else if (act === 'pzhint') S.solve?.hint();
  else if (act === 'pzshow') S.solve?.show();
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
  else if (act === 'lu') { const d = ls.get('lus', {}); d[el.dataset.id] = !d[el.dataset.id]; ls.set('lus', d); bump('les', d[el.dataset.id] ? 1 : -1); render(true); }
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
    if (S.cl.step >= n - 1) { const d = ls.get('lus', {}); d[S.cl.id] = true; ls.set('lus', d); bump('les'); S.cl = null; location.hash = '#accueil'; }
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
  else if (act === 'reset') {
    if (el.dataset.sure) { const u = S.user; ls.clear(['key', 'model', 'goal', 'hours']); dbDel('data:' + u); dbDel('an:' + u); dbDel('ai:' + u); S.ai = {}; S.li = null; S.liKeep = null; S.dr = null; S.gen = null; S.cl = null; LINES.clear(); S.job.stop = true; S.user = null; S.data = null; S.an = {}; S.pz = null; location.hash = '#accueil'; render(); }
    else { el.dataset.sure = '1'; el.textContent = 'Confirmer : effacer parties, analyses et progression (réglages et clé du coach conservés)'; }
  }
});
document.addEventListener('change', (ev) => {
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
  if (S.exui && $('.cap.film')) { // suites commentées : flèches pour avancer, espace pour lire ou mettre en pause
    if (ev.key === 'ArrowLeft') S.exui('prev'); else if (ev.key === 'ArrowRight') S.exui('next'); else if (ev.key === ' ' && ev.target.tagName !== 'BUTTON') { ev.preventDefault(); S.exui('play'); }
    return;
  }
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
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { const r = route()[0]; if (r === 'accueil') mountAccueil(); else if (r === 'stats') mountStats(S, H); else if (r === 'partie' && S.gv?.cg) gvSync(); }, 200); });

if (new URLSearchParams(location.search).has('debug')) window.__cap = S; // accès à l'état pour les tests
(async function init() {
  await load();
  restoreUi();
  navigator.storage?.persist?.().catch(() => {}); // demande au navigateur de ne pas effacer les données de l'app
  render();
  const u = new URLSearchParams(location.search).get('u');
  if (!S.data && (S.user || u)) doImport(S.user || u);
  else if (S.data && Date.now() - (S.data.fetchedAt || 0) > 6 * 3600000) doImport(S.user);
})();
