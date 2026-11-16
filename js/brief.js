// Brief du coach (accueil) : ce que je vois dans tes parties, ce qu'on fait aujourd'hui, à quoi on saura que ça marche.
// Calcul pur : les faits viennent des parties analysées, les phrases de gabarits. Testé dans tests/brief.test.mjs.

// Causes d'une erreur, données par l'élève après un puzzle tiré de ses parties (progress.recordCause).
// tip : consigne de jeu ; drill : échauffement qui entraîne ce réflexe (drills.js), null si celui du chantier convient mieux.
export const CAUSES = {
  vu: { label: 'Je n’ai pas vu sa menace', tip: 'Avant chaque coup, demande-toi ce que menace son dernier coup.', drill: 'menace' },
  calc: { label: 'J’ai mal calculé', tip: 'Avant une prise, compte qui prend et qui reprend sur la case, jusqu’au bout.', drill: 'compte' },
  temps: { label: 'Je jouais trop vite', tip: 'Joue l’ouverture vite, puis ralentis dès que les pièces se touchent : garde 3 minutes pour la fin.', drill: null },
  plan: { label: 'Je suivais une autre idée', tip: 'Avant de jouer ton idée, vérifie que la case d’arrivée n’est pas attaquée.', drill: null },
};
// Cause dominante : au moins 3 réponses, et 40 % d'entre elles.
export const mainCause = (c) => (c && c.n >= 3 && c.top && c.top.share >= 0.4 ? c.top.id : null);

const f1 = (x) => x.toFixed(1).replace('.', ',');
const low1 = (s) => s[0].toLowerCase() + s.slice(1);

// Faits sur les n dernières parties analysées (gaffes et erreurs du thème du chantier).
export function briefFacts(games, an, themeId, n = 10) {
  const last = games.filter((g) => an[g.id] && !an[g.id].bad).sort((a, b) => a.t - b.t).slice(-n);
  let lost = 0, lostWith = 0, errs = 0, sum = 0, low = 0, timed = 0;
  for (const g of last) {
    const es = an[g.id].errs.filter((e) => e.theme === themeId && e.kind !== 'imprecision');
    if (g.out === 'L') { lost++; if (es.length) lostWith++; }
    for (const e of es) {
      errs++; sum += Math.floor(e.ply / 2) + 1;
      if (g.clk && g.clk.length === g.san.length && g.base) { timed++; if ((e.ply >= 2 ? g.clk[e.ply - 2] : g.base) < 120) low++; }
    }
  }
  return { n: last.length, lost, lostWith, errs, avgMove: errs ? Math.round(sum / errs) : null, low, timed };
}

// facts : briefFacts ; theme, rule : nom et règle du chantier ; fs : mesure du chantier (focusStats) ;
// cause : progress.causes() ; next : prochaine étape de la séance, en minuscules (null si la séance est faite).
export function coachBrief({ facts: f, theme, rule, fs, cause, next }) {
  const th = `« ${theme} »`, c = mainCause(cause);
  let diag;
  if (!f.n) diag = 'Je n’ai encore aucune partie analysée : lance l’analyse, et je te dirai quoi travailler en priorité.';
  else if (f.lostWith) diag = `Sur tes ${f.n} dernières parties, ${f.lostWith} de tes ${f.lost} défaites passent par ${th}${f.avgMove ? `, en moyenne vers le coup ${f.avgMove}` : ''}${f.timed >= 2 && f.low / f.timed >= 0.5 ? `, et ${f.low} fois sur ${f.timed} avec moins de 2 minutes à la pendule` : ''}.`;
  else if (f.errs) diag = `Sur tes ${f.n} dernières parties, ${th} revient ${f.errs} fois${f.avgMove ? `, vers le coup ${f.avgMove} en moyenne` : ''}.`;
  else diag = `Sur tes ${f.n} dernières parties, plus aucune erreur de type ${th} : le chantier porte ses fruits.`;
  if (c) diag += ` Tu me dis surtout : « ${CAUSES[c].label} » (${cause.top.n} fois sur ${cause.n}).`;
  const todo = `${next ? `Aujourd’hui : ${next}.` : 'Séance du jour faite.'} En partie : ${low1(c ? CAUSES[c].tip : rule)}`;
  let goal;
  if (fs?.ok) goal = `Objectif atteint : ${th} est divisé par deux. On peut passer au chantier suivant.`;
  else if (!fs || fs.target == null) goal = 'Joue et analyse quelques parties : je fixerai un objectif chiffré.';
  else goal = `Objectif : ${f1(fs.target)} par partie sur 5 parties. Tu es à ${f1(fs.nAfter && fs.now != null ? fs.now : fs.base)}.`;
  return { diag, todo, goal };
}

// Auto-évaluation après une partie (« As-tu appliqué la règle ? ») confrontée à l'analyse.
// moves : numéros de coup des erreurs du chantier dans cette partie.
export function selfVerdict(yes, moves, theme) {
  const th = `« ${theme} »`, n = moves.length, where = n ? ` (coup${n > 1 ? 's' : ''} ${n > 1 ? moves.slice(0, -1).join(', ') + ' et ' + moves[n - 1] : moves[0]})` : '';
  if (yes) return n ? `Tu dis oui, mais l’analyse trouve ${n} ${th}${where}. Rejoue-les dans tes puzzles.` : `Confirmé : aucune erreur ${th} dans cette partie. Continue comme ça.`;
  return n ? `Tu ne l’as pas appliquée, et ça se voit : ${n} ${th}${where}.` : `Tu ne l’as pas appliquée, et pourtant aucune erreur ${th} : bonne partie, mais garde la routine.`;
}
