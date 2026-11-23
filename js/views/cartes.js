// Cartes et calculs communs à plusieurs écrans : cadence et période, objectif, chantier et séance du jour (session),
// portrait, programme, sorties de théorie, causes d'erreur, tendance.
import { ls } from '../store.js';
import * as st from '../stats.js';
import { LESSONS, RULES } from '../lessons.js';
import { fr } from '../explain.js';
import { F_DNUM, TC, agoFr, esc, f1, ico, pl } from '../ui.js';
import { DAY, progress } from '../progress.js';
import { DRILLS, DRILL_FOR } from '../drills.js';
import { OPENINGS, lineKey } from '../openings.js';
import { CAUSES, mainCause } from '../brief.js';
import { STAGES, programWeek, reviewText, weekStats } from '../program.js';
import { portrait } from '../portrait.js';
import { theoryExits } from '../theory.js';
import { S, act, cadenceGames, dkey, goal, memo, rapidAll, targetTc } from '../state.js';
import { lineHref } from './ouvertures.js';
import { pzDay, pzDots } from './puzzles.js';

// Cadence suivie : un réglage avec son libellé (vue Plan), plus un filtre posé sur chaque page.
function cadenceField() {
  const has = new Set(S.data.games.map((g) => g.tc));
  return `<label class="sub" for="tcsel">Cadence suivie</label><select id="tcsel" data-f="tc">${['rapid', 'blitz', 'bullet', 'daily'].filter((k) => has.has(k)).map((k) => `<option value="${k}" ${S.f.tc === k ? 'selected' : ''}>${TC[k]}</option>`).join('')}<option value="all" ${S.f.tc === 'all' ? 'selected' : ''}>Toutes cadences</option></select>`;
}
// Période : Tout · 90 j · 30 j, dans chaque vue qui la lit (Mon jeu, Parties, Mes ouvertures, détail d'une ouverture).
const periodSeg = () => `<div class="seg2 mini" role="group" aria-label="Période">${[[0, 'Tout'], [90, '90 j'], [30, '30 j']].map(([v, l]) => `<button data-f="days" data-v="${v}" aria-pressed="${(S.f.days || 0) === v}" class="${(S.f.days || 0) === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const upToDate = () => (S.upErr ? (S.data?.fetchedAt ? `Mise à jour impossible, dernière réussie ${agoFr(Date.now() - S.data.fetchedAt)}` : 'Mise à jour impossible')
  : S.data?.fetchedAt ? `À jour, ${agoFr(Date.now() - S.data.fetchedAt)}` : 'Pas encore mis à jour');
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
    <details class="gd" ${innerWidth >= 860 ? 'open' : ''}><summary>Détail de l’objectif</summary><dl class="kv"><dt>Échéance</dt><dd>${F_DNUM(new Date(g.date))} (${days} j)</dd>
    ${gap > 0 ? `<dt>Rythme nécessaire</dt><dd>+${Math.ceil(gap / weeks)} pts / semaine</dd>` : ''}
    <dt>30 derniers jours</dt><dd>${tr.delta30 == null ? 'aucune partie' : (tr.delta30 >= 0 ? '+' : '') + tr.delta30 + ' pts sur ' + tr.recent + ' parties'}</dd>
    ${proj != null ? `<dt>Projection à l’échéance</dt><dd>${proj}</dd>` : ''}
    <dt>Record</dt><dd>${tr.peak}</dd></dl>
    ${proj != null ? '<p class="small">Projection : tendance linéaire des 30 derniers jours prolongée. C’est un repère, pas une prévision.</p>' : ''}</details></div>`;
  return { html, tr, g };
}
// Calcul lourd (statistiques de toutes les parties) et appelé à chaque en-tête, donc gardé par memo() : il ne dépend que des
// parties, des analyses, du filtre et du jour. Le résultat ne se modifie jamais. session() elle-même ne se garde pas :
// elle lit aussi l'entraînement du jour (puzzles faits, échauffement en cours), qui change sans toucher aux parties.
function priorityLessons() {
  return memo('priority', () => {
    const gs = cadenceGames(), es = st.engineStats(gs, S.an), sig = st.signals(gs, S.an);
    const ids = es.themes.map((t) => t.id);
    for (const w of sig.faiblesses) if (w.lesson && LESSONS[w.lesson] && !ids.includes(w.lesson)) ids.push(w.lesson);
    return { ids, es, sig };
  });
}
function nextLesson(ids) {
  const read = progress.lessonsRead();
  return ids.find((id) => !read[id]) || ids[0] || 'principes';
}
// Chantier : un seul type d'erreur travaillé à la fois, jusqu'à ce que son taux baisse de moitié.
function focus(es) {
  let f = ls.get('focus', null);
  if (f && st.THEMES[f.id]) return f;
  const top = es.themes[0]?.id;
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
  return `<section class="card focus"><div class="row" style="justify-content:space-between"><span class="small">Chantier en cours</span>${state}</div>
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
  return p.length ? `<div class="card"><h2>Portrait</h2><ul class="portrait">${p.map((x) => `<li>${esc(x.t)}</li>`).join('')}</ul></div>` : '';
}
// Programme de 4 semaines du chantier et bilan de la semaine passée (program.js).
function programCard(fc) {
  if (!fc) return '';
  const w = programWeek(fc.since), gs = S.data.games.filter((g) => g.tc === targetTc()), hist = progress.hist();
  const wk = (from, to) => weekStats({ games: gs, an: S.an, hist, themeId: fc.id, from, to });
  return `<div class="card"><h2>Programme <span class="small">${w.i < 4 ? `semaine ${w.i + 1} sur 4` : 'terminé'}</span></h2>
    <ol class="dayplan">${STAGES.map((x, i) => `<li class="${i < w.i ? 'done' : i === w.i ? 'on' : ''}"><i aria-hidden="true">${i < w.i ? '✓' : i + 1}</i><span><b>Semaine ${i + 1} · ${x.t}${i === w.i ? ' <span class="chip">en cours</span>' : ''}</b><span>${x.d}</span></span></li>`).join('')}</ol>
    <p class="sub">${w.i === 0 ? 'Premier bilan lundi prochain, ici et sur l’accueil.' : esc(reviewText(wk(w.prev, w.start), wk(w.prev - 7 * DAY, w.prev), st.THEMES[fc.id]))}</p>
    ${w.i >= 4 ? `<p class="small">${focusStats(fc).ok ? 'Chantier validé : passe au suivant.' : 'Quatre semaines passées sans diviser l’erreur par deux : le chantier continue, reprends à la semaine 1.'}</p>` : ''}</div>`;
}
// Où tu sors de la théorie dans les ouvertures du catalogue (theory.js) : une ligne précise à revoir.
function theoryCard() {
  const x = theoryExits(S.data.games.filter((g) => g.tc === targetTc()), OPENINGS, S.an).slice(0, 3);
  if (!x.length) return '';
  const mv = (r, s) => `${Math.floor(r.ply / 2) + 1}${r.ply % 2 ? '…' : '.'}${fr(s)}`;
  return `<div class="card"><h2>Où tu sors de la théorie</h2>${x.map((r) => `<a class="mrow" href="${lineHref(lineKey(r.o, r.k), true)}"><span class="mico">${ico('lines')}</span><span class="stepc"><b>${esc(r.o.nom)} · ${esc(r.o.lines[r.k].n)}</b><span>${r.n} fois sur ${r.of}, tu joues ${r.played.map(([s, n]) => mv(r, s) + (n > 1 ? ` (${n} fois)` : '')).join(', ')} au lieu de ${mv(r, r.book)} : le moteur juge ton coup moins bon.</span></span><span class="chev" aria-hidden="true">${ico('next')}</span></a>`).join('')}
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
  return `<div class="card"><h2>Erreurs graves par partie</h2>
    <div class="scroll"><table><thead><tr><th>Type d’erreur</th><th class="r">${tr.nPrev >= 5 ? 'Avant' : ''}</th><th class="r">Maintenant</th><th></th></tr></thead><tbody>
    ${tr.rows.map((r) => `<tr class="click" data-act="goto-cours" data-id="${r.id}"><td>${st.THEMES[r.id]}</td><td class="r">${r.before == null ? '' : f1(r.before)}</td><td class="r"><b>${f1(r.now || 0)}</b></td><td class="r">${chip(r)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="small">« Maintenant » : tes ${tr.nCur} dernières parties analysées.${tr.nPrev >= 5 ? ` « Avant » : les ${tr.nPrev} précédentes.` : ' Analyse au moins 15 parties pour voir l’évolution.'} C’est ce tableau qui dit si l’entraînement paie.</p>
    ${S.job.running ? '' : '<div><button class="btn sm" data-act="analyse">Analyser 20 parties de plus</button></div>'}</div>`;
}

export { cadenceField, causesCard, focusCard, focusStats, goalBlock, periodSeg, portraitCard, priorityLessons, programCard, session, theoryCard, trendCard, upToDate };
