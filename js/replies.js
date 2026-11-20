// Réponses aux coups adverses (20/11) : les meilleurs coups du camp au trait (MultiPV du moteur), chacun suivi de la
// meilleure réponse de l'autre camp (2e coup de la ligne). Calcul pur, sans moteur ni DOM : testable sans navigateur.
/* global Chess */

// fen : position ; lines : [{ cp, pv }] du moteur, cp du point de vue du camp au trait ; me : 'w' | 'b' (le joueur).
// Renvoie [{ uci, san, from, to, reply: { uci, san } | null, cp }] avec cp du point de vue du joueur.
export function replyRows(fen, lines, me) {
  const turn = fen.split(' ')[1], sign = turn === me ? 1 : -1, rows = [];
  for (const l of lines || []) {
    const [u, r] = l.pv || [];
    if (!u) continue;
    const ch = new Chess(fen), m = play(ch, u);
    if (!m) continue;
    const rm = r ? play(ch, r) : null;
    rows.push({ uci: u, san: m.san, from: m.from, to: m.to, reply: rm ? { uci: r, san: rm.san } : null, cp: sign * l.cp });
  }
  return rows;
}
const play = (ch, u) => { try { return ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { return null; } };

// Titre de la carte et verbe de la réponse selon le camp au trait.
export function repliesHead(fen, me) {
  return fen.split(' ')[1] === me
    ? { who: 'me', title: 'Si tu joues…', reply: 'il répond' }
    : { who: 'opp', title: 'S’il joue…', reply: 'réponds' };
}
