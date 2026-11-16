// Programme de 4 semaines par chantier, et bilan de la semaine passée (semaines du lundi au dimanche).
// Calcul pur, testé dans tests/program.test.mjs.
const DAY = 86400000;
export const STAGES = [
  { t: 'Comprendre', d: 'Lis le cours du chantier et fais tes puzzles du chantier chaque jour.' },
  { t: 'Automatiser', d: 'Un échauffement chaque jour : le contrôle doit devenir un réflexe.' },
  { t: 'Appliquer', d: 'Au moins 10 parties rapides, la règle du chantier répétée avant chaque coup.' },
  { t: 'Vérifier', d: 'On mesure : l’erreur doit être divisée par deux. Sinon, on prolonge le chantier.' },
];
const mondayOf = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

// since : début du chantier (secondes). i : semaine du programme (0 à 3, 4 = fini) ; start, prev : lundis de cette semaine et de la précédente.
export function programWeek(since, now = Date.now()) {
  const start = mondayOf(now), i = Math.round((start - mondayOf(since * 1000)) / (7 * DAY));
  return { i: Math.max(0, Math.min(4, i)), start, prev: mondayOf(start - DAY) };
}

// Chiffres de la semaine [from, to) : parties analysées, gaffes et erreurs du chantier, puzzles (hors révisions), échauffements.
export function weekStats({ games, an, hist, themeId, from, to }) {
  const gs = games.filter((g) => g.t * 1000 >= from && g.t * 1000 < to && an[g.id] && !an[g.id].bad);
  const errs = gs.reduce((n, g) => n + an[g.id].errs.filter((e) => e.theme === themeId && e.kind !== 'imprecision').length, 0);
  const h = hist.filter((x) => x.t >= from && x.t < to);
  return { n: gs.length, errs, rate: gs.length ? errs / gs.length : null, puzzles: h.filter((x) => x.k === 'm' && !x.re).length, drills: h.filter((x) => x.k === 'd').length };
}

const f1 = (x) => x.toFixed(1).replace('.', ',');
const pl = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
export function reviewText(cur, prev, theme) {
  const parts = [cur.n ? `${pl(cur.n, 'partie')}, ${f1(cur.rate)} « ${theme} » par partie${prev?.rate != null ? ` (${f1(prev.rate)} la semaine d’avant)` : ''}` : 'aucune partie analysée'];
  if (cur.puzzles) parts.push(pl(cur.puzzles, 'puzzle'));
  if (cur.drills) parts.push(pl(cur.drills, 'échauffement'));
  const verdict = cur.rate == null || prev?.rate == null ? '' : cur.rate < prev.rate - 0.05 ? ' En progrès.' : cur.rate > prev.rate + 0.05 ? ' En recul : on reprend les puzzles du chantier.' : ' Stable.';
  return `Semaine passée : ${parts.join(', ')}.${verdict}`;
}
