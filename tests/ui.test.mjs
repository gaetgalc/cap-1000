// Formats d'affichage sans navigateur : node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dfmt, datef, agoFr, esc, HOW, tile, resWord, resChip, tabs } from '../js/ui.js';

// Aides communes (tâche 9) : chacune rend exactement le HTML des copies qu'elle remplace dans app.js, recopiées ici comme référence.
test('tile rend le HTML des encarts de l’accueil, de la relecture et de la révision', () => {
  const goal = (lab, v, sub = '', cls = '', tip = '') => `<div class="glt"${tip ? ` title="${tip}"` : ''}><span class="small">${lab}</span><b class="num ${cls}">${v}</b>${sub ? `<span class="small">${sub}</span>` : ''}</div>`;
  const gv = (lab, v, cls = '', tip = '') => `<div class="glt"${tip ? ` title="${tip}"` : ''}><span class="small">${lab}</span><b class="num ${cls}">${v}</b></div>`;
  const box = (lab, v, sub, href, tip, cls = '') => `<a class="glt revue" href="${href}" title="${esc(tip)}"><span class="small">${lab}</span><b class="num ${cls}">${v}</b><span class="small">${esc(sub)}</span></a>`;
  const tip = 'Jours consécutifs avec au moins un puzzle ou un cours', svg = '<svg class="spark"><path d="M0 1"/></svg>';
  assert.equal(tile('Il manque', '120 pts', { sub: 'pour atteindre 1000' }), goal('Il manque', '120 pts', 'pour atteindre 1000'));
  assert.equal(tile('Il manque', 'Atteint', { sub: 'pour atteindre 1000', cls: 'up' }), goal('Il manque', 'Atteint', 'pour atteindre 1000', 'up'));
  assert.equal(tile('30 derniers jours', '+12', { sub: svg, cls: 'up' }), goal('30 derniers jours', '+12', svg, 'up'));
  assert.equal(tile('Série', '3 j', { sub: svg, cls: 'warn', tip }), goal('Série', '3 j', svg, 'warn', tip));
  assert.equal(tile('Précision', '81 %'), gv('Précision', '81 %'));
  assert.equal(tile('Elo estimé', 912, { tip: 'Repère : ta précision moyenne (70 %) vaut ton classement moyen (850) ; chaque point compte pour 25 points.' }), gv('Elo estimé', 912, '', 'Repère : ta précision moyenne (70 %) vaut ton classement moyen (850) ; chaque point compte pour 25 points.'));
  const sub = 'Ligne · King\'s Gambit : <ligne> & "suite"', t2 = 'Ligne : a\nFinale : b & "c"';
  assert.equal(tile('À réviser', 2, { sub: esc(sub), href: '#ligne/italienne/1', tip: t2, cls: 'warn' }), box('À réviser', 2, sub, '#ligne/italienne/1', t2, 'warn'));
  assert.equal(tile('Prochaine révision', '3 j', { sub: esc(sub), href: '#finale/escalier', tip: t2 }), box('Prochaine révision', '3 j', sub, '#finale/escalier', t2));
});

test('resChip et resWord rendent les pastilles de résultat de app.js', () => {
  const chip = (out) => `<span class="chip ${out === 'W' ? 'good' : out === 'L' ? 'bad' : ''}">${out === 'W' ? 'Victoire' : out === 'L' ? 'Défaite' : 'Nulle'}</span>`;
  const withHow = (out, how) => `<span class="chip ${out === 'W' ? 'good' : out === 'L' ? 'bad' : ''}">${out === 'W' ? 'Victoire' : out === 'L' ? 'Défaite' : 'Nulle'}${HOW[how] ? ' (' + HOW[how] + ')' : ''}</span>`;
  // Bandeau du joueur (relecture, ligne « Toi ») : résultat vu de ton camp
  const me = (out, how) => { const res = out === 'D' ? 'Nulle' : (out === 'W') === true ? 'Victoire' : 'Défaite', cls = out === 'D' ? '' : (out === 'W') === true ? 'good' : 'bad'; return `<span class="chip ${cls}">${res}${HOW[how] ? ' (' + HOW[how] + ')' : ''}</span>`; };
  for (const out of ['W', 'L', 'D']) {
    assert.equal(resChip(out), chip(out));
    assert.equal(resWord(out), out === 'W' ? 'Victoire' : out === 'L' ? 'Défaite' : 'Nulle');
    for (const how of [...Object.keys(HOW), 'win', '', undefined]) { assert.equal(resChip(out, how), withHow(out, how)); assert.equal(resChip(out, how), me(out, how)); }
  }
});

test('tabs rend les onglets des puzzles, des cours et des parties', () => {
  const pzTabs = (on) => `<div class="seg2 pztabs"><a class="${on === 'mine' ? 'on' : ''}" href="#puzzles">Mes erreurs</a><a class="${on === 'li' ? 'on' : ''}" href="#inedits">Inédits</a><a class="${on === 'hist' ? 'on' : ''}" href="#historique">Historique</a></div>`;
  const PZ = [['mine', '#puzzles', 'Mes erreurs'], ['li', '#inedits', 'Inédits'], ['hist', '#historique', 'Historique']];
  for (const on of ['mine', 'li', 'hist', 'x']) assert.equal(tabs(on, PZ), pzTabs(on));
  assert.equal(tabs('cours', [['cours', '#cours', 'Cours'], ['ouv', '#ouvertures/apprendre', 'Ouvertures']]), '<div class="seg2 pztabs"><a class="on" href="#cours">Cours</a><a class="" href="#ouvertures/apprendre">Ouvertures</a></div>');
});

test('dfmt rend JJ/MM/AA', () => {
  assert.equal(dfmt(Date.UTC(2023, 10, 14, 12) / 1000), '14/11/23');
  assert.equal(dfmt(Date.UTC(2026, 0, 5, 12) / 1000), '05/01/26');
});

test('datef rend la même chaîne que toLocaleDateString', () => {
  const opts = { day: 'numeric', month: 'short' }, f = datef(opts);
  for (let i = 0; i < 50; i++) {
    const ms = Date.UTC(2021, 0, 1, 12) + i * 29 * 86400000;
    assert.equal(f(ms), new Date(ms).toLocaleDateString('fr-FR', opts));
  }
});

test('datef garde le formateur : 10 000 appels de dfmt en moins de 50 ms', () => {
  const t0 = performance.now();
  for (let i = 0; i < 10000; i++) dfmt(1700000000 + i * 3600);
  const ms = performance.now() - t0;
  assert.ok(ms < 50, `${ms.toFixed(1)} ms`);
});

test('agoFr', () => {
  assert.equal(agoFr(30e3), 'à l’instant');
  assert.equal(agoFr(3 * 60e3), 'il y a 3 min');
  assert.equal(agoFr(2 * 3600e3), 'il y a 2 h');
  assert.equal(agoFr(30 * 3600e3), 'hier');
  assert.equal(agoFr(5 * 86400e3), 'il y a 5 jours');
});
