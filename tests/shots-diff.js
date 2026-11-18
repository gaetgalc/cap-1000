// Comparaison pixel à pixel de deux dossiers d'audit (captures PNG de même nom, sous-dossier par taille).
// Lancer : node tests/shots-diff.js <dossierA> <dossierB> [seuil=0]
// seuil : part maximale de pixels changés par écran, en % (0 = aucun écart toléré). Sort en erreur si un écran la dépasse
// ou si un écran manque d'un côté. Le décodage se fait dans Chromium (canvas) : aucune dépendance.
/* eslint-disable no-console */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [A, B, TH = '0'] = process.argv.slice(2), SEUIL = parseFloat(TH);
if (!A || !B) { console.error('Usage : node tests/shots-diff.js <dossierA> <dossierB> [seuil=0]'); process.exit(2); }

const pngs = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => fs.readdirSync(path.join(dir, d.name)).filter((f) => f.endsWith('.png')).map((f) => d.name + '/' + f)) : [];

(async () => {
  const la = pngs(A), lb = pngs(B), sa = new Set(la), sb = new Set(lb);
  const missing = [...la.filter((f) => !sb.has(f)).map((f) => f + ' (absent de B)'), ...lb.filter((f) => !sa.has(f)).map((f) => f + ' (absent de A)')];
  const common = la.filter((f) => sb.has(f));
  const browser = await chromium.launch(), page = await browser.newPage();
  await page.setContent('<canvas></canvas>');
  const diff = async (b64a, b64b) => page.evaluate(async ([x, y]) => {
    const load = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data }; };
    const a = await load(x), b = await load(y);
    if (a.w !== b.w || a.h !== b.h) return { size: `${a.w}×${a.h} contre ${b.w}×${b.h}` };
    let n = 0;
    for (let i = 0; i < a.d.length; i += 4) if (a.d[i] !== b.d[i] || a.d[i + 1] !== b.d[i + 1] || a.d[i + 2] !== b.d[i + 2] || a.d[i + 3] !== b.d[i + 3]) n++;
    return { n, total: a.w * a.h };
  }, [b64a, b64b]);
  const res = [];
  for (const f of common) {
    const r = await diff(fs.readFileSync(path.join(A, f)).toString('base64'), fs.readFileSync(path.join(B, f)).toString('base64'));
    res.push({ f, ...r, pct: r.size ? 100 : 100 * r.n / r.total });
  }
  await browser.close();
  const diffs = res.filter((r) => r.pct > SEUIL);
  for (const r of diffs) console.log(`${r.f.padEnd(40)} ${r.size ? 'taille différente : ' + r.size : r.pct.toFixed(3) + ' % des pixels (' + r.n + ')'}`);
  for (const m of missing) console.log(m);
  console.log(`${common.length} écrans comparés, ${diffs.length} différent${diffs.length > 1 ? 's' : ''}${SEUIL ? ' au-delà de ' + SEUIL + ' %' : ''}, ${missing.length} manquant${missing.length > 1 ? 's' : ''}.`);
  process.exit(diffs.length || missing.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
