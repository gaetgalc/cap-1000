// Sections de la navigation : source unique des routes de chaque entrée, et cible d'un onglet du téléphone.
// Sans état ni DOM : testable sans navigateur.
export const SECTIONS = {
  acc: ['accueil', 'avantpartie'],
  ent: ['entrainer', 'puzzles', 'erreur', 'inedits', 'historique', 'exos', 'drill', 'gagner', 'idees', 'rush', 'finales', 'finale', 'cours', 'apprendre', 'ligne'],
  par: ['parties', 'partie', 'jouer', 'mesouvertures', 'monouv', 'echiquier'],
  pro: ['bilan', 'stats', 'plan', 'plus'],
};
export const ROOT = { acc: 'accueil', ent: 'entrainer', par: 'parties', pro: 'bilan' };

// Section d'une adresse (#route/…). #ouvertures : sans argument « Mes ouvertures » (Parties), avec argument le catalogue (S'entraîner).
export function sectionOf(hash) {
  const [r, a] = (hash || '').replace(/^#/, '').split('/');
  const key = r === 'ouvertures' ? (a ? 'apprendre' : 'mesouvertures') : r || 'accueil';
  return Object.keys(SECTIONS).find((s) => SECTIONS[s].includes(key)) || null;
}

// Page où mène l'onglet d'une section : l'entrée si on y est déjà, sinon la dernière page vue dans la section, sinon l'entrée.
export function tabTarget(sec, cur, last) {
  const root = '#' + ROOT[sec];
  if (sectionOf(cur) === sec) return root;
  const l = last && last[sec];
  return l && sectionOf(l) === sec ? l : root;
}

// Onglets internes (refonte du 16/11) : Cours / Ouvertures, Parties / Mes ouvertures. Ils doublent le volet de la navigation, utile sur téléphone.
export const LEARN_TABS = [['cours', '#cours', 'Cours'], ['ouv', '#ouvertures/apprendre', 'Ouvertures']];
export const GAMES_TABS = [['parties', '#parties', 'Parties'], ['ouv', '#ouvertures', 'Ouvertures'], ['fb', '#echiquier', 'Échiquier']];
export const PRO_TABS = [['bilan', '#bilan', 'Mon jeu'], ['stats', '#stats', 'Stats'], ['plan', '#plan', 'Plan']];
