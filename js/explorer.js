// Explorateur d'ouvertures filtré par niveau : ce que jouent, depuis une position, les joueurs Lichess proches du tien.
// API publique explorer.lichess.ovh (base des parties Lichess). Lecture de la réponse pure, testée sans réseau.
import { fr } from './geom.js';

// Tranches de classement Lichess interrogées (chaque tranche va jusqu'à la suivante) : 1200 à 1800 sur Lichess,
// où l'échelle est plus haute que sur Chess.com ; c'est le niveau autour de 1000 en Rapide sur Chess.com.
export const RATINGS = [1200, 1400, 1600];
export const LEVEL = 'joueurs Lichess classés 1200 à 1800, parties rapides et blitz';
export function explorerUrl(fen) {
  const q = new URLSearchParams({ variant: 'standard', fen, speeds: 'blitz,rapid', ratings: RATINGS.join(','), moves: '8', topGames: '0', recentGames: '0' });
  return 'https://explorer.lichess.ovh/lichess?' + q;
}
// turn : camp au trait ('w' ou 'b'). score : points marqués par ce camp après le coup, en %.
export function explorerRows(d, turn) {
  const n = (x) => (x.white || 0) + (x.draws || 0) + (x.black || 0);
  const total = n(d || {});
  const rows = (d?.moves || []).map((m) => {
    const k = n(m), mine = turn === 'w' ? m.white || 0 : m.black || 0;
    return { uci: m.uci, san: fr(m.san), n: k, pct: total ? Math.round((100 * k) / total) : 0, score: k ? Math.round((100 * (mine + (m.draws || 0) / 2)) / k) : 0 };
  });
  return { total, rows, opening: d?.opening?.name || '' };
}
const CACHE = new Map();
export async function fetchExplorer(fen, get = (u) => fetch(u, { headers: { Accept: 'application/json' } })) {
  if (CACHE.has(fen)) return CACHE.get(fen);
  let r;
  try { r = await get(explorerUrl(fen)); } catch { throw new Error('L’explorateur Lichess ne répond pas. Vérifie ta connexion puis réessaie.'); }
  if (r.status === 429) throw new Error('Lichess limite les requêtes pour le moment. Attends une minute puis réessaie.');
  if (r.status === 401 || r.status === 403) throw new Error('L’explorateur Lichess demande une connexion à un compte : il n’est pas disponible depuis ce site pour l’instant.');
  if (!r.ok) throw new Error('L’explorateur Lichess a répondu avec une erreur (' + r.status + ').');
  const d = await r.json();
  CACHE.set(fen, d);
  return d;
}
