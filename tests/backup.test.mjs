// Format de la sauvegarde : jamais de clé API, refus des fichiers étrangers. node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { pack, unpack, summary, FORMAT } = await import('../js/backup.js');

test('sauvegarde : tout sauf la clé du coach, et relecture à l’identique', () => {
  const b = pack('gaet', { key: 'sk-ant-secret', model: 'm', pz: { a: { box: 1 } }, hist: [{ k: 'm' }], user: 'gaet' }, { data: { games: [1, 2] }, an: { x: {} }, ai: {} }, 5);
  assert.equal(b.format, FORMAT);
  assert.ok(!JSON.stringify(b).includes('sk-ant'), 'la clé n’est pas dans le fichier');
  const r = unpack(JSON.parse(JSON.stringify(b)));
  assert.equal(r.user, 'gaet'); assert.deepEqual(r.ls.pz, { a: { box: 1 } }); assert.equal(r.ls.key, undefined);
  assert.deepEqual(summary(r), { games: 2, an: 1, pz: 1, h: 1, date: new Date(5) });
});

test('restauration : fichier étranger ou trop récent refusé avec un message clair', () => {
  assert.throws(() => unpack({ hello: 1 }), /pas une sauvegarde/);
  assert.throws(() => unpack({ app: 'cap1000', format: FORMAT + 1, user: 'x', ls: {}, db: {} }), /plus récente/);
  assert.equal(unpack({ app: 'cap1000', format: 1, user: 'x', ls: { key: 'k' }, db: {} }).ls.key, undefined, 'une clé glissée dans le fichier est ignorée');
});
