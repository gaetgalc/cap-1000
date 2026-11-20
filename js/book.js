// Coups de théorie (relecture, 20/11) : positions de la base d'ouvertures de Lichess (lichess-org/chess-openings, domaine
// public, CC0), gardées sous forme d'empreintes dans vendor/book.txt (scripts/book.mjs les produit). Une position est
// reconnue quel que soit l'ordre des coups qui y mène. Un début de partie est « théorie » tant que chaque position atteinte
// est dans la base. Calcul pur, testable sans navigateur.
// Empreinte d'une position : FNV-1a 32 bits des pièces, du trait et des roques (prise en passant et compteurs ignorés).
export function posKey(fen) {
  const s = fen.split(' ').slice(0, 3).join(' ');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
export const buildBook = (text) => new Set(text.split(/\s+/).filter(Boolean));
// Nombre de demi-coups du début de la partie dont la position d'arrivée est dans la base ; fens[i] : position avant le coup i.
export function bookPlies(book, fens) {
  let i = 0;
  while (i + 1 < fens.length && book.has(posKey(fens[i + 1]))) i++;
  return i;
}
// Chargement paresseux dans le navigateur : une seule requête, partagée.
let pending = null;
export const loadBook = () => (pending ||= fetch('vendor/book.txt').then((r) => (r.ok ? r.text() : Promise.reject())).then(buildBook).catch(() => { pending = null; return null; }));
