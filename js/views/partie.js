/* global Chess */
// Relecture d'une partie (#partie/<t>/<k>) : liste des coups, qualité de chaque coup, variantes jouées sur l'échiquier,
// débrief, réponses aux coups adverses. État dans S.gv ; mise à jour sur place par gvSync, sans render().
import { dbSet } from '../store.js';
import { Engine } from '../engine.js';
import { fmtEval, uciMove, winPct } from '../classify.js';
import * as st from '../stats.js';
import { describeAt, fr, moveText } from '../explain.js';
import { $, TC, dfmt, esc, ico, pl, resChip, setHtml, tile, txt } from '../ui.js';
import { lineChart } from '../charts.js';
import { REDUCED, arrow, destsOf, errShapes } from '../board.js';
import { QBY, QUALITY, clockFmt, clocksAt, errStep, evalShare, moveQualities, moveTimes, qualityCounts } from '../review.js';
import { bookPlies, loadBook } from '../book.js';
import * as exo from '../exercise.js';
import { OPENINGS } from '../openings.js';
import { coachKey } from '../coach.js';
import { planOf } from '../theory.js';
import { moments } from '../debrief.js';
import { intent } from '../plan.js';
import { gameRating, perfRef } from '../insights.js';
import { ASK, askRun, explain, mmss, moveNo, render, viewParties } from '../app.js';
import { DEPTH, S, memo, touch } from '../state.js';
import { repCard, repLines } from './reponses.js';

// Symbole du coup qui mène à la position k, pour les deux camps (20/11) : catégorie de gvQ (?? ? ?! × ! !! ★), sans symbole
// pour théorie, excellent et bon. Partie non analysée : rien.
function gvMark(v, k) {
  const q = QBY[v.q?.[k - 1]];
  return q?.s ? { s: q.s, c: q.c, t: q.t } : null;
}
// Qualité de chaque coup (review.js) : théorie connue une fois la base chargée (v.book), « seul bon coup » à mesure que
// gvGreat calcule les 3 meilleurs coups des positions où le meilleur coup a été joué.
function gvQ(v) {
  v.q = v.a ? moveQualities({ ev: v.a.ev, best: v.a.best || [], mv: v.mv, fens: v.fens, book: v.book || 0, mp: { ...(v.a.mp || {}), ...v.mp } }) : null;
}
// Tableau des catégories par camp, comme le bilan de Chess.com ; un nombre mène au coup suivant de cette catégorie.
function gvQTable(v) {
  if (!v.q) return '';
  const c = qualityCounts(v.q), me = v.g.w ? 'w' : 'b', op = v.g.w ? 'b' : 'w';
  const cell = (side, k) => { const n = c[side][k] || 0; return n ? `<button class="gvqn" data-act="qgo" data-q="${k}" data-s="${side}" title="Aller au coup suivant : ${esc(QBY[k].t.toLowerCase())}">${n}</button>` : '<span class="gvqn">0</span>'; };
  const pending = v.greatTodo ? `<p class="small">Recherche des coups uniques : ${v.greatTodo} position${v.greatTodo > 1 ? 's' : ''} à vérifier.</p>` : '';
  return `<h2>Qualité des coups</h2><div class="gvqt"><span></span><b>Toi</b><span></span><b>${esc(v.g.opp)}</b>
    ${QUALITY.map((x) => `<span class="gvql">${x.t}</span>${cell(me, x.k)}<i class="gvqs" style="--q:var(--${x.c})">${x.s || ''}</i>${cell(op, x.k)}`).join('')}</div>${pending}`;
}
// Mise à jour sur place (calculs d'arrière-plan) : tableau, symboles de la liste et de l'échiquier, sans reconstruire la liste
// (un bouton sous la souris resterait cliquable) ni la faire défiler.
function gvQPaint(v) {
  const before = (v.q || []).join();
  gvQ(v);
  setHtml($('#gvq'), gvQTable(v));
  if ((v.q || []).join() === before) return;
  document.querySelectorAll('#gvm .mv[data-k]').forEach((b) => {
    const mk = QBY[v.q?.[+b.dataset.k - 1]];
    b.querySelector('sup')?.remove(); b.title = mk ? mk.t : '';
    if (mk?.s) b.insertAdjacentHTML('beforeend', `<sup style="color:var(--${mk.c})">${mk.s}</sup>`);
  });
  if (v.cg && !v.var && v.db == null) v.cg.setAutoShapes(gvAuto(v));
}
// Coup suivant d'une catégorie pour un camp, après le coup affiché (en boucle).
function gvQGo(kind, side) {
  const v = S.gv; if (!v?.q) return;
  const ok = (i) => v.q[i] === kind && (i % 2 === 0) === (side === 'w');
  let i = v.q.findIndex((_, j) => j >= v.k && ok(j));
  if (i < 0) i = v.q.findIndex((_, j) => ok(j));
  if (i >= 0) { gvGo(i + 1); gvTab(v, 'bilan'); }
}
// Pastille du symbole, dans le coin haut droit de la case d'arrivée (repère de chessground : la case fait 100 × 100).
const markSvg = (mk) => `<g><circle cx="81" cy="19" r="19" fill="var(--${mk.c})" stroke="var(--bg)" stroke-width="3"/><text x="81" y="20" text-anchor="middle" dominant-baseline="central" font-family="Geist Mono, monospace" font-size="${mk.s.length > 1 ? 17 : 22}" font-weight="600" fill="var(--bg)">${mk.s}</text></g>`;
// Formes de la position k : flèches, puis symbole du dernier coup.
function gvAuto(v) {
  const k = v.k, mk = gvMark(v, k);
  return [...gvShapes(v, k), ...(mk ? [{ orig: v.mv[k - 1].to, customSvg: { html: markSvg(mk) } }] : [])];
}
// « ! » (seul bon coup) : pour chaque coup des deux camps qui est le meilleur, le moteur cherche si d'autres coups tenaient
// (3 meilleurs coups). Le coup affiché passe en premier ; un calcul à la fois, jamais pendant une analyse en cours.
// Résultats ajoutés à l'analyse (a.mp, déjà gardé par le reclassement) et enregistrés : calculés une fois par partie.
async function gvGreat(v) {
  if (v.busy || S.job.running || !v.a || !v.q) return;
  const need = (i) => v.q[i] === 'meilleur' && !(v.a.mp?.[i]) && !(i in v.mp) && new Chess(v.fens[i]).moves().length > 1;
  const todo = v.q.map((_, i) => i).filter(need);
  v.greatTodo = todo.length;
  if (!todo.length) { if (v.greatDirty) { v.greatDirty = false; touch(); dbSet('an:' + S.user, S.an); } return; }
  const i = need(v.k - 1) ? v.k - 1 : todo[0];
  v.busy = true;
  try { S.play ||= new Engine(); const r = await S.play.evalFen(v.fens[i], DEPTH, false, 3); (v.a.mp ||= {})[i] = r.lines.map((l) => l.cp); v.greatDirty = true; } catch { S.play = null; v.mp[i] = null; }
  v.busy = false;
  if (S.gv !== v || !v.x?.alive()) { if (v.greatDirty) { touch(); dbSet('an:' + S.user, S.an); } return; }
  gvQPaint(v);
  gvGreat(v);
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
  const btn = (i) => { const m = mv[i], mk = QBY[v.q?.[i]]; return `<button class="mv ${errAt[i]?.kind || ''}" data-act="goto" data-k="${i + 1}"${mk ? ` title="${mk.t}"` : ''}>${fr(m.san)}${mk?.s ? `<sup style="color:var(--${mk.c})">${mk.s}</sup>` : ''}</button>`; };
  let h = '<button class="mv gvst" data-act="goto" data-k="0">Début</button>';
  for (let i = 0; i < mv.length; i += 2) {
    h += `<div class="gvr"><span class="n">${i / 2 + 1}.</span>${btn(i)}${i + 1 < mv.length ? btn(i + 1) : '<span></span>'}${tm ? `<span class="gvt">${time(i)}${time(i + 1)}</span>` : ''}</div>`;
    h += note(errAt[i]) + note(errAt[i + 1]);
  }
  return h;
}
// Elo estimé de la partie (insights.js) : repère personnel, d'après ta précision moyenne et ton classement moyen dans cette cadence.
function perfOf(g, a) {
  const ref = memo('ref:' + g.tc, () => perfRef(S.data.games.filter((x) => x.tc === g.tc), S.an)), e = gameRating(a.acc, ref);
  return e ? { e, tip: `Repère : ta précision moyenne (${ref.acc} %) vaut ton classement moyen (${ref.elo}) ; chaque point de précision en plus ou en moins compte pour 25 points.` } : null;
}
function perfChip(g, a) { const p = perfOf(g, a); return p ? `<span class="chip" title="${p.tip}">Elo estimé ${p.e}</span>` : ''; }
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
  if (fresh) S.gv = { t: g.t, k: plyArg != null && plyArg !== 'd' ? Math.min(+plyArg, mv.length) : 0, mp: {}, tab: plyArg == null && a ? 'bilan' : 'coups' };
  else if (plyArg != null && plyArg !== 'd') S.gv.tab = 'coups'; // lien vers un coup précis : la relecture, pas le bilan
  const serious = a ? a.errs.filter((x) => x.theme) : [];
  const v = Object.assign(S.gv, { fens, mv, g, a, errAt: a ? Object.fromEntries(a.errs.map((e) => [e.ply, e])) : {}, keys: serious.map((x) => x.ply).sort((p, q) => p - q) });
  gvQ(v);
  // #partie/<t>/d : débrief d'entrée, puis l'adresse redevient celle de la partie (un rendu suivant ne le relance pas).
  if (plyArg === 'd') { if (gvDbList(v).length) { v.var = null; v.ask = null; v.db = 0; v.k = Math.min(mv.length, v.dbl[0].ply); } history.replaceState(null, '', '#partie/' + g.t); }
  const cap = gvCap(v);
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
    panel: `${a ? `<div class="seg2 gvtabs" role="tablist">${[['coups', 'Coups'], ['bilan', 'Bilan']].map(([k, t]) => `<button role="tab" aria-selected="${v.tab === k}" class="${v.tab === k ? 'on' : ''}" data-act="gvtab" data-v="${k}">${t}</button>`).join('')}</div>` : ''}<div class="card rep" id="rep"></div>${a ? `${gvTiles(g, a)}
      <div class="card gvq" id="gvq">${gvQTable(v)}</div>
      <div class="gvch" title="Tes chances de gain. Points rouges : gaffes, orange : erreurs. Touche la courbe pour aller au coup."><p class="small">Tes chances de gain. Points rouges : gaffes, orange : erreurs. Touche la courbe pour aller au coup.</p><div class="chart" id="evc"></div></div>`
    : `<div class="card"><p class="sub">Cette partie n’est pas encore analysée.</p><div><button class="btn pri" data-act="analyse1" ${S.job.running ? 'disabled' : ''}>${S.job.running ? 'Analyse en cours' : 'Analyser cette partie'}</button></div></div>`}
      <div class="gvm" id="gvm" data-edge>${gvMoves(v)}</div>
      <div class="gvmore stack"><div class="row">${resChip(g.out, g.how)}<span class="chip">${dfmt(g.t)}</span>${link}</div>
      <p class="small">Joue tes propres coups sur l’échiquier pour tester une autre suite : le moteur l’évalue. Clic droit pour tracer des flèches.</p>
      ${serious.length ? `<div class="card"><h2>Moments clés</h2>${serious.map((x) => `<a class="row" href="#" data-act="goto" data-k="${x.ply}" style="justify-content:space-between;text-decoration:none"><span>Coup ${moveNo(x)} : ${fr(x.played)}, mieux ${fr(x.bestSan)}</span><span class="chip ${x.kind === 'gaffe' ? 'bad' : 'warn'}">${st.THEMES[x.theme]}</span></a>`).join('')}</div>` : ''}</div>`,
    bar: gvBar(v),
  });
}
// Bandeau d'un joueur au-dessus ou au-dessous de l'échiquier (ordinateur) : couleur, nom, Elo, résultat, pendule au coup affiché.
function gvPlayer(v, me) {
  const g = v.g, white = me === g.w;
  return `<div class="gvbar ${me ? 'me' : ''}"><i class="dot ${white ? 'w' : 'b'}"></i><b>${me ? 'Toi' : esc(g.opp)}</b><span class="num">${me ? g.r : g.or}</span>${me ? resChip(g.out, g.how) : ''}<span class="gvclk num" data-side="${white ? 'w' : 'b'}"></span></div>`;
}
function gvClocks(v) {
  const c = clocksAt(v.g, v.var ? v.var.k0 : v.k), turn = (v.var ? v.var.k0 : v.k) % 2 ? 'b' : 'w';
  document.querySelectorAll('.gvclk').forEach((el) => { el.textContent = c ? mmss(c[el.dataset.side]) : ''; el.hidden = !c; el.classList.toggle('on', el.dataset.side === turn); });
}
// Bilan de la partie en encarts (17/11) : précision, Elo estimé, puis les fautes par gravité avec leur symbole.
function gvTiles(g, a) {
  const n = (k) => a.errs.filter((x) => x.kind === k).length, p = perfOf(g, a);
  const f = (k, sym, cls, lab) => `<span class="gvf ${n(k) ? cls : ''}" title="${pl(n(k), lab)}">${n(k)}<small>${sym}</small></span>`;
  return `<div class="glsum gvsum">${tile('Précision', a.acc != null ? a.acc.toFixed(0) + ' %' : '—')}${p ? tile('Elo estimé', p.e, { tip: p.tip }) : ''}${tile('Fautes', f('gaffe', '??', 'ko', 'gaffe') + f('erreur', '?', 'warn', 'erreur') + f('imprecision', '?!', '', 'imprécision'))}</div>`;
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
    gvRep(v);
    return;
  }
  const cap = gvCap(v);
  v.cg.set({ fen: v.fens[k], turnColor: v.fens[k].split(' ')[1] === 'w' ? 'white' : 'black', lastMove: k > 0 ? [v.mv[k - 1].from, v.mv[k - 1].to] : undefined, movable: gvMov(v), drawable: { autoShapes: gvAuto(v) } });
  v.x.say(cap.cls, cap.html);
  v.x.setBar(gvBar(v));
  gvRep(v);
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
  gvGreat(v);
}
// Onglet du panneau (ordinateur), changé sur place ; la courbe, dessinée cachée sans largeur, est alors redessinée.
function gvTab(v, tab) {
  if (v.tab === tab) return;
  v.tab = tab;
  const p = $('#xpanel'); if (!p) return;
  p.setAttribute('data-tab', tab);
  p.querySelectorAll('.gvtabs button').forEach((b) => { const on = b.dataset.v === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  if (tab === 'coups') { if (!v.chart) gvChart(v); gvSync(); }
}
function gvGo(k) {
  const v = S.gv; if (!v) return;
  v.var = null; v.db = null; v.ask = null; // aller à un coup de la partie quitte la variante, le débrief et la réponse du coach
  v.k = Math.max(0, Math.min(v.mv.length, k));
  if (v.x?.alive() && v.cg) gvSync(); else render(true);
  gvTab(v, 'coups');
}
// Courbe des chances de gain, dessinée une fois ; seul le curseur suit le coup affiché. Cachée (onglet Bilan), elle attend.
function gvChart(v) {
  v.chart = null;
  const c = $('#evc');
  if (!c || !v.a || !c.offsetWidth) return;
  const pts = v.a.ev.map((cp, i) => ({ x: i, y: winPct(v.g.w ? cp : -cp), tip: (i ? `Coup ${Math.ceil(i / 2)} (${fr(v.mv[i - 1]?.san || '')}) : ` : 'Début : ') + Math.round(winPct(v.g.w ? cp : -cp)) + ' %' }));
  const marks = v.a.errs.filter((x) => x.kind !== 'imprecision').map((x) => ({ i: x.ply, c: x.kind === 'gaffe' ? 'bad' : 'warn' }));
  const o = { min: 0, max: 100, base: 0, marks, cursor: Math.min(v.k, pts.length - 1), label: 'Chances de gain au fil de la partie', onPick: gvGo };
  v.chart = lineChart(c, pts, matchMedia('(min-width: 860px)').matches ? { ...o, h: 104, step: 50, yfmt: (y) => y + ' %', x0: 'Début', x1: 'Fin' } : { ...o, h: 48, compact: true, mid: 50 });
}
function mountPartie() {
  const v = S.gv, X = exo.current(); if (!X || !v) return;
  v.x = X;
  $('#xpanel')?.setAttribute('data-tab', v.tab || 'coups');
  v.cg = X.board({ fen: gvFen(v), orientation: v.g.w ? 'white' : 'black', movable: gvMov(v), drawable: { enabled: true } }); // clic droit : flèches et cases, comme sur Chess.com
  gvChart(v);
  // Boutons (data-act="goto") et clavier : gérés par les écouteurs globaux (variante comprise), voir plus bas
  gvSync();
  if (v.a && v.book == null) loadBook().then((b) => { if (S.gv !== v) return; v.book = b ? bookPlies(b, v.fens) : 0; if (v.x?.alive()) { gvQPaint(v); gvGreat(v); } });
}
function gvRep(v) {
  const fen = gvFen(v), me = v.g.w ? 'w' : 'b';
  setHtml($('#rep'), repCard(fen, me, repLines(fen, () => { if (S.gv === v && v.x?.alive() && gvFen(v) === fen) gvRep(v); })));
}

export { gvAsk, gvDb, gvGo, gvMove, gvQGo, gvSync, gvTab, gvVarGo, mountPartie, viewPartie };
