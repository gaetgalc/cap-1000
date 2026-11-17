// Banc de fluidité : 5 000 parties simulées, 300 clones analysés, chaque vue visitée aux deux tailles, puis un rechargement.
// Lancer : node tests/perf.js [--report]   (PORT=8820 par exemple ; écrit tests/out/perf.json)
// Mesure par vue : la plus longue tâche du fil principal (PerformanceObserver 'longtask', seuil du navigateur : 50 ms)
// et le temps jusqu'à deux images après le changement d'adresse. Budgets : 100 ms par vue, 150 ms au rechargement.
// Sans --report, sort en erreur si un budget est dépassé. Durée : 3 à 4 minutes (l'analyse des 12 parties de base en prend environ 30 s).
/* eslint-disable no-console */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const { USER, GAMES, bigGames, startServer, stopServer, routeChessCom } = require('./fixture');
const PORT = +process.env.PORT || 8766, N = 5000, CLONES = 300, VIEW_BUDGET = 100, LOAD_BUDGET = 150;
const REPORT = process.argv.includes('--report');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SIZES = [{ id: '1366x768', width: 1366, height: 768 }, { id: '390x664', width: 390, height: 664, mobile: true }];
const URL0 = `http://localhost:${PORT}/?u=${USER}&debug`;

(async () => {
  const t00 = Date.now();
  await startServer(PORT);
  const games = bigGames(N), base = new Set(GAMES.map((g) => g.url));
  const cloneIds = games.filter((g) => !base.has(g.url)).sort((a, b) => b.end_time - a.end_time).slice(0, CLONES).map((g) => g.url);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-perf-'));
  const open = async (size) => {
    const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: size.width, height: size.height }, isMobile: !!size.mobile, hasTouch: !!size.mobile, deviceScaleFactor: 1 });
    await routeChessCom(ctx, { games });
    await ctx.route('https://lichess.org/**', (r) => r.fulfill({ status: 503, body: '' }));
    await ctx.addInitScript(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push({ t: e.startTime, d: e.duration }); }).observe({ type: 'longtask', buffered: true }); });
    return ctx;
  };

  // 1. Import des 5 000 parties, analyse des 12 parties de base, recopie sur 300 clones.
  let ctx = await open(SIZES[0]), p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let t0 = Date.now();
  await p.goto(URL0 + '#accueil');
  await p.waitForFunction((n) => window.__cap?.data && window.__cap.data.games.length >= n && !window.__cap.importing, N, { timeout: 120000 });
  const tImport = Date.now() - t0; t0 = Date.now();
  await p.waitForFunction((ids) => ids.every((id) => window.__cap.an[id]), [...base], { timeout: 300000 });
  const tAnalyse = Date.now() - t0;
  await p.evaluate(() => { window.__cap.job.stop = true; });
  await p.waitForFunction(() => !window.__cap.job.running, null, { timeout: 60000 });
  await p.evaluate(async ({ ids, base }) => {
    const s = window.__cap, urls = base;
    ids.forEach((id, k) => { s.an[id] = structuredClone(s.an[urls[k % urls.length]]); });
    const { dbSet } = await import('/js/store.js');
    await dbSet('an:' + s.user, s.an);
  }, { ids: cloneIds, base: GAMES.map((g) => g.url) });
  const info = await p.evaluate(() => { const s = window.__cap, g = s.data.games.find((x) => s.an[x.id] && !s.an[x.id].bad); let e = null; for (const x of s.data.games) { const r = s.an[x.id]?.errs?.[0]; if (r) { e = { t: x.t, ply: r.ply }; break; } } return { n: s.data.games.length, an: Object.keys(s.an).length, pt: g.t, e }; });
  console.log(`Import ${info.n} parties : ${tImport} ms ; analyse des 12 de base : ${tAnalyse} ms ; ${info.an} analyses après recopie`);
  await ctx.close();

  // 2. Vues et rechargement, aux deux tailles.
  const routes = ['accueil', 'entrainer', 'puzzles', 'bilan', 'parties', 'partie/' + info.pt, 'stats', 'ouvertures', 'ouvertures/apprendre', 'plan', 'historique', 'drill/sur', 'idees', 'gagner', 'finales', 'rush', 'erreur/' + info.e.t + '/' + info.e.ply];
  const rows = [], max = (a) => Math.round(Math.max(0, ...a.map((x) => x.d)));
  for (const size of SIZES) {
    ctx = await open(size); p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(size.id + ' ' + e.message));
    await p.goto(URL0 + '#accueil');
    await p.waitForFunction(() => window.__cap?.data && !window.__cap.job.running, null, { timeout: 60000 });
    await sleep(1500);
    for (const r of routes) {
      await p.evaluate(() => { window.__lt = []; });
      const frames = await p.evaluate(async (r) => { const t = performance.now(); location.hash = '#' + r; await new Promise((res) => setTimeout(res, 0)); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))); return Math.round(performance.now() - t); }, r);
      await sleep(700);
      const lt = await p.evaluate(() => window.__lt);
      rows.push({ size: size.id, view: r.split('/')[0] + (r.startsWith('ouvertures/') ? '/apprendre' : ''), route: r, frames, maxLongTask: max(lt), longTasks: lt.length });
    }
    // Rechargement : plus longue tâche entre le début de la navigation et 1,5 s après les parties chargées.
    await p.goto(URL0 + '#accueil');
    await p.waitForFunction(() => window.__cap?.data, null, { timeout: 60000 });
    await sleep(1500);
    const lt = await p.evaluate(() => window.__lt);
    rows.push({ size: size.id, view: 'rechargement', route: 'accueil', frames: null, maxLongTask: max(lt), longTasks: lt.length });
    await ctx.close();
  }
  stopServer();
  fs.rmSync(dir, { recursive: true, force: true });

  // 3. Tableau et verdict.
  const out = path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'perf.json'), JSON.stringify({ games: info.n, analysed: info.an, tImport, tAnalyse, budgets: { view: VIEW_BUDGET, reload: LOAD_BUDGET }, errors: errs, rows }, null, 1));
  const bad = rows.filter((r) => r.maxLongTask > (r.view === 'rechargement' ? LOAD_BUDGET : VIEW_BUDGET));
  console.log('\nPlus longue tâche en ms (temps jusqu\'à deux images entre parenthèses), ! = au-dessus du budget');
  console.log('Vue'.padEnd(24) + SIZES.map((s) => s.id.padStart(18)).join(''));
  const names = [...new Set(rows.map((r) => r.view))];
  for (const v of names) {
    const cell = (sid) => { const r = rows.find((x) => x.size === sid && x.view === v); return r ? (String(r.maxLongTask) + (r.frames == null ? '' : ' (' + r.frames + ')') + (bad.includes(r) ? ' !' : '')).padStart(18) : ''.padStart(18); };
    console.log(v.padEnd(24) + SIZES.map((s) => cell(s.id)).join(''));
  }
  if (errs.length) console.log('Erreurs JS : ' + errs.join(' | '));
  console.log(`\nDurée : ${Math.round((Date.now() - t00) / 1000)} s. Détail : tests/out/perf.json`);
  if (bad.length) console.log(`${bad.length} mesure(s) au-dessus du budget (${VIEW_BUDGET} ms par vue, ${LOAD_BUDGET} ms au rechargement) : ` + bad.map((r) => r.view + ' ' + r.size + ' ' + r.maxLongTask + ' ms').join(', '));
  process.exit(bad.length && !REPORT ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
