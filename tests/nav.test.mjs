// Sections de la navigation et cible d'un onglet du téléphone. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { sectionOf, tabTarget, ROOT, SECTIONS } = await import('../js/nav.js');

test('sectionOf', () => {
  assert.equal(sectionOf('#partie/1700000000/12'), 'par');
  assert.equal(sectionOf('#ouvertures'), 'par');
  assert.equal(sectionOf('#ouvertures/italienne'), 'ent');
  assert.equal(sectionOf('#avantpartie'), 'acc');
  assert.equal(sectionOf('#cours/x'), 'ent');
  assert.equal(sectionOf('#inconnu'), null);
  assert.equal(sectionOf(''), 'acc');
});
test('tabTarget', () => {
  assert.equal(tabTarget('ent', '#accueil', {}), '#entrainer');
  assert.equal(tabTarget('pro', '#parties', { pro: '#stats' }), '#stats');
  assert.equal(tabTarget('pro', '#stats', { pro: '#stats' }), '#bilan');
  assert.equal(tabTarget('par', '#accueil', { par: '#bilan' }), '#parties'); // mémoire invalide
});
test('chaque entrée est dans sa section', () => {
  for (const [s, r] of Object.entries(ROOT)) assert.ok(SECTIONS[s].includes(r));
});
