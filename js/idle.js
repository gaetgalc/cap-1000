// Travail de fond « quand le navigateur est libre » (17/11) : idle(f) appelle f(deadline), où deadline.timeRemaining() donne
// le temps restant de la tranche. Sans requestIdleCallback (Safari), repli par setTimeout(0) avec une tranche de 12 ms,
// décomptée à l'horloge : une boucle « while (timeRemaining() > 2) » s'arrête après environ 10 ms, sous le seuil de 50 ms
// d'une tâche longue. Fonction pure (la fenêtre et l'horloge sont injectées) : testée sans navigateur dans tests/idle.test.mjs.
export const SLICE_MS = 12;
export function makeIdle(win, now = () => performance.now()) {
  return (f) => {
    if (win.requestIdleCallback) return win.requestIdleCallback(f);
    return setTimeout(() => { const t0 = now(); f({ timeRemaining: () => Math.max(0, SLICE_MS - (now() - t0)) }); }, 0);
  };
}
