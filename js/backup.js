// Sauvegarde et restauration : toute la progression d'un appareil dans un seul fichier JSON.
// Parties, analyses et cours privés (IndexedDB) + répétition espacée, journal, activité, chantier, réglages (localStorage).
// La clé API du coach n'est jamais exportée. pack et unpack sont purs (tests/backup.test.mjs) ; le reste lit et écrit le stockage.
import { dbGet, dbSet, ls } from './store.js';

export const FORMAT = 1;
const SECRET = ['key']; // jamais dans le fichier
const DEVICE = ['key', 'model']; // conservés sur l'appareil lors d'une restauration

// lsAll : { clé sans préfixe: valeur }. db : { data, an, ai } du compte.
export function pack(user, lsAll, db, now = Date.now()) {
  const keep = Object.fromEntries(Object.entries(lsAll).filter(([k]) => !SECRET.includes(k)));
  return { app: 'cap1000', format: FORMAT, at: now, user, ls: keep, db: { data: db.data || null, an: db.an || {}, ai: db.ai || {} } };
}
// Vérifie un fichier lu et en tire ce qu'il faut écrire. Lève une erreur en français si le fichier ne convient pas.
export function unpack(obj) {
  if (!obj || obj.app !== 'cap1000' || typeof obj.user !== 'string' || !obj.ls || !obj.db) throw new Error('Ce fichier n’est pas une sauvegarde de Cap 1000.');
  if (obj.format > FORMAT) throw new Error('Sauvegarde faite par une version plus récente du site : recharge la page puis réessaie.');
  const lsOut = Object.fromEntries(Object.entries(obj.ls).filter(([k]) => !SECRET.includes(k)));
  return { user: obj.user, at: obj.at, ls: { ...lsOut, user: obj.user }, db: obj.db };
}
// Résumé lisible d'une sauvegarde, pour la confirmation.
export function summary(b) {
  const games = b.db.data?.games?.length || 0, an = Object.keys(b.db.an || {}).length, pz = Object.keys(b.ls.pz || {}).length, h = (b.ls.hist || []).length;
  return { games, an, pz, h, date: b.at ? new Date(b.at) : null };
}

function lsAll() {
  const out = {};
  try { for (const k of Object.keys(localStorage)) if (k.startsWith('cap1000:')) { try { out[k.slice(8)] = JSON.parse(localStorage.getItem(k)); } catch { /* valeur illisible */ } } } catch { /* stockage indisponible */ }
  return out;
}
// Télécharge le fichier de sauvegarde. Renvoie son nom.
export async function exportFile(user) {
  const b = pack(user, lsAll(), { data: await dbGet('data:' + user), an: await dbGet('an:' + user), ai: await dbGet('ai:' + user) });
  const name = `cap1000-${user}-${new Date().toLocaleDateString('sv')}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  ls.set('bak', Date.now());
  return name;
}
// Lit un fichier choisi par l'utilisateur : renvoie la sauvegarde vérifiée, sans rien écrire.
export async function readFile(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { throw new Error('Fichier illisible : choisis le fichier .json téléchargé depuis Cap 1000.'); }
  return unpack(obj);
}
// Remplace les données de l'appareil par la sauvegarde. La clé du coach et le modèle choisi restent.
export async function restore(b) {
  ls.clear(DEVICE);
  for (const [k, v] of Object.entries(b.ls)) if (!DEVICE.includes(k)) ls.set(k, v);
  if (b.db.data) await dbSet('data:' + b.user, b.db.data);
  await dbSet('an:' + b.user, b.db.an || {});
  await dbSet('ai:' + b.user, b.db.ai || {});
}
