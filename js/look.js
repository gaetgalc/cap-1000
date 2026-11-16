// Réglages d'apparence de l'échiquier : palette, pièces, coordonnées, vitesse de lecture des suites, taille sur ordinateur.
// Stockés sous cap1000:look (JSON, donc dans la sauvegarde), lus au démarrage et posés en classes sur <html>
// (pal-bois, pc-merida, nocoords) et en variable CSS (--bsz). Les règles visuelles sont dans css/app.css.
import { ls } from './store.js';

export const PALETTES = [['vert', 'Vert'], ['bois', 'Bois'], ['bleu', 'Bleu-gris']];
// Pièces servies depuis vendor/pieces (licences dans vendor/pieces/LICENSES.txt) ; cburnett est celle de chessground.
export const PIECES = [['cburnett', 'Classiques'], ['merida', 'Merida'], ['chessnut', 'Chessnut']];
export const SPEEDS = [['lent', 'Lente', 1.6], ['normal', 'Normale', 1], ['rapide', 'Rapide', 0.6]];
export const DEFAULT = Object.freeze({ pal: 'vert', pc: 'cburnett', coords: true, speed: 'normal', size: null });
const MIN = 320, MAX = 1000; // taille de l'échiquier réglée à la poignée, en pixels

const has = (list, v) => list.some(([k]) => k === v);
export const clampSize = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(MIN, Math.min(MAX, v))) : null);
export function normalize(o) {
  const x = o && typeof o === 'object' ? o : {};
  return {
    pal: has(PALETTES, x.pal) ? x.pal : DEFAULT.pal,
    pc: has(PIECES, x.pc) ? x.pc : DEFAULT.pc,
    coords: typeof x.coords === 'boolean' ? x.coords : DEFAULT.coords,
    speed: has(SPEEDS, x.speed) ? x.speed : DEFAULT.speed,
    size: clampSize(x.size),
  };
}
export const classesOf = (l) => [l.pal !== 'vert' && 'pal-' + l.pal, l.pc !== 'cburnett' && 'pc-' + l.pc, !l.coords && 'nocoords'].filter(Boolean);
export const speedOf = (s) => (SPEEDS.find(([k]) => k === s) || [0, 0, 1])[2];

const ALL = [...PALETTES.map(([k]) => 'pal-' + k), ...PIECES.map(([k]) => 'pc-' + k), 'nocoords'];
export const look = () => normalize(ls.get('look', null));
// Pose les classes et la taille sur la page ; à rappeler après chaque changement (ou une restauration).
export function apply(l = look()) {
  const r = document.documentElement;
  r.classList.remove(...ALL);
  r.classList.add(...classesOf(l));
  if (l.size) r.style.setProperty('--bsz', l.size + 'px'); else r.style.removeProperty('--bsz');
  return l;
}
export function setLook(patch) {
  const l = normalize({ ...look(), ...patch });
  ls.set('look', l);
  return apply(l);
}
// Facteur appliqué aux temps de lecture de film() (board.js).
export const speed = () => speedOf(look().speed);
