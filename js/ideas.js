// Exercices de plan : sur une position calme de tes parties, choisir la bonne idée parmi trois.
// La bonne idée est l'intention du meilleur coup (plan.js) ; les autres : ton coup en partie, et un coup plausible
// que le moteur doit confirmer comme moins bon (check). Calcul pur, testé dans tests/ideas.test.mjs.
/* global Chess */
import { intent } from './plan.js';
import { poss, play } from './geom.js';

const VERB = { prépare: 'Préparer', enferme: 'Enfermer', bloque: 'Bloquer', installe: 'Installer', place: 'Placer', rapproche: 'Rapprocher', attaque: 'Attaquer', active: 'Activer' };
// « Ce coup installe ton cavalier… » → « Installer ton cavalier… »
const infinitive = (t) => t.replace(/^Ce coup (\S+)/, (_, v) => VERB[v] || v);
// Coup décrit sans idée : « Jouer ta dame en c7. », « Roquer côté roi. »
const plain = (m, me) => (m.flags.includes('k') ? 'Roquer côté roi.' : m.flags.includes('q') ? 'Roquer côté dame.' : `Jouer ${poss(m.piece, m.color, me)} en ${m.to}.`);
const CALM = new Set(['plan', 'ouverture', 'finale']);

// Positions retenues : ton coup, après le 8e coup, position pas encore décidée, erreur calme (imprécision ou erreur de plan),
// et une intention nette pour le meilleur coup.
export function ideaPositionsOf(g, a) {
  const out = [];
  if (!a || a.bad || !a.errs) return out;
  const me = g.w ? 'w' : 'b';
  for (const e of a.errs) {
    if (!e.best || !e.fen || e.ply < 16 || Math.abs(e.e0) >= 400) continue;
    if (e.kind !== 'imprecision' && !CALM.has(e.theme)) continue;
    // Le meilleur coup doit être calme : une prise ou un échec relève de la tactique, pas d'un plan.
    const m = play(new Chess(e.fen), e.best);
    if (!m || m.captured || /[+#]/.test(m.san)) continue;
    if (!intent(e.fen, e.line?.length ? e.line : [e.best], me)) continue;
    out.push({ id: g.t + ':' + e.ply, g, e });
  }
  return out;
}
export const ideaPositions = (games, an) => games.flatMap((g) => ideaPositionsOf(g, an[g.id]));

// Trois choix { mv, san, k, text, good, check }, dans un ordre stable (par coup).
export function ideaChoices(fen, e, me) {
  const best = intent(fen, e.line?.length ? e.line : [e.best], me);
  const c = [{ mv: e.best, k: best?.k, text: infinitive(best?.text || ''), good: true }];
  if (e.playedUci && e.playedUci !== e.best) {
    const it = intent(fen, [e.playedUci, ...(e.punish || [])], me), m = play(new Chess(fen), e.playedUci);
    const t = it ? infinitive(it.text) : '';
    c.push({ mv: e.playedUci, k: it?.k, text: t && t !== c[0].text ? t : plain(m, me) });
  }
  const used = new Set(c.map((x) => x.mv.slice(0, 4)));
  for (const m of new Chess(fen).moves({ verbose: true }).sort((a, b) => (a.from + a.to < b.from + b.to ? -1 : 1))) {
    if (c.length >= 3) break;
    const uci = m.from + m.to + (m.promotion || '');
    if (used.has(uci.slice(0, 4)) || m.captured) continue;
    const it = intent(fen, [uci], me);
    if (it && it.k !== best?.k && !c.some((x) => x.text === infinitive(it.text))) c.push({ mv: uci, k: it.k, text: infinitive(it.text), check: true });
  }
  // Aucun autre coup à l'idée nette : un coup de pièce calme, décrit simplement.
  const quiet = new Chess(fen).moves({ verbose: true }).filter((m) => m.piece !== 'p' && m.piece !== 'k' && !m.captured && !used.has(m.from + m.to)).sort((a, b) => (a.from + a.to < b.from + b.to ? -1 : 1));
  for (const m of quiet) { if (c.length >= 3) break; if (c.some((x) => x.mv.slice(0, 4) === m.from + m.to)) continue; c.push({ mv: m.from + m.to, text: plain(m, me), check: true }); }
  for (const x of c) { x.san = play(new Chess(fen), x.mv)?.san; x.good = !!x.good; }
  return c.sort((a, b) => (a.mv < b.mv ? -1 : 1));
}

// Parcours paresseux (17/11) : on ne calcule les positions d'une partie que quand on y arrive, de la plus récente à la plus
// ancienne, au lieu de toutes les parties à chaque rendu. `of(g)` rend les positions d'une partie (ideaPositionsOf, gardé
// par l'appelant). L'ordre est celui d'avant : parties récentes d'abord, puis plus tard dans la partie d'abord.
export function* ideaWalk(games, of) {
  for (const g of [...games].sort((a, b) => b.t - a.t)) yield* [...of(g)].sort((a, b) => b.e.ply - a.e.ply);
}
// Retrouve une position par son identifiant « fin:coup » sans parcourir les autres parties.
export function ideaFind(games, of, id) {
  const t = +String(id).split(':')[0];
  for (const g of games) if (g.t === t) { const p = of(g).find((x) => x.id === id); if (p) return p; }
  return null;
}
// Position à montrer : la mémorisée si elle existe encore, sinon la première pas encore faite (à défaut, la première).
export function ideaStart(games, of, cur, done) {
  const keep = cur ? ideaFind(games, of, cur) : null;
  if (keep) return keep;
  let first = null;
  for (const p of ideaWalk(games, of)) { first ||= p; if (!done.has(p.id)) return p; }
  return first;
}
// Position suivante après `cur` : la première pas encore faite après elle, puis avant elle ; à défaut la suivante ou la première.
export function ideaFollow(games, of, cur, done) {
  const known = cur ? ideaFind(games, of, cur) : null;
  let seen = !known, after = null, first = null, before = null;
  for (const p of ideaWalk(games, of)) {
    first ||= p;
    if (seen) { after ||= p; if (!done.has(p.id)) return p; }
    else if (p.id === cur) seen = true;
    else before ||= !done.has(p.id) ? p : null;
  }
  return before || after || first;
}
