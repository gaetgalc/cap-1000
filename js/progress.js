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
  const dkey = (d = new Date(now())) => d.toLocaleDateString('sv'); // jour local, AAAA-MM-JJ
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
  function streak() {
    const a = act(); let n = 0; const d = new Date(now());
    if (!a[dkey(d)]) d.setDate(d.getDate() - 1);
    while (a[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // ---- Journal : chaque exercice terminé est noté tout de suite ----
  // k : 'm' puzzle sur une erreur, 'l' position inédite Lichess, 'd' série d'échauffement. re : 1 si déjà fait ce jour-là.
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
  function mark(id, res) {
    const prog = store.get('pz', {}), p = prog[id], day = dkey();
    if (p?.d === day) return false;
    const box = res === 2 ? Math.min(STEPS.length - 1, (p?.box ?? -1) + 1) : -1;
    prog[id] = { box, due: dayStart() + (box < 0 ? 1 : STEPS[box]) * DAY, ok: (p?.ok || 0) + (res === 2 ? 1 : 0), d: day };
    store.set('pz', prog);
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

  // ---- Lecture : le jour en cours ----
  const todayPuzzles = () => { const d0 = dayStart(); return hist().filter((h) => h.k === 'm' && !h.re && h.t >= d0); };
  // Ratés du jour qui n'ont pas été réussis depuis. exists(id) écarte les positions qui ne sont plus disponibles.
  function failedToday(exists = () => true) {
    const d0 = dayStart(), last = new Map();
    for (const h of hist()) if (h.k === 'm' && h.t >= d0) last.set(h.id, h.r);
    return [...last].filter(([id, r]) => r < 2 && exists(id)).map(([id]) => id);
  }
  // Objectif du jour : GOAL puzzles, ou moins s'il n'y en a pas autant en attente. focusTheme : thème du chantier, servi d'abord.
  function day(puzzles, focusTheme) {
    const t = todayPuzzles(), done = Math.max(act()[dkey()]?.pz || 0, t.length);
    const due = (focusTheme && queue(puzzles, focusTheme, false).length) || queue(puzzles, '', false).length;
    return { done, due, goal: Math.max(1, Math.min(GOAL, done + due)), t };
  }

  return { dkey, dayStart, act, bump, streak, hist, queue, acquired, recordPuzzle, recordLichess, lichessStat, recordDrill, drills, lessonsRead, setLessonRead, todayPuzzles, failedToday, day };
}

export const progress = makeProgress();
