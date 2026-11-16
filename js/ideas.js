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
export function ideaPositions(games, an) {
  const out = [];
  for (const g of games) {
    const a = an[g.id]; if (!a || a.bad || !a.errs) continue;
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
  }
  return out;
}

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
