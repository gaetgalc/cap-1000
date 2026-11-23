// Accueil (#accueil) : objectif, séance du jour, mot du coach, dernière partie, bilan du dernier import.
import { ls } from '../store.js';
import * as st from '../stats.js';
import { RULES } from '../lessons.js';
import { fr } from '../explain.js';
import { $, F_DMY, F_WDLONG_MSHORT, coach, dayLetter, dfmt, esc, ico, pl, skel, tile } from '../ui.js';
import { sparkline } from '../charts.js';
import { DAY, progress } from '../progress.js';
import { arrow, board } from '../board.js';
import { gaffeTrail, moveMark } from '../review.js';
import { byId } from '../openings.js';
import { briefFacts, coachBrief, selfVerdict } from '../brief.js';
import { STAGES, programWeek, reviewText, weekStats } from '../program.js';
import { importRecap } from '../recap.js';
import { ENDGAMES } from '../endgames.js';
import { S, cadenceGames, dkey, goal, rapidAll, streak, targetTc } from '../state.js';
import { allLineKeys, lineHref } from './ouvertures.js';
import { failedToday, moveNo } from './puzzles.js';
import { focusStats, session } from './cartes.js';

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
  const tiles = `<div class="glsum gtiles d-only">${tile('Il manque', gap > 0 ? `${gap} pts` : 'Atteint', { sub: `pour atteindre ${g.elo}`, cls: gap > 0 ? '' : 'up' })}${tile('Échéance', `${days} j`, { sub: F_DMY(new Date(g.date)) })}${gap > 0 ? tile('Rythme nécessaire', pace.replace(' pts / sem.', ''), { sub: 'points par semaine' }) : ''}${tile('30 derniers jours', tr.delta30 ? `${tr.delta30 > 0 ? '+' : ''}${tr.delta30}` : '0', { sub: elo30(), cls: tr.delta30 > 0 ? 'up' : tr.delta30 < 0 ? 'dn' : '' })}${tile('Série', `${stk} j`, { sub: weekDots(), cls: stk ? 'warn' : '', tip: 'Jours consécutifs avec au moins un puzzle ou un cours. Cases : les 7 derniers jours, aujourd’hui à droite ; vert plein = entraîné, vert sombre = partie jouée sans entraînement.' })}${nextReview()}</div>`;
  return `<section class="gstrip"><a class="gnum" href="#bilan" title="Détail de l’objectif"><b class="num">${tr.cur}</b><span class="goalbar" aria-hidden="true"><i style="width:${Math.max(3, Math.min(100, (100 * tr.cur) / g.elo))}%"></i></span><b class="num">${g.elo}</b></a>
    <span class="gmeta m-only">${gap > 0 ? `<span>Il manque <b class="num">${gap}</b></span><span>${days} j</span>` : ''}<span>${pace}</span>${d30}</span>${tiles}</section>`;
}
// Accueil, encarts de l'objectif (17/11) : courbe de l'Elo sur 30 jours et semaine d'entraînement en 7 cases.
function elo30() {
  const t0 = Date.now() / 1000 - 30 * 86400, gs = rapidAll().filter((g) => g.rated && g.r).sort((a, b) => a.t - b.t);
  const before = gs.filter((g) => g.t < t0).pop(), vals = [...(before ? [before] : []), ...gs.filter((g) => g.t >= t0)].map((g) => g.r);
  return sparkline(vals, 'Ton Elo sur les 30 derniers jours', vals.length > 1 && vals[vals.length - 1] < vals[0] ? 'dn' : '') || 'points';
}
function weekDots() {
  const played = {}; for (const g of S.data?.games || []) { const k = dkey(new Date(g.t * 1000)); played[k] = (played[k] || 0) + 1; }
  const today = dkey();
  // Une case par jour (les 7 derniers jours, aujourd'hui à droite), avec sa lettre dessous : sans lettre, on ne voyait pas que chaque case est un jour.
  return `<span class="week">${progress.week().map((x) => { const p = played[x.d] || 0, lab = F_WDLONG_MSHORT(new Date(x.t)), now = x.d === today; return `<span class="wd${now ? ' td' : ''}"><i class="${x.n ? 'on' : p ? 'pl' : ''}${now ? ' now' : ''}" title="${lab} : ${x.n ? pl(x.n, 'exercice') : 'pas d’entraînement'}${p ? ', ' + pl(p, 'partie') : ''}"></i><b aria-hidden="true">${dayLetter(x.t)}</b></span>`; }).join('')}</span>`;
}
// Prochaine révision (accueil, ordinateur) : lignes d'ouverture et finales dues aujourd'hui, sinon la prochaine à venir.
function nextReview() {
  const lines = allLineKeys().map((k) => { const [id, i] = k.split(':'), o = byId(id), st0 = progress.lineState(k); return st0 && { due: st0.due, href: lineHref(k), t: `${o.nom} : ${o.lines[+i].n}`, k: 'Ligne' }; });
  const fins = ENDGAMES.map((e) => { const st0 = progress.endgameState(e.id); return st0 && { due: st0.due, href: '#finale/' + e.id, t: e.t, k: 'Finale' }; });
  const all = [...lines, ...fins].filter(Boolean).sort((a, b) => a.due - b.due), now = Date.now(), due = all.filter((x) => x.due <= now);
  // Encart cliquable, sixième de la carte de l'objectif : la page d'accueil n'a pas de place pour une ligne de plus.
  if (due.length) return tile('À réviser', due.length, { sub: esc(due[0].t), href: due[0].href, tip: due.map((x) => `${x.k} : ${x.t}`).join('\n'), cls: 'warn' });
  if (all.length) { const x = all[0], d = Math.max(1, Math.ceil((x.due - now) / DAY)); return tile('Prochaine révision', `${d} j`, { sub: esc(x.t), href: x.href, tip: `${x.k} : ${x.t}` }); }
  return tile('Révisions', '—', { sub: 'Apprends une ligne', href: '#ouvertures/apprendre', tip: 'Une ligne apprise revient ici le jour où il faut la réviser' });
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
  return `<section class="card today"><div class="row d-flex" style="justify-content:space-between"><h2>${all ? 'Séance du jour terminée' : 'Séance du jour'}</h2><span class="chip ${all ? 'good' : ''}">${nDone} / ${steps.length}</span></div>${dots}${body}${prog}</section>`;
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
  if (sg && !sg.ans) return `<section class="card fmini brief"><span class="hlab">Le mot du coach</span>
    <span class="selfrow"><span class="bdiag">As-tu appliqué ta règle dans ta partie contre ${esc(sg.g.opp)} ?<span class="d-only"> « ${esc(RULES[fc.id])} »</span></span>
    <span class="selfq"><button class="btn" data-act="selfck" data-id="${esc(sg.g.id)}" data-v="1">Oui</button><button class="btn" data-act="selfck" data-id="${esc(sg.g.id)}" data-v="0">Non</button></span></span></section>`;
  const gs = S.data.games.filter((g) => g.tc === targetTc());
  const b = coachBrief({ facts: briefFacts(gs, S.an, fc.id), theme: th, rule: RULES[fc.id], fs, cause: progress.causes(), next: cur ? STEP_NEXT[cur.k] : null });
  const w = programWeek(fc.since);
  // Réponse du jour à « As-tu appliqué la règle ? » : le verdict de l'analyse remplace le diagnostic pendant 20 heures.
  if (sg?.ans && Date.now() - sg.ans.t < 20 * 3600000) b.diag = selfVerdict(sg.ans.y, S.an[sg.g.id].errs.filter((e) => e.theme === fc.id && e.kind !== 'imprecision').map(moveNo), th);
  // Le lundi, le bilan de la semaine passée remplace le diagnostic.
  else if (new Date().getDay() === 1 && w.i >= 1) b.diag = reviewText(weekStats({ games: gs, an: S.an, hist: progress.hist(), themeId: fc.id, from: w.prev, to: w.start }), weekStats({ games: gs, an: S.an, hist: progress.hist(), themeId: fc.id, from: w.prev - 7 * DAY, to: w.prev }), th);
  const stage = w.i < 4 ? ` Semaine ${w.i + 1} sur 4 : ${STAGES[w.i].t.toLowerCase()}.` : '';
  return `<a class="card fmini brief" href="#bilan"><span class="hlab">Le mot du coach${fs.ok ? ' <span class="chip good">validé</span>' : ''}<span class="chev" aria-hidden="true">${ico('next')}</span></span>
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
  // Vocabulaire des échecs plutôt que pastilles (18/11) : résultat noté 1-0 / 0-1 / ½-½, faute annotée ?? ou ?.
  const out = g.out === 'W' ? ['up', 'Victoire'] : g.out === 'L' ? ['dn', 'Défaite'] : ['', 'Nulle'];
  const score = g.out === 'D' ? '½-½' : (g.out === 'W') === !!g.w ? '1-0' : '0-1', mk = e && moveMark(e);
  const body = pending ? (S.job.running ? skel('Analyse en cours', 80, 55) : '<span class="sub">Pas encore analysée.</span>')
    : !e ? `<span class="sub">Aucune gaffe ni erreur grave${a.acc != null ? `, précision ${a.acc.toFixed(0)} %` : ''}.</span>`
    : `<span class="lgerr"><span>Coup ${moveNo(e)} : <b>${esc(fr(e.played))}<span class="lgmk ${mk?.c === 'bad' ? 'dn' : 'warnc'}" title="${mk?.t || ''}">${mk?.s || ''}</span></b>, il fallait <b>${esc(fr(e.bestSan))}</b></span>${n > 1 ? `<span class="small">gaffe ${i} sur ${n}</span>` : ''}</span>`;
  const head = `<span class="htitle"><span class="lgres ${out[0]}" title="${out[1]}"><span class="sr">${out[1]}, </span>${score}</span> contre ${esc(g.opp)} <span class="sub">(${g.or}), ${g.w ? 'Blancs' : 'Noirs'}<span class="m-only-i">, ${dfmt(g.t)}</span></span></span>`;
  // Ordinateur : la position de la faute, coup joué en rouge (la solution reste à trouver dans « Rejouer l'erreur »).
  const pos = e ? `<a class="lgpos d-only" href="#partie/${g.t}/${e.ply}" aria-label="Position avant ${esc(fr(e.played))}"><span class="board" id="lgb" data-t="${g.t}" data-ply="${e.ply}"></span></a>` : '';
  const nav = (d, lab, icon) => `<button class="btn ico" data-act="lgnav" data-d="${d}" aria-label="${lab}" title="${lab}" ${k + d < 0 || k + d >= trail.length ? 'disabled' : ''}>${ico(icon)}</button>`;
  const mid = e ? `<a class="btn" href="#partie/${g.t}/${e.ply}"><span class="d-only">Voir mon coup</span><span class="m-only">Mon coup</span></a><a class="btn" href="#erreur/${g.t}/${e.ply}"><span class="d-only">Rejouer l’erreur</span><span class="m-only">Rejouer</span></a>`
    : `<a class="btn wide" href="#partie/${g.t}">Revoir la partie</a>`;
  return `<section class="card lgame"><span class="hlab d-flex">${k ? 'Partie' : 'Dernière partie'} du ${dfmt(g.t)}${a && !a.bad ? `<a class="small" href="#partie/${g.t}/d">Débrief</a>` : ''}</span>
    ${e ? `<div class="lgrow">${pos}<div class="lgtxt">${head}${body}</div></div>` : head + body}
    <div class="lgbtn">${nav(-1, 'Gaffe plus récente', 'prev')}${mid}${nav(1, 'Gaffe plus ancienne', 'next')}</div></section>`;
}
// Bilan de l'import (18/11, demande de Gaëtan) : après chaque chargement de parties, une fois Stockfish passé sur les
// nouvelles, points forts et faibles de l'ensemble des parties de la cadence suivie (recap.js), ce que l'import change,
// et le bilan des nouvelles. Prend la place de la dernière partie jusqu'à « J'ai lu ». Téléphone : un point de chaque.
function recapCard() {
  const rc = ls.get('recap', null);
  if (!rc?.ids?.length || !S.data) return '';
  const gs = cadenceGames(), mine = new Set(gs.map((g) => g.id)), ids = rc.ids.filter((id) => mine.has(id));
  if (!ids.length) return '';
  const r = importRecap(gs, S.an, ids);
  if (!r.ready) return '';
  const li = (x) => `<li><b><span class="sr">${x === r.forces[0] || r.forces.includes(x) ? 'Point fort : ' : 'Point faible : '}</span>${esc(x.t)}</b>${x.neu ? ' <span class="small">nouveau</span>' : ''}<span class="rd d-only">${esc(x.d)}</span></li>`;
  const col = (h, arr, cls) => `<div class="rcol ${cls}"><h3>${h}</h3><ul>${arr.slice(0, 2).map(li).join('')}</ul></div>`;
  const sig = r.forces.length || r.faiblesses.length
    ? `<div class="rcols">${col('Points forts', r.forces, 'rf')}${col('Points faibles', r.faiblesses, 'rw')}</div>`
    : '<p class="sub">Points forts et faibles à partir de 10 parties analysées.</p>';
  const fixed = r.goneWeak.length ? `<p class="small d-only">Disparu depuis l’import : ${esc(r.goneWeak.join(', ').toLowerCase())}.</p>` : '';
  return `<section class="card ibilan"><span class="hlab">Bilan de tes parties</span><p class="rbatch"><span class="d-only-i">${esc(r.batch.text)}</span><span class="m-only-i">${r.batch.n > 1 ? r.batch.n + ' nouvelles parties' : '1 nouvelle partie'} : ${r.batch.w} V, ${r.batch.d} N, ${r.batch.l} D</span></p>${sig}${fixed}
    <div class="rbtn"><a class="btn" href="#bilan">Détail<span class="d-only-i"> dans Mon jeu</span></a><button class="btn" data-act="recapok">J’ai lu</button></div></section>`;
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
  return `<div class="home">${goalStrip()}${sessionCard(steps, nDone)}<div class="hside">${briefCard(fc, steps)}${recapCard() || lastGameCard()}</div></div>`;
}

export { mountAccueil, viewAccueil };
