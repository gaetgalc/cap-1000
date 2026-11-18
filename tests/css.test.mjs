// Feuille de style : une accolade oubliée (souvent à la fusion de deux branches) range silencieusement toutes les règles
// suivantes dans le bloc @media resté ouvert. Les navigateurs ne signalent rien : ce test le fait.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('css/app.css : accolades équilibrées, aucun bloc resté ouvert', () => {
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ''));
  let depth = 0, open = 0;
  css.split('\n').forEach((l, i) => {
    if (depth === 0 && l.includes('{')) open = i + 1;
    depth += (l.match(/{/g) || []).length - (l.match(/}/g) || []).length;
    assert.ok(depth >= 0, `accolade fermante en trop ligne ${i + 1}`);
  });
  assert.equal(depth, 0, `bloc ouvert ligne ${open} jamais fermé`);
});

// Revue HIG (17/11, D2 = B) : une couleur, un sens. Une icône de section ne doit pas prendre la teinte d'un état
// (avertissement, erreur) : au moins 40° d'écart de teinte entre chaque couleur de section et chaque couleur d'état.
const rootTokens = () => {
  const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const root = css.match(/:root\s*{([^}]*)}/)[1];
  return Object.fromEntries([...root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};
const hue = (hex) => {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const gap = (a, b) => { const d = Math.abs(hue(a) - hue(b)); return Math.min(d, 360 - d); };

test('css/app.css : couleurs de section à 40° au moins des couleurs d’état', () => {
  const t = rootTokens();
  for (const sec of ['--c-train', '--c-games', '--c-prog']) {
    for (const st of ['--warn', '--bad']) {
      const d = gap(t[sec], t[st]);
      assert.ok(d >= 40, `${sec} (${t[sec]}) et ${st} (${t[st]}) : ${Math.round(d)}° d’écart, il en faut 40`);
    }
  }
});
