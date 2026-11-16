// Audit de l'interface : chaque écran, aux 4 tailles de référence, sur des parties simulées.
// Lancer : node tests/audit-ui.js [dossier]   (par défaut tests/out/audit ; captures + audit.json + résumé à l'écran)
// Mesures, d'après les règles de la refonte (docs/REFONTE.md) : défilement de la page, débordement horizontal,
// tailles de texte, texte sous 13 px, contraste du texte, cibles tactiles sous 44 px, boutons pleins, arrondis.
/* eslint-disable no-console */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const { USER, GAMES, startServer, stopServer, routeChessCom } = require('./fixture');
const PORT = +process.env.PORT || 8766, OUT = path.resolve(process.argv[2] || path.join(__dirname, 'out/audit'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SIZES = [
  { id: '390x664', width: 390, height: 664, mobile: true },
  { id: '390x760', width: 390, height: 760, mobile: true },
  { id: '1366x768', width: 1366, height: 768 },
  { id: '1280x860', width: 1280, height: 860 },
];

// Écrans : route fixe, ou fonction qui la calcule sur l'état chargé (window.__cap).
const SCREENS = [
  ['accueil'], ['bilan'], ['plan'], ['puzzles'], ['historique'], ['exos'], ['drill-sur', 'drill/sur'], ['drill-compte', 'drill/compte'],
  ['cours'], ['cours-fiche', 'cours/en_prise_pose/fiche'], ['cours-prive', 'cours/en_prise_pose'],
  ['gagner'], ['ouvertures'], ['ouvertures-apprendre', 'ouvertures/apprendre'], ['ouverture-fiche', 'ouvertures/italienne'],
  ['ligne-reciter', 'ligne/italienne/0'], ['ligne-voir', 'ligne/italienne/0/voir'],
  ['parties'], ['stats'], ['entrainer'],
  ['partie', () => { const s = window.__cap, g = s.data.games.find((x) => s.an[x.id] && !s.an[x.id].bad); return 'partie/' + g.t; }],
  ['erreur', () => { const s = window.__cap; for (const g of s.data.games) { const e = s.an[g.id]?.errs?.[0]; if (e) return 'erreur/' + g.t + '/' + e.ply; } return 'puzzles'; }],
];

// Exécuté dans la page : mesures sur tout ce qui est visible.
function measure(touch) {
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0'; };
  const rgba = (s) => { const m = s.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]] : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, bot) => { const a = top[3]; return [top[0] * a + bot[0] * (1 - a), top[1] * a + bot[1] * (1 - a), top[2] * a + bot[2] * (1 - a), 1]; };
  function bgOf(el) { // fond réel : on remonte et on compose les fonds semi-transparents
    const layers = []; let imgs = false;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') imgs = true;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let b = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) b = over(layers[i], b);
    return { b, imgs };
  }
  const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.className || el.tagName).toString().replace(/\s+/g, ' ').trim().slice(0, 40);
  const root = document.scrollingElement;
  const out = { fit: document.body.classList.contains('fit'), scrollY: root.scrollHeight - innerHeight, scrollX: root.scrollWidth - innerWidth, sizes: {}, small: [], contrast: [], taps: [], primaries: 0, radii: {} };
  const seen = new Set();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const t = n.textContent.trim(), el = n.parentElement;
    if (!t || !el || el.closest('cg-container, svg, script, style, [hidden]') || !vis(el) || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el), fsz = Math.round(parseFloat(cs.fontSize) * 10) / 10;
    out.sizes[fsz] = (out.sizes[fsz] || 0) + 1;
    if (fsz < 13) out.small.push(fsz + 'px « ' + t.slice(0, 30) + ' »');
    const { b, imgs } = bgOf(el);
    if (imgs) continue;
    const fg = over(rgba(cs.color), b), l1 = lum(fg), l2 = lum(b), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const big = fsz >= 24 || (fsz >= 18.66 && +cs.fontWeight >= 700), need = big ? 3 : 4.5;
    if (ratio < need) out.contrast.push(ratio.toFixed(2) + ' < ' + need + ' « ' + t.slice(0, 30) + ' »');
  }
  // Cibles tactiles : sur téléphone seulement (le skill les exige aux largeurs tactiles ; à la souris, 36 px suffisent).
  for (const el of touch ? document.querySelectorAll('a[href], button, select, input, [data-act], [data-x], [data-f], [role=button]') : []) {
    if (!vis(el) || el.closest('[hidden]')) continue;
    const lab = el.tagName === 'INPUT' && el.closest('label');
    if (lab && lab.getBoundingClientRect().height >= 44) continue; // case à cocher dans une ligne cliquable
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (cs.display === 'inline' && el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length + 2) continue; // lien dans une phrase
    if (r.width < 44 || r.height < 44) out.taps.push(Math.round(r.width) + '×' + Math.round(r.height) + ' « ' + label(el) + ' »');
  }
  out.primaries = [...document.querySelectorAll('.btn.pri')].filter(vis).length;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('cg-container, svg') || !vis(el)) continue;
    const rr = getComputedStyle(el).borderTopLeftRadius;
    if (rr && rr !== '0px') out.radii[rr] = (out.radii[rr] || 0) + 1;
  }
  return out;
}

async function visit(ctx, size, report) {
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const base = `http://localhost:${PORT}/?u=${USER}&debug`;
  await page.goto(base + '#accueil');
  await page.waitForFunction((n) => window.__cap?.data && !window.__cap.job.running && Object.keys(window.__cap.an).length === n, GAMES.length, { timeout: 240000 });
  fs.mkdirSync(path.join(OUT, size.id), { recursive: true });
  for (const [name, route = name, opt = {}] of SCREENS) {
    if (opt.mobileOnly && !size.mobile) continue;
    const hash = typeof route === 'function' ? await page.evaluate(route) : route;
    await page.goto(base + '#' + hash); await sleep(900);
    const m = await page.evaluate(measure, !!size.mobile);
    m.route = hash; m.errors = errs.splice(0);
    await page.screenshot({ path: path.join(OUT, size.id, name + '.png') });
    report[size.id][name] = m;
  }
  await page.close();
}

(async () => {
  await startServer(PORT);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-audit-'));
  const report = {};
  for (const size of SIZES) {
    report[size.id] = {};
    // Même profil pour toutes les tailles : l'import et l'analyse ne se font qu'une fois.
    const ctx = await chromium.launchPersistentContext(dir, { viewport: { width: size.width, height: size.height }, isMobile: !!size.mobile, hasTouch: !!size.mobile, deviceScaleFactor: 1 });
    await routeChessCom(ctx);
    await ctx.route('https://lichess.org/**', (r) => r.fulfill({ status: 503, body: '' }));
    await visit(ctx, size, report);
    await ctx.close();
  }
  stopServer();
  fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 1));

  // Résumé
  const all = Object.values(report).flatMap((r) => Object.values(r));
  const sizes = {}, radii = {};
  for (const m of all) { for (const [k, v] of Object.entries(m.sizes)) sizes[k] = (sizes[k] || 0) + v; for (const [k, v] of Object.entries(m.radii)) radii[k] = (radii[k] || 0) + v; }
  console.log('Tailles de texte (' + Object.keys(sizes).length + ') : ' + Object.keys(sizes).sort((a, b) => a - b).join(', '));
  console.log('Arrondis (' + Object.keys(radii).length + ') : ' + Object.keys(radii).sort((a, b) => parseFloat(a) - parseFloat(b)).join(', '));
  for (const [sid, r] of Object.entries(report)) {
    for (const [name, m] of Object.entries(r)) {
      const pb = [];
      if (m.fit && m.scrollY > 0) pb.push('défile de ' + m.scrollY + ' px');
      if (m.scrollX > 0) pb.push('déborde de ' + m.scrollX + ' px');
      if (m.primaries > 1) pb.push(m.primaries + ' boutons pleins');
      if (m.small.length) pb.push(m.small.length + ' textes < 13 px');
      if (m.contrast.length) pb.push(m.contrast.length + ' contrastes faibles');
      if (m.taps.length) pb.push(m.taps.length + ' cibles < 44 px');
      if (m.errors.length) pb.push('erreurs JS : ' + m.errors.join(' | '));
      console.log(`${sid.padEnd(9)} ${name.padEnd(21)} ${pb.join(' · ') || 'rien à signaler'}`);
    }
  }
  console.log('Captures et détail : ' + OUT);
  fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
