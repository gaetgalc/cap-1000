// Page « Stats » : toutes les données depuis la première partie, sans filtre de période.
import { tally, score, pct, clockErrors } from './stats.js';
import { esc, dfmt, datef, TC, HOW, wdl, WDL_LEGEND } from './ui.js';
import { lineChart } from './charts.js';
import { fr } from './explain.js';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const SLOTS = [['Nuit (0 h à 6 h)', 0, 6], ['Matin (6 h à 12 h)', 6, 12], ['Après-midi (12 h à 18 h)', 12, 18], ['Soir (18 h à 24 h)', 18, 24]];
const NF = new Intl.NumberFormat('fr-FR');
const nf = (n) => NF.format(Math.round(n));

function streaks(games) {
  let w = 0, l = 0, bw = 0, bl = 0;
  for (const g of games) {
    w = g.out === 'W' ? w + 1 : 0; l = g.out === 'L' ? l + 1 : 0;
    bw = Math.max(bw, w); bl = Math.max(bl, l);
  }
  return { bw, bl };
}
function duration(g) {
  if (!g.base || g.clk.length < 2 || g.tc === 'daily') return 0;
  const lw = g.clk[g.clk.length - 1 - ((g.clk.length - 1) % 2)], lb = g.clk[g.clk.length - 1 - (g.clk.length % 2)];
  return Math.max(0, g.base - (lw ?? g.base)) + Math.max(0, g.base - (lb ?? g.base));
}

// Erreurs graves selon la pendule : temps restant avant le coup, temps pris pour le jouer (parties analysées).
function clockCard(gs, an) {
  const ce = clockErrors(gs, an);
  if (!ce.games) return '';
  const max = Math.max(0.01, ...[...ce.left, ...ce.think].map((b) => b.rate || 0));
  const rows = (B) => B.map((b) => `<div class="hbar"><span>${b.label}</span><span class="track"><i style="width:${b.n ? (100 * b.rate) / max : 0}%;background:var(--bad)"></i></span><span class="v" style="white-space:nowrap">${b.n ? pct(b.bad, b.n) + ' %' : '—'} <span class="small">${nf(b.n)} coups</span></span></div>`).join('');
  return `<div class="card"><h2>Tes erreurs et la pendule <span class="small">${ce.games} parties analysées</span></h2>
    <h3>Selon le temps qui te restait</h3>${rows(ce.left)}
    <h3>Selon le temps pris pour jouer</h3>${rows(ce.think)}
    <p class="small">Part de tes coups qui sont des erreurs ou des gaffes, à partir du 9e coup. Si la barre grandit vers le bas, c’est la pendule ou la vitesse qui te coûte des points, pas la tactique.</p></div>`;
}

export function viewStats(S) {
  const all = S.data.games;
  if (!all.length) return '<h1>Stats</h1><div class="card"><p class="sub">Aucune partie importée.</p></div>';
  const has = [...new Set(all.map((g) => g.tc))];
  const sel = S.statTc && (S.statTc === 'all' || has.includes(S.statTc)) ? S.statTc : 'all';
  const gs = sel === 'all' ? all : all.filter((g) => g.tc === sel);
  const T = tally(gs), first = gs[0], last = gs[gs.length - 1];
  const tbl = (head, rows) => `<div class="scroll"><table><thead><tr>${head.map((x, i) => `<th class="${i && i !== 2 ? 'r' : ''}">${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const row = (label, s, extra = '') => (s.n ? `<tr><td>${label}</td><td class="r">${nf(s.n)}</td><td style="min-width:100px">${wdl(s)}</td><td class="r"><b>${score(s)} %</b></td>${extra}</tr>` : '');
  const group = (keyFn) => { const m = new Map(); for (const g of gs) { const k = keyFn(g); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(g); } return m; };
  const link = (g, txt) => (g ? `<a href="#partie/${g.t}">${txt}</a>` : '—');

  // Tuiles
  const myMoves = gs.reduce((a, g) => a + Math.ceil((g.san.length - (g.w ? 0 : 1)) / 2), 0);
  const secs = gs.reduce((a, g) => a + duration(g), 0);
  const dayset = new Set(gs.map((g) => new Date(g.t * 1000).toDateString()));
  const tiles = [
    [nf(T.n), 'parties jouées'], [score(T) + ' %', 'de score global'], [nf(T.w), 'victoires'],
    [secs ? nf(secs / 3600) + ' h' : '—', 'de jeu, environ'], [nf(myMoves), 'coups joués'], [nf(dayset.size), 'jours avec au moins une partie'],
  ].map(([v, l]) => `<div class="tile"><b class="num">${v}</b><span>${l}</span></div>`).join('');

  // Par cadence (toujours toutes les cadences)
  const cad = ['rapid', 'blitz', 'bullet', 'daily'].filter((k) => has.includes(k)).map((k) => {
    const g = all.filter((x) => x.tc === k), r = g.filter((x) => x.rated && x.r);
    const peak = r.reduce((a, x) => (!a || x.r > a.r ? x : a), null), low = r.reduce((a, x) => (!a || x.r < a.r ? x : a), null);
    return row(TC[k], tally(g), `<td class="r">${r.length ? r[r.length - 1].r : '—'}</td><td class="r">${peak ? `${peak.r} <span class="small">${dfmt(peak.t)}</span>` : '—'}</td><td class="r">${low ? low.r : '—'}</td>`);
  });

  // Activité par mois et par année
  const byMonth = group((g) => { const d = new Date(g.t * 1000); return d.getFullYear() * 12 + d.getMonth(); });
  const mk = [...byMonth.keys()].sort((a, b) => a - b);
  const months = []; for (let k = mk[0]; k <= mk[mk.length - 1]; k++) months.push(k);
  const maxM = Math.max(...months.map((k) => byMonth.get(k)?.length || 0));
  const MFMT = datef({ month: 'short', year: 'numeric' });
  const mName = (k) => MFMT(new Date(Math.floor(k / 12), k % 12, 1).getTime());
  const bars = months.map((k) => { const g = byMonth.get(k) || []; const s = tally(g); return `<i style="height:${Math.max(g.length ? 3 : 0, (100 * g.length) / maxM)}%" data-tip="${mName(k)} : ${g.length} partie${g.length > 1 ? 's' : ''}${g.length ? ', ' + score(s) + ' % de score' : ''}"></i>`; }).join('');
  const byYear = group((g) => new Date(g.t * 1000).getFullYear());
  const years = [...byYear.keys()].sort().map((y) => { const g = byYear.get(y); const r = g.filter((x) => x.rated && x.r && (sel === 'all' ? x.tc === 'rapid' : true)); return row(y, tally(g), `<td class="r">${r.length ? r[r.length - 1].r : '—'}</td>`); });

  // Records
  const wins = gs.filter((g) => g.out === 'W'), losses = gs.filter((g) => g.out === 'L');
  const bestWin = wins.reduce((a, g) => (!a || g.or > a.or ? g : a), null);
  const worstLoss = losses.reduce((a, g) => (!a || g.or < a.or ? g : a), null);
  const longest = gs.reduce((a, g) => (!a || g.san.length > a.san.length ? g : a), null);
  const fastWin = wins.filter((g) => g.how === 'checkmated').reduce((a, g) => (!a || g.san.length < a.san.length ? g : a), null);
  const byDay = group((g) => new Date(g.t * 1000).toDateString());
  const busiest = [...byDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const stk = streaks(gs);
  const upset = wins.reduce((a, g) => (!a || g.or - g.r > a.or - a.r ? g : a), null);
  const kv = (a, b) => `<dt>${a}</dt><dd>${b}</dd>`;
  const records = kv('Première partie', link(first, dfmt(first.t))) + kv('Dernière partie', link(last, dfmt(last.t)))
    + kv('Adversaire le mieux classé battu', bestWin ? link(bestWin, `${esc(bestWin.opp)} (${bestWin.or})`) : '—')
    + kv('Plus gros exploit (écart Elo)', upset && upset.or > upset.r ? link(upset, `+${upset.or - upset.r} contre ${esc(upset.opp)}`) : '—')
    + kv('Défaite contre le moins bien classé', worstLoss ? link(worstLoss, `${esc(worstLoss.opp)} (${worstLoss.or})`) : '—')
    + kv('Plus longue série de victoires', stk.bw) + kv('Plus longue série de défaites', stk.bl)
    + kv('Partie la plus longue', link(longest, Math.ceil(longest.san.length / 2) + ' coups'))
    + kv('Mat le plus rapide', fastWin ? link(fastWin, Math.ceil(fastWin.san.length / 2) + ' coups') : '—')
    + kv('Journée la plus chargée', busiest ? `${busiest[1].length} parties le ${dfmt(busiest[1][0].t)}` : '—');

  // Fins de partie
  const hb = (pairs, total) => { const mx = Math.max(1, ...pairs.map((p) => p[1])); return pairs.map(([l, n]) => `<div class="hbar"><span>${l}</span><span class="track"><i style="width:${(100 * n) / mx}%"></i></span><span class="v" style="white-space:nowrap">${n}${total ? ' <span class="small">' + pct(n, total) + ' %</span>' : ''}</span></div>`).join(''); };
  const ends = (list) => { const m = new Map(); for (const g of list) { const k = HOW[g.how] || g.how; m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k[0].toUpperCase() + k.slice(1), n]); };

  // Quand
  const wd = group((g) => (new Date(g.t * 1000).getDay() + 6) % 7);
  const slot = group((g) => { const hr = new Date(g.t * 1000).getHours(); return SLOTS.findIndex((s) => hr >= s[1] && hr < s[2]); });

  // Adversaires
  const BK = [['Bien moins bien classé (−100 et moins)', -1e9, -100], ['Moins bien classé (−99 à −25)', -100, -25], ['Niveau proche (±24)', -25, 25], ['Mieux classé (+25 à +99)', 25, 100], ['Bien mieux classé (+100 et plus)', 100, 1e9]];
  const diff = BK.map(([l, a, b]) => row(l, tally(gs.filter((g) => g.or - g.r >= a && g.or - g.r < b))));
  const opp = [...group((g) => g.opp).entries()].filter((e) => e[1].length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([n, g]) => row(esc(n), tally(g)));
  const LEN = [['Moins de 15 coups', 0, 15], ['15 à 24 coups', 15, 25], ['25 à 39 coups', 25, 40], ['40 à 59 coups', 40, 60], ['60 coups et plus', 60, 1e9]];
  const lens = LEN.map(([l, a, b]) => row(l, tally(gs.filter((g) => { const n = Math.ceil(g.san.length / 2); return n >= a && n < b; }))));

  // Tes coups
  const P = { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 }; let cap = 0, chk = 0, mate = 0, promo = 0, oo = 0, ooo = 0, played = 0;
  const firstMv = new Map();
  for (const g of gs) {
    let castled = false;
    g.san.forEach((s, i) => {
      if ((i % 2 === 0) !== g.w) return;
      played++;
      if (s.startsWith('O-O-O')) { ooo++; castled = true; P.K++; } else if (s.startsWith('O-O')) { oo++; castled = true; P.K++; } else P['NBRQK'.includes(s[0]) ? s[0] : 'P']++;
      if (s.includes('x')) cap++; if (s.includes('+')) chk++; if (s.includes('#')) mate++; if (s.includes('=')) promo++;
    });
    if (g.w) firstMv.set(g.san[0], (firstMv.get(g.san[0]) || 0) + 1);
  }
  const pieces = [['Pions', P.P], ['Cavaliers', P.N], ['Fous', P.B], ['Tours', P.R], ['Dame', P.Q], ['Roi', P.K]].sort((a, b) => b[1] - a[1]);
  const fm = [...firstMv.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, n]) => [fr(s), n]);
  const whiteN = gs.filter((g) => g.w).length;
  const accs = gs.filter((g) => g.acc != null);
  const es = Object.values(S.an).filter((a) => a && !a.bad && a.acc != null);
  const cs = S.data.stats || {};
  const extra = [
    cs.tactics?.highest?.rating ? kv('Meilleur classement aux problèmes Chess.com', cs.tactics.highest.rating) : '',
    cs.puzzle_rush?.best?.score ? kv('Record Puzzle Rush', cs.puzzle_rush.best.score) : '',
    accs.length ? kv(`Précision moyenne Chess.com (${accs.length} parties revues)`, (accs.reduce((a, g) => a + g.acc, 0) / accs.length).toFixed(1) + ' %') : '',
    es.length ? kv(`Précision moyenne ici (${es.length} parties analysées)`, (es.reduce((a, x) => a + x.acc, 0) / es.length).toFixed(1) + ' %') : '',
  ].join('');
  const H4 = ['', 'Parties', 'Résultats', 'Score'];

  return `<div class="vhead"><h1>Stats depuis le début</h1>
    <div class="row" role="group" aria-label="Cadence">${['all', ...['rapid', 'blitz', 'bullet', 'daily'].filter((k) => has.includes(k))].map((k) => `<button class="btn sm ${sel === k ? 'pri' : ''}" data-act="stattc" data-tc="${k}">${k === 'all' ? 'Toutes' : TC[k]}</button>`).join('')}</div></div>
  <p class="sub">Depuis ta première partie du ${dfmt(first.t)}.</p>
  <div class="tiles">${tiles}</div>
  <div class="card"><h2>Par cadence</h2>${tbl(['Cadence', 'Parties', 'Résultats', 'Score', 'Elo actuel', 'Record', 'Plus bas'], cad)}${WDL_LEGEND}</div>
  <div class="grid">${['rapid', 'blitz', 'bullet', 'daily'].filter((k) => all.filter((g) => g.tc === k && g.rated && g.r).length >= 2).map((k) => `<div class="card"><h2>Classement ${TC[k]}</h2><div class="chart" data-rc="${k}"></div></div>`).join('')}</div>
  <div class="card"><h2>Activité par mois <span class="small">${months.length} mois</span></h2><div class="bars">${bars}</div>
    <div class="row small" style="justify-content:space-between"><span>${mName(months[0])}</span><span>${mName(months[months.length - 1])}</span></div>
    ${tbl(['Année', 'Parties', 'Résultats', 'Score', sel === 'all' ? 'Elo Rapide en fin d’année' : 'Elo en fin d’année'], years)}</div>
  <div class="grid">
    <div class="card"><h2>Records</h2><dl class="kv">${records}</dl></div>
    <div class="card"><h2>Comment tes parties se terminent</h2>
      <h3>Tes ${wins.length} victoires</h3>${hb(ends(wins), wins.length)}
      <h3>Tes ${losses.length} défaites</h3>${hb(ends(losses), losses.length)}
      ${T.d ? `<h3>Tes ${T.d} nulles</h3>${hb(ends(gs.filter((g) => g.out === 'D')), T.d)}` : ''}</div>
  </div>
  <div class="grid">
    <div class="card"><h2>Par jour de la semaine</h2>${tbl(H4, DAYS.map((d, i) => row(d, tally(wd.get(i) || []))))}</div>
    <div class="card"><h2>Par moment de la journée</h2>${tbl(H4, SLOTS.map((s, i) => row(s[0], tally(slot.get(i) || []))))}
      <h2>Par couleur</h2>${tbl(H4, [row('Blancs', tally(gs.filter((g) => g.w))), row('Noirs', tally(gs.filter((g) => !g.w)))])}</div>
  </div>
  <div class="grid">
    <div class="card"><h2>Selon le niveau de l’adversaire</h2>${tbl(H4, diff)}</div>
    <div class="card"><h2>Selon la longueur de la partie</h2>${tbl(H4, lens)}</div>
    ${clockCard(gs, S.an)}
  </div>
  <div class="grid">
    <div class="card"><h2>Tes coups <span class="small">${nf(played)} coups</span></h2>${hb(pieces, played)}
      <dl class="kv">${kv('Captures', nf(cap))}${kv('Échecs donnés', nf(chk))}${kv('Mats donnés', nf(mate))}${kv('Promotions', nf(promo))}${kv('Petits roques', `${nf(oo)} (${pct(oo, gs.length)} % des parties)`)}${kv('Grands roques', `${nf(ooo)} (${pct(ooo, gs.length)} %)`)}</dl></div>
    <div class="card"><h2>Ton premier coup avec les Blancs</h2>${fm.length ? hb(fm, whiteN) : '<p class="sub">Aucune partie avec les Blancs.</p>'}
      ${opp.length ? `<h2>Adversaires les plus fréquents</h2>${tbl(H4, opp)}` : ''}
      ${extra ? `<h2>Autres repères</h2><dl class="kv">${extra}</dl>` : ''}</div>
  </div>`;
}

export function mountStats(S) {
  document.querySelectorAll('[data-rc]').forEach((el) => {
    const pts = S.data.games.filter((g) => g.tc === el.dataset.rc && g.rated && g.r).map((g) => ({ x: g.t, y: g.r, tip: `${dfmt(g.t)} : ${g.r}` }));
    lineChart(el, pts, { h: 180, label: 'Classement ' + TC[el.dataset.rc], x0: dfmt(pts[0].x), x1: dfmt(pts[pts.length - 1].x) });
  });
}
