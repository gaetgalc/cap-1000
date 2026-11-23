// État de l'application (S), version des données et calculs gardés, accès aux parties, route affichée.
// Sans DOM ni rendu : tout module d'écran (js/views/) peut l'importer sans dépendre de js/app.js.
import { ls } from './store.js';
import * as st from './stats.js';
import { progress } from './progress.js';
import { makeMemo, viewKey } from './memo.js';

const DEPTH = 12; // même profondeur sur tous les appareils : une erreur est classée pareil partout
const { dkey, dayStart, act, streak } = progress;
const S = {
  user: ls.get('user', null), data: null, an: {}, rev: 0,
  f: ls.get('filter', { tc: 'rapid', days: 0 }),
  job: { running: false, done: 0, total: 0, stop: false, msg: '' },
  engine: null, play: null, ai: {}, gen: null, cl: null, white: true, path: [], pz: null, importing: null, upErr: null,
};
// ---------- Données ----------
// S.rev : version des données (parties, analyses). touch() à chaque changement de S.data ou S.an : les calculs gardés par memo() sont alors refaits.
const touch = () => { S.rev++; };
const memo = makeMemo(() => viewKey(S, dkey()));
const goal = () => ls.get('goal', { elo: 1000, date: new Date().getFullYear() + '-12-31' });
const rapidAll = () => (S.data ? S.data.games.filter((g) => g.tc === 'rapid') : []);
const games = () => (S.data ? st.filterGames(S.data.games, S.f) : []); // cadence suivie ET période : seulement dans les vues qui montrent le sélecteur de période
const cadenceGames = () => (S.data ? st.filterGames(S.data.games, { ...S.f, days: 0 }) : []); // cadence suivie, toute la période (cours, priorités)
const targetTc = () => (S.f.tc === 'all' ? 'rapid' : S.f.tc);
// Route affichée : #route/a/b/c → ['route', 'a', 'b', 'c'].
const route = () => (location.hash.slice(1) || 'accueil').split('/');

export { DEPTH, S, act, cadenceGames, dayStart, dkey, games, goal, memo, rapidAll, route, streak, targetTc, touch };
