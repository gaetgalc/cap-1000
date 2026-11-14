// Agrégations : bilan, ouvertures, gestion du temps, forces et faiblesses.
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
  const done = games.filter((g) => an[g.id]);
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
  const es = engineStats(games, an);
  if (es.n >= 5) {
    const perGame = es.gaffes / es.n;
    if (perGame >= 2.5) W('Trop de gaffes par partie', `${perGame.toFixed(1)} gaffes par partie en moyenne sur ${es.n} parties analysées. Une gaffe de moins par partie vaut environ 100 Elo à ce niveau.`, es.themes[0]?.id);
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
