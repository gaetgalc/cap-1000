// Échiquier (chessground) : création, roi en échec signalé, flèches, lecture animée d'une suite.
/* global Chess */
import { Chessground } from '../vendor/chessground.min.js';
import { look, setLook, clampSize, speed } from './look.js';

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; // pas de lecture automatique si l'appareil le demande
const boards = []; // échiquiers de l'écran courant, détruits au rendu suivant
export function destroyBoards() { for (const b of boards.splice(0)) { try { b.destroy(); } catch { /* déjà détruit */ } } }
export function destsOf(ch) {
  const d = new Map();
  for (const m of ch.moves({ verbose: true })) { if (!d.has(m.from)) d.set(m.from, []); d.get(m.from).push(m.to); }
  return d;
}
const chkOf = (fen) => { try { const c = new Chess(fen); return c.in_check() ? (c.turn() === 'w' ? 'white' : 'black') : false; } catch { return false; } };
// Couleurs des flèches : plus vives que celles de chessground (vert = meilleur coup, rouge = erreur ou menace).
const BRUSHES = {
  green: { key: 'g', color: '#2bd46a', opacity: 1, lineWidth: 11 },
  red: { key: 'r', color: '#f0443c', opacity: 1, lineWidth: 11 },
  blue: { key: 'b', color: '#3b8cff', opacity: 1, lineWidth: 11 },
  yellow: { key: 'y', color: '#ffad1f', opacity: 1, lineWidth: 11 },
  paleBlue: { key: 'pb', color: '#3b8cff', opacity: 0.4, lineWidth: 15 },
};
export function board(el, cfg) {
  const drawable = { enabled: false, visible: true, autoShapes: cfg.shapes || [], ...cfg.drawable, brushes: BRUSHES };
  const cg = Chessground(el, { coordinates: true, animation: { duration: REDUCED ? 0 : 220 }, ...(cfg.fen ? { check: chkOf(cfg.fen) } : {}), ...cfg, drawable });
  const set0 = cg.set; // le roi en échec est signalé à chaque changement de position
  cg.set = (c) => set0(c.fen ? { check: chkOf(c.fen), ...c } : c);
  boards.push(cg);
  if (el.parentElement?.classList.contains('bwrap')) grip(el);
  return cg;
}

// Poignée de redimensionnement (écran d'exercice, ordinateur) : glisser le coin de l'échiquier, double-clic pour la taille
// automatique, flèches au clavier. La taille va dans cap1000:look ; le CSS la borne pour que la page ne défile jamais.
function grip(el) {
  const wrap = el.parentElement;
  if (wrap.querySelector('.bgrip')) return;
  const g = document.createElement('button');
  g.type = 'button'; g.className = 'bgrip'; g.title = 'Taille de l’échiquier (double-clic : automatique)'; g.setAttribute('aria-label', 'Taille de l’échiquier');
  wrap.appendChild(g);
  const root = document.documentElement, cur = () => el.getBoundingClientRect().width;
  const most = () => { // plus grande taille possible dans cette fenêtre
    const was = root.style.getPropertyValue('--bsz');
    root.style.setProperty('--bsz', '9999px');
    const m = cur();
    if (was) root.style.setProperty('--bsz', was); else root.style.removeProperty('--bsz');
    return m;
  };
  const fit = (v, max) => clampSize(Math.min(v, max));
  let drag = null;
  g.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    drag = { x: ev.clientX, y: ev.clientY, w: cur(), max: most(), id: ev.pointerId };
    try { g.setPointerCapture(ev.pointerId); } catch { /* rien */ }
    g.classList.add('on');
  });
  g.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const v = fit(drag.w + Math.max(ev.clientX - drag.x, ev.clientY - drag.y), drag.max);
    root.style.setProperty('--bsz', v + 'px');
  });
  const end = () => {
    if (!drag) return;
    drag = null; g.classList.remove('on');
    setLook({ size: clampSize(cur()) });
  };
  g.addEventListener('pointerup', end);
  g.addEventListener('pointercancel', end);
  g.addEventListener('dblclick', () => setLook({ size: null }));
  g.addEventListener('keydown', (ev) => {
    const d = { ArrowUp: 16, ArrowRight: 16, ArrowDown: -16, ArrowLeft: -16 }[ev.key];
    if (!d) return;
    ev.preventDefault(); ev.stopPropagation();
    setLook({ size: fit((look().size || cur()) + d, most()) });
  });
}
export const arrow = (uci, brush) => (uci ? { orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush } : null);
export const errShapes = (e) => [arrow(e.playedUci, 'red'), arrow(e.best, 'green')].filter(Boolean);
// Flèches d'un coup commenté : ce que la pièce jouée attaque (jaune : ta menace, rouge : celle de l'adversaire).
export const stepShapes = (s) => (s.tags.shapes || []).map((q) => ({ orig: q.orig, ...(q.dest ? { dest: q.dest } : {}), brush: (q.by === 'mover') === s.tags.mine ? 'yellow' : 'red' }));

// Lecture animée d'une suite : la flèche annonce le coup, la pièce se déplace, le commentaire suit.
// o : { len(), step(k), brush(k), arrows(liste), show(), alive() }
export function film(o) {
  const f = { i: 0, play: false, tm: 0 };
  const k = speed(); // vitesse de lecture choisie dans Apparence (lente, normale, rapide)
  const read = (s) => k * Math.max(1500, Math.min(3000, 700 + 21 * s.text.length)); // temps de lecture du commentaire
  f.stop = () => { clearTimeout(f.tm); f.play = false; };
  function tick() {
    if (!f.play) return;
    if (!o.alive()) { f.stop(); return; }
    if (f.i >= o.len()) { f.play = false; o.show(); return; }
    const nx = o.step(f.i);
    o.arrows([{ orig: nx.from, dest: nx.to, brush: o.brush(f.i) }]);
    f.tm = setTimeout(() => {
      if (!o.alive()) { f.stop(); return; }
      f.i++;
      if (f.i >= o.len()) f.play = false;
      o.show();
      if (f.play) f.tm = setTimeout(tick, read(nx));
    }, 750 * k);
  }
  f.start = (from, delay) => {
    f.stop();
    if (from != null) f.i = from;
    f.i = Math.max(0, Math.min(f.i, o.len()));
    f.play = f.i < o.len();
    o.show();
    if (f.play) f.tm = setTimeout(tick, delay ?? (f.i ? read(o.step(f.i - 1)) : 700 * k));
  };
  return f;
}
