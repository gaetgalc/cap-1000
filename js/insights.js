// Regards croisés sur les parties, à la manière des « Insights » de Chess.com : précision par phase, fautes par pièce,
// score selon l'heure et selon le rang de la partie dans la session, Elo estimé d'une partie. Calcul pur, sans moteur.
/* global Chess */
import { winPct, phase, replay } from './classify.js';

const blank = () => ({ n: 0, w: 0, d: 0, l: 0 });
const add = (s, g) => { s.n++; if (g.out === 'W') s.w++; else if (g.out === 'D') s.d++; else s.l++; };
const score = (s) => (s.n ? Math.round((100 * (s.w + s.d / 2)) / s.n) : 0);
const ok = (a) => a && !a.bad;

export const PHASES = [['ouverture', 'Ouverture'], ['milieu', 'Milieu de partie'], ['finale', 'Finale']];
// Précision (100 moins la perte moyenne de chances de gain) et fautes graves (10 points ou plus), par phase de jeu.
// Contribution d'une partie (par phase : coups, perte, fautes graves), gardée sur l'objet analyse : une reprise du calcul
// après un changement de données ne refait que les parties dont l'analyse a changé.
const PH = new WeakMap();
function tally(g, a) {
  const r = replay(g); if (!r) return null;
  const by = {}, pov = (cp) => (g.w ? cp : -cp);
  for (let j = 0; j < r.mv.length && j + 1 < a.ev.length; j++) {
    if ((j % 2 === 0) !== g.w) continue;
    const d = Math.max(0, winPct(pov(a.ev[j])) - winPct(pov(a.ev[j + 1]))), k = phase(r.fens[j], j), b = (by[k] ||= [k, 0, 0, 0]);
    b[1]++; b[2] += d; if (d >= 10) b[3]++;
  }
  return Object.values(by);
}
export function phaseStats(games, an) {
  const job = phaseJob(games, an);
  job.step(Infinity);
  return job.result();
}
// Même calcul, par tranches (17/11) : step(ms) traite des parties tant qu'il reste du temps (au moins une), rend true quand
// tout est fait. La phase demande de rejouer chaque partie : sur des milliers de parties, c'est trop long pour un seul rendu.
export function phaseJob(games, an) {
  const by = Object.fromEntries(PHASES.map(([k, label]) => [k, { k, label, n: 0, drop: 0, bad: 0 }]));
  let i = 0;
  const one = (g) => {
    const a = an[g.id];
    if (!ok(a) || !a.ev) return;
    let t = PH.get(a);
    if (!t) { t = tally(g, a); if (t) PH.set(a, t); }
    for (const [k, n, drop, bad] of t || []) { const b = by[k]; b.n += n; b.drop += drop; b.bad += bad; }
  };
  return {
    get done() { return i >= games.length; },
    step(ms, now = () => performance.now()) {
      const t0 = now();
      for (let n = 0; i < games.length && (n === 0 || now() - t0 < ms); n++) one(games[i++]);
      return i >= games.length;
    },
    result: () => Object.values(by).map((b) => ({ k: b.k, label: b.label, n: b.n, bad: b.bad, acc: b.n ? Math.round(100 - b.drop / b.n) : null, rate: b.n ? b.bad / b.n : null })),
  };
}

export const PIECE = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const pieceOf = (san) => (san.startsWith('O-O') ? 'k' : 'NBRQK'.includes(san[0]) ? san[0].toLowerCase() : 'p');
// Fautes graves (erreurs et gaffes) selon la pièce jouée, rapportées au nombre de coups de cette pièce. Plus fautive d'abord.
export function pieceStats(games, an) {
  const by = Object.fromEntries(Object.keys(PIECE).map((p) => [p, { p, name: PIECE[p], moves: 0, bad: 0 }]));
  for (const g of games) {
    const a = an[g.id];
    if (!ok(a)) continue;
    g.san.forEach((s, i) => { if ((i % 2 === 0) === g.w) by[pieceOf(s)].moves++; });
    for (const e of a.errs || []) if (e.kind !== 'imprecision' && e.played) by[pieceOf(e.played)].bad++;
  }
  return Object.values(by).map((x) => ({ ...x, rate: x.moves ? x.bad / x.moves : 0 })).sort((x, y) => y.rate - x.rate || y.bad - x.bad);
}

export const HOURS = [['matin', 'Le matin (6 h - 12 h)', 6, 12], ['aprem', 'L’après-midi (12 h - 18 h)', 12, 18], ['soir', 'Le soir (18 h - 22 h)', 18, 22], ['nuit', 'La nuit (22 h - 6 h)', 22, 30]];
const localHour = (t) => new Date(t * 1000).getHours();
// Score selon l'heure de fin de la partie. hourOf : heure locale (injectée dans les tests).
export function hourStats(games, hourOf = localHour) {
  const by = HOURS.map(([k, label, lo, hi]) => ({ k, label, lo, hi, ...blank() }));
  for (const g of games) { const h = hourOf(g.t), hh = h < 6 ? h + 24 : h; add(by.find((b) => hh >= b.lo && hh < b.hi), g); }
  return by.map((b) => ({ k: b.k, label: b.label, n: b.n, score: score(b) }));
}

// Rang de la partie dans la session : une pause de plus d'une heure entre deux fins de partie ouvre une nouvelle session.
export function sessionStats(games, gap = 3600) {
  const by = [1, 2, 3].map((k) => ({ k, label: k === 1 ? '1re partie' : k === 2 ? '2e partie' : '3e partie et suivantes', ...blank() }));
  let rank = 0, prev = null;
  for (const g of [...games].sort((a, b) => a.t - b.t)) {
    rank = prev && g.t - prev.t <= gap ? rank + 1 : 1; prev = g;
    add(by[Math.min(3, rank) - 1], g);
  }
  return by.map((b) => ({ k: b.k, label: b.label, n: b.n, score: score(b) }));
}

// Elo estimé d'une partie : repère personnel. Ta précision moyenne vaut ton classement moyen (30 dernières parties analysées) ;
// chaque point de précision en plus ou en moins vaut 25 points d'Elo, dans la limite de 400. Pas d'estimation sous 10 parties.
export const ELO_PER_ACC = 25, ELO_SPAN = 400, REF_MIN = 10;
export function perfRef(games, an) {
  const l = games.filter((g) => ok(an[g.id]) && an[g.id].acc != null && g.r).sort((a, b) => b.t - a.t).slice(0, 30);
  if (!l.length) return { elo: null, acc: null, n: 0 };
  const m = (f) => l.reduce((s, g) => s + f(g), 0) / l.length;
  return { elo: Math.round(m((g) => g.r)), acc: Math.round(m((g) => an[g.id].acc) * 10) / 10, n: l.length };
}
export function gameRating(acc, ref) {
  if (acc == null || !ref || ref.n < REF_MIN) return null;
  const d = Math.max(-ELO_SPAN, Math.min(ELO_SPAN, (acc - ref.acc) * ELO_PER_ACC));
  return Math.round((ref.elo + d) / 10) * 10;
}

// Phrases à retenir : seulement les écarts nets (au moins 8 parties de chaque côté et 12 points de score, ou une phase
// nettement plus fautive). Au plus 3, de la plus utile à la moins utile.
export function insightText({ sessions = [], hours = [], phases = [], pieces = [] }) {
  const out = [], enough = (x) => x && x.n >= 8;
  const s1 = sessions[0], s3 = sessions[2];
  if (enough(s1) && enough(s3) && s1.score - s3.score >= 12) out.push(`Tu marques ${s1.score} % sur la première partie d’une session, ${s3.score} % à partir de la 3e partie d’affilée : arrête-toi après deux parties.`);
  const hs = hours.filter(enough).sort((a, b) => b.score - a.score);
  if (hs.length >= 2 && hs[0].score - hs[hs.length - 1].score >= 12) out.push(`${hs[0].label.split(' (')[0]}, tu marques ${hs[0].score} % ; ${hs[hs.length - 1].label.split(' (')[0].toLowerCase()}, ${hs[hs.length - 1].score} %. Joue tes parties classées aux heures où tu es frais.`);
  const ps = phases.filter((p) => p.n >= 40 && p.rate != null).sort((a, b) => b.rate - a.rate);
  if (ps.length >= 2 && ps[0].rate >= 1.5 * ps[ps.length - 1].rate && ps[0].rate > 0) out.push(`${ps[0].label} : une faute grave tous les ${Math.round(1 / ps[0].rate)} coups, contre une tous les ${ps[ps.length - 1].rate ? Math.round(1 / ps[ps.length - 1].rate) : '∞'} en ${ps[ps.length - 1].label.toLowerCase()}. C’est la phase à travailler.`);
  const pc = pieces.filter((p) => p.moves >= 30 && p.bad >= 3);
  if (pc.length >= 2 && pc[0].rate >= 1.5 * pc[pc.length - 1].rate) { const f = 'rq'.includes(pc[0].p); out.push(`${f ? 'Ta' : 'Ton'} ${pc[0].name} est la pièce la plus fautive : une faute grave tous les ${Math.round(1 / pc[0].rate)} coups de ${pc[0].name}. Avant de ${f ? 'la' : 'le'} jouer, vérifie la case d’arrivée.`); }
  return out.slice(0, 3);
}
