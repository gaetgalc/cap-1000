// Test de bout en bout du parcours d'entraînement, sur des parties simulées (aucun accès réseau réel).
// Lancer : node tests/parcours.js   (nécessite playwright et Chromium ; `api.chess.com` est intercepté)
/* eslint-disable no-console */
const { chromium } = require('playwright');
const fs = require('fs');
const { USER, Chess, GAMES, startServer, stopServer, routeChessCom } = require('./fixture');
const PORT = +process.env.PORT || 8765;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
const check = (ok, label) => { console.log((ok ? 'ok   ' : 'ÉCHEC') + ' ' + label); if (!ok) failed++; };

(async () => {
  await startServer(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await routeChessCom(ctx);
  const S = (fn, arg) => page.evaluate(fn, arg);
  const cur = () => S(() => { const s = window.__cap, id = s.pzOne?.id || s.pz?.redo?.[0] || s.pz?.cur?.id; if (!id) return null; const [t, ply] = id.split(':'); const g = s.data.games.find((x) => String(x.t) === t); const e = s.an[g.id].errs.find((x) => String(x.ply) === ply); return { id, best: e.best, w: g.w }; });
  const tap = async (sel, sq, w) => { const b = await page.locator(sel + ' cg-board').boundingBox(), f = sq.charCodeAt(0) - 97, r = +sq[1] - 1; await page.touchscreen.tap(b.x + ((w ? f : 7 - f) + 0.5) * b.width / 8, b.y + ((w ? 7 - r : r) + 0.5) * b.height / 8); };
  const ls = (k) => S((k2) => JSON.parse(localStorage.getItem('cap1000:' + k2) || 'null'), k);
  const bar = (sel) => S((s) => document.querySelector(s)?.innerText.replace(/\s+/g, ' ') || '', sel);

  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#accueil`);
  await page.waitForFunction(() => window.__cap?.data && window.__cap.job.total > 0 && !window.__cap.job.running, null, { timeout: 180000 });
  check(await S(() => Object.keys(window.__cap.an).length) === GAMES.length, 'import et analyse des parties simulées');
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#accueil`); await sleep(600);
  check(await S(() => document.querySelectorAll('.home .stepper li').length === 4 && document.querySelectorAll('.home .btn.pri').length === 1 && !!document.querySelector('.gstrip') && !!document.querySelector('.lgame a[href^="#erreur/"]')), 'accueil : objectif, séance à un seul bouton, dernière partie avec son erreur');
  check(await S(() => document.documentElement.scrollHeight <= innerHeight && document.querySelector('.lgame').getBoundingClientRect().bottom <= document.querySelector('#nav').getBoundingClientRect().top), 'accueil : rien ne défile, tout est au-dessus de la barre du bas');
  // Navigation à 4 entrées (16/11) : chaque entrée ouvre un volet de ses pages ; sur téléphone, le premier appui ouvre, le second ferme
  check(/dernières parties/.test(await bar('.brief .bdiag')) && /Objectif|Joue et analyse/.test(await bar('.brief .fnums')), 'accueil : le mot du coach donne un diagnostic chiffré et un objectif');
  await page.setViewportSize({ width: 390, height: 664 }); await sleep(300);
  check(await S(() => document.querySelector('.lgbtn').getBoundingClientRect().bottom <= document.querySelector('#nav').getBoundingClientRect().top), 'accueil en 390 × 664 : les boutons de la dernière partie restent au-dessus de la barre du bas');
  await page.setViewportSize({ width: 390, height: 760 }); await sleep(300);
  check(await S(() => document.querySelectorAll('#nav .grp-h').length === 4 && document.querySelector('#nh-ent').dataset.grp.split(' ').includes('cours')), 'navigation : 4 entrées, S’entraîner couvre aussi les cours');
  await page.tap('#nh-ent'); await sleep(250);
  check(await S(() => location.hash === '#accueil' && document.querySelector('#nh-ent').getAttribute('aria-expanded') === 'true' && [...document.querySelectorAll('#fly-ent a')].every((a) => a.getBoundingClientRect().height >= 44) && document.querySelector('#fly-ent').getBoundingClientRect().bottom <= document.querySelector('#nh-ent').getBoundingClientRect().top), 'navigation : un appui ouvre le volet au-dessus de la barre, cibles de 44 px, sans changer de page');
  await page.tap('#nh-ent'); await sleep(200);
  check(await S(() => document.querySelector('#nh-ent').getAttribute('aria-expanded') === 'false' && !document.querySelector('#fly-ent a').offsetParent), 'navigation : un second appui ferme le volet');
  await page.tap('#nh-pro'); await sleep(250); await page.tap('#fly-pro a[href="#stats"]'); await sleep(600);
  check(await S(() => location.hash === '#stats' && document.querySelector('#nh-pro').classList.contains('on') && document.querySelector('#nh-pro').getAttribute('aria-expanded') === 'false'), 'navigation : un lien du volet mène à sa page et referme le volet');
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#bilan`); await sleep(600);
  check(await S(() => !!document.querySelector('#rc svg') && !!document.querySelector('.focus') && !!document.querySelector('.sig')), 'Mon jeu : classement, chantier détaillé, points forts et faibles');

  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#puzzles`); await sleep(600);
  let c = await cur();
  check(!!c, 'un puzzle est proposé');
  await tap('#xb', c.best.slice(0, 2), c.w); await sleep(250);
  check(await S(() => document.querySelectorAll('#xb square.move-dest').length) > 0, 'les cases possibles de la pièce choisie sont marquées');
  await tap('#xb', c.best.slice(2, 4), c.w); await sleep(900);
  check(/Pause/.test(await bar('#xbar')), 'après le bon coup, la suite se joue toute seule');
  for (let k = 0; k < 250 && !/Revoir|Voir mon erreur/.test(await bar('#xbar')); k++) await sleep(200);
  check(/Revoir|Voir mon erreur/.test(await bar('#xbar')) && /Bilan/.test(await bar('#xcap')), 'la lecture va au bout et affiche le bilan');
  check((await ls('hist')).length === 1 && (await ls('hist'))[0].r === 2, 'le puzzle est noté dans le journal (du premier coup)');
  check(await S(() => Object.values(window.__cap.an).every((a) => a.bad || a.mp)), 'chaque analyse cherche les coups qui tenaient sur les positions d’erreur');
  check(/Facile · 3 j/.test(await bar('#xpanel .rate')), 'après une réussite du premier coup, l’avis facile ou difficile est proposé avec son délai');
  const due1 = (await ls('pz'))[c.id].due;
  await page.click('#xpanel .rate [data-v="e"]'); await sleep(200);
  await page.click('#xpanel .whyq [data-v="vu"]'); await sleep(200);
  check((await ls('why'))?.[c.id]?.c === 'vu' && await S(() => !!document.querySelector('#xpanel .whyq [data-v="vu"].on')), 'pourquoi l’erreur : la réponse est notée et reste sélectionnée');
  check(/Copier la question pour Claude/.test(await bar('#xpanel [data-x="ask"]')), 'sans clé API, « Demande au coach » propose de copier la question');
  await page.click('#xpanel [data-x="ask"]'); await sleep(400);
  check(await S(() => /Trait aux/.test(document.querySelector('#xpanel .askout textarea')?.value || '') || /Question copiée/.test(document.body.innerText)), 'la question pour Claude est copiée, ou affichée à copier');
  check((await ls('pz'))[c.id].due - due1 === 2 * 86400000 && await S(() => document.querySelector('#xpanel .rate [data-v="e"]').classList.contains('on')), '« Facile » repousse le retour du puzzle (1 jour → 3 jours)');

  await page.reload(); await sleep(900);
  const c2 = await cur();
  check(c2 && c2.id !== c.id, 'après rechargement, le puzzle fait ne revient pas');
  check(/^1/.test(await bar('#tools .pzprog')), 'après rechargement, l’avancée du jour est conservée');

  let n = 1;
  for (let k = 0; k < 12 && !(await S(() => !!document.querySelector('.recap'))); k++) { await page.click('[data-x="show"]'); await sleep(250); await page.click('[data-act="pznext"]'); await sleep(350); n++; }
  check(await S(() => !!document.querySelector('.recap')), 'un bilan apparaît quand l’objectif du jour est atteint');
  n = (await ls('hist')).length;
  check(await S(() => !!document.querySelector('[data-act="pzredo"]')), 'le bilan propose de refaire les ratés');
  const due = Object.entries(await ls('pz')).filter(([id]) => id !== c.id).map(([, p]) => p.due - Date.now()); // c : jugé « facile » plus haut
  check(due.every((d) => d > 0 && d <= 86400000), 'les puzzles du jour reviennent demain au plus tôt');

  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#historique`); await sleep(500);
  check(await S(() => document.querySelectorAll('.hrow').length) === n, `l’historique liste les ${n} puzzles`);

  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#drill/sur`); await sleep(600);
  if (await S(() => window.__cap.dr.items.length >= 3)) {
    for (let k = 0; k < 2; k++) { await page.click('#xbar .btn'); await sleep(150); await page.click('[data-act="drnext"]'); await sleep(250); }
    await page.reload(); await sleep(800);
    check(await S(() => window.__cap.dr?.i) === 2, 'un échauffement interrompu reprend à la même position');
  }
  // ---- Pendule, erreurs répétées ----
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#stats`); await sleep(600);
  check(/Tes erreurs et la pendule/.test(await bar('#view')), 'la page Stats montre les erreurs selon la pendule');
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#ouvertures`); await sleep(400);
  check(/Ouvertures/.test(await bar('#view')), 'la page Ouvertures s’affiche avec le bloc des erreurs qui reviennent');

  // ---- Relecture d'une partie : meilleur coup affiché par défaut ----
  const g0 = await S(() => { const s = window.__cap, g = s.data.games.find((x) => s.an[x.id] && !s.an[x.id].bad); return { t: g.t, id: g.id }; });
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#partie/${g0.t}`); await sleep(700);
  const shapes = () => S(() => { const v = window.__cap.gv; return { k: v.k, best: v.a.best[v.k], err: !!v.errAt[v.k], next: v.mv[v.k] && v.mv[v.k].from + v.mv[v.k].to, sh: v.cg.state.drawable.autoShapes.map((x) => x.orig + (x.dest || x.ldest || '') + ':' + (x.brush || x.lbrush)) }; });
  let okAll = true, okRed = true;
  for (let i = 0; i < 8; i++) {
    const s = await shapes();
    if (s.best && !s.sh.includes(s.best.slice(0, 4) + ':green')) { okAll = false; console.log('  position', s.k, s); }
    if (s.best && !s.err && s.next && s.next !== s.best.slice(0, 4) && !s.sh.includes(s.next + ':red')) { okRed = false; console.log('  rouge', s.k, s); }
    await page.click('#xbar [aria-label="Coup suivant"]'); await sleep(150);
  }
  check(okAll, 'relecture : flèche verte du meilleur coup sur chaque position, sans clic');
  check(okRed, 'relecture : flèche rouge du coup joué quand il diffère du meilleur');
  check(/Meilleur /.test(await bar('#xcap')) || (await shapes()).err, 'relecture : le bandeau nomme le meilleur coup');
  check(await page.locator('#xb svg.cg-shapes g, #xb svg g').count() > 0, 'relecture : la flèche est dessinée sur l’échiquier');
  // Façon « Game Review » : barre d'évaluation, liste de coups, erreur suivante, courbe cliquable, symbole sur la case
  const gvState = () => S(() => { const v = window.__cap.gv; return { k: v.k, ev: document.querySelector('#gvev')?.style.getPropertyValue('--ev'), cur: document.querySelector('#gvm .mv.cur')?.dataset.k, keys: v.keys, mark: [...document.querySelectorAll('#xb .cg-custom-svgs text')].map((x) => x.textContent).join('') }; });
  let gs = await gvState();
  check(gs.ev !== '' && gs.ev != null && +gs.cur === gs.k, 'relecture : barre d’évaluation et coup courant surligné dans la liste');
  if (gs.keys.length) {
    await page.click('#xbar [aria-label="Erreur suivante"]'); await sleep(300); gs = await gvState();
    const e1 = gs.keys.find((p) => p > 8) ?? null;
    check(e1 == null || gs.k === e1, 'relecture : « Erreur suivante » mène au moment clé');
    if (e1 != null) { await page.click(`#gvm .mv[data-k="${e1 + 1}"]`); await sleep(300); gs = await gvState(); check(gs.k === e1 + 1 && /\?/.test(gs.mark), 'relecture : clic sur un coup de la liste, symbole de l’erreur sur la case'); }
  }
  await page.locator('#evc rect').click({ position: { x: 1, y: 20 } }); await sleep(300);
  check((await gvState()).k === 0, 'relecture : clic sur la courbe, retour au début');
  // Saut de cavalier : flèche en L dessinée à la main, pas de diagonale.
  await S(() => window.__cap.gv.cg.setAutoShapes([{ orig: 'b1', dest: 'c3', brush: 'green' }, { orig: 'e2', dest: 'e4', brush: 'red' }])); await sleep(200);
  check(await S(() => { const a = window.__cap.gv.cg.state.drawable.autoShapes; return !!a[0].customSvg && !a[0].dest && a[0].ldest === 'c3' && !a[1].customSvg; }) && await page.locator('#xb .cg-custom-svgs polyline').count() === 1, 'cavalier : flèche en L, les autres pièces gardent la flèche droite');

  // ---- Relecture : l'échiquier se joue, un autre coup ouvre une variante évaluée ----
  await page.keyboard.press('Home'); await sleep(300);
  const gw = await S(() => window.__cap.gv.g.w), gt = await S(() => window.__cap.gv.g.t);
  const alt0 = await S(() => { const v = window.__cap.gv, real = v.mv[0]; return new Chess(v.fens[0]).moves({ verbose: true }).find((x) => x.from + x.to !== real.from + real.to); });
  const real0 = await S(() => window.__cap.gv.mv[0]);
  await tap('#xb', real0.from, gw); await sleep(150); await tap('#xb', real0.to, gw); await sleep(400);
  check(await S(() => window.__cap.gv.k === 1 && !window.__cap.gv.var), 'relecture : jouer le coup de la partie avance d’un coup');
  await page.click('#xbar [aria-label="Coup précédent"]'); await sleep(300);
  await tap('#xb', alt0.from, gw); await sleep(150); await tap('#xb', alt0.to, gw); await sleep(400);
  check(await S(() => window.__cap.gv.var?.mv.length === 1) && /Variante/.test(await bar('#xcap')) && /Revenir à la partie/.test(await bar('#xbar')), 'relecture : un autre coup ouvre une variante');
  await page.waitForFunction(() => /éval [-+0-9M]/.test(document.querySelector('#xcap')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  check(/éval [-+0-9M]/.test(await bar('#xcap')), 'relecture : la variante est évaluée par le moteur');
  const rep = await S(() => new Chess(window.__cap.gv.var.fens[1]).moves({ verbose: true })[0]);
  await tap('#xb', rep.from, gw); await sleep(150); await tap('#xb', rep.to, gw); await sleep(400);
  check(await S(() => window.__cap.gv.var?.mv.length === 2), 'relecture : l’autre camp se joue aussi dans la variante');
  await page.click('#xbar [data-act="vexit"]'); await sleep(300);
  check(await S(() => !window.__cap.gv.var && window.__cap.gv.k === 0), 'relecture : retour à la partie au coup de départ');
  await page.click('#xcap [data-act="dbgo"]'); await sleep(400);
  check(/Débrief 1 \//.test(await bar('#xcap')) && /Moment suivant/.test(await bar('#xbar')), 'débrief : le coach raconte la partie, premier moment');
  const t1 = await bar('#xcap');
  await page.click('#xbar [data-act="dbgo"][data-i="1"]'); await sleep(400);
  check(/Débrief 2 \//.test(await bar('#xcap')) && await bar('#xcap') !== t1 && await S(() => window.__cap.gv.k === window.__cap.gv.dbl[1].ply), 'débrief : moment suivant, l’échiquier suit');
  await page.click('#xbar [data-act="dbend"]'); await sleep(300);
  check(await S(() => window.__cap.gv.db == null) && !/Débrief \d/.test(await bar('#xcap')), 'débrief : on le quitte pour revenir à la relecture');
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#partie/${gt}/d`); await sleep(800);
  check(/Débrief 1 \//.test(await bar('#xcap')), 'débrief : l’adresse #partie/<partie>/d l’ouvre directement');

  // ---- Gagner les parties gagnées ----
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#gagner`); await sleep(500);
  const firstCv = await S(() => document.querySelector('#view .menu a.mrow')?.getAttribute('href'));
  if (firstCv) {
    await page.goto(`http://localhost:${PORT}/?u=${USER}&debug${firstCv}`); await sleep(700);
    const { fen, w } = await S(() => ({ fen: window.__cap.cvCur.fen, w: window.__cap.cvCur.it.g.w }));
    const mv = new Chess(fen).moves({ verbose: true })[0];
    await tap('#xb', mv.from, w); await sleep(200); await tap('#xb', mv.to, w);
    await page.waitForFunction(() => window.__cap.cv?.moves.length >= 2 || window.__cap.cv?.over, null, { timeout: 60000 });
    check(true, 'partie gagnante rejouée : le moteur répond au coup joué');
    await page.reload(); await sleep(900);
    check(await S(() => window.__cap.cv?.moves.length) >= 2, 'après rechargement, la partie rejouée reprend au même coup');
    if (await S(() => !window.__cap.cv.over)) { await page.click('[data-x="resign"]'); await sleep(300); }
    check((await ls('hist')).some((h) => h.k === 'c') && /Recommencer/.test(await bar('#xbar')), 'fin de partie notée au journal, avec Recommencer');
  } else check(true, 'aucune partie gagnante gâchée dans les parties simulées (écran non testé)');

  // ---- Apprendre les ouvertures ----
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#ouvertures/apprendre`); await sleep(500);
  check(await S(() => document.querySelectorAll('#view .oprow').length) === 7, 'Apprendre : liste compacte, 7 ouvertures avec les Blancs');
  await page.click('[data-act="opgrp"][data-g="e4"]'); await sleep(300);
  check(await S(() => document.querySelectorAll('#view .oprow').length) === 5, 'Apprendre : filtre « Noirs contre 1.e4 »');
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#ouvertures/italienne`); await sleep(600);
  check(await S(() => document.querySelectorAll('#view .lnrow').length) === 6 && await S(() => !!document.querySelector('#opb cg-board')), 'fiche : position et lignes visibles d’emblée');
  await page.click('[data-act="optab"][data-tab="histoire"]'); await sleep(300);
  check(/Polerio/.test(await bar('#view')) && await S(() => !document.querySelector('#view .lnrow')), 'fiche : un seul bloc à la fois (onglet Histoire)');
  const playLine = async (moves, w, wrongAt) => {
    const c2 = new Chess();
    for (const [i, sanM] of moves.entries()) {
      const before = c2.fen(), m = c2.move(sanM);
      if ((i % 2 === 0) !== w) { await page.waitForFunction((n) => window.__cap && document.querySelector('#lnmoves')?.textContent.split(' ').length >= n, i + 1, { timeout: 5000 }).catch(() => {}); await sleep(150); continue; }
      if (i === wrongAt) { const alt = new Chess(before).moves({ verbose: true }).find((x) => x.san !== sanM); await tap('#xb', alt.from, w); await sleep(150); await tap('#xb', alt.to, w); await sleep(1200); }
      await tap('#xb', m.from, w); await sleep(150); await tap('#xb', m.to, w); await sleep(300);
    }
    await sleep(600);
  };
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#ligne/italienne/1`); await sleep(600);
  await playLine('e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3'.split(' '), true);
  let o1 = (await ls('hist')).filter((h) => h.k === 'o').at(-1);
  check(o1 && o1.id === 'italienne:1' && o1.r === 2 && /Ligne récitée sans faute/.test(await bar('#xcap')), 'ligne récitée de mémoire avec les Blancs : notée sans faute');
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#ligne/francaise/1`); await sleep(600);
  await playLine('e4 e6 d4 d5 exd5 exd5 Bd3 Nc6 c3 Bd6 Nf3 Nge7 O-O Bg4'.split(' '), false, 3);
  o1 = (await ls('hist')).filter((h) => h.k === 'o').at(-1);
  check(o1 && o1.id === 'francaise:1' && o1.r === 1, 'ligne avec les Noirs : les coups blancs viennent seuls, une faute donne « avec aide »');
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#ligne/italienne/0/voir`); await sleep(1200);
  check(/Pause/.test(await bar('#xbar')) && await S(() => document.querySelectorAll('#lnp ol.line li').length) === 17, 'Découvrir : la ligne se joue toute seule, commentée');

  // ---- Sauvegarde et restauration ----
  await S(() => localStorage.setItem('cap1000:key', JSON.stringify('sk-ant-test')));
  await page.goto(`http://localhost:${PORT}/?u=${USER}&debug#plan`); await sleep(500);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="bakexp"]')]);
  const file = await dl.path(), txt = fs.readFileSync(file, 'utf8'), bk = JSON.parse(txt);
  check(bk.app === 'cap1000' && bk.db.data.games.length === GAMES.length && bk.ls.hist.length > 0 && !txt.includes('sk-ant-test'), 'sauvegarde téléchargée : parties, analyses, journal, sans la clé du coach');
  const nHist = bk.ls.hist.length;
  await S(() => { localStorage.removeItem('cap1000:hist'); localStorage.removeItem('cap1000:pz'); });
  page.once('dialog', (d) => d.accept());
  await page.setInputFiles('#bakfile', file); await sleep(1200);
  check((await ls('hist'))?.length === nHist && Object.keys(await ls('pz') || {}).length > 0 && await ls('key') === 'sk-ant-test', 'restauration : journal et puzzles revenus, clé de l’appareil conservée');

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
  nErr = await tamper('delete a.mp; for (const e of a.errs) delete e.alt;'); // analyses d'avant la recherche des coups qui tiennent
  await page.reload();
  await page.waitForFunction(() => window.__cap?.job.total > 0 && !window.__cap.job.running, null, { timeout: 180000 });
  check(await S(() => Object.values(window.__cap.an).every((a) => a.bad || a.mp)) && await errCount() === nErr, 'analyses sans coups qui tiennent : complétées une fois, mêmes erreurs');

  check(errs.length === 0, 'aucune erreur JavaScript' + (errs.length ? ' : ' + errs.join(' | ') : ''));
  await browser.close(); stopServer();
  console.log(failed ? `\n${failed} échec(s)` : '\nTout passe.');
  process.exit(failed ? 1 : 0);
})();
