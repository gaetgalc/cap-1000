// Sons de l'échiquier et des exercices, synthétisés en Web Audio : aucun fichier, rien de repris d'un autre site.
// Coupés par défaut ; activés, ils ne jouent qu'après une première interaction (règle d'iOS pour l'audio).
// Les exercices signalent bon coup, coup faux et objectif atteint par l'événement `cap:feedback` (détail : 'good' | 'bad' | 'goal').
/* global Chess */

const KEY = 'cap1000:snd'; // '1' = activés ; absent = coupés
let on = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();
let ctx = null, out = null;
const last = {}; // dernier passage de chaque son : deux appels rapprochés n'en font qu'un

export const enabled = () => on;
export function setEnabled(v) {
  on = !!v;
  try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* stockage indisponible */ }
  if (on) unlock(); // appelé depuis un clic : l'audio peut naître ici
}

// Son d'un coup (objet verbose de chess.js) : l'échec prime, puis le roque, puis la prise.
export function soundFor(m) {
  if (!m) return null;
  if (/[+#]/.test(m.san)) return 'check';
  if (/[kq]/.test(m.flags)) return 'castle';
  if (/[ce]/.test(m.flags)) return 'capture';
  return 'move';
}
const place = (fen) => String(fen || '').split(' ')[0];
// Coup légal qui mène de la position a à la position b (placement des pièces), sinon null :
// même position, retour en arrière, saut de plusieurs coups ou affichage d'une autre position ne font pas de son.
export function moveBetween(a, b) {
  if (!a || !b || place(a) === place(b)) return null;
  try {
    const c = new Chess(a), want = place(b);
    for (const m of c.moves({ verbose: true })) {
      c.move(m);
      const hit = place(c.fen()) === want;
      c.undo();
      if (hit) return m;
    }
  } catch { /* position illisible */ }
  return null;
}
// Coup joué à la main sur l'échiquier : le coup et la position obtenue (promotion en dame par défaut).
export function moveAt(fen, from, to) {
  try {
    const c = new Chess(fen), m = c.move({ from, to, promotion: 'q' });
    return m ? { move: m, fen: c.fen() } : null;
  } catch { return null; }
}

// ---------- Synthèse ----------
function unlock() {
  if (!on) return;
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      out = ctx.createGain(); out.gain.value = 0.5; // volume général, doux
      out.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch { ctx = null; }
}
if (typeof document !== 'undefined') {
  for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('cap:feedback', (e) => play(e.detail));
}

// Note : oscillateur à enveloppe courte (attaque 5 ms, décroissance exponentielle).
function tone(t, freq, dur, { type = 'sine', vol = 0.3, to } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
// Choc de bois : bruit filtré très bref, la note grave en dessous donne le corps.
function knock(t, { freq = 1100, vol = 0.45, dur = 0.06, body = 190 } = {}) {
  const n = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4; g.gain.value = vol;
  s.connect(f).connect(g).connect(out); s.start(t);
  tone(t, body, dur + 0.03, { vol: vol * 0.5, to: body * 0.6 });
}
const SOUNDS = {
  move: (t) => knock(t),
  capture: (t) => { knock(t, { freq: 1500, vol: 0.55, dur: 0.05, body: 240 }); knock(t + 0.045, { freq: 800, vol: 0.4, dur: 0.07, body: 150 }); },
  castle: (t) => { knock(t); knock(t + 0.11, { freq: 950, vol: 0.38 }); },
  check: (t) => { knock(t); tone(t + 0.02, 784, 0.2, { type: 'triangle', vol: 0.16 }); tone(t + 0.02, 1176, 0.16, { vol: 0.06 }); },
  good: (t) => { tone(t, 659.25, 0.13, { vol: 0.2 }); tone(t + 0.1, 987.77, 0.18, { vol: 0.2 }); },
  bad: (t) => { tone(t, 311.13, 0.14, { type: 'triangle', vol: 0.2 }); tone(t + 0.11, 233.08, 0.17, { type: 'triangle', vol: 0.2 }); },
  goal: (t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(t + i * 0.11, f, i === 3 ? 0.55 : 0.2, { vol: 0.17 }); tone(t + i * 0.11, f * 2, 0.12, { vol: 0.03 }); }),
};

// Joue un son par son nom ; sans effet si les sons sont coupés, si l'audio n'est pas encore permis ou absent.
export function play(name) {
  if (!on || !ctx || !SOUNDS[name]) return;
  const now = Date.now();
  if (now - (last[name] || 0) < 120) return;
  last[name] = now;
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    SOUNDS[name](ctx.currentTime + 0.01);
  } catch { /* Web Audio indisponible ou refusé */ }
}
