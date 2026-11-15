// Écran d'exercice : un échiquier, un bandeau de commentaire dessous, un panneau d'explication, une barre d'actions.
// Puzzle, erreur précise, position inédite, échauffement, position de cours et relecture de partie passent tous par ici :
// la structure sans défilement, le bandeau, la barre, les actions et la lecture animée des suites n'existent qu'à cet endroit.
// Un exercice ne fournit que ses règles : ce qu'il affiche (screen), ce que font ses boutons (on), ses films (player).
import { $, esc, ico, setHtml } from './ui.js';
import { board, film, stepShapes, REDUCED } from './board.js';
import { fr } from './explain.js';

let pending = null, cur = null;

// Dans une vue : renvoie le HTML de l'écran, à rendre seul dans la page. spec :
//   head      HTML au-dessus : onglets, titre, consigne du coach
//   cap       contenu initial du bandeau ; capClass : sa classe d'état
//   panel     contenu du panneau (colonne de droite sur ordinateur, sous le bandeau sur téléphone ; il défile seul)
//   bar       boutons de la barre d'actions : data-x="nom" pour une action de l'exercice, data-act pour la navigation
//   top       () => HTML : avancée montrée dans la barre du haut sur téléphone
//   live      true si un rendu d'arrière-plan ne doit pas reconstruire l'écran (exercice en cours)
//   autres champs : libres, retrouvés au montage dans X.spec
export function screen(spec) {
  pending = spec;
  return `<div class="bwrap"><div class="board" id="xb"></div><div class="cap ${spec.capClass || ''}" id="xcap">${spec.cap || ''}</div></div>
    <div class="fitside"><div class="fithead">${spec.head || ''}</div><div class="stack fitpanel" id="xpanel">${spec.panel || ''}</div><div class="actbar" id="xbar">${spec.bar || ''}</div></div>`;
}

// Après l'écriture de la vue et avant la création de l'échiquier : il naît ainsi à sa taille définitive.
export function attach() {
  const el = $('#view > .bwrap > #xb');
  document.body.classList.toggle('fit', !!el);
  document.body.classList.remove('solved');
  cur = el && pending ? handle(el, pending) : null;
  pending = null;
  return cur;
}
export const current = () => (cur && cur.alive() ? cur : null);
export const live = () => !!current()?.spec.live;
export const top = () => current()?.spec.top?.() || '';
// Clic sur un bouton data-x : renvoie false si aucun exercice ne connaît l'action.
export function act(name, el) {
  const f = current()?.actions[name];
  if (!f) return false;
  f(el?.dataset.v, el);
  return true;
}
// Clavier pendant une lecture : flèches pour avancer, espace pour lire ou mettre en pause.
export function key(ev) {
  const a = current()?.keys?.[ev.key];
  if (!a) return false;
  if (ev.key === ' ') { if (ev.target.tagName === 'BUTTON') return true; ev.preventDefault(); }
  return act(a);
}

function handle(el, spec) {
  const X = { el, spec, cap: $('#xcap'), panel: $('#xpanel'), bar: $('#xbar'), actions: {}, keys: null };
  X.alive = () => document.body.contains(el);
  X.board = (cfg) => board(el, cfg);
  X.say = (cls, html) => { X.cap.className = 'cap ' + cls; X.cap.innerHTML = html; };
  X.setBar = (html) => setHtml(X.bar, html); // ne remplace pas un bouton sous le doigt si rien ne change
  X.btn = (name) => X.bar.querySelector(`[data-x="${name}"]`);
  X.on = (actions) => Object.assign(X.actions, actions);
  X.solved = () => document.body.classList.add('solved');
  X.player = (o) => player(X, o);
  return X;
}

const capStep = (s, i, n, extra = '') => `<div class="capm"><span class="capn"><i class="dot ${s.white ? 'w' : 'b'}"></i>${s.no}${s.white ? '.' : '…'} ${fr(s.san)}</span><span class="small">coup ${i} sur ${n}</span>${extra}</div><div class="prog" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k < i - 1 ? 'done' : k === i - 1 ? 'cur' : ''}"></i>`).join('')}</div>`;

// Lecteur de suites : un ou plusieurs films commentés, joués sur l'échiquier de l'écran. o :
//   view(fen, dernierCoup, flèches), arrows(flèches), ask(fen, rappel) : accès à l'échiquier
//   films   { clé: { steps, start: { fen, last, shape }, startText, tone ('ok' | 'ko'), brush(k), bilan, chip(i), guess(i), ask, cta } }
//           le premier est le film principal ; cta est le libellé du bouton qui propose le film suivant à la fin du premier
//   from    coup de départ de la lecture automatique (0 : position de départ) ; auto: false pour ne pas lancer la lecture
//   rest    coup affiché quand la lecture n'est pas lancée
//   verdict HTML en tête du bandeau au début du premier film (verdictAlways : à chaque coup)
//   panel   élément où panelHtml(clé) est rendu à chaque changement de film ; exit : HTML du bouton de sortie
function player(X, o) {
  const keys = Object.keys(o.films), st = { key: keys[0], seen: new Set(), note: '', pkey: null };
  const steps = () => o.films[st.key].steps;
  const F = film({ len: () => steps().length, step: (k) => steps()[k], brush: (k) => o.films[st.key].brush(k), arrows: o.arrows, alive: X.alive, show: draw });
  function draw() {
    const fm = o.films[st.key], L = fm.steps, n = L.length, i = Math.min(F.i, n), s = L[i - 1], first = st.key === keys[0];
    if (!s) o.view(fm.start.fen, fm.start.last, [fm.start.shape]); else o.view(s.fen, [s.from, s.to], stepShapes(s));
    // En pas à pas, l'élève peut jouer lui-même le coup suivant quand le film le prévoit.
    const nx = L[i], guess = !F.play && !!o.ask && i >= 1 && !!nx && !!fm.guess?.(i);
    if (guess) o.ask(s.fen, (from, to) => {
      st.note = from === nx.from && to === nx.to ? '<b class="ok">Exact.</b>' : `<b class="ko">Pas le coup du moteur.</b> Il préférait ${fr(nx.san)}.`;
      F.i++; draw();
    });
    const note = st.note; st.note = '';
    const atEnd = i >= n;
    st.seen.add(st.key);
    X.say('film ' + (fm.tone || 'ok'), (o.verdict && (o.verdictAlways || (first && i <= 1)) ? `<div class="verdict">${o.verdict}</div>` : '')
      + (s ? `${capStep(s, i, n, fm.chip?.(i) || '')}<p>${note ? note + ' ' : ''}${esc(s.text)}</p>${guess ? `<p class="ask">${fm.ask} <span class="small">Ou passe au coup suivant.</span></p>` : ''}${atEnd && fm.bilan ? `<p class="bilan">${fm.bilan}</p>` : ''}`
        : `<p><b>Position de départ.</b> ${fm.startText || ''}</p>`));
    if (o.panelHtml && st.pkey !== st.key) { st.pkey = st.key; o.panel.innerHTML = o.panelHtml(st.key); } // reconstruit au changement de film seulement
    o.panel?.querySelectorAll('ol.line li').forEach((li, k) => li.classList.toggle('cur', k + 1 === i));
    const other = keys.find((k) => k !== st.key), want = first && atEnd && !!other && !st.seen.has(other);
    const mid = F.play ? `<button class="btn" data-x="play">${ico('pause')}Pause</button>`
      : !atEnd ? `<button class="btn pri" data-x="play">${ico('play')}Lecture</button>`
      : want ? `<button class="btn pri" data-x="film" data-v="${other}">${o.films[other].cta}</button>`
      : `<button class="btn" data-x="play">${ico('replay')}Revoir</button>`;
    X.setBar(`<button class="btn ico" data-x="prev" aria-label="Coup précédent" ${i === 0 ? 'disabled' : ''}>${ico('prev')}</button><button class="btn ico" data-x="next" aria-label="Coup suivant" ${atEnd ? 'disabled' : ''}>${ico('next')}</button>${mid}${o.exit.replace('class="btn"', `class="btn ${atEnd && !want ? 'pri' : ''}"`)}`);
  }
  const go = (i) => { F.stop(); F.i = Math.max(0, Math.min(i, steps().length)); draw(); };
  X.on({
    play() { if (F.play) { F.stop(); draw(); } else F.start(F.i >= steps().length ? 0 : null, 350); },
    prev() { go(F.i - 1); },
    next() { go(F.i + 1); },
    jump(v) { go(+v); },
    film(v) { F.stop(); st.key = v; if (REDUCED) go(1); else F.start(0); },
  });
  X.keys = { ArrowLeft: 'prev', ArrowRight: 'next', ' ': 'play' };
  X.solved();
  if (o.auto === false || REDUCED) go(o.rest ?? 1); else F.start(o.from ?? 1);
}
