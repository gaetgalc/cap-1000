// Agrégations : bilan, ouvertures, gestion du temps, forces et faiblesses.
import { fr } from './explain.js';
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
export const score = (s) => (s.n ? Math.round((100 * (s.w + s.d / 2)) / s.n) : 0);
const blank = () => ({ n: 0, w: 0, d: 0, l: 0 });
const add = (s, g) => { s.n++; if (g.out === 'W') s.w++; else if (g.out === 'D') s.d++; else s.l++; return s; };
export const tally = (games) => games.reduce(add, blank());
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export function filterGames(games, f) {
  const min = f.days ? Date.now() / 1000 - f.days * 86400 : 0;
  return games.filter((g) => (f.tc === 'all' || g.tc === f.tc) && g.t >= min);
}

export function openings(games, white) {
  const map = new Map();
  for (const g of games) {
    if (g.w !== white) continue;
    let o = map.get(g.fam);
    if (!o) map.set(g.fam, (o = { fam: g.fam, ...blank(), vars: new Map() }));
    add(o, g);
    let v = o.vars.get(g.op);
    if (!v) o.vars.set(g.op, (v = { op: g.op, ...blank() }));
    add(v, g);
  }
  return [...map.values()].sort((a, b) => b.n - a.n);
}

// Arbre des coups réellement joués (pour l'explorateur), jusqu'à 14 demi-coups.
export function tree(games, white) {
  const root = { ...blank(), kids: new Map() };
  for (const g of games) {
    if (g.w !== white) continue;
    let node = add(root, g);
    for (let i = 0; i < Math.min(14, g.san.length); i++) {
      let k = node.kids.get(g.san[i]);
      if (!k) node.kids.set(g.san[i], (k = { ...blank(), kids: new Map() }));
      node = add(k, g);
    }
  }
  return root;
}

// Détail d'une ouverture jouée (famille Chess.com, une couleur) : tronc commun à toutes ses parties, suites jouées
// au moins deux fois (4 demi-coups après le tronc), variantes, usage dans le temps (par semaine sur moins de 10 semaines, par mois sur moins d'un an, sinon par trimestre).
export function famDetail(games, fam, white) {
  const mine = games.filter((g) => g.w === white).sort((a, b) => a.t - b.t);
  const gs = mine.filter((g) => g.fam === fam);
  const prefix = [];
  for (let i = 0; gs.length && i < 12; i++) { const s = gs[0].san[i]; if (!s || !gs.every((g) => g.san[i] === s)) break; prefix.push(s); }
  const n = Math.min(14, Math.max(6, prefix.length + 4)), m = new Map();
  for (const g of gs) { if (g.san.length < n) continue; const k = g.san.slice(0, n).join(' '); const r = m.get(k) || { san: g.san.slice(0, n), ...blank() }; add(r, g); m.set(k, r); }
  const lines = [...m.values()].filter((r) => r.n >= 2).sort((a, b) => b.n - a.n).slice(0, 5);
  const vars = [...(openings(gs, white)[0]?.vars.values() || [])].sort((a, b) => b.n - a.n);
  const mo = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const periods = { unit: 'mois', list: [] };
  if (gs.length) {
    const t0 = gs[0].t, t1 = mine[mine.length - 1].t, days = (t1 - t0) / 86400;
    periods.unit = days < 70 ? 'semaine' : days < 400 ? 'mois' : 'trimestre';
    // k : numéro de semaine (lundi) depuis 1970, ou numéro de mois (multiple de 3 pour un trimestre)
    const key = periods.unit === 'semaine' ? (t) => Math.floor((t / 86400 + 3) / 7) : periods.unit === 'mois' ? mo : (t) => mo(t) - (mo(t) % 3);
    const step = periods.unit === 'trimestre' ? 3 : 1, by = new Map();
    for (const g of mine) { const k = key(g.t); if (k < key(t0)) continue; const p = by.get(k) || { k, all: 0, ...blank() }; p.all++; if (g.fam === fam) add(p, g); by.set(k, p); }
    for (let k = key(t0); k <= key(t1); k += step) periods.list.push(by.get(k) || { k, all: 0, ...blank() });
  }
  return { games: gs, tally: tally(gs), prefix, lines, vars, periods };
}

export function timeStats(games) {
  const losses = games.filter((g) => g.out === 'L');
  const flag = losses.filter((g) => g.how === 'timeout').length;
  const left = [];
  for (const g of games) {
    if (!g.base || !g.clk.length || g.how === 'timeout') continue;
    const mine = g.clk.filter((_, i) => (i % 2 === 0) === g.w);
    if (mine.length) left.push({ out: g.out, p: Math.min(1, mine[mine.length - 1] / g.base) });
  }
  return {
    losses: losses.length, flag,
    leftLoss: median(left.filter((x) => x.out === 'L').map((x) => x.p)),
    leftAll: median(left.map((x) => x.p)),
  };
}

// Incrément d'une partie : connu à l'import (g.inc), sinon déduit de la pendule (le plus grand gain de temps entre
// deux coups d'un même camp, atteint quand un coup est joué sans réfléchir).
export function incOf(g) {
  if (g.inc != null) return g.inc;
  let inc = 0;
  for (let i = 2; i < g.clk.length; i++) inc = Math.max(inc, g.clk[i] - g.clk[i - 2]);
  return inc;
}
export const CLOCK_LEFT = [['Plus de 5 min', 300, Infinity], ['2 à 5 min', 120, 300], ['1 à 2 min', 60, 120], ['Moins de 1 min', 0, 60]];
export const CLOCK_THINK = [['Moins de 5 s', 0, 5], ['5 à 15 s', 5, 15], ['15 s à 1 min', 15, 60], ['Plus de 1 min', 60, Infinity]];
// Erreurs graves (erreurs et gaffes) selon la pendule : temps qui restait avant le coup, temps pris pour le jouer.
// Coups du joueur après le 8e coup seulement : l'ouverture se joue vite et sans erreur, elle fausserait les taux.
export function clockErrors(games, an) {
  const mk = (B) => B.map(([label, lo, hi]) => ({ label, lo, hi, n: 0, bad: 0 }));
  const left = mk(CLOCK_LEFT), think = mk(CLOCK_THINK);
  const put = (B, v, bad) => { const b = B.find((x) => v >= x.lo && v < x.hi); if (b) { b.n++; if (bad) b.bad++; } };
  let n = 0;
  for (const g of games) {
    const a = an[g.id];
    if (!a || a.bad || !g.base || g.tc === 'daily' || g.clk.length !== g.san.length) continue;
    const inc = incOf(g), errs = new Set(a.errs.filter((e) => e.kind !== 'imprecision').map((e) => e.ply));
    n++;
    for (let i = 16; i < g.clk.length; i++) {
      if ((i % 2 === 0) !== g.w) continue;
      const before = i >= 2 ? g.clk[i - 2] : g.base, bad = errs.has(i);
      put(left, before, bad);
      put(think, Math.max(0, before + inc - g.clk[i]), bad);
    }
  }
  const rate = (b) => (b.n ? b.bad / b.n : null);
  for (const b of [...left, ...think]) b.rate = rate(b);
  return { games: n, left, think };
}

// Même position, même faute : erreurs commises dans au moins deux parties différentes depuis une position identique.
// Renvoie les groupes, du plus fréquent au moins fréquent : { key, n, games, moves: [[san, n]], bestSan, drop, last: { g, e }, line, w }.
export function repeatedErrors(games, an) {
  const map = new Map();
  for (const g of games) {
    const a = an[g.id];
    if (!a || a.bad) continue;
    for (const e of a.errs) {
      if (!e.best) continue;
      const key = e.fen.split(' ').slice(0, 4).join(' ');
      let r = map.get(key);
      if (!r) map.set(key, (r = { key, n: 0, ids: new Set(), moves: new Map(), drop: 0, last: null }));
      r.n++; r.ids.add(g.id); r.drop += e.drop;
      r.moves.set(e.played, (r.moves.get(e.played) || 0) + 1);
      if (!r.last || g.t > r.last.g.t) r.last = { g, e };
    }
  }
  return [...map.values()].filter((r) => r.ids.size >= 2).map((r) => ({
    key: r.key, n: r.n, games: r.ids.size, drop: Math.round(r.drop / r.n), last: r.last, w: r.last.g.w, bestSan: r.last.e.bestSan,
    moves: [...r.moves].sort((x, y) => y[1] - x[1]), line: r.last.g.san.slice(0, r.last.e.ply),
  })).sort((x, y) => y.n - x.n || y.drop - x.drop);
}
// « tu as joué 6…Fg4 3 fois. Le bon coup : 6…Fe7. »
export function repText(r) {
  const p = r.line.length, mv = (s) => `${Math.floor(p / 2) + 1}${p % 2 ? '…' : '.'}${fr(s)}`, one = r.moves.length === 1;
  return `${one ? `tu as joué ${mv(r.moves[0][0])} ${r.n} fois` : `tu t’es trompé ${r.n} fois (${r.moves.map(([s, k]) => `${mv(s)}${k > 1 ? ' ×' + k : ''}`).join(', ')})`}. Le bon coup : ${mv(r.bestSan)}.`;
}
// Une suite de coups en notation française : « 1.e4 e5 2.Cf3 Cc6 ».
export const lineText = (san, from = 0) => san.slice(from).map((s, k) => { const i = from + k; return (i % 2 === 0 ? (i / 2 + 1) + '.' : (k === 0 ? Math.ceil(i / 2) + '…' : '')) + fr(s); }).join(' ');

export function habits(games) {
  let castled = blank(), notCastled = blank(), earlyQ = blank(), noEarlyQ = blank();
  for (const g of games) {
    const mine = g.san.filter((_, i) => (i % 2 === 0) === g.w);
    if (mine.length < 10) continue;
    const c = mine.slice(0, 12).some((s) => s.startsWith('O-O'));
    add(c ? castled : notCastled, g);
    const q = mine.slice(0, 6).some((s) => s[0] === 'Q' && !s.includes('x'));
    add(q ? earlyQ : noEarlyQ, g);
  }
  return { castled, notCastled, earlyQ, noEarlyQ };
}

export function tilt(games) {
  const afterL = blank(), afterW = blank();
  let streakMax = 0, cur = 0;
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    cur = g.out === 'L' ? cur + 1 : 0; streakMax = Math.max(streakMax, cur);
    if (i === 0) continue;
    const p = games[i - 1];
    if (g.t - p.t > 3600 || g.tc !== p.tc) continue;
    if (p.out === 'L') add(afterL, g); else if (p.out === 'W') add(afterW, g);
  }
  return { afterL, afterW, streakMax };
}

export function trend(games) {
  const rated = games.filter((g) => g.rated && g.r);
  if (!rated.length) return null;
  const cur = rated[rated.length - 1].r;
  const since = Date.now() / 1000 - 30 * 86400;
  const recent = rated.filter((g) => g.t >= since);
  let slope = null;
  if (recent.length >= 8) {
    const n = recent.length, mx = recent.reduce((a, g) => a + g.t, 0) / n, my = recent.reduce((a, g) => a + g.r, 0) / n;
    let num = 0, den = 0;
    for (const g of recent) { num += (g.t - mx) * (g.r - my); den += (g.t - mx) ** 2; }
    slope = den ? (num / den) * 86400 : null; // points par jour
  }
  return { cur, peak: Math.max(...rated.map((g) => g.r)), recent: recent.length, delta30: recent.length ? cur - recent[0].r : null, slope };
}

export const THEMES = {
  en_prise_pose: 'Pièce posée en prise',
  en_prise_ignore: 'Menace ignorée',
  cadeau_rate: 'Cadeau non pris',
  mat_autorise: 'Mat encaissé',
  mat_rate: 'Mat raté',
  tactique_subie: 'Tactique subie',
  tactique_ratee: 'Tactique ratée',
  ouverture: 'Erreur d’ouverture',
  plan: 'Mauvais coup en milieu de partie',
  finale: 'Erreur de finale',
};

// Synthèse des analyses moteur pour un ensemble de parties.
export function engineStats(games, an) {
  const done = games.filter((g) => an[g.id] && !an[g.id].bad);
  const themes = {}; const phases = { ouverture: 0, milieu: 0, finale: 0 };
  let gaffes = 0, erreurs = 0, accSum = 0, accN = 0, ahead = 0, converted = 0, behind = 0, saved = 0;
  for (const g of done) {
    const a = an[g.id];
    if (a.acc != null) { accSum += a.acc; accN++; }
    for (const e of a.errs) {
      if (e.kind === 'gaffe') gaffes++; else if (e.kind === 'erreur') erreurs++;
      if (e.theme) {
        const t = (themes[e.theme] ||= { n: 0, drop: 0 });
        t.n++; t.drop += e.drop; phases[e.ph]++;
      }
    }
    if (a.maxAdv >= 500) { ahead++; if (g.out === 'W') converted++; }
    const worst = Math.min(...a.ev.map((v) => (g.w ? v : -v)));
    if (worst <= -500) { behind++; if (g.out !== 'L') saved++; }
  }
  const ranked = Object.entries(themes).map(([id, t]) => ({ id, ...t })).sort((a, b) => b.drop - a.drop);
  return { n: done.length, gaffes, erreurs, acc: accN ? accSum / accN : null, ahead, converted, behind, saved, themes: ranked, phases };
}

// Forces et faiblesses, chacune avec sa preuve chiffrée.
export function signals(games, an) {
  const out = { forces: [], faiblesses: [] };
  const F = (t, d) => out.forces.push({ t, d }), W = (t, d, lesson) => out.faiblesses.push({ t, d, lesson });
  if (games.length < 10) return out;
  const wh = tally(games.filter((g) => g.w)), bl = tally(games.filter((g) => !g.w));
  if (wh.n >= 8 && bl.n >= 8) {
    const dlt = score(wh) - score(bl);
    if (dlt >= 8) { F('Tu marques bien avec les Blancs', `${score(wh)} % de score, contre ${score(bl)} % avec les Noirs.`); W('Tes parties avec les Noirs', `${score(bl)} % de score sur ${bl.n} parties. Ton répertoire noir est à consolider.`, 'ouvertures'); }
    else if (dlt <= -8) { F('Tu marques bien avec les Noirs', `${score(bl)} % de score, contre ${score(wh)} % avec les Blancs.`); W('Tes parties avec les Blancs', `${score(wh)} % de score sur ${wh.n} parties malgré l’avantage du trait.`, 'ouvertures'); }
  }
  const up = tally(games.filter((g) => g.or - g.r >= 40)), down = tally(games.filter((g) => g.r - g.or >= 40));
  if (up.n >= 8 && score(up) >= 42) F('Tu tiens tête aux mieux classés', `${score(up)} % de score face aux adversaires à +40 Elo ou plus (${up.n} parties).`);
  if (down.n >= 8 && score(down) < 55) W('Points perdus contre les moins bien classés', `${score(down)} % de score seulement face aux adversaires à −40 Elo ou moins (${down.n} parties).`, 'tilt');
  const ts = timeStats(games);
  if (ts.losses >= 8) {
    const p = pct(ts.flag, ts.losses);
    if (p >= 25) W('Tu perds au temps', `${p} % de tes défaites se terminent à la pendule (${ts.flag} sur ${ts.losses}).`, 'temps');
    else if (p <= 8) F('Tu ne perds presque jamais au temps', `${p} % de tes défaites seulement à la pendule.`);
    if (ts.leftLoss != null && ts.leftLoss >= 0.5) W('Tu joues trop vite', `Dans une défaite type, il te reste ${Math.round(ts.leftLoss * 100)} % de ton temps à la fin. Ce temps aurait pu servir à vérifier tes coups.`, 'temps');
  }
  const losses = games.filter((g) => g.out === 'L');
  const short = losses.filter((g) => g.san.length <= 40).length;
  if (losses.length >= 8 && pct(short, losses.length) >= 30) W('Défaites rapides', `${pct(short, losses.length)} % de tes défaites arrivent avant le 20e coup : la partie se joue dès l’ouverture.`, 'principes');
  const h = habits(games);
  if (h.castled.n >= 8 && h.notCastled.n >= 8 && score(h.castled) - score(h.notCastled) >= 8) W('Roi laissé au centre', `${score(h.notCastled)} % de score quand tu ne roques pas dans les 12 premiers coups, contre ${score(h.castled)} % quand tu roques.`, 'principes');
  if (h.castled.n + h.notCastled.n >= 15 && pct(h.castled.n, h.castled.n + h.notCastled.n) >= 75) F('Tu mets ton roi à l’abri', `Tu roques tôt dans ${pct(h.castled.n, h.castled.n + h.notCastled.n)} % de tes parties.`);
  if (h.earlyQ.n >= 8 && score(h.noEarlyQ) - score(h.earlyQ) >= 8) W('Dame sortie trop tôt', `${score(h.earlyQ)} % de score quand ta dame sort avant le 7e coup, contre ${score(h.noEarlyQ)} % sinon.`, 'principes');
  const tl = tilt(games);
  if (tl.afterL.n >= 8 && tl.afterW.n >= 8 && score(tl.afterW) - score(tl.afterL) >= 10) W('Tilt après une défaite', `${score(tl.afterL)} % de score dans la partie qui suit une défaite, contre ${score(tl.afterW)} % après une victoire.`, 'tilt');
  else if (tl.afterL.n >= 8 && score(tl.afterL) >= 50) F('Tu rebondis après une défaite', `${score(tl.afterL)} % de score dans la partie qui suit une défaite.`);
  for (const white of [true, false]) {
    const ops = openings(games, white).filter((o) => o.n >= 5);
    const side = white ? 'Blancs' : 'Noirs';
    const best = [...ops].sort((a, b) => score(b) - score(a))[0];
    const worst = [...ops].sort((a, b) => score(a) - score(b))[0];
    if (best && score(best) >= 58) F(`${best.fam} (${side})`, `${score(best)} % de score sur ${best.n} parties.`);
    if (worst && worst !== best && score(worst) <= 40) W(`${worst.fam} (${side})`, `${score(worst)} % de score sur ${worst.n} parties.`, 'ouvertures');
  }
  const ce = clockErrors(games, an), [lA, lB, , lD] = ce.left, [tA, , tC, tD] = ce.think;
  const calm = { n: lA.n + lB.n, bad: lA.bad + lB.bad }, slow = { n: tC.n + tD.n, bad: tC.bad + tD.bad };
  if (lD.n >= 30 && calm.n >= 30 && lD.rate >= 2 * (calm.bad / calm.n) && lD.bad >= 4) W('Tu craques à la pendule', `Avec moins d’une minute, ${pct(lD.bad, lD.n)} % de tes coups sont des erreurs graves, contre ${pct(calm.bad, calm.n)} % quand il te reste plus de 2 minutes.`, 'temps');
  if (tA.n >= 40 && slow.n >= 40 && tA.rate >= 2 * (slow.bad / slow.n) && tA.bad >= 4) W('Coups joués trop vite', `${pct(tA.bad, tA.n)} % de tes coups joués en moins de 5 secondes sont des erreurs graves, contre ${pct(slow.bad, slow.n)} % quand tu prends plus de 15 secondes.`, 'temps');
  const rep = repeatedErrors(games, an)[0];
  if (rep && rep.n >= 3) W('La même erreur, encore et encore', `Après ${lineText(rep.line, Math.max(0, rep.line.length - 4))}, ${repText(rep)}`, 'ouvertures');
  const es = engineStats(games, an);
  if (es.n >= 5) {
    const perGame = es.gaffes / es.n;
    if (perGame >= 2.5) W('Trop de gaffes par partie', `${perGame.toFixed(1)} gaffes par partie en moyenne sur ${es.n} parties analysées.`, es.themes[0]?.id);
    else if (perGame <= 1.2) F('Peu de gaffes', `${perGame.toFixed(1)} gaffe par partie en moyenne sur ${es.n} parties analysées.`);
    const top = es.themes[0];
    if (top && top.n >= 3) W(THEMES[top.id], `${top.n} occurrences sur ${es.n} parties analysées. C’est ton erreur la plus coûteuse.`, top.id);
    if (es.ahead >= 5) {
      const c = pct(es.converted, es.ahead);
      if (c >= 80) F('Tu convertis tes avantages', `${c} % de victoires quand tu as eu au moins +5 d’avantage.`);
      else if (c < 65) W('Avantages gâchés', `Tu ne gagnes que ${c} % des parties où tu as eu au moins +5 d’avantage (${es.ahead} parties).`, 'conversion');
    }
    if (es.behind >= 5 && pct(es.saved, es.behind) >= 30) F('Tu te bats jusqu’au bout', `${pct(es.saved, es.behind)} % de parties sauvées après avoir été à −5 ou pire.`);
    const totPh = es.phases.ouverture + es.phases.milieu + es.phases.finale;
    if (totPh >= 10 && es.phases.ouverture / totPh <= 0.12) F('Sorties d’ouverture propres', `Seulement ${pct(es.phases.ouverture, totPh)} % de tes erreurs graves arrivent dans les 10 premiers coups.`);
  }
  return out;
}

// Évolution des erreurs graves par partie : 10 dernières parties analysées contre les 10 précédentes.
export function themeTrend(games, an) {
  const done = games.filter((g) => an[g.id] && !an[g.id].bad).sort((a, b) => a.t - b.t);
  const cur = done.slice(-10), prev = done.slice(-20, -10);
  const rate = (list, id) => (list.length ? list.reduce((n, g) => n + an[g.id].errs.filter((e) => e.theme === id).length, 0) / list.length : null);
  const rows = Object.keys(THEMES).map((id) => ({ id, now: rate(cur, id), before: prev.length >= 5 ? rate(prev, id) : null })).filter((r) => r.now || r.before).sort((a, b) => (b.now || 0) - (a.now || 0));
  return { rows, nCur: cur.length, nPrev: prev.length, done };
}
// Taux d'un type d'erreur par paquets de 5 parties analysées (pour la courbe du chantier).
export function themeSeries(done, an, id, size = 5) {
  const out = [];
  for (let i = 0; i + size <= done.length; i += size) {
    const b = done.slice(i, i + size);
    out.push({ t: b[b.length - 1].t, y: b.reduce((n, g) => n + an[g.id].errs.filter((e) => e.theme === id).length, 0) / size });
  }
  return out;
}
