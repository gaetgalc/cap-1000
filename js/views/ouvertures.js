/* global Chess */
// Ouvertures : catalogue à apprendre (#ouvertures/apprendre), fiche, ligne récitée (#ligne), mes ouvertures (#ouvertures),
// détail d'une ouverture jouée (#monouv).
import { fmtEval } from '../classify.js';
import * as st from '../stats.js';
import { buildLine, fr } from '../explain.js';
import { $, F_DSHORT, F_DSHORT_UTC, F_MY_UTC, WDL_LEGEND, coach, dfmt, esc, f1, ico, pl, resChip, tabs, wdl } from '../ui.js';
import { lineChart } from '../charts.js';
import { progress } from '../progress.js';
import { arrow, board, destsOf } from '../board.js';
import * as exo from '../exercise.js';
import { GROUPS, OPENINGS, byId, lineKey, matchGame, movesOf } from '../openings.js';
import { GAMES_TABS, LEARN_TABS } from '../nav.js';
import { LEVEL, explorerRows, fetchExplorer } from '../explorer.js';
import { S, games, route } from '../state.js';
import { header, render } from '../app.js';
import { moveNo } from './puzzles.js';
import { periodSeg } from './cartes.js';

// ---------- Apprendre les ouvertures ----------
// Fiches (histoire, idées, pièges, lignes) et lignes récitées de mémoire, en révision espacée comme les puzzles.
const allLineKeys = () => OPENINGS.flatMap((o) => o.lines.map((_, k) => lineKey(o, k)));
const lineHref = (key, voir) => '#ligne/' + key.replace(':', '/') + (voir ? '/voir' : '');
const opGames = (o) => (S.data ? S.data.games.filter((g) => matchGame(o, g)) : []);
const dshort = F_DSHORT;
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
  return tabs('ouv', LEARN_TABS) + `<h1>Apprendre les ouvertures</h1>
    <p class="sub">Une fiche par ouverture. Ses lignes se rejouent de mémoire et reviennent en révision, comme tes puzzles.</p>
    ${due.length ? `<a class="opdue" href="${lineHref(due[0])}"><b>${pl(due.length, 'ligne')} à réviser aujourd’hui</b><span>Réviser${ico('next')}</span></a>` : ''}
    <div class="seg2 mini opgrp">${GROUPS.map(tab).join('')}</div>
    <div class="oplist">${rows.map(({ o, n, learned, total }) => `<a class="oprow" href="#ouvertures/${o.id}">
      <span><b>${o.nom}</b>${o.rep ? '<i class="optag">Répertoire</i>' : ''}</span>
      <span class="opmeta">${o.eco}${n ? ` · ${pl(n, 'partie')}` : ''} · ${learned}/${total} lignes</span>
      <span class="opprog" aria-hidden="true"><i style="width:${(100 * learned) / total}%"></i></span>
      <span class="chev" aria-hidden="true">${ico('next')}</span></a>`).join('')}</div>`;
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
      <div class="stack">${gs.slice(-3).reverse().map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or}), ${g.w ? 'Blancs' : 'Noirs'}</span>${resChip(g.out)}</a>`).join('')}</div>`
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
  const chips = `<span class="chip lnmode">${voir ? 'Découverte' : 'De mémoire'}</span><span class="chip">Ligne ${+k + 1} / ${o.lines.length}</span>`;
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
  const repCard = reps.length ? `<div class="card"><h2>Erreurs qui reviennent</h2><p class="small">Même position, même faute, dans plusieurs parties. Une position travaillée ici, c’est une erreur de moins dans toutes les parties qui y passent.</p>
    ${reps.map((r) => `<div class="hrow"><i class="dot ${r.w ? 'w' : 'b'}"></i><span class="stepc"><b>${esc(st.lineText(r.line, Math.max(0, r.line.length - 6)))}</b><span>${r.games} parties : ${esc(st.repText(r))}</span></span><a class="btn sm" href="#erreur/${r.last.g.t}/${r.last.e.ply}">Travailler</a></div>`).join('')}</div>` : '';
  return `${tabs('ouv', GAMES_TABS)}<div class="vhead"><h1>Ouvertures</h1>${periodSeg()}</div><div class="row" style="justify-content:flex-end"><div class="row" role="group" aria-label="Couleur">
    <button class="btn ${S.white ? 'on' : ''}" aria-pressed="${!!S.white}" data-act="color" data-w="1"><i class="dot w"></i>Blancs</button><button class="btn ${S.white ? '' : 'on'}" aria-pressed="${!S.white}" data-act="color" data-w="0"><i class="dot b"></i>Noirs</button></div></div>
  ${repCard}
  <div class="card"><h2>Ouvertures avec les ${S.white ? 'Blancs' : 'Noirs'} <span class="small">${side.n} parties, ${st.score(side)} % de score</span></h2>
    ${ops.length ? `<div class="scroll"><table><thead><tr><th>Ouverture</th><th class="r">Parties</th><th>Résultats</th><th class="r">Score</th><th class="r" title="Évaluation moyenne du moteur après 10 coups, de ton point de vue">Après 10 coups</th><th>Verdict</th></tr></thead><tbody>
    ${ops.slice(0, 12).map((o) => `<tr class="click" data-act="opfam" data-fam="${esc(o.fam)}" title="Détail de cette ouverture"><td><b>${esc(o.fam)}</b> <span class="chev" aria-hidden="true">${ico('next')}</span>${o.vars.size > 1 ? `<br><span class="small">${[...o.vars.values()].sort((a, b) => b.n - a.n).slice(0, 2).map((v) => esc(v.op.replace(o.fam, '').trim() || 'ligne principale') + ' (' + v.n + ')').join(', ')}</span>` : ''}</td>
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
// Détail d'une ouverture jouée (#monouv/<w|b>/<famille>) : chiffres, usage dans le temps, suites, variantes, erreurs, parties.
const famHref = (fam, w) => `#monouv/${w ? 'w' : 'b'}/${encodeURIComponent(fam)}`;
const perName = (k, unit) => (unit === 'semaine' ? 'sem. du ' + F_DSHORT_UTC(new Date(((k * 7) - 3) * 86400000)) : unit === 'mois' ? F_MY_UTC(new Date(Date.UTC(Math.floor(k / 12), k % 12, 1))) : `T${(k % 12) / 3 + 1} ${Math.floor(k / 12)}`);
const scoreChip = (s) => { const sc = st.score(s); return `<span class="chip ${s.n >= 2 && sc >= 55 ? 'good' : s.n >= 2 && sc <= 42 ? 'bad' : ''}">${sc} %</span>`; };
function viewMonOuv(c, enc) {
  let fam; try { fam = decodeURIComponent(enc || ''); } catch { fam = ''; }
  const white = c === 'w', d = st.famDetail(games(), fam, white), gs = d.games;
  const back = '<p class="small"><a href="#ouvertures">‹ Mes ouvertures</a></p>';
  if (!gs.length) return `${back}<div class="vhead"><h1>${esc(fam || 'Ouverture')}</h1>${periodSeg()}</div><p class="sub">Aucune partie dans cette ouverture avec les ${white ? 'Blancs' : 'Noirs'} pour le filtre choisi.</p>`;
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
    <div class="vhead"><h1>${esc(fam)}</h1>${periodSeg()}</div>
    <p class="opmoves">${d.prefix.length ? esc(st.lineText(d.prefix)) : 'Premiers coups variables'}</p>
    <div class="row"><span class="chip"><i class="dot ${white ? 'w' : 'b'}"></i>${white ? 'Blancs' : 'Noirs'}</span><span class="chip">${pl(gs.length, 'partie')}</span>${verdict(d.tally)}</div>
    <div class="mowdl">${wdl(d.tally)}</div>
    <div class="row">${exBtn(d.prefix, 'Explorer mes coups', 'btn pri sm')}${cat ? `<a class="btn sm" href="#ouvertures/${cat.id}">Fiche : ${esc(cat.nom)}</a>` : ''}</div></div></div>
  <div class="mogrid">
  <div class="card"><h2>En chiffres</h2><dl class="kv">
    <dt>Score</dt><dd>${st.score(d.tally)} % (${d.tally.w} V, ${d.tally.d} N, ${d.tally.l} D)</dd>
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
  ${d.lines.length ? `<div class="card"><h2>Suites les plus jouées</h2><table><tbody>${d.lines.map((l) => `<tr class="click" data-act="exline" data-w="${white ? 1 : 0}" data-san="${esc(l.san.join(' '))}" title="Ouvrir dans l’explorateur"><td>${esc(st.lineText(l.san, d.prefix.length))}</td><td class="r">${l.n}</td><td style="width:28%">${wdl(l)}</td><td class="r">${scoreChip(l)}</td></tr>`).join('')}</tbody></table>
    <p class="small">Après ${d.prefix.length ? esc(st.lineText(d.prefix)) : 'le début'}. Touche une suite pour la suivre coup par coup dans l’explorateur.</p></div>` : ''}
  ${d.vars.length > 1 ? `<div class="card"><h2>Variantes</h2><table><tbody>${d.vars.map((v) => `<tr><td>${esc(v.op.replace(fam, '').trim() || 'Ligne principale')}</td><td class="r">${v.n}</td><td style="width:28%">${wdl(v)}</td><td class="r">${scoreChip(v)}</td></tr>`).join('')}</tbody></table></div>` : ''}
  ${opErrs.length ? `<div class="card"><h2>Fautes dans l’ouverture</h2>${topTh.length ? `<p class="small">Le plus souvent : ${topTh.map(([t, n]) => `${st.THEMES[t]} (${n})`).join(', ')}.</p>` : ''}
    ${opErrs.slice(-4).reverse().map(({ g, e }) => `<div class="hrow"><i class="hres ${e.kind === 'gaffe' ? 'r0' : 'r1'}"></i><span class="stepc"><b>Coup ${moveNo(e)} : ${fr(e.played)} au lieu de ${fr(e.bestSan)}</b><span>${dfmt(g.t)} contre ${esc(g.opp)}${st.THEMES[e.theme] ? ' · ' + st.THEMES[e.theme] : ''}</span></span><a class="btn sm" href="#erreur/${g.t}/${e.ply}">Rejouer</a></div>`).join('')}</div>` : ''}
  <div class="card"><h2>Dernières parties</h2><div class="stack">${recent.map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or}) · ${Math.ceil(g.san.length / 2)} coups</span>${resChip(g.out)}</a>`).join('')}</div></div>`;
}
function mountMonOuv() {
  const P = S.mo; if (!P || !$('#mob')) return;
  board($('#mob'), { fen: P.fen, orientation: P.white ? 'white' : 'black', viewOnly: true, coordinates: false });
  const el = $('#moc'), { unit, list } = P.d.periods;
  if (el) lineChart(el, list.map((p, i) => ({ x: i, y: p.n, tip: `${perName(p.k, unit)} : ${pl(p.n, 'partie')}${p.n ? `, ${st.score(p)} % de score` : ''}${p.all ? ` (${st.pct(p.n, p.all)} % de tes parties)` : ''}` })),
    { h: 130, min: 0, label: 'Tes parties dans cette ouverture, par ' + unit, x0: perName(list[0].k, unit), x1: perName(list[list.length - 1].k, unit), yfmt: (v) => String(Math.round(v)) });
}

export { allLineKeys, dshort, famHref, lexpLoad, lineHref, mountLigne, mountMonOuv, mountOpening, viewApprendre, viewLigne, viewMonOuv, viewOpening, viewOuvertures };
