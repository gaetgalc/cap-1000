// Débrief d'une partie, comme le raconterait un entraîneur : 5 moments au plus, dans l'ordre de la partie.
// Sortie de l'ouverture, tournant (faute de l'adversaire), occasion manquée, faute décisive, fin.
// Calcul pur sur l'analyse (ev : centipions du point de vue des Blancs ; errs : erreurs du joueur). Testé dans tests/debrief.test.mjs.
import { winPct } from './classify.js';
import { fr } from './geom.js';
import { THEMES } from './stats.js';
import { HOW } from './ui.js';

const no = (ply) => Math.floor(ply / 2) + 1;
const ev1 = (cp) => (cp > 0 ? '+' : cp < 0 ? '−' : '') + Math.abs(cp / 100).toFixed(1).replace('.', ',');
const MISSED = new Set(['cadeau_rate', 'tactique_ratee', 'mat_rate']);

// g : { w, san, out, how } ; a : { ev, errs }. Renvoie [{ k, ply, title, text }] ; ply = position à montrer dans la relecture.
// o : { plan, name } facultatif, plan typique de l'ouverture jouée (theory.planOf), ajouté à la sortie de l'ouverture.
export function moments(g, a, o = {}) {
  const n = g.san.length, pov = (i) => (g.w ? a.ev[i] : -a.ev[i]), pct = (i) => Math.round(winPct(pov(i)));
  const mine = (i) => (i % 2 === 0) === g.w, serious = a.errs.filter((e) => e.kind !== 'imprecision' && e.theme);
  const out = [];
  // Sortie de l'ouverture : la position au 10e coup.
  const k0 = Math.min(20, n), c0 = pov(k0);
  out.push({ k: 'ouv', ply: k0, title: 'Sortie de l’ouverture', text: c0 >= 150 ? `Tu sors de l’ouverture avec l’avantage (${ev1(c0)}).` : c0 <= -150 ? `Tu sors de l’ouverture en difficulté (${ev1(c0)}) : c’est là qu’il faut regarder d’abord.` : `Position équilibrée après l’ouverture (${ev1(c0)}).` });
  if (o.plan) out[0].text += ` ${o.name}, le plan pour ton camp : ${o.plan}`;
  // Tournant : le coup adverse qui te fait passer au-dessus de 60 % de chances de gain, le plus coûteux pour lui.
  let tour = null, told = null;
  for (let i = 0; i < n; i++) {
    if (mine(i) || a.ev[i + 1] == null) continue;
    const before = pct(i), after = pct(i + 1);
    if (before < 60 && after >= 60 && after - before >= 20 && (!tour || after - before > tour.gain)) tour = { i, gain: after - before, before, after };
  }
  if (tour) {
    const reply = serious.find((e) => e.ply === tour.i + 1);
    // Ta réponse au cadeau est une erreur : elle est racontée ici, pas une seconde fois comme faute ou occasion manquée.
    told = reply || null;
    out.push({ k: 'tour', ply: tour.i + 1, title: 'Le tournant', text: `Coup ${no(tour.i)} : ton adversaire joue ${fr(g.san[tour.i])} et te donne l’avantage (${tour.before} % → ${tour.after} % de chances de gain). ${!reply ? 'Et tu en profites.' : `Mais tu ne le punis pas : ${fr(reply.played)} au lieu de ${fr(reply.bestSan)} (${THEMES[reply.theme]}), tes chances de gain passent de ${pct(reply.ply)} % à ${pct(reply.ply + 1)} %.`}` });
  }
  // Faute décisive : ta plus coûteuse ; occasion manquée : un gain que tu n'as pas vu, si c'est une autre erreur.
  const faute = serious.filter((e) => e !== told).sort((x, y) => y.drop - x.drop)[0];
  const rate = serious.filter((e) => MISSED.has(e.theme) && e !== faute && e !== told).sort((x, y) => y.drop - x.drop)[0];
  if (rate) out.push({ k: 'rate', ply: rate.ply, title: 'L’occasion manquée', text: `Coup ${no(rate.ply)} : ${fr(rate.bestSan)} gagnait (${THEMES[rate.theme]}). Tu as joué ${fr(rate.played)}.` });
  if (faute) out.push({ k: 'faute', ply: faute.ply, title: told && told.drop > faute.drop ? 'Une autre faute' : 'La faute décisive', text: `Coup ${no(faute.ply)} : ${fr(faute.played)} au lieu de ${fr(faute.bestSan)} (${THEMES[faute.theme]}). Tes chances de gain passent de ${pct(faute.ply)} % à ${pct(faute.ply + 1)} %.` });
  // Fin : résultat, et ce qu'elle dit de la partie.
  let best = 0; for (let i = 0; i <= n; i++) if (a.ev[i] != null) best = Math.max(best, pct(i));
  const res = g.out === 'W' ? 'Victoire' : g.out === 'L' ? 'Défaite' : 'Nulle', how = HOW[g.how] ? ` (${HOW[g.how]})` : '';
  const note = g.out !== 'W' && best >= 70 ? ` Tu as eu jusqu’à ${best} % de chances de gain : la partie était gagnable.` : g.out === 'W' && faute ? ' Gagnée malgré la faute : un adversaire plus solide l’aurait punie.' : '';
  out.push({ k: 'fin', ply: n, title: 'La fin', text: `${res}${how}.${note}` });
  return out.sort((x, y) => x.ply - y.ply);
}
