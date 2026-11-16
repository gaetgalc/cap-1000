// Messages éphémères (« Sauvegardé », « 3 parties importées ») : en bas de l'écran, au-dessus de la barre de navigation
// du téléphone, lus par les lecteurs d'écran (role="status"), effacés seuls après 2,5 s.
const LIFE = 2500, OUT = 150; // durée d'affichage, puis fondu de sortie (--m-in)

function host() {
  let el = document.getElementById('toasts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toasts'; el.className = 'toasts';
    el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function toast(msg) {
  const box = host();
  for (const old of [...box.children]) if (old.textContent === msg) old.remove(); // pas deux fois le même message
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  while (box.children.length > 2) box.firstElementChild.remove(); // deux messages au plus à l'écran
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('in'))); // laisse le navigateur peindre l'état de départ
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), OUT); }, LIFE);
}
