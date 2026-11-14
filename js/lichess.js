// Puzzles inédits : API publique de Lichess (base de puzzles dans le domaine public), sans compte.
/* global Chess */
export const LI_ANGLES = [['hangingPiece', 'Pièce en prise'], ['fork', 'Fourchette'], ['pin', 'Clouage'], ['skewer', 'Enfilade'], ['discoveredAttack', 'Attaque à la découverte'], ['mateIn1', 'Mat en 1'], ['mateIn2', 'Mat en 2'], ['backRankMate', 'Mat du couloir'], ['endgame', 'Finale'], ['opening', 'Ouverture'], ['mix', 'Mélange']];
// Thème Lichess qui travaille chaque type d'erreur du joueur.
export const LI_FOR = { en_prise_pose: 'hangingPiece', en_prise_ignore: 'hangingPiece', cadeau_rate: 'hangingPiece', tactique_subie: 'fork', tactique_ratee: 'fork', mat_rate: 'mateIn2', mat_autorise: 'backRankMate', ouverture: 'opening', finale: 'endgame', plan: 'mix' };
export const LI_DIFF = [['easiest', 'Très facile'], ['easier', 'Facile'], ['normal', 'Moyen']];

function legal(fen, uci) {
  const c = new Chess(fen);
  return !!c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
}

export async function fetchPuzzle(angle, difficulty) {
  const q = new URLSearchParams({ difficulty });
  if (angle && angle !== 'mix') q.set('angle', angle);
  let r;
  try { r = await fetch('https://lichess.org/api/puzzle/next?' + q, { headers: { Accept: 'application/json' } }); }
  catch { throw new Error('Lichess ne répond pas. Vérifie ta connexion puis réessaie.'); }
  if (r.status === 429) throw new Error('Lichess limite les requêtes pour le moment. Attends une minute puis réessaie.');
  if (!r.ok) throw new Error('Lichess a répondu avec une erreur (' + r.status + ').');
  const d = await r.json();
  const sol = d?.puzzle?.solution, san = String(d?.game?.pgn || '').split(/\s+/).filter(Boolean);
  if (!Array.isArray(sol) || !sol.length || !san.length) throw new Error('Puzzle Lichess illisible. Réessaie.');
  // La position du puzzle suit le dernier coup adverse. Selon la version de l'API, le PGN
  // s'arrête à ce coup ou un demi-coup avant : on garde la coupe où la solution est légale.
  const ch = new Chess(), fens = [ch.fen()], mv = [];
  for (const s of san) { const m = ch.move(s, { sloppy: true }); if (!m) break; mv.push(m); fens.push(ch.fen()); }
  const ip = d.puzzle.initialPly;
  const cut = [mv.length, ip + 1, ip, ip + 2].find((k) => Number.isInteger(k) && k >= 1 && k <= mv.length && legal(fens[k], sol[0]));
  if (cut == null) throw new Error('Puzzle Lichess incohérent. Réessaie.');
  const last = mv[cut - 1];
  return {
    id: d.puzzle.id, rating: d.puzzle.rating, themes: d.puzzle.themes || [], sol,
    fen: fens[cut], prevFen: fens[cut - 1], last: [last.from, last.to], lastSan: last.san,
    white: fens[cut].split(' ')[1] === 'w', url: 'https://lichess.org/training/' + d.puzzle.id,
  };
}
