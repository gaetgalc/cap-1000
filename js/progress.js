// Mémoire de l'entraînement : répétition espacée des puzzles, journal des exercices, activité par jour.
// Toute règle de planification vit ici et se teste sans navigateur (tests/progress.test.mjs).
// Le stockage et l'horloge sont injectés : localStorage et l'heure réelle en production, une table en mémoire et une date fixée dans les tests.
import { ls } from './store.js';

export const DAY = 86400000;
const STEPS = [1, 3, 7, 21, 60]; // jours avant le retour d'un puzzle réussi du premier coup, à chaque réussite de plus
const GOAL = 8;                  // puzzles par jour
const KEEP = 600, KEEP_LICHESS = 60;

// Résultat d'un puzzle : 2 = trouvé du premier coup, 1 = trouvé après une erreur ou un indice, 0 = solution vue.
export function makeProgress(store = ls, now = () => Date.now()) {
  const dkey = (d = new Date(now())) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // jour local, AAAA-MM-JJ
  const dayStart = (t = now()) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };

  // ---- Activité par jour (séance du jour, série) ----
  const act = () => store.get('act', {});
  function bump(k, n = 1) {
    const a = act(), d = dkey();
    a[d] ||= {}; a[d][k] = Math.max(0, (a[d][k] || 0) + n);
    if (!a[d][k]) delete a[d][k];
    if (!Object.keys(a[d]).length) delete a[d];
    const keys = Object.keys(a).sort(); // on garde un an d'historique
    for (const old of keys.slice(0, Math.max(0, keys.length - 370))) delete a[old];
    store.set('act', a);
  }
  // Les 7 derniers jours (le plus ancien d'abord) : { d: AAAA-MM-JJ, t: début du jour, n: exercices faits }
  function week() {
    const a = act(), out = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(now()); d.setDate(d.getDate() - i); const k = dkey(d), n = Object.values(a[k] || {}).reduce((s, x) => s + x, 0); out.push({ d: k, t: dayStart(d.getTime()), n }); }
    return out;
  }
  function streak() {
    const a = act(); let n = 0; const d = new Date(now());
    if (!a[dkey(d)]) d.setDate(d.getDate() - 1);
    while (a[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---- Journal : chaque exercice terminé est noté tout de suite ----
  // k : 'm' puzzle sur une erreur, 'l' position inédite Lichess, 'd' série d'échauffement, 'c' partie gagnante rejouée,
  //     'o' ligne d'ouverture récitée, 'f' finale de base, 'r' série de Rush, 'j' partie jouée depuis une position.
  // re : 1 si déjà fait ce jour-là.
  const hist = () => store.get('hist', []);
  function log(x) {
    const h = hist(); h.push({ t: now(), ...x });
    let n = 0; // la position complète d'un puzzle Lichess n'est gardée que pour les derniers
    for (let i = h.length - 1; i >= 0; i--) if (h[i].p && ++n > KEEP_LICHESS) delete h[i].p;
    store.set('hist', h.slice(-KEEP));
  }

  // ---- Répétition espacée ----
  // Un seul résultat par jour et par puzzle compte. Un puzzle fait aujourd'hui ne revient pas aujourd'hui :
  // raté, il revient demain ; réussi du premier coup, après 1, 3, 7, 21 puis 60 jours.
  // key : 'pz' pour les puzzles, 'ln' pour les lignes d'ouverture (même règle, mémoires séparées).
  function mark(id, res, key = 'pz') {
    const prog = store.get(key, {}), p = prog[id], day = dkey();
    if (p?.d === day) return false;
    const box = res === 2 ? Math.min(STEPS.length - 1, (p?.box ?? -1) + 1) : -1;
    // b : case prévue par la règle, point de départ si l'élève juge ensuite le puzzle facile ou difficile.
    prog[id] = { box, b: box, due: dayStart() + (box < 0 ? 1 : STEPS[box]) * DAY, ok: (p?.ok || 0) + (res === 2 ? 1 : 0), d: day };
    store.set(key, prog);
    return true;
  }
  // File des puzzles à faire, parmi `puzzles` ({ id, g: { t }, e: { theme, drop } }) : déjà vus d'abord, puis les plus récents.
  // free : entraînement libre, sans attendre l'échéance, mais sans ceux déjà faits aujourd'hui.
  function queue(puzzles, theme, free) {
    const prog = store.get('pz', {}), t = now(), day = dkey();
    let list = puzzles.filter((p) => !theme || p.e.theme === theme);
    if (!free) list = list.filter((p) => (prog[p.id]?.due || 0) <= t);
    else { const rest = list.filter((p) => prog[p.id]?.d !== day); if (rest.length) list = rest; }
    return list.sort((a, b) => ((prog[a.id] ? 0 : 1) - (prog[b.id] ? 0 : 1)) || (b.g.t - a.g.t) || (b.e.drop - a.e.drop));
  }
  // Avis de l'élève sur un puzzle réussi du premier coup aujourd'hui : 'e' facile (un palier de plus), 'h' difficile
  // (un palier de moins, jamais moins d'un jour), '' normal (la règle). Modifiable dans la journée.
  // rateInfo renvoie null si le puzzle ne peut pas être jugé, sinon l'avis actuel et le délai de retour de chaque choix.
  const boxFor = (b, q) => (q === 'e' ? Math.min(STEPS.length - 1, b + 1) : q === 'h' ? Math.max(0, b - 1) : b);
  function rateInfo(id) {
    const p = store.get('pz', {})[id];
    if (!p || p.d !== dkey() || !(p.b >= 0)) return null;
    return { q: p.q || '', days: { e: STEPS[boxFor(p.b, 'e')], '': STEPS[p.b], h: STEPS[boxFor(p.b, 'h')] } };
  }
  function ratePuzzle(id, q) {
    const prog = store.get('pz', {}), p = prog[id];
    if (!p || p.d !== dkey() || !(p.b >= 0)) return null;
    p.box = boxFor(p.b, q); p.due = dayStart() + STEPS[p.box] * DAY; p.q = q;
    store.set('pz', prog);
    const h = hist(); // l'avis est aussi noté dans le journal, sur la ligne du jour de ce puzzle
    for (let i = h.length - 1; i >= 0; i--) if (h[i].k === 'm' && h[i].id === id && !h[i].re) { if (q) h[i].q = q; else delete h[i].q; store.set('hist', h); break; }
    return STEPS[p.box];
  }
  const acquired = () => Object.values(store.get('pz', {})).filter((p) => p.box >= 2).length; // réussis 3 fois, à plusieurs jours d'écart

  // ---- Enregistrement d'un exercice terminé ----
  // Renvoie true si le résultat compte pour le jour (premier passage du jour sur ce puzzle).
  function recordPuzzle(p, res) {
    const fresh = mark(p.id, res);
    if (fresh) bump('pz');
    log({ k: 'm', id: p.id, r: res, th: p.e.theme || '', re: fresh ? 0 : 1 });
    return fresh;
  }
  // P : puzzle Lichess ({ id, rating, fen, prevFen, last, lastSan, sol, white, themes }). replay : rejoué depuis l'historique.
  function recordLichess(P, res, angle, replay) {
    if (!replay) { const all = store.get('listat', {}), s = all[angle] || { n: 0, ok: 0 }; s.n++; if (res === 2) s.ok++; all[angle] = s; store.set('listat', all); bump('li'); }
    log({ k: 'l', id: P.id, r: res, a: angle, rt: P.rating, re: replay ? 1 : 0, p: { fen: P.fen, prevFen: P.prevFen, last: P.last, lastSan: P.lastSan, sol: P.sol, white: P.white, themes: P.themes } });
  }
  // Ligne d'ouverture récitée : 2 sans faute, 1 avec des fautes ou un indice, 0 suite montrée. Même répétition espacée
  // que les puzzles, dans sa propre mémoire. Une ligne jamais récitée n'est pas « à réviser » : elle est nouvelle.
  function recordLine(id, res) {
    const fresh = mark(id, res, 'ln');
    if (fresh) bump('op');
    log({ k: 'o', id, r: res, re: fresh ? 0 : 1 });
    return fresh;
  }
  // État d'une ligne : null si jamais récitée, sinon { due, box, ok, acquise, aReviser }.
  function lineState(id) {
    const p = store.get('ln', {})[id];
    return p ? { due: p.due, box: p.box, ok: p.ok, acquise: p.box >= 2, aReviser: p.due <= now() } : null;
  }
  const linesDue = (ids) => { const ln = store.get('ln', {}), t = now(); return ids.filter((id) => ln[id] && ln[id].due <= t); };
  // Finale de base jouée contre le moteur (#finale) : 2 réussie sans indice, 1 réussie avec indice, 0 manquée.
  // Même répétition espacée que les lignes, mémoire 'fin' ; journal k 'f'.
  function recordEndgame(id, res) {
    const fresh = mark(id, res, 'fin');
    if (fresh) bump('fin');
    log({ k: 'f', id, r: res, re: fresh ? 0 : 1 });
    return fresh;
  }
  function endgameState(id) {
    const p = store.get('fin', {})[id];
    return p ? { due: p.due, box: p.box, ok: p.ok, acquise: p.box >= 2, aReviser: p.due <= now() } : null;
  }
  const endgamesDue = (ids) => { const f = store.get('fin', {}), t = now(); return ids.filter((id) => f[id] && f[id].due <= t); };
  // Rush (#rush) : mode 't3' (3 minutes) ou 'surv' (3 fautes), ok réponses justes sur n. Renvoie true si c'est un record.
  const rushBest = () => ({ t3: 0, surv: 0, ...store.get('rush', {}) });
  function recordRush(m, ok, n) {
    const b = rushBest(), rec = ok > (b[m] || 0);
    if (rec) { b[m] = ok; store.set('rush', b); }
    bump('rush'); log({ k: 'r', m, ok, n, rec: rec ? 1 : 0 });
    return rec;
  }
  // Partie jouée contre le moteur depuis une position de la relecture (#jouer) : why = fin de la partie, n = demi-coups.
  function recordPlay(id, ply, why, n) { bump('jouer'); log({ k: 'j', id: String(id), ply, why, n }); }
  // Partie gagnante rejouée contre le moteur : r = 2 gagnée, 0 pas gagnée (nulle, défaite, abandon). n : demi-coups joués.
  function recordConversion(id, r, n) { bump('cv'); log({ k: 'c', id: String(id), r, n }); }
  const conversions = () => hist().filter((h) => h.k === 'c');
  const lichessStat = (angle) => store.get('listat', {})[angle] || { n: 0, ok: 0 };
  function recordDrill(type, ok, n, ms) {
    const h = drills(); h.push({ d: dkey(), type, ok, n, ms }); store.set('drills', h.slice(-200));
    bump('dr'); log({ k: 'd', ty: type, ok, n });
  }
  const drills = () => store.get('drills', []);
  // Cours terminés : { id: true }. Marquer ou démarquer compte dans l'activité du jour.
  const lessonsRead = () => store.get('lus', {});
  function setLessonRead(id, on) {
    const d = lessonsRead(); if (!!d[id] === !!on) { if (on) bump('les'); return; }
    d[id] = !!on; store.set('lus', d); bump('les', on ? 1 : -1);
  }

  // ---- Pourquoi l'erreur a été faite en partie : réponse de l'élève, une par puzzle (clé 'why') ----
  // vu : je n'ai pas vu sa menace ; calc : j'ai mal calculé ; temps : je jouais vite ; plan : je suivais une autre idée.
  const WHY = ['vu', 'calc', 'temps', 'plan'];
  const whyAll = () => store.get('why', {});
  function recordCause(id, c) {
    if (!WHY.includes(c)) return false;
    const w = whyAll(); w[id] = { c, t: now() };
    const keep = Object.entries(w).sort((a, b) => b[1].t - a[1].t).slice(0, 200);
    store.set('why', Object.fromEntries(keep));
    return true;
  }
  const causeOf = (id) => whyAll()[id]?.c || null;
  // Les 30 dernières réponses : compte par cause et cause dominante.
  function causes() {
    const last = Object.values(whyAll()).sort((a, b) => b.t - a.t).slice(0, 30), by = {};
    for (const x of last) by[x.c] = (by[x.c] || 0) + 1;
    const [id, n] = Object.entries(by).sort((a, b) => b[1] - a[1])[0] || [];
    return { n: last.length, by, top: id ? { id, n, share: Math.round((100 * n) / last.length) / 100 } : null };
  }

  // ---- Auto-évaluation d'une partie (clé 'self') : « As-tu appliqué la règle du chantier ? » ----
  const selfAll = () => store.get('self', {});
  function recordSelf(id, y) {
    const s = selfAll(); s[id] = { y: !!y, t: now() };
    store.set('self', Object.fromEntries(Object.entries(s).sort((a, b) => b[1].t - a[1].t).slice(0, 100)));
  }
  const selfOf = (id) => selfAll()[id] || null;
  // ---- Exercice de plan (choisir la bonne idée) : journal k 'i', 2 trouvé, 0 raté ----
  function recordIdea(id, ok) { log({ k: 'i', id, r: ok ? 2 : 0 }); bump('idea'); }

  // ---- Lecture : le jour en cours ----
  const todayPuzzles = () => { const d0 = dayStart(); return hist().filter((h) => h.k === 'm' && !h.re && h.t >= d0); };
  // Ratés du jour qui n'ont pas été réussis depuis. exists(id) écarte les positions qui ne sont plus disponibles.
  function failedToday(exists = () => true) {
    const d0 = dayStart(), last = new Map();
    for (const h of hist()) if (h.k === 'm' && h.t >= d0) last.set(h.id, h.r);
    return [...last].filter(([id, r]) => r < 2 && exists(id)).map(([id]) => id);
  }
  // Réussites du premier coup d'affilée, sur les puzzles du jour (révisions exclues) : série en cours et meilleure série.
  function run() {
    let cur = 0, best = 0;
    for (const h of todayPuzzles()) { cur = h.r === 2 ? cur + 1 : 0; best = Math.max(best, cur); }
    return { cur, best };
  }
  // Objectif du jour : GOAL puzzles, ou moins s'il n'y en a pas autant en attente. focusTheme : thème du chantier, servi d'abord.
  function day(puzzles, focusTheme) {
    const t = todayPuzzles(), done = Math.max(act()[dkey()]?.pz || 0, t.length);
    const due = (focusTheme && queue(puzzles, focusTheme, false).length) || queue(puzzles, '', false).length;
    return { done, due, goal: Math.max(1, Math.min(GOAL, done + due)), t };
  }

  return { dkey, dayStart, act, bump, streak, week, hist, queue, acquired, recordPuzzle, rateInfo, ratePuzzle, recordLichess, lichessStat, recordDrill, recordConversion, conversions, recordLine, lineState, linesDue, recordEndgame, endgameState, endgamesDue, rushBest, recordRush, recordPlay, drills, lessonsRead, setLessonRead, todayPuzzles, run, failedToday, day, recordCause, causeOf, causes, recordSelf, selfOf, recordIdea };
}

export const progress = makeProgress();
