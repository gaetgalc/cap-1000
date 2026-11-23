/* global Chess */
// Puzzles sur tes erreurs (#puzzles, #erreur/<t>/<ply>), file de répétition espacée, historique (#historique).
import { ls } from '../store.js';
import { Engine } from '../engine.js';
import { fmtEval, isPuzzle, uciMove, winPct } from '../classify.js';
import * as st from '../stats.js';
import { fr, hintFor, lastMoveText } from '../explain.js';
import { $, F_HM, F_WDLONG, coach, dfmt, esc, ico, pl, tabs, txt } from '../ui.js';
import { DAY, progress } from '../progress.js';
import { arrow, destsOf } from '../board.js';
import * as exo from '../exercise.js';
import { LI_ANGLES } from '../lichess.js';
import { DRILLS } from '../drills.js';
import { byId } from '../openings.js';
import { egById } from '../endgames.js';
import { DEPTH, S, dayStart, dkey } from '../state.js';
import { RUSH } from './rush.js';
import { explainUI, getLines } from './explication.js';
import { header } from '../app.js';
import { lineHref } from './ouvertures.js';
import { session } from './cartes.js';

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
const PZ_TABS = [['mine', '#puzzles', 'Mes erreurs'], ['li', '#inedits', 'Inédits'], ['hist', '#historique', 'Historique']];
const LI_NAME = Object.fromEntries(LI_ANGLES);
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
      <div class="meta small">Coup ${moveNo(p.e)} de ta ${gameRef(p.g)}${p.e.theme ? ` · ${st.THEMES[p.e.theme]}` : ''}</div><div class="meta small"><a href="#partie/${p.g.t}/${p.e.ply}">Ouvrir la partie</a></div>
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
    return tabs('mine', PZ_TABS) + `<h1>Puzzles sur tes erreurs</h1><div class="card"><p class="prose">${S.job.running ? 'L’analyse de tes parties est en cours. Les premiers puzzles apparaissent ici dès qu’une partie est terminée.' : 'Aucune partie analysée pour le moment. Lance l’analyse pour transformer tes erreurs en puzzles.'}</p>${S.job.running ? '' : '<div><button class="btn pri" data-act="analyse">Analyser mes 20 dernières parties</button></div>'}</div>`;
  }
  if (!S.pz) pzReset('', false);
  const z = S.pz, themes = [...new Set(total.map((p) => p.e.theme))];
  const head = tabs('mine', PZ_TABS) + `<div class="pzhead main"><h1>Puzzles sur tes erreurs</h1><span class="row" id="pzdayi">${pzDayHtml()}</span></div>`;
  const plain = tabs('mine', PZ_TABS) + '<h1>Puzzles sur tes erreurs</h1>';
  const filter = `<div class="row pzfilter"><label class="small" for="pzt">Thème travaillé</label><select id="pzt"><option value="">Tous les thèmes</option>${themes.map((t) => `<option value="${t}" ${z.theme === t ? 'selected' : ''}>${st.THEMES[t]}</option>`).join('')}</select></div>`;
  // Révision des ratés du jour : une liste fixe, sans effet sur le calendrier de répétition.
  z.redo = (z.redo || []).filter((id) => pzById(id));
  if (z.redo.length) {
    return workScreen(pzById(z.redo[0]), {
      head: tabs('mine', PZ_TABS) + `<div class="pzhead"><h1>Ratés du jour</h1><div class="row"><span class="chip warn">Révision : encore ${z.redo.length}</span><button class="btn sm" data-act="pzredostop">Arrêter</button></div></div>`,
      next: `<button class="btn" data-act="pznext">${z.redo.length > 1 ? `Raté suivant${ico('next')}` : `Terminer${ico('next')}`}</button>`,
    });
  }
  if (z.show === dkey()) return plain + pzRecap('Objectif du jour atteint', 'Tu peux t’arrêter là. Les puzzles ratés reviennent demain, les réussis dans quelques jours : c’est cet espacement qui transforme une correction en réflexe.', false, filter);
  const q = pzQueue(z.theme, z.free);
  if (!z.cur || !q.some((p) => p.id === z.cur.id)) z.cur = q[0] ? { id: q[0].id } : null;
  if (!z.cur) return plain + pzRecap(z.theme ? 'Ce thème est à jour' : 'Tout est à jour', `Plus aucun puzzle en attente aujourd’hui${z.theme ? ' sur ce thème' : ''}. Les puzzles réussis reviennent après 1, 3, 7 puis 21 jours, les ratés dès demain : c’est la répétition espacée qui transforme une correction en réflexe.`, true, filter);
  const p = q.find((x) => x.id === z.cur.id);
  return workScreen(p, { head, next: `<button class="btn" data-act="pznext">Suivant${ico('next')}</button>`, side: filter, top: () => pzProg(pzDay()) });
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
  const all = progress.hist(), h = all.slice().reverse(), head = tabs('hist', PZ_TABS) + '<h1>Historique</h1>';
  if (!h.length) return head + `<div class="card">${coach('Chaque puzzle, chaque position inédite, chaque échauffement et chaque partie rejouée que tu termines est noté ici avec son résultat. Tu peux quitter la page ou fermer le site : rien ne se perd, et tu peux refaire une position d’un clic.')}<div><a class="btn pri" href="#puzzles">Faire mes puzzles</a></div></div>`;
  S.histN ||= 60;
  const pz = all.filter((x) => (x.k === 'm' || x.k === 'l') && !x.re), d0 = dayStart(), today = dkey();
  const acq = progress.acquired();
  const tiles = `<div class="tiles"><div class="tile"><b class="num">${pz.filter((x) => x.t >= d0).length}</b><span>puzzles aujourd’hui</span></div>
    <div class="tile"><b class="num">${pz.filter((x) => x.t >= d0 - 6 * DAY).length}</b><span>sur 7 jours</span></div>
    <div class="tile"><b class="num">${pz.length ? st.pct(pz.filter((x) => x.r === 2).length, pz.length) + ' %' : '—'}</b><span>trouvés du premier coup</span></div>
    <div class="tile"><b class="num">${acq}</b><span>acquis (réussis 3 fois, à plusieurs jours d’écart)</span></div></div>`;
  const hm = F_HM;
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
  const label = (k) => (k === today ? 'Aujourd’hui' : k === yest ? 'Hier' : F_WDLONG(new Date(k + 'T12:00:00')));
  const isPz = (x) => x.k === 'm' || x.k === 'l';
  const sum = (l) => { const z = l.filter((x) => isPz(x) && !x.re), dr = l.filter((x) => x.k === 'd').length, cv = l.filter((x) => x.k === 'c').length, ol = l.filter((x) => x.k === 'o').length, ii = l.filter((x) => x.k === 'i').length, fi = l.filter((x) => x.k === 'f').length, ru = l.filter((x) => x.k === 'r').length, rv = l.filter((x) => isPz(x) && x.re).length; return [z.length ? `${pl(z.length, 'puzzle')}, ${z.filter((x) => x.r === 2).length} du premier coup` : '', rv ? pl(rv, 'révision') : '', dr ? pl(dr, 'échauffement') : '', cv ? pl(cv, 'partie rejouée').replace('parties rejouée', 'parties rejouées') : '', ol ? `${ol} ligne${ol > 1 ? 's' : ''} d’ouverture` : '', ii ? pl(ii, 'idée') + ' de plan' : '', fi ? pl(fi, 'finale') : '', ru ? pl(ru, 'rush') : ''].filter(Boolean).join(' · '); };
  return head + tiles + `<div class="legend"><span style="--c:var(--good)">Du premier coup</span><span style="--c:var(--warn)">Trouvé avec aide</span><span style="--c:var(--bad)">Solution vue</span></div>`
    + [...days].map(([k, l]) => `<div class="card hday"><h2><span class="hcap">${label(k)}</span><span class="small">${sum(l)}</span></h2>${l.map(row).join('')}</div>`).join('')
    + (h.length > S.histN ? '<div><button class="btn" data-act="histmore">Afficher les exercices plus anciens</button></div>' : '');
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

export { PZ_TABS, SOLVE_BAR, allPuzzles, explain, failedToday, gameRef, mountPuzzle, moveNo, nextStep, pzDay, pzDots, pzProg, pzQueue, pzRecord, pzReset, solveBoard, viewHistory, viewPuzzles };
