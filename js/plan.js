// Intention d'un coup, au-delà de la tactique : ce qu'il prépare, la pièce adverse qu'il gêne, la case qu'il prend.
// Déduit des règles et de la suite fournie (coups UCI ou SAN), sans moteur. Une phrase dont le sujet est « Ce coup »,
// les pièces nommées du point de vue du joueur (me). null quand rien de net ne se dégage : on n'invente pas d'idée.
/* global Chess */
import { VAL, fr, sqOf, rf, poss, il, attacksFrom, attackers, play } from './geom.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const other = (c) => (c === 'w' ? 'b' : 'w');
// Même position, l'autre camp au trait (sans prise en passant) : pour savoir ce qu'un camp pourrait jouer ensuite.
const turnTo = (fen, c) => { const p = fen.split(' '); p[1] = c; p[3] = '-'; return p.join(' '); };
const legal = (fen, mv) => { try { return play(new Chess(fen), mv); } catch { return null; } };

// Cases sûres d'une pièce : libres ou adverses, et non attaquées par l'autre camp.
function safeMoves(B, r, f) {
  const p = B[r][f]; if (!p) return 0;
  return attacksFrom(B, r, f).filter(([a, b]) => (!B[a][b] || B[a][b].color !== p.color) && !attackers(B, sqOf(a, b), other(p.color)).length).length;
}
function passed(B, r, f) {
  const p = B[r][f]; if (!p || p.type !== 'p') return false;
  for (let a = 0; a < 8; a++) {
    if (p.color === 'w' ? a >= r : a <= r) continue;
    for (const b of [f - 1, f, f + 1]) { const q = B[a]?.[b]; if (q && q.type === 'p' && q.color !== p.color) return false; }
  }
  return true;
}
// Un pion adverse peut-il un jour attaquer cette case ? (pion sur une colonne voisine, encore derrière elle)
function chaseable(B, sq, color) {
  const [r, f] = rf(sq);
  for (let a = 0; a < 8; a++) for (const b of [f - 1, f + 1]) {
    const q = B[a]?.[b];
    if (q && q.type === 'p' && q.color !== color && (color === 'w' ? a < r : a > r)) return true;
  }
  return false;
}
function kingZone(B, color) {
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = B[r][f];
    if (p && p.type === 'k' && p.color === color) { const z = []; for (let a = r - 1; a <= r + 1; a++) for (let b = f - 1; b <= f + 1; b++) if (a >= 0 && a < 8 && b >= 0 && b < 8 && (a !== r || b !== f)) z.push(sqOf(a, b)); return z; }
  }
  return [];
}
const hits = (B, sq, set) => { const [r, f] = rf(sq); return attacksFrom(B, r, f).map(([a, b]) => sqOf(a, b)).filter((s) => set.includes(s)).length; };
const fileOpen = (B, f, color) => { let own = false, opp = null; for (let r = 0; r < 8; r++) { const q = B[r][f]; if (q && q.type === 'p') { if (q.color === color) own = true; else opp ||= { sq: sqOf(r, f) }; } } return { own, opp }; };

export function intent(fen, moves, me) {
  const ch = new Chess(fen), B0 = ch.board(), m = legal(fen, moves[0]);
  if (!m) return null;
  ch.move(m.san);
  const B1 = ch.board(), c = m.color, opp = other(c), [tr, tf] = rf(m.to), piece = poss(m.piece, c, me);

  // 1. Prépare : le prochain coup du même camp dans la suite n'était pas jouable avant, et l'est grâce à ce coup.
  const n2 = moves[2];
  if (n2 && !legal(fen, n2)) {
    const after = turnTo(ch.fen(), c), k = legal(after, n2);
    if (k && k.from !== m.to) {
      const c2 = new Chess(after); c2.move(k.san);
      const B2 = c2.board(), [r2, f2] = rf(k.to);
      const tg = attacksFrom(B2, r2, f2).map(([a, b]) => ({ ...B2[a][b], sq: sqOf(a, b) })).filter((q) => q.type && q.color === opp && q.type !== 'p').sort((x, y) => VAL[y.type] - VAL[x.type] || (x.type === 'k') - (y.type === 'k'))[0];
      const what = k.captured ? `, qui prendra ${poss(k.captured, opp, me)} en ${k.to}` : tg ? (tg.type === 'k' ? ', avec échec' : `, qui attaquera ${poss(tg.type, opp, me)} en ${tg.sq}`) : '';
      return { k: 'prepare', text: `Ce coup prépare ${fr(k.san)}${what}.` };
    }
  }
  // 2. Enferme : une pièce adverse perd ses cases sûres.
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const q = B1[r][f]; if (!q || q.color !== opp || !'nbrq'.includes(q.type) || B0[r][f]?.type !== q.type || B0[r][f]?.color !== opp) continue;
    if (r === (opp === 'w' ? 7 : 0)) continue; // pièce pas encore sortie : elle n'est pas enfermée, juste pas développée
    const before = safeMoves(B0, r, f), now = safeMoves(B1, r, f);
    if (before >= 2 && now <= 1 && now < before) return { k: 'trap', text: `Ce coup enferme ${poss(q.type, opp, me)} en ${sqOf(r, f)} : ${il(q.type)} n’a plus ${now ? 'qu’une case sûre' : 'aucune case sûre'}.` };
  }
  // 3. Bloque : la pièce se pose juste devant un pion passé adverse.
  if (m.piece !== 'p') {
    const ar = tr + (c === 'w' ? -1 : 1), q = B1[ar]?.[tf];
    if (q && q.type === 'p' && q.color === opp && passed(B1, ar, tf)) return { k: 'block', text: `Ce coup bloque ${poss('p', opp, me)} passé en ${sqOf(ar, tf)} : il ne peut plus avancer.` };
  }
  // 4. Avant-poste : cavalier (ou fou) chez l'adversaire, soutenu par un pion, qu'aucun pion adverse ne pourra chasser.
  if ('nb'.includes(m.piece) && (c === 'w' ? +m.to[1] >= 5 : +m.to[1] <= 4) && attackers(B1, m.to, c).some((x) => x.type === 'p') && !chaseable(B1, m.to, c))
    return { k: 'outpost', text: `Ce coup installe ${piece} en ${m.to}, une case forte : un pion la soutient et aucun pion adverse ne pourra l’en chasser.` };
  // 5. Colonne : la tour prend une colonne sans pion à elle.
  if (m.piece === 'r' && m.from[0] !== m.to[0]) {
    const o = fileOpen(B1, tf, c);
    if (!o.own) return { k: 'file', text: o.opp ? `Ce coup place ${piece} sur la colonne ${m.to[0]}, à moitié ouverte : elle vise ${poss('p', opp, me)} en ${o.opp.sq}.` : `Ce coup place ${piece} sur la colonne ${m.to[0]}, ouverte : elle pourra entrer dans le camp adverse.` };
  }
  // 6. Roi : la pièce vise maintenant plusieurs cases autour du roi adverse.
  if (m.piece !== 'k' && m.piece !== 'p') {
    const z = kingZone(B1, opp), was = hits(B0, m.from, z), now = hits(B1, m.to, z);
    if (now >= 2 && now > was) return { k: 'king', text: `Ce coup rapproche ${piece} du roi adverse : ${piece} vise maintenant ${now} cases autour de ${poss('k', opp, me)}.` };
  }
  // 7. Rupture : le pion attaque un pion adverse pour ouvrir le jeu.
  if (m.piece === 'p' && !m.captured) {
    const t = attacksFrom(B1, tr, tf).map(([a, b]) => ({ ...B1[a][b], sq: sqOf(a, b) })).find((q) => q.type === 'p' && q.color === opp);
    if (t) return { k: 'break', text: `Ce coup attaque ${poss('p', opp, me)} en ${t.sq} : une rupture pour ouvrir des lignes.` };
  }
  // 8. Activité : la pièce gagne beaucoup de cases.
  if ('nbrq'.includes(m.piece)) {
    const [fr0, ff0] = rf(m.from), before = safeMoves(B0, fr0, ff0), now = safeMoves(B1, tr, tf);
    if (now - before >= 4) return { k: 'active', text: `Ce coup active ${piece} : ${il(m.piece)} passe de ${before} à ${now} cases sûres.` };
  }
  return null;
}

// Repères de la position, en phrases courtes : la matière que le coach Claude a le droit d'affirmer en plus des suites.
export function features(fen, me) {
  const B = new Chess(fen).board(), out = [], moveNo = +fen.split(' ')[5] || 1;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = B[r][f]; if (!p) continue;
    const sq = sqOf(r, f);
    if (p.type === 'p' && passed(B, r, f)) out.push(`Pion passé : ${poss('p', p.color, me)} en ${sq}.`);
    // Pièce sans case : seulement une fois sortie, ou passé l'ouverture (au départ, tours et fous n'ont aucune case).
    const home = sq[1] === (p.color === 'w' ? '1' : '8');
    if ('nbrq'.includes(p.type) && (!home || moveNo > 15)) { const n = safeMoves(B, r, f); if (n <= 1) out.push(`${cap(poss(p.type, p.color, me))} en ${sq} : ${n ? 'une seule case sûre' : 'aucune case sûre'}.`); }
  }
  for (let f = 0; f < 8; f++) {
    let pawns = 0; for (let r = 0; r < 8; r++) if (B[r][f]?.type === 'p') pawns++;
    if (!pawns) out.push(`Colonne ${'abcdefgh'[f]} ouverte.`);
  }
  return out;
}
