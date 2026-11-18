// Cache des calculs de vue (17/11) : un résultat est gardé tant que la clé ne change pas.
// La clé change quand les données bougent (S.rev, augmenté par touch()), quand le filtre change, ou quand le jour change.
// Fonctions pures : la clé est injectée, donc testable sans navigateur (tests/memo.test.mjs).
export const viewKey = (S, day) => `${S.rev}|${S.f.tc}|${S.f.days}|${day}`;

export function makeMemo(keyOf) {
  const cache = new Map();
  let last = null;
  return function memo(name, fn) {
    const k = keyOf();
    if (k !== last) { cache.clear(); last = k; }
    if (!cache.has(name)) cache.set(name, fn());
    return cache.get(name);
  };
}
