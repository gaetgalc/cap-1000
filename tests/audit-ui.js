// Audit de l'interface : chaque écran, aux 5 tailles de référence et en une passe en contraste renforcé, sur des parties simulées.
// Lancer : node tests/audit-ui.js [dossier]   (par défaut tests/out/audit ; captures + audit.json + résumé à l'écran)
// Mesures, d'après les règles de la refonte (docs/REFONTE.md) : défilement de la page, débordement horizontal,
// tailles de texte, texte sous 13 px, contraste du texte, cibles tactiles sous 44 px, boutons pleins, arrondis,
// barre du haut du téléphone (titre de la page hors accueil, logo sur l'accueil seulement : revue HIG, tâche 6).
// Échiquier (lot 1 du 16/11) : coordonnées dans leur case et sans chevauchement (échiquier retourné compris), largeur de
// l'échiquier de la relecture et des cours (.xwide) d'au moins 360 px en 390 de large ; échiquier d'exercice d'au moins
// 640 px en 1366 × 768 et 1280 × 860 (revue HIG, tâche 9). Les coordonnées (12 px) sont dans
// cg-container, donc hors de la mesure « texte sous 13 px » : exception assumée, documentée dans css/app.css (--t-coord).
/* eslint-disable no-console */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const { USER, GAMES, startServer, stopServer, routeChessCom } = require('./fixture');
const PORT = +process.env.PORT || 8766, OUT = path.resolve(process.argv[2] || path.join(__dirname, 'out/audit'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TOUTES_TAILLES = [
  { id: '390x664', width: 390, height: 664, mobile: true },
  { id: '390x760', width: 390, height: 760, mobile: true },
  { id: '1366x768', width: 1366, height: 768 },
  { id: '1280x860', width: 1280, height: 860 },
  // 390 × 664 au zoom 125 % de Safari : 312 × 531 pixels CSS (revue HIG, texte agrandi).
  { id: '312x531', width: 312, height: 531, mobile: true, zoom: true },
  // 390 × 664 avec le réglage « Augmenter le contraste » (prefers-contrast: more) : texte à 7:1, bord de carte à 3:1.
  { id: '390x664-hc', width: 390, height: 664, mobile: true, hc: true },
  // Fenêtre d'ordinateur en demi-écran (capture du 20/11) : sur demande seulement (SIZES=733x742).
  { id: '733x742', width: 733, height: 742, extra: true },
];
// Audit ciblé : SIZES=390x664,1366x768 et ONLY=accueil,bilan (noms d'écrans) ; sans variable, tout tourne.
const liste = (v) => (v || '').split(',').map((x) => x.trim()).filter(Boolean);
const SIZES = liste(process.env.SIZES).length ? TOUTES_TAILLES.filter((z) => liste(process.env.SIZES).includes(z.id)) : TOUTES_TAILLES.filter((z) => !z.extra);

// Écrans : route fixe, ou fonction qui la calcule sur l'état chargé (window.__cap) ; act : gestes faits avant la capture.
const ERREUR = () => { const s = window.__cap; for (const g of s.data.games) { const e = s.an[g.id]?.errs?.[0]; if (e) return 'erreur/' + g.t + '/' + e.ply; } return 'puzzles'; };
// Erreur après « Solution » (body.solved, bandeau de la suite, panneau d'explication) : la bonne suite est menée au pas à
// pas jusqu'à son dernier coup, pour une capture qui ne dépend pas de la vitesse de lecture.
async function solveToEnd(page) {
  await page.locator('#xbar [data-x="show"]').click();
  await page.waitForSelector('#xcap.film', { timeout: 120000 });
  for (let k = 0; k < 60; k++) {
    const next = page.locator('#xbar [data-x="next"]');
    if (await next.isDisabled()) break;
    await next.click();
  }
}
const repJoue = async (page) => { await sleep(900); const t = page.locator('[data-act="gvtab"][data-v="coups"]'); if (await t.isVisible()) await t.click(); const b = page.locator('[data-act="repplay"]').first(); await b.waitFor({ timeout: 30000 }); await b.click(); await page.locator('[data-act="repplay"]').first().waitFor({ timeout: 30000 }); };
const TOUS_ECRANS = [
  ['accueil-bilan', () => { const k = 'cap1000:recap', b = localStorage.getItem(k) || localStorage.getItem(k + '-audit'); if (b) { localStorage.setItem(k, b); localStorage.setItem(k + '-audit', b); } return 'accueil'; }],
  ['accueil', () => { localStorage.removeItem('cap1000:recap'); return 'accueil'; }], ['bilan'], ['plan'], ['puzzles'], ['historique'], ['exos'], ['drill-sur', 'drill/sur'], ['drill-compte', 'drill/compte'],
  ['cours'], ['cours-fiche', 'cours/en_prise_pose/fiche'], ['cours-prive', 'cours/en_prise_pose'],
  ['gagner'], ['ouvertures'], ['ouvertures-apprendre', 'ouvertures/apprendre'], ['ouverture-fiche', 'ouvertures/italienne'],
  ['ligne-reciter', 'ligne/italienne/0'], ['ligne-voir', 'ligne/italienne/0/voir'],
  ['parties'], ['echiquier'], ['stats'], ['entrainer'], ['idees'], ['avantpartie'],
  ['rush'], ['rush-3min', 'rush/t3'], ['finales'], ['finale', 'finale/lucena'],
  ['jouer', () => { const s = window.__cap, g = s.data.games.find((x) => s.an[x.id] && !s.an[x.id].bad); return 'jouer/' + g.t + '/20'; }],
  ['mon-ouverture', () => { const s = window.__cap, g = s.data.games.find((x) => x.w); return 'monouv/w/' + encodeURIComponent(g.fam); }],
  ['partie', () => { const s = window.__cap, g = s.data.games.find((x) => s.an[x.id] && !s.an[x.id].bad); return 'partie/' + g.t; }],
  // Réponses aux coups adverses (20/11) : une ligne jouée d'un clic ouvre une variante ; la carte suivante s'affiche.
  ['partie-variante', () => { const s = window.__cap, g = s.data.games.find((x) => s.an[x.id] && !s.an[x.id].bad); return 'partie/' + g.t + '/1'; }, { act: repJoue }],
  ['echiquier-ligne', 'echiquier', { act: repJoue }],
  // Flèche du meilleur coup masquée (20/11) : plus aucune flèche sur l'échiquier, bouton à l'état « non pressé ».
  ['echiquier-sansfleche', 'echiquier', { act: async (page) => { await repJoue(page); await page.click('[data-act="fbarrow"]'); await page.waitForFunction(() => document.querySelector('[data-act="fbarrow"]')?.getAttribute('aria-pressed') === 'false' && !document.querySelector('#xb svg.cg-shapes g g, #xb .cg-custom-svgs g g, #xb .cg-custom-svgs polyline')); } }],
  // Impact d'un coup en direct (20/11) : 1. f3 e5 2. g4, la gaffe des Blancs (mat en un) doit s'afficher.
  ['echiquier-gaffe', 'echiquier', { act: async (page) => { await page.evaluate(() => { document.querySelector('[data-act="fbreset"]')?.click(); }); await page.locator('details.fbload summary').click(); await page.fill('#fbin', '1. f3 e5 2. g4'); await page.click('[data-act="fbload"]'); await page.locator('#xcap .chip.bad').waitFor({ timeout: 60000 }); } }],
  ['partie-debrief', () => { const s = window.__cap, g = s.data.games.find((x) => s.an[x.id] && !s.an[x.id].bad); return 'partie/' + g.t + '/d'; }],
  ['erreur', ERREUR],
  // Position d'un cours privé : cours simulé injecté dans l'état (jamais enregistré), sur la première erreur analysée.
  ['cours-position', () => {
    const s = window.__cap;
    for (const g of s.data.games) {
      const e = s.an[g.id]?.errs?.[0]; if (!e) continue;
      s.ai.en_prise_pose = { titre: 'Ne plus poser une pièce en prise', accroche: 'Accroche.', idee: 'Idée.', regle: 'Règle.', methode: [], quiz: [],
        positions: [{ i: 0, question: 'Avant de jouer, quelle pièce adverse peut prendre la case où tu vas ?', explication: 'Explication.', retenir: 'À retenir.', indice: 'Indice.' }], ex: [{ t: g.t, ply: e.ply }] };
      s.cl = { id: 'en_prise_pose', step: 1, quiz: {} };
      return 'cours/en_prise_pose';
    }
    return 'cours';
  }],
  // En dernier : la solution vue s'inscrit au journal, remis dans son état d'avant juste après la capture.
  ['erreur-resolue', ERREUR, { act: solveToEnd }],
];
const SCREENS = liste(process.env.ONLY).length ? TOUS_ECRANS.filter(([n]) => liste(process.env.ONLY).includes(n)) : TOUS_ECRANS;
// Un nom inconnu (faute de frappe) ne doit pas donner un « rien à signaler » silencieux.
const inconnus = [
  ...liste(process.env.SIZES).filter((x) => !TOUTES_TAILLES.some((z) => z.id === x)).map((x) => 'taille ' + x),
  ...liste(process.env.ONLY).filter((x) => !TOUS_ECRANS.some(([n]) => n === x)).map((x) => 'écran ' + x),
];
if (inconnus.length || !SIZES.length || !SCREENS.length) {
  console.error('Audit : rien à mesurer, noms inconnus : ' + (inconnus.join(', ') || '(sélection vide)'));
  process.exit(1);
}

// Exécuté dans la page : mesures sur tout ce qui est visible.
function measure([touch, hc, zoom]) {
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
    const big = fsz >= 24 || (fsz >= 18.66 && +cs.fontWeight >= 700), need = big ? 3 : hc ? 7 : 4.5;
    if (ratio < need) out.contrast.push(ratio.toFixed(2) + ' < ' + need + ' « ' + t.slice(0, 30) + ' »');
  }
  // Contraste renforcé : le bord de chaque carte visible atteint 3:1 contre le fond de la page.
  out.edges = [];
  for (const el of hc ? document.querySelectorAll('.card') : []) {
    if (!vis(el) || el.closest('[hidden]')) continue;
    const cs = getComputedStyle(el), page = bgOf(el.parentElement).b, edge = over(rgba(cs.borderTopColor), page);
    const l1 = lum(edge), l2 = lum(page), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (!parseFloat(cs.borderTopWidth) || ratio < 3) out.edges.push(ratio.toFixed(2) + ' < 3 « ' + label(el) + ' »');
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
  // Coordonnées : chaque étiquette reste dans l'échiquier et dans sa case (8 par côté), aucune n'en recouvre une autre.
  out.coords = [];
  for (const w of document.querySelectorAll('.cg-wrap')) {
    if (!vis(w)) continue;
    const B = (w.querySelector('cg-board') || w).getBoundingClientRect(), sq = B.width / 8, boxes = []; // cases réelles : chessground arrondit au multiple de 8
    for (const c of w.querySelectorAll('coords coord')) {
      if (!vis(c.parentElement)) continue;
      const rg = document.createRange(); rg.selectNodeContents(c);
      const r = rg.getBoundingClientRect();
      if (!r.width) continue;
      boxes.push({ t: c.textContent, r });
      const col = Math.floor((r.left - B.left) / sq), row = Math.floor((r.top - B.top) / sq);
      if (r.left < B.left - 0.5 || r.right > B.right + 0.5 || r.top < B.top - 0.5 || r.bottom > B.bottom + 0.5) out.coords.push('« ' + c.textContent + ' » hors de l’échiquier');
      else if (col !== Math.floor((r.right - 0.5 - B.left) / sq) || row !== Math.floor((r.bottom - 0.5 - B.top) / sq)) out.coords.push('« ' + c.textContent + ' » à cheval sur deux cases');
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].r, b = boxes[j].r;
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.coords.push('« ' + boxes[i].t + ' » recouvre « ' + boxes[j].t + ' »');
    }
  }
  const xb = document.querySelector('#xb');
  out.board = xb && vis(xb) ? Math.round(xb.getBoundingClientRect().width) : 0;
  out.wide = !!document.querySelector('.xwide');
  // Libellés courts : jamais sur deux lignes (plus haut que 1,6 fois la hauteur de ligne).
  out.wraps = [];
  for (const el of document.querySelectorAll('#ttl, .tools .chip, .seg2 > *, .actbar .btn, .nav .grp-h span')) {
    if (!vis(el)) continue;
    // Hauteur du texte lui-même (pas de la boîte, qui peut avoir une hauteur minimale ou des marges).
    const cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const rg = document.createRange(); rg.selectNodeContents(el);
    const h = rg.getBoundingClientRect().height;
    if (h > lh * 1.6) out.wraps.push('« ' + label(el) + ' » sur deux lignes');
  }
  // Barre du haut du téléphone (revue HIG, tâche 6) : hors accueil et hors écran à retour (body.imm), le titre de la page
  // est dans la barre (#ttl), sans le logo ni un h1 visible qui le répète ; l'accueil garde le logo et laisse l'Elo à son objectif.
  out.bar = [];
  if (touch) {
    const shown = (el) => !!el && vis(el) && el.getBoundingClientRect().width > 1 && el.getBoundingClientRect().height > 1; // un h1 .vh mesure 1 × 1 px
    const brand = document.querySelector('.brand'), ttl = document.querySelector('#ttl'), t = ttl.textContent.replace(/\s+/g, ' ').trim();
    // Le titre s'abrège avant que les puces de la barre (Elo, série) ne passent sur deux rangs.
    const tops = [...document.querySelectorAll('#tools .chip')].filter(shown).map((c) => Math.round(c.getBoundingClientRect().top));
    if (tops.length > 1 && Math.max(...tops) - Math.min(...tops) > 4) out.bar.push('puces sur deux rangs');
    if ((location.hash.slice(1).split('/')[0] || 'accueil') === 'accueil') {
      if (!shown(brand)) out.bar.push('logo absent de l’accueil');
      if ([...document.querySelectorAll('#tools .chip')].some((c) => shown(c) && /\bElo\b/.test(c.textContent))) out.bar.push('puce Elo sur l’accueil');
    } else if (!document.body.classList.contains('imm')) {
      if (shown(brand)) out.bar.push('logo visible');
      if (!t || !shown(ttl)) out.bar.push('titre absent de la barre');
      else if ([...document.querySelectorAll('h1')].some((h) => shown(h) && h.textContent.replace(/\s+/g, ' ').trim() === t)) out.bar.push('titre répété par un h1 visible');
      // Le titre de la barre est caché aux lecteurs d'écran : le h1 de la page, gardé en .vh, le lit à sa place.
      if (t && (ttl.getAttribute('aria-hidden') !== 'true' || ![...document.querySelectorAll('#view h1.vh')].some((h) => h.textContent.replace(/\s+/g, ' ').trim() === t))) out.bar.push('titre non relu par les lecteurs d’écran');
    }
    // Texte agrandi (312 × 531) : sur un écran d'exercice, le titre de la barre tient en entier (pas de points de suspension).
    if (zoom && document.body.classList.contains('fit') && shown(ttl) && ttl.scrollWidth > ttl.clientWidth + 1) out.bar.push('titre abrégé (' + ttl.scrollWidth + ' px pour ' + ttl.clientWidth + ')');
  }
  // Panneaux qui défilent : tant qu'il reste du contenu dessous, le bord du bas est estompé (classe edge-b).
  out.noEdge = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('cg-container, svg') || /^(TEXTAREA|SELECT|INPUT)$/.test(el.tagName) || !vis(el)) continue;
    if (!/auto|scroll/.test(getComputedStyle(el).overflowY)) continue;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 4 && !el.classList.contains('edge-b')) out.noEdge.push('« ' + label(el) + ' »');
  }
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('cg-container, svg') || !vis(el)) continue;
    const rr = getComputedStyle(el).borderTopLeftRadius;
    if (rr && rr !== '0px') out.radii[rr] = (out.radii[rr] || 0) + 1;
  }
  return out;
}

async function visit(ctx, size, report) {
  const page = await ctx.newPage(), errs = [];
  // Captures reproductibles : les positions tirées au hasard (échauffements, Rush) viennent d'un générateur à graine fixe.
  if (process.env.GLASS) await page.addInitScript(() => { const k = 'cap1000:look', l = JSON.parse(localStorage.getItem(k) || '{}'); if (!l.glass) localStorage.setItem(k, JSON.stringify({ ...l, glass: true })); }); // essai des barres en verre
  await page.addInitScript(() => { let a = 12345; Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
  if (size.hc) await page.emulateMedia({ contrast: 'more' });
  page.on('pageerror', (e) => errs.push(e.message));
  const base = `http://localhost:${PORT}/?u=${USER}&debug`;
  await page.goto(base + '#accueil');
  await page.waitForFunction((n) => window.__cap?.data && !window.__cap.job.running && Object.keys(window.__cap.an).length === n, GAMES.length, { timeout: 240000 });
  fs.mkdirSync(path.join(OUT, size.id), { recursive: true });
  for (const [name, route = name, opt = {}] of SCREENS) {
    if (opt.mobileOnly && !size.mobile) continue;
    const hash = typeof route === 'function' ? await page.evaluate(route) : route;
    const saved = opt.act && await page.evaluate(() => JSON.stringify({ ...localStorage }));
    await page.goto(base + '#' + hash); if (name.startsWith('accueil')) await page.reload(); // même adresse : on recharge pour relire le bilan
    if (opt.act) await opt.act(page);
    await sleep(900);
    // Transition de vue et animations finies avant de mesurer et de photographier (sinon capture à mi-fondu sur une machine chargée).
    await page.evaluate(() => Promise.race([new Promise((r) => setTimeout(r, 4000)), Promise.all([document.activeViewTransition?.finished, ...document.getAnimations().filter((a) => isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished)].map((p) => Promise.resolve(p).catch(() => {})))])).catch(() => {});
    const m = await page.evaluate(measure, [!!size.mobile, !!size.hc, !!size.zoom]);
    m.route = hash; m.errors = errs.splice(0);
    // Heures qui changent d'une exécution à l'autre (pendule du Rush, « À jour, il y a … » de Parties et du Plan, masqué avec sa ligne entière pour que le masque garde la même largeur) : masquées sur la capture seulement.
    await page.screenshot({ path: path.join(OUT, size.id, name + '.png'), mask: [page.locator('.rushclk'), page.locator('.row:has([data-act="refresh"])')], maskColor: '#ff00ff' });
    // Défilés jusqu'en bas : plus de bord estompé sur la dernière ligne.
    m.edgeEnd = await page.evaluate(async () => {
      const bad = [], fr = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (const el of document.querySelectorAll('[data-edge]')) {
        if (!el.getBoundingClientRect().height) continue;
        el.scrollTop = el.scrollHeight; await fr();
        if (el.classList.contains('edge-b')) bad.push('« ' + (el.id || el.className) + ' »');
      }
      return bad;
    });
    // Revue HIG, tâche 9 : sur ordinateur, le bandeau est au-dessus du panneau ; pendant une lecture automatique,
    // le haut du panneau ne bouge pas (onglets des suites et boutons de « Pourquoi… » restent sous le pointeur).
    if (name === 'erreur' && size.id === '1366x768') {
      m.filmShift = 0; m.filmCap = [];
      if (await page.$('#xbar [data-x="show"]')) {
        await page.click('#xbar [data-x="show"]'); await sleep(400);
        const tops = [];
        for (let k = 0; k < 30; k++) {
          const r = await page.evaluate(() => [document.querySelector('#xpanel')?.getBoundingClientRect().top, document.querySelector('#xcap')?.textContent.replace(/\s+/g, ' ').trim()]);
          tops.push(r[0]); m.filmCap.push(r[1]); await sleep(300);
        }
        m.filmShift = Math.round(Math.max(...tops) - Math.min(...tops));
        m.scrollAfterFilm = await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight);
      } else m.filmShift = -1;
    }
    report[size.id][name] = m;
    if (saved) await page.evaluate((k) => { localStorage.clear(); Object.assign(localStorage, JSON.parse(k)); }, saved);
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
      if (m.filmShift === -1) pb.push('lecture automatique : bouton Solution introuvable');
      if (m.filmShift > 1) pb.push('lecture automatique : le panneau bouge de ' + m.filmShift + ' px');
      // Le contrôle du panneau immobile n'a de sens que si le film avance : le texte du bandeau doit changer.
      if (m.filmCap && m.filmShift !== -1 && new Set(m.filmCap).size < 2) pb.push('lecture automatique : le bandeau ne change pas');
      if (m.scrollAfterFilm > 0) pb.push('défile de ' + m.scrollAfterFilm + ' px pendant la lecture');
      if (m.fit && m.scrollY > 0) pb.push('défile de ' + m.scrollY + ' px');
      if (m.scrollX > 0) pb.push('déborde de ' + m.scrollX + ' px');
      if (m.primaries > 1) pb.push(m.primaries + ' boutons pleins');
      if (m.small.length) pb.push(m.small.length + ' textes < 13 px');
      if (m.contrast.length) pb.push(m.contrast.length + ' contrastes faibles');
      if (m.edges.length) pb.push(m.edges.length + ' bords de carte < 3:1 (' + m.edges[0] + ')');
      if (m.taps.length) pb.push(m.taps.length + ' cibles < 44 px');
      if (m.coords.length) pb.push('coordonnées : ' + m.coords.slice(0, 3).join(', '));
      if (m.wide && sid.startsWith('390x') && m.board < 360) pb.push('échiquier de ' + m.board + ' px (360 au moins)');
      if (m.wraps.length) pb.push('libellé sur deux lignes : ' + m.wraps.slice(0, 3).join(', '));
      if (m.bar.length) pb.push('barre du haut : ' + m.bar.join(', '));
      // Revue HIG, tâche 9 : sur ordinateur, le bandeau passe à droite et l'échiquier d'exercice garde au moins 640 px.
      // La relecture a 600 px : ses deux bandeaux de joueurs et pendules (2 × 52 px) prennent la hauteur au-dessus et au-dessous.
      const minD = name.startsWith('partie') ? 600 : 640;
      if ((sid === '1366x768' || sid === '1280x860') && m.fit && m.board < minD) pb.push('échiquier de ' + m.board + ' px (' + minD + ' au moins)');
      // Seuil à 125 % : 200 px pour la relecture ; 170 px après la solution (erreur-resolue) tant que la taille de l'échiquier
      // après la solution n'est pas tranchée (point ouvert du 15/11 dans CLAUDE.md : explication réduite ou défilement permis).
      const minB = name.startsWith('partie') ? 200 : name === 'erreur-resolue' ? 170 : 240;
      if (sid === '312x531' && m.fit && m.board && m.board < minB) pb.push('échiquier de ' + m.board + ' px (' + minB + ' au moins)');
      if (m.noEdge.length) pb.push('panneau qui défile sans bord : ' + m.noEdge.slice(0, 3).join(', '));
      if (m.edgeEnd.length) pb.push('bord estompé gardé en bas du défilement : ' + m.edgeEnd.join(', '));
      if (m.errors.length) pb.push('erreurs JS : ' + m.errors.join(' | '));
      console.log(`${sid.padEnd(9)} ${name.padEnd(21)} ${pb.join(' · ') || 'rien à signaler'}`);
    }
  }
  console.log('Captures et détail : ' + OUT);
  fs.rmSync(dir, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
