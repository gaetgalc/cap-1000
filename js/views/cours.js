// Cours (#cours, #cours/<id>) : liste, fiches statiques, cours privés rédigés par Claude (clé API ou copier-coller).
import { dbSet } from '../store.js';
import * as st from '../stats.js';
import { ENGINE_LESSONS, LESSONS } from '../lessons.js';
import { lastMoveText } from '../explain.js';
import { $, coach, dfmt, esc, ico, resChip, skel, tabs, txt } from '../ui.js';
import { progress } from '../progress.js';
import { board, errShapes } from '../board.js';
import * as exo from '../exercise.js';
import { coachKey, facts, genLesson } from '../coach.js';
import { LEARN_TABS } from '../nav.js';
import { S, cadenceGames, goal, rapidAll, route } from '../state.js';
import { SOLVE_BAR, explain, gameRef, moveNo, nextStep, pzRecord, solveBoard } from './puzzles.js';
import { bgRender, render } from '../app.js';
import { explainUI, getLines } from './explication.js';
import { priorityLessons } from './cartes.js';

function keyForm() {
  return `<form data-form="key" class="row"><input type="text" id="keyin" placeholder="sk-ant-…" autocomplete="off" spellcheck="false" style="flex:1;min-width:200px" aria-label="Clé API Anthropic"><button class="btn">Activer le coach</button></form>
    <p class="small">Crée une clé sur <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. Elle reste sur cet appareil et n’est envoyée qu’à l’API Claude. Un cours coûte quelques centimes.</p>`;
}
function viewCours() {
  const { ids, es } = priorityLessons();
  const read = progress.lessonsRead();
  const cnt = Object.fromEntries(es.themes.map((t) => [t.id, t.n]));
  const card = (id, prio) => `<a class="card lesson" href="#cours/${id}">
    <div class="row">${prio ? `<span class="chip">Priorité ${prio}</span>` : ''}${S.ai[id] ? '<span class="chip good">Cours privé prêt</span>' : ''}${read[id] ? '<span class="chip">Terminé</span>' : ''}</div>
    <h2>${esc(S.ai[id]?.titre || LESSONS[id].titre)}</h2>
    <p class="sub">${cnt[id] ? `${cnt[id]} exemple${cnt[id] > 1 ? 's' : ''} dans tes parties. ` : ''}${LESSONS[id].principe.split('. ')[0]}.</p></a>`;
  const others = Object.keys(LESSONS).filter((id) => !ids.includes(id));
  return `${tabs('cours', LEARN_TABS)}<h1>Cours</h1>
    ${coachKey() ? coach('Je prépare chaque cours à partir de tes propres positions : une idée, tes erreurs à rejouer, une règle à emporter. Ouvre un cours et demande-moi de le préparer.')
    : `<div class="card"><h2>Coach privé</h2><p class="prose">Chaque cours peut devenir une leçon particulière : Claude étudie tes positions, te pose les bonnes questions avant de te laisser jouer, puis t’explique pourquoi ton coup échouait. Deux façons de faire : avec ton abonnement Claude (un copier-coller, proposé dans chaque cours), ou en un clic avec une clé API facturée à l’usage.</p><details class="manual"><summary>Activer la génération en un clic (clé API)</summary>${keyForm()}</details></div>`}
    ${ids.length ? `<h2>Priorités</h2><div class="grid">${ids.map((id, i) => card(id, i < 3 ? i + 1 : 0)).join('')}</div>` : S.job.running ? `<h2>Priorités</h2><div class="grid">${[0, 1, 2].map((i) => `<div class="card">${skel(i ? '' : 'Analyse en cours : le classement des cours arrive.', 30, 75, 90, 60)}</div>`).join('')}</div>` : '<div class="card"><p class="sub">Lance l’analyse de tes parties pour classer les cours selon tes erreurs.</p></div>'}
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
  const gs = cadenceGames().slice().sort((a, b) => b.t - a.t), out = [];
  for (const g of gs) {
    const a = S.an[g.id]; if (!a) continue;
    for (const e of a.errs) if (e.theme === id) out.push({ g, e });
    if (out.length >= 30) break;
  }
  return out.sort((x, y) => y.e.drop - x.e.drop).slice(0, 4);
}
function lessonArgs(id) {
  const ex = ENGINE_LESSONS.includes(id) ? lessonExamples(id) : [];
  const numbers = lessonNumbers(id, cadenceGames()).replace(/<\/dd>/g, '\n').replace(/<[^>]+>/g, ' ').trim();
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
      live: true, exit: `<button class="btn" data-act="clnext">Continuer${ico('next')}</button>`,
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
      <div class="card"><h2>Routine avant chaque coup</h2><ol class="routine">${L.methode.map((m) => `<li>${txt(m)}</li>`).join('')}</ol></div>` + next(L.quiz.length ? 'Vérifier que j’ai compris' : 'Terminer le cours');
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
  const gs = cadenceGames(), ex = ENGINE_LESSONS.includes(id) ? lessonExamples(id) : [];
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
  ${blown.length ? `<div class="card"><h2>Parties qui t’ont échappé</h2><div><a class="btn" href="#gagner">Les rejouer pour les gagner</a></div>${blown.map((g) => `<a class="row" href="#partie/${g.t}" style="justify-content:space-between"><span>${dfmt(g.t)} contre ${esc(g.opp)} (${g.or})</span>${resChip(g.out)}</a>`).join('')}</div>` : ''}
  <div class="row">${read[id] ? nextStep('les') : ''}<button class="btn ${read[id] ? '' : 'pri'}" data-act="lu" data-id="${id}">${read[id] ? 'Marquer comme non terminé' : 'J’ai compris, marquer comme terminé'}</button></div>`;
}
function mountLecon() {
  mountCoachLesson();
  document.querySelectorAll('[data-mini]').forEach((el) => {
    const x = S.lessonEx[+el.dataset.mini];
    board(el, { fen: x.e.fen, orientation: x.g.w ? 'white' : 'black', viewOnly: true, coordinates: false, shapes: errShapes(x.e) });
  });
}

export { genCourse, keyForm, lessonArgs, mountLecon, viewCours, viewLecon };
