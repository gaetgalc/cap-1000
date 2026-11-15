// Jeu de données commun aux tests navigateur : parties simulées au format Chess.com, serveur local, interception de l'API.
/* eslint-disable no-console */
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..'), USER = 'testeur';
const { Chess } = require(path.join(ROOT, 'vendor/chess.js'));

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
  let cw = 600, cb = 600; // pendule : de 2 à 40 s par coup
  const body = san.map((s, k) => { const t = Math.floor(2 + rnd() * 38); if (k % 2) cb -= t; else cw -= t; const c = k % 2 ? cb : cw; return (k % 2 ? '' : k / 2 + 1 + '. ') + s + ` {[%clk 0:${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}]}`; }).join(' ');
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

const startServer = (port) => new Promise((r) => server.listen(port, r));
const stopServer = () => server.close();
function routeChessCom(ctx) {
  return ctx.route('https://api.chess.com/**', (r) => {
    const u = r.request().url(), json = (o) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.endsWith('/games/archives')) return json({ archives: [`https://api.chess.com/pub/player/${USER}/games/2026/01`] });
    if (/\/games\/\d{4}\/\d{2}$/.test(u)) return json({ games: GAMES });
    return json(u.endsWith('/stats') ? {} : { username: USER });
  });
}

module.exports = { ROOT, USER, Chess, GAMES, startServer, stopServer, routeChessCom };
