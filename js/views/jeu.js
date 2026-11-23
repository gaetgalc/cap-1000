/* global Chess */
// Parties contre le moteur : Gagner les parties gagnées (#gagner), Jouer d'ici (#jouer), Finales (#finales, #finale/<id>).
import { Engine } from '../engine.js';
import { fmtEval, replay, uciMove } from '../classify.js';
import * as st from '../stats.js';
import { LESSONS } from '../lessons.js';
import { describeAt, hintFor, justPlayed } from '../explain.js';
import { $, coach, dfmt, esc, ico, pl } from '../ui.js';
import { progress } from '../progress.js';
import { arrow, destsOf } from '../board.js';
import * as exo from '../exercise.js';
import { ENDGAMES, GOAL_TXT, egById } from '../endgames.js';
import { DEPTH, S } from '../state.js';
import { dshort } from './ouvertures.js';
import { gameRef } from './puzzles.js';
import { header, keepUi, render } from '../app.js';
import { viewParties } from './parties.js';

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
    return head + `<div class="menu">${list.slice(0, 30).map((x) => `<a class="mrow" href="#gagner/${x.g.t}"><span class="mico">${won.has(String(x.g.t)) ? '✓' : ico('play')}</span><span class="stepc"><b>${dfmt(x.g.t)} contre ${esc(x.g.opp)} (${x.g.or})</b><span>${fmtEval(x.ev)} au coup ${Math.floor(x.ply / 2) + 1} · finie en ${x.g.out === 'L' ? 'défaite' : 'nulle'}${won.has(String(x.g.t)) ? ' · déjà gagnée ici' : ''}</span></span><span class="chev" aria-hidden="true">${ico('next')}</span></a>`).join('')}</div>`;
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
  const endBar = () => X.setBar(`<button class="btn ${cv.over === 'gagne' ? '' : 'pri'}" data-x="restart">Recommencer</button>${X.spec.nextT ? `<a class="btn ${cv.over === 'gagne' ? 'pri' : ''}" href="#gagner/${X.spec.nextT}">Partie suivante${ico('next')}</a>` : '<a class="btn" href="#gagner">Toutes les parties</a>'}`);
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
  ${[1, 2, 3].map((lvl) => `<h2 class="ent-h">${['', 'Les bases', 'Finales de pions', 'Finales de tours'][lvl]}</h2><div class="menu">${ENDGAMES.filter((e) => e.lvl === lvl).map((e) => `<a class="mrow" href="#finale/${e.id}"><span class="mico">${progress.endgameState(e.id) ? '✓' : ico('flag')}</span><span class="stepc"><b>${esc(e.t)}</b><span>${GOAL_TXT[e.goal]} · ${esc(e.intro)}</span></span>${egChip(e.id)}<span class="chev" aria-hidden="true">${ico('next')}</span></a>`).join('')}</div>`).join('')}`;
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
      X.setBar(`<button class="btn ${ok ? '' : 'pri'}" data-x="restart">Recommencer</button><a class="btn ${ok ? 'pri' : ''}" href="#finale/${X.spec.nextId}">Finale suivante${ico('next')}</a>`);
    },
  });
}

export { cvList, mountFinale, mountGagner, mountJouer, viewFinale, viewFinales, viewGagner, viewJouer };
