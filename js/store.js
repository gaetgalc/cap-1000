// Stockage local : IndexedDB pour les parties et analyses, localStorage pour les réglages.
let dbp = null;
function open() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open('cap1000', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const mem = new Map(); // repli si IndexedDB est indisponible
export async function dbGet(k) {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const r = db.transaction('kv').objectStore('kv').get(k);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  } catch { return mem.get(k); }
}
export async function dbSet(k, v) {
  mem.set(k, v);
  try {
    const db = await open();
    await new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(v, k);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  } catch { /* mémoire seulement */ }
}
export async function dbDel(k) {
  mem.delete(k);
  try {
    const db = await open();
    await new Promise((res) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = res; tx.onerror = res; });
  } catch { /* rien */ }
}
export const ls = {
  get(k, d) { try { const v = localStorage.getItem('cap1000:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('cap1000:' + k, JSON.stringify(v)); } catch { /* rien */ } },
  del(k) { try { localStorage.removeItem('cap1000:' + k); } catch { /* rien */ } },
  // Efface toutes les clés de l'app sauf celles listées (réglages de l'appareil).
  clear(keep) { try { for (const k of Object.keys(localStorage)) if (k.startsWith('cap1000:') && !keep.includes(k.slice(8))) localStorage.removeItem(k); } catch { /* rien */ } },
};
