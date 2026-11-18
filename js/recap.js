// Bilan après un import (18/11, demande de Gaëtan : « à chaque fois que je charge des parties, une analyse claire de
// l'ensemble des parties sur mes points forts et faibles »). Calcul pur : la carte de l'accueil (recapCard, app.js)
// l'affiche une fois les nouvelles parties analysées.
import { signals } from './stats.js';

const ok = (an, g) => an[g.id] && !an[g.id].bad && an[g.id].errs;
const gaffes = (an, list) => list.reduce((n, g) => n + an[g.id].errs.filter((e) => e.kind === 'gaffe').length, 0);
const f1 = (x) => x.toFixed(1).replace('.', ',');
const plw = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

// games : parties de la cadence suivie ; an : analyses ; ids : parties arrivées depuis le dernier bilan.
// ready : faux tant qu'une nouvelle partie attend son analyse (une partie illisible, bad, compte comme faite).
export function importRecap(games, an, ids) {
  const set = new Set(ids), neu = games.filter((g) => set.has(g.id)), old = games.filter((g) => !set.has(g.id));
  const ready = neu.every((g) => an[g.id]);
  const out = { ready, forces: [], faiblesses: [], gone: [], batch: null };
  if (!ready) return out;
  const nA = neu.filter((g) => ok(an, g)), oA = old.filter((g) => ok(an, g));
  const c = { w: 0, d: 0, l: 0 }; for (const g of neu) c[g.out === 'W' ? 'w' : g.out === 'L' ? 'l' : 'd']++;
  const gpg = nA.length ? gaffes(an, nA) / nA.length : null, gpgBefore = oA.length ? gaffes(an, oA) / oA.length : null;
  const res = [c.w && plw(c.w, 'victoire'), c.d && plw(c.d, 'nulle'), c.l && plw(c.l, 'défaite')].filter(Boolean).join(', ');
  const text = `${neu.length > 1 ? `${neu.length} nouvelles parties` : '1 nouvelle partie'} : ${res}.`
    + (gpg != null ? ` ${f1(gpg)} gaffe${gpg >= 2 ? 's' : ''} par partie${gpgBefore != null ? `, contre ${f1(gpgBefore)} avant` : ''}.` : '');
  out.batch = { n: neu.length, ...c, gpg, gpgBefore, text };
  // Points forts et faibles de l'ensemble ; « nouveau » quand le signal n'existait pas sans les nouvelles parties.
  const now = signals(games, an), before = signals(old, an);
  const had = (arr) => new Set(arr.map((x) => x.t));
  const bF = had(before.forces), bW = had(before.faiblesses), nF = had(now.forces), nW = had(now.faiblesses);
  out.forces = now.forces.slice(0, 3).map((x) => ({ ...x, neu: old.length >= 10 && !bF.has(x.t) }));
  out.faiblesses = now.faiblesses.slice(0, 3).map((x) => ({ ...x, neu: old.length >= 10 && !bW.has(x.t) }));
  // Ce que l'import a fait disparaître : une faiblesse corrigée, ou une force perdue.
  out.gone = [...[...bW].filter((t) => !nW.has(t)), ...[...bF].filter((t) => !nF.has(t))];
  out.goneWeak = [...bW].filter((t) => !nW.has(t));
  return out;
}
