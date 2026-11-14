// Import depuis l'API publique de Chess.com (aucune clé, pseudo seul).
const API = 'https://api.chess.com/pub/player/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 4; i++) {
    let r;
    try { r = await fetch(url); } catch (e) {
      if (i === 3) throw new Error('Connexion à Chess.com impossible. Vérifie ta connexion puis réessaie.');
      await sleep(800 * (i + 1)); continue;
    }
    if (r.status === 404) throw new Error('Pseudo introuvable sur Chess.com. Vérifie l’orthographe.');
    if (r.status === 429 || r.status >= 500) { await sleep(1500 * (i + 1)); continue; }
    if (!r.ok) throw new Error('Chess.com a répondu avec une erreur (' + r.status + ').');
    return r.json();
  }
  throw new Error('Chess.com limite les requêtes pour le moment. Réessaie dans une minute.');
}

const LOSS = new Set(['checkmated', 'timeout', 'resigned', 'abandoned', 'lose', 'kingofthehill', 'threecheck', 'bughousepartnerlose']);

export function family(name) {
  const m = name.match(/^(.*?\b(?:Game|Opening|Defense|Defence|Gambit|Attack|System|Countergambit))\b/);
  return (m ? m[1] : name).trim();
}

function parsePgn(pgn) {
  const head = {};
  pgn.replace(/^\[(\w+) "([^"]*)"\]/gm, (_, k, v) => { head[k] = v; return ''; });
  const idx = pgn.indexOf('\n\n');
  const body = idx >= 0 ? pgn.slice(idx) : pgn.replace(/^\[.*\]$/gm, '');
  const clk = [];
  body.replace(/\[%clk (\d+):(\d+):(\d+(?:\.\d+)?)\]/g, (_, h, m, s) => { clk.push(Math.round(+h * 3600 + +m * 60 + +s)); return ''; });
  const san = body.replace(/\{[^}]*\}/g, ' ').replace(/\([^)]*\)/g, ' ').replace(/\$\d+/g, ' ')
    .split(/\s+/).filter((t) => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t))
    .map((t) => t.replace(/^\d+\.+/, '')).filter(Boolean);
  return { head, san, clk };
}

function norm(g, user) {
  if (g.rules !== 'chess' || !g.pgn || !g.white || !g.black) return null;
  const w = (g.white.username || '').toLowerCase() === user;
  const me = w ? g.white : g.black, op = w ? g.black : g.white;
  const { head, san, clk } = parsePgn(g.pgn);
  if (head.SetUp === '1' || san.length < 2) return null;
  const out = me.result === 'win' ? 'W' : LOSS.has(me.result) ? 'L' : 'D';
  let name = 'Ouverture inconnue';
  if (head.ECOUrl) {
    name = decodeURIComponent(head.ECOUrl.split('/').pop()).replace(/-/g, ' ').replace(/\s\d+\.{1,3}.*$/, '').trim() || name;
  }
  const acc = g.accuracies ? (w ? g.accuracies.white : g.accuracies.black) : null;
  return {
    id: g.url, t: g.end_time, tc: g.time_class, base: parseInt(String(g.time_control), 10) || 0,
    w, r: me.rating, or: op.rating, opp: op.username, out,
    how: out === 'W' ? op.result : me.result, rated: !!g.rated,
    eco: head.ECO || '', op: name, fam: family(name), san, clk, acc: acc == null ? null : Math.round(acc * 10) / 10,
  };
}

// months : { "2026/10": true } pour les mois complets déjà en cache.
export async function importPlayer(userRaw, prev, onProgress) {
  const user = userRaw.trim().toLowerCase();
  const profile = await getJson(API + encodeURIComponent(user));
  const stats = await getJson(API + encodeURIComponent(user) + '/stats').catch(() => ({}));
  const arch = (await getJson(API + encodeURIComponent(user) + '/games/archives')).archives || [];
  const now = new Date();
  const curKey = now.getUTCFullYear() + '/' + String(now.getUTCMonth() + 1).padStart(2, '0');
  const months = { ...(prev?.months || {}) };
  const byId = new Map((prev?.games || []).map((g) => [g.id, g]));
  const todo = arch.filter((u) => !months[u.split('/').slice(-2).join('/')]);
  let done = 0;
  for (const url of todo) {
    onProgress?.(done, todo.length);
    const key = url.split('/').slice(-2).join('/');
    const data = await getJson(url);
    for (const g of data.games || []) { const n = norm(g, user); if (n) byId.set(n.id, n); }
    if (key < curKey) months[key] = true;
    done++;
    await sleep(120);
  }
  onProgress?.(done, todo.length);
  const games = [...byId.values()].sort((a, b) => a.t - b.t);
  return { user, profile: { name: profile.name || '', username: profile.username || user, avatar: profile.avatar || '' }, stats, months, games, fetchedAt: Date.now() };
}
