// Site installable sur l'écran d'accueil (23/11) : manifeste, icônes et réglages iPhone. Une app installée échappe à
// l'effacement des données qu'applique Safari à un site non ouvert depuis 7 jours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const attr = (re) => html.match(re)?.[1];
// Largeur et hauteur lues dans l'en-tête PNG (IHDR)
const pngSize = (f) => { const b = readFileSync(resolve(root, f)); assert.equal(b.toString('latin1', 1, 4), 'PNG', `${f} n'est pas un PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('index.html déclare le manifeste et les réglages iPhone', () => {
  assert.equal(attr(/<link rel="manifest" href="([^"]+)"/), 'manifest.webmanifest');
  assert.ok(attr(/<link rel="apple-touch-icon" href="([^"]+)"/), 'icône iPhone');
  assert.equal(attr(/<meta name="apple-mobile-web-app-capable" content="([^"]+)"/), 'yes');
  assert.equal(attr(/<meta name="apple-mobile-web-app-status-bar-style" content="([^"]+)"/), 'black');
  assert.equal(attr(/<meta name="apple-mobile-web-app-title" content="([^"]+)"/), 'Cap 1000');
  assert.match(attr(/<meta name="theme-color" content="([^"]+)"/) || '', /^#[0-9a-f]{6}$/i);
});

test('le manifeste ouvre le site en plein écran, avec ses icônes', () => {
  const m = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.lang, 'fr');
  assert.ok(m.name && m.short_name && m.short_name.length <= 12);
  for (const s of [192, 512]) {
    const i = m.icons.find((x) => x.sizes === `${s}x${s}` && (x.purpose || 'any').includes('any'));
    assert.ok(i, `icône ${s}`);
    assert.deepEqual(pngSize(i.src), [s, s]);
  }
  const mask = m.icons.find((x) => x.purpose === 'maskable');
  assert.ok(mask && existsSync(resolve(root, mask.src)), 'icône adaptable (Android)');
});

test("l'icône iPhone fait 180 px", () => {
  assert.deepEqual(pngSize(attr(/<link rel="apple-touch-icon" href="([^"]+)"/)), [180, 180]);
});

test('installed : app ouverte depuis l’écran d’accueil (iPhone ou norme), sinon non', async () => {
  const { installed, iosBrowser } = await import('../js/ui.js');
  const win = (standalone, ios, mq) => ({ navigator: { standalone, userAgent: ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : 'Mozilla/5.0 (X11; Linux x86_64)', maxTouchPoints: 0 }, matchMedia: () => ({ matches: mq }) });
  assert.equal(installed(win(true, true, false)), true);
  assert.equal(installed(win(undefined, false, true)), true);
  assert.equal(installed(win(false, true, false)), false);
  assert.equal(iosBrowser(win(false, true, false)), true, 'Safari sur iPhone, non installé');
  assert.equal(iosBrowser(win(true, true, false)), false, 'déjà installé');
  assert.equal(iosBrowser(win(undefined, false, false)), false, 'ordinateur');
});
