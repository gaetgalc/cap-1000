/* global Chess */
// Panneau « Réponses » commun à la relecture et à l'échiquier libre.
import { Engine } from '../engine.js';
import { fmtEval } from '../classify.js';
import { fr } from '../explain.js';
import { skel } from '../ui.js';
import { repliesHead, replyRows } from '../replies.js';
import { DEPTH, S } from '../state.js';

// ---------- Réponses aux coups adverses (20/11) : relecture et échiquier libre ----------
// Pour la position affichée, les 3 meilleurs coups du camp au trait (MultiPV), chacun avec la meilleure réponse de l'autre
// camp : « S'il joue e5, réponds Cf3 ». Lignes brutes du moteur gardées par position ; un seul calcul à la fois, toujours
// celui de la dernière position demandée (parcourir vite une partie n'empile pas les calculs).
const REP = new Map();
let repQ = null, repBusy = false;
async function repFetch(fen, done) {
  repQ = { fen, done };
  if (repBusy) return;
  repBusy = true;
  while (repQ && !REP.has(repQ.fen)) {
    const f = repQ.fen;
    try { S.play ||= new Engine(); REP.set(f, (await S.play.evalFen(f, DEPTH, false, 3)).lines); } catch { S.play = null; REP.set(f, false); }
    if (REP.size > 400) REP.delete(REP.keys().next().value);
  }
  repBusy = false;
  const q = repQ; repQ = null;
  if (q && REP.has(q.fen)) q.done();
}
// Lignes de la position, ou null en attendant le moteur (again est rappelée quand elles arrivent).
function repLines(fen, again) {
  if (REP.has(fen)) return REP.get(fen); // false : le moteur a échoué (pas de nouvel essai avant rechargement)
  if (new Chess(fen).game_over()) { REP.set(fen, []); return []; }
  repFetch(fen, again);
  return null;
}
function repCard(fen, me, lines) {
  const h = repliesHead(fen, me), head = `<h3>${h.title}</h3>`;
  if (lines === false) return `${head}<p class="small">Le moteur ne répond pas sur ce navigateur. Recharge la page pour réessayer.</p>`;
  if (lines && !lines.length) return `${head}<p class="small">Partie terminée : plus de coup à jouer.</p>`;
  if (!lines) return head + skel('Le moteur cherche les meilleurs coups', 92, 84, 76);
  const rows = replyRows(fen, lines, me);
  return `${head}<div class="replist">${rows.map((r) => `<button class="reprow" data-act="repplay" data-u="${r.uci}"><b>${fr(r.san)}</b><span class="repv">${r.reply ? `${h.reply} <b>${fr(r.reply.san)}</b>` : ''}</span><span class="num">${fmtEval(r.cp)}</span></button>`).join('')}</div>
    <p class="small">${h.who === 'opp' ? 'Ses 3 meilleurs coups et ta réponse. Il joue autre chose ? Joue-le sur l’échiquier : ta meilleure réponse s’affiche.' : 'Tes 3 meilleurs coups et sa meilleure réponse.'} Éval de ton point de vue ; touche une ligne pour la jouer.</p>`;
}

export { REP, repCard, repLines };
