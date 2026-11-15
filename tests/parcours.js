// Test de bout en bout du parcours d'entraînement, sur des parties simulées (aucun accès réseau réel).
// Lancer : node tests/parcours.js   (nécessite playwright et Chromium ; `api.chess.com` est intercepté)
/* eslint-disable no-console */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'), PORT = 8765, USER = 'testeur';
const { Chess } = require(path.join(ROOT, 'vendor/chess.js'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Parties simulées au format Chess.com : un joueur étourdi contre un adversaire qui prend ce qui traîne ----
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
function greedy(ch) {
  let best = null, bs = -99;
  for (const m of ch.moves({ verbose: true })) {
    const c = new Chess(ch.fen()); c.move(m);
    const rec = c.moves({ verbose: true }).some((x) => x.to === m.to);
    const s = rnd() * 0.8 + (m.san.includes('#') ? 100 : 0) + (m.captured ? (rec ? VAL[m.captured] - VAL[m.piece] : VAL[m.captured]) : rec ? -VAL[m.piece] : 0);
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
function game(i) {
  const ch = new Chess(), w = i % 2 === 0, san = [], max = 30 + Math.floor(rnd() * 30);
  while (!ch.game_over() && san.length < max) {
    const mine = (ch.turn() === 'w') === w, ms = ch.moves({ verbose: true });
    const m = mine && rnd() > 0.55 ? ms[Math.floor(rnd() * ms.length)] : greedy(ch);
    ch.move(m); san.push(m.san);
  }
  const whiteWon = ch.in_checkmate() ? ch.turn() === 'b' : rnd() < 0.5, res = whiteWon ? '1-0' : '0-1';
  const body = san.map((s, k) => (k % 2 ? '' : k / 2 + 1 + '. ') + s).join(' ');
  const me = { rating: 700 + i * 5, result: whiteWon === w ? 'win' : 'resigned', username: USER }, op = { rating: 720 + i * 5, result: whiteWon === w ? 'resigned' : 'win', username: 'adv' + i };
  return { url: 'https://www.chess.com/game/live/' + (1000 + i), pgn: `[Event "Live Chess"]\n[Result "${res}"]\n[ECOUrl "https://www.chess.com/openings/Italian-Game"]\n\n${body} ${res}\n`,
    time_control: '600', end_time: Math.floor(Date.now() / 1000) - (40 - i) * 86400, rated: true, time_class: 'rapid', rules: 'chess', white: w ? me : op, black: w ? op : me };
}
const GAMES = Array.from({ length: 12 }, (_, i) => game(i));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };
const server = http.createServer((req, rsp) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (e, buf) => { rsp.writeHead(e ? 404 : 200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); rsp.end(e ? '' : buf); });
});

let failed = 0;
const check = (ok, label) => { console.log((ok ? 'ok   ' : 'ÉCHEC') + ' ' + label); if (!ok) failed++; };

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await ctx.route('https://api.chess.com/**', (r) => {
    const u = r.request().url(), json = (o) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.endsWith('/games/archives')) return json({ archives: [`https://api.chess.com/pub/player/${USER}/games/2026/01`] });
    if (/\/games\/\d{4}\/\d{2}$/.test(u)) return json({ games: GAMES });
    return json(u.endsWith('/stats') ? {} : { username: USER });
  });
  const S = (fn, arg) => page.evaluate(fn, arg);
  const cur = () => S(() => { const s = window.__cap, id = s.pzOne?.id || s.pz?.redo?.[0] || s.pz?.cur?.id; if (!id) return null; const [t, ply] = id.split(':'); const g = s.data.games.find((x) => String(x.t) === t); const e = s.an[g.id].errs.find((x) => String(x.ply) === ply); return { id, best: e.best, w: g.w }; });
  const tap = async (sel, sq, w) => { const b = await page.locator(sel + ' cg-board').boundingBox(), f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; await page.touchscreen.tap(b.x + ((w ? f : 7 - f) + 0.5) * b.width / 8, b.y + ((w ? 7 - r : r) + 0.5) * b.height / 8); };
  const ls = (k) => S((k2) => JSON.parse(localStorage.getItem('cap1000:' + k2) || 'null'), k);
  const bar = (sel) => S((s) => document.querySelector(s)?.innerText.replace(/\s+/g, ' ') || '', sel);

  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#accueil`);
  await page.waitForFunction(() => window.__cap?.data && window.__cap.job.total > 0 && !window.__cap.job.running, null, { timeout: 180000 });
  check(await S(() => Object.keys(window.__cap.an).length) === GAMES.length, 'import et analyse des parties simulées');

  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#puzzles`); await sleep(600);
  let c = await cur();
  check(!!c, 'un puzzle est proposé');
  await tap('#pzb', c.best.slice(0, 2), c.w); await sleep(250);
  check(await S(() => document.querySelectorAll('#pzb square.move-dest').length) > 0, 'les cases possibles de la pièce choisie sont marquées');
  await tap('#pzb', c.best.slice(2, 4), c.w); await sleep(900);
  check(/Pause/.test(await bar('#pzbar')), 'après le bon coup, la suite se joue toute seule');
  for (let k = 0; k < 250 && !/Revoir|Voir mon erreur/.test(await bar('#pzbar')); k++) await sleep(200);
  check(/Revoir|Voir mon erreur/.test(await bar('#pzbar')) && /Bilan/.test(await bar('#pzcap')), 'la lecture va au bout et affiche le bilan');
  check((await ls('hist')).length === 1 && (await ls('hist'))[0].r === 2, 'le puzzle est noté dans le journal (du premier coup)');

  await page.reload(); await sleep(900);
  const c2 = await cur();
  check(c2 && c2.id !== c.id, 'après rechargement, le puzzle fait ne revient pas');
  check(/^1/.test(await bar('#tools .pzprog')), 'après rechargement, l’avancée du jour est conservée');

  let n = 1;
  for (let k = 0; k < 12 && !(await S(() => !!document.querySelector('.recap'))); k++) { await page.click('[data-act="pzshow"]'); await sleep(250); await page.click('[data-act="pznext"]'); await sleep(350); n++; }
  check(await S(() => !!document.querySelector('.recap')), 'un bilan apparaît quand l’objectif du jour est atteint');
  n = (await ls('hist')).length;
  check(await S(() => !!document.querySelector('[data-act="pzredo"]')), 'le bilan propose de refaire les ratés');
  const due = Object.values(await ls('pz')).map((p) => p.due - Date.now());
  check(due.every((d) => d > 0 && d <= 86400000), 'les puzzles du jour reviennent demain au plus tôt');

  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#historique`); await sleep(500);
  check(await S(() => document.querySelectorAll('.hrow').length) === n, `l’historique liste les ${n} puzzles`);

  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#drill/sur`); await sleep(600);
  if (await S(() => window.__cap.dr.items.length >= 3)) {
    for (let k = 0; k < 2; k++) { await page.click('#drbar .btn'); await sleep(150); await page.click('[data-act="drnext"]'); await sleep(250); }
    await page.reload(); await sleep(800);
    check(await S(() => window.__cap.dr?.i) === 2, 'un échauffement interrompu reprend à la même position');
  }
  // ---- Analyse en deux temps : reclasser sans moteur, réévaluer les anciennes analyses ----
  const tamper = (fn) => S(async (src) => {
    const db = await new Promise((res) => { const r = indexedDB.open('cap1000', 1); r.onsuccess = () => res(r.result); });
    const an = await new Promise((res) => { const q = db.transaction('kv').objectStore('kv').get('an:testeur'); q.onsuccess = () => res(q.result); });
    const before = Object.values(an).reduce((n, a) => n + a.errs.length, 0);
    for (const a of Object.values(an)) new Function('a', src)(a);
    await new Promise((res) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(an, 'an:testeur'); tx.oncomplete = res; });
    db.close(); return before;
  }, fn);
  const errCount = () => S(() => Object.values(window.__cap.an).reduce((n, a) => n + a.errs.length, 0));
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#accueil`); await sleep(500);
  let nErr = await tamper('a.v = 0; a.errs = [];'); // comme si les règles de classement avaient changé
  await page.reload(); await sleep(1200);
  check(await errCount() === nErr && await S(() => window.__cap.job.total) === 0, 'règles changées : les parties sont reclassées sans relancer le moteur');
  nErr = await tamper('delete a.pv; delete a.best; delete a.v;'); // analyses d'avant la séparation évaluer / classer
  await page.reload();
  await page.waitForFunction(() => window.__cap?.job.total > 0 && !window.__cap.job.running, null, { timeout: 180000 });
  check(await S(() => Object.values(window.__cap.an).every((a) => a.pv && a.v)) && await errCount() === nErr, 'anciennes analyses : réévaluées une fois, mêmes erreurs');

  check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} échec(s)` : '\nTout passe.');
  process.exit(failed ? 1 : 0);
})();
