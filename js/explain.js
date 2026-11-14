// Explications pédagogiques : décrit chaque coup d'une suite en langage clair, dégage l'idée,
// et compare le meilleur coup au coup joué. Tout est déduit des règles et des suites du moteur.
/* global Chess */
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NOM = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame', k: 'roi' };
const FEM = { r: 1, q: 1 };
const UN = { p: 'un pion', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'la dame' };
const FR = { N: 'C', B: 'F', R: 'T', Q: 'D', K: 'R' };
export const fr = (san) => String(san).replace(/[NBRQK]/g, (c) => FR[c]);
const sqOf = (r, f) => 'abcdefgh'[f] + (8 - r);
const rf = (sq) => [8 - +sq[1], sq.charCodeAt(0) - 97];
// « ton cavalier », « sa dame » : toujours du point de vue du joueur (me).
const poss = (type, color, me) => (color === me ? (FEM[type] ? 'ta ' : 'ton ') : (FEM[type] ? 'sa ' : 'son ')) + NOM[type];
const il = (type) => (FEM[type] ? 'elle' : 'il');
const e_ = (type) => (FEM[type] ? 'e' : '');

function attacksFrom(B, r, f) {
  const p = B[r][f]; if (!p) return [];
  const out = [], on = (a, b) => a >= 0 && a < 8 && b >= 0 && b < 8;
  const step = (list) => { for (const [dr, df] of list) if (on(r + dr, f + df)) out.push([r + dr, f + df]); };
  const ray = (list) => { for (const [dr, df] of list) { let a = r + dr, b = f + df; while (on(a, b)) { out.push([a, b]); if (B[a][b]) break; a += dr; b += df; } } };
  const D = [[1, 1], [1, -1], [-1, 1], [-1, -1]], O = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (p.type === 'n') step([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]);
  else if (p.type === 'k') step([...D, ...O]);
  else if (p.type === 'p') step(p.color === 'w' ? [[-1, 1], [-1, -1]] : [[1, 1], [1, -1]]);
  else if (p.type === 'b') ray(D); else if (p.type === 'r') ray(O); else ray([...D, ...O]);
  return out;
}
function attackers(B, sq, color) {
  const [tr, tf] = rf(sq), out = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = B[r][f];
    if (p && p.color === color && attacksFrom(B, r, f).some(([a, b]) => a === tr && b === tf)) out.push({ sq: sqOf(r, f), type: p.type });
  }
  return out;
}
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
const cheapest = (list) => list.slice().sort((a, b) => VAL[a.type] - VAL[b.type])[0];
export function material(fen, me) {
  let m = 0;
  for (const c of fen.split(' ')[0]) { const l = c.toLowerCase(); if (VAL[l] != null && l !== 'k') m += (c === l ? 'b' : 'w') === me ? VAL[l] : -VAL[l]; }
  return m;
}
// Pièces du camp `color` attaquées et en danger réel (non défendues, ou attaquées par moins cher).
function hanging(B, color) {
  const opp = color === 'w' ? 'b' : 'w', out = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = B[r][f]; if (!p || p.color !== color || p.type === 'k') continue;
    const sq = sqOf(r, f), att = attackers(B, sq, opp); if (!att.length) continue;
    const def = attackers(B, sq, color), low = cheapest(att);
    if (!def.length || VAL[low.type] < VAL[p.type]) out.push({ sq, type: p.type, by: low, defended: def.length > 0 });
  }
  return out.sort((a, b) => VAL[b.type] - VAL[a.type]);
}

function play(ch, mv) {
  if (!mv) return null;
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(mv)) return ch.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] || 'q' });
  return ch.move(mv, { sloppy: true });
}

// Décrit un coup. `me` : couleur du joueur. `next` : coup suivant de la suite (pour reconnaître un échange).
function describe(fen, mv, me, next, prev) {
  const ch = new Chess(fen), B0 = ch.board(), wasCheck = ch.in_check();
  const m = play(ch, mv); if (!m) return null;
  const B1 = ch.board(), mine = m.color === me, opp = m.color === 'w' ? 'b' : 'w';
  const S = mine ? 'Tu' : 'Ton adversaire', v = (a, b) => (mine ? a : b);
  const tags = { mine, capture: !!m.captured, check: ch.in_check(), mate: ch.in_checkmate(), gain: 0 };
  const piece = poss(m.piece, m.color, me);
  let t;
  // Dangers avant le coup, pour reconnaître une fuite ou une défense.
  const dangerBefore = hanging(B0, m.color), fled = dangerBefore.find((h) => h.sq === m.from);
  if (m.flags.includes('k') || m.flags.includes('q')) {
    t = `${S} ${v('roques', 'roque')} : le roi se met à l’abri et la tour entre en jeu`;
    tags.castle = true;
  } else if (m.captured && prev && prev.to === m.to && prev.captured) {
    const d = VAL[m.captured] - VAL[prev.captured];
    t = `${S} ${v('reprends', 'reprend')} en ${m.to}${m.piece !== 'p' ? ` avec ${piece}` : ''} : ${d === 0 ? 'l’échange est à égalité' : (d > 0) === mine ? `au total, l’échange te rapporte ${Math.abs(d)} point${Math.abs(d) > 1 ? 's' : ''}` : `au total, l’échange te coûte ${Math.abs(d)} point${Math.abs(d) > 1 ? 's' : ''}`}`;
    tags.recapture = true; tags.capture = false;
  } else if (m.captured) {
    const capType = m.flags.includes('e') ? 'p' : m.captured, target = poss(capType, opp, me);
    const recapture = ch.moves({ verbose: true }).some((x) => x.to === m.to);
    const nextRecaptures = next && next.slice(2, 4) === m.to;
    t = `${S} ${v('prends', 'prend')} ${target} en ${m.to}${m.piece !== 'p' ? ` avec ${piece}` : ''}`;
    if (!recapture) { tags.gain = VAL[capType]; t += ` : ${il(capType)} n’était pas défendu${e_(capType)}${VAL[capType] >= 3 ? `, ${v('tu gagnes', 'tu perds')} ${VAL[capType]} points de matériel` : ''}`; tags.free = true; }
    else if (VAL[capType] > VAL[m.piece]) { tags.gain = VAL[capType] - VAL[m.piece]; t += ` : même si la pièce est reprise, l’échange ${v('te rapporte', 'te coûte')} du matériel (${NOM[capType]} contre ${NOM[m.piece]})`; }
    else if (VAL[capType] === VAL[m.piece]) t += nextRecaptures ? ' : un échange à égalité' : ' : la pièce peut être reprise, c’est un échange à égalité';
    else { t += ` : ${piece} peut être repris${e_(m.piece)}, ${v('tu donnes', 'il donne')} plus que ce qui est pris`; tags.bad = true; }
    tags.target = { type: capType, sq: m.to };
  } else if (fled) {
    t = `${S} ${v('mets', 'met')} ${piece} à l’abri en ${m.to} : ${il(m.piece)} était attaqué${e_(m.piece)} par ${poss(fled.by.type, opp, me)}`;
    tags.escape = fled;
  } else if (wasCheck) {
    t = `${S} ${v('pares', 'pare')} l’échec avec ${piece} en ${m.to}`;
  } else {
    t = `${S} ${v('joues', 'joue')} ${piece} en ${m.to}`;
  }
  if (m.promotion) { t += `, le pion devient une ${NOM[m.promotion]}`; tags.promo = true; }
  if (tags.mate) return { m, fen: ch.fen(), tags, text: t + ' : échec et mat.' };
  if (tags.check) t += t.includes(' : ') ? '. C’est aussi un échec' : ', avec échec';
  const out = [t + '.'];
  if (!m.captured && !fled && !wasCheck && !tags.castle) {
    const home = m.color === 'w' ? '1' : '8', own = (f) => B1.some((row) => row[f] && row[f].type === 'p' && row[f].color === m.color);
    if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === home) out.push('Une pièce de plus en jeu.');
    else if (m.piece === 'r' && !own(m.to.charCodeAt(0) - 97) && m.from[0] !== m.to[0]) out.push('La tour prend une colonne sans pion devant elle.');
    else if (m.piece === 'p' && /^[de][45]$/.test(m.to)) out.push('Le pion occupe le centre.');
    else if (m.piece === 'p' && (m.color === 'w' ? +m.to[1] >= 6 : +m.to[1] <= 3)) out.push('Le pion avance vers la promotion.');
  }
  // Nouvelles menaces créées par la pièce jouée (cibles qui comptent : pièce de valeur ou non défendue).
  const [tr, tf] = rf(m.to), before = new Set(attacksFrom(B0, ...rf(m.from)).map(([a, b]) => sqOf(a, b)));
  const targets = [];
  for (const [a, b] of attacksFrom(B1, tr, tf)) {
    const q = B1[a][b]; if (!q || q.color === m.color || q.type === 'k' || q.type === 'p') continue;
    const sq = sqOf(a, b); if (before.has(sq) && !m.captured) continue;
    const undefended = attackers(B1, sq, q.color).length === 0;
    if (undefended || VAL[q.type] > VAL[m.piece]) targets.push({ sq, type: q.type, undefended });
  }
  targets.sort((x, y) => VAL[y.type] - VAL[x.type]);
  // La pièce jouée peut-elle être prise ? Si oui, ses menaces ne valent rien.
  const selfHang = hanging(B1, m.color).find((h) => h.sq === m.to);
  const P = cap(il(m.piece));
  if (selfHang) tags.selfHang = selfHang;
  else if (tags.check && targets.length) { out.push(`Fourchette : ${il(m.piece)} attaque en même temps le roi et ${poss(targets[0].type, opp, me)} en ${targets[0].sq}.`); tags.fork = targets[0]; }
  else if (targets.length >= 2) { out.push(`Fourchette : ${il(m.piece)} attaque à la fois ${poss(targets[0].type, opp, me)} en ${targets[0].sq} et ${poss(targets[1].type, opp, me)} en ${targets[1].sq}.`); tags.fork = targets[0]; }
  else if (targets.length === 1) { out.push(`${P} menace ${poss(targets[0].type, opp, me)} en ${targets[0].sq}${targets[0].undefended ? `, qui n’est pas défendu${e_(targets[0].type)}` : ''}.`); tags.threat = targets[0]; }
  // Défense d'une pièce qui était en danger.
  if (!m.captured && !fled) {
    const still = new Set(hanging(B1, m.color).map((h) => h.sq));
    const saved = dangerBefore.find((h) => h.sq !== m.from && !still.has(h.sq));
    if (saved) { out.push(`Ce coup protège ${poss(saved.type, m.color, me)} en ${saved.sq}, qui était attaqué${e_(saved.type)}.`); tags.defend = saved; }
  }
  return { m, fen: ch.fen(), tags, text: out.join(' ') };
}

// Construit une suite commentée à partir d'une liste de coups (UCI ou SAN).
export function buildLine(fen, moves, me) {
  const steps = []; let cur = fen;
  for (let i = 0; i < moves.length; i++) {
    const d = describe(cur, moves[i], me, moves[i + 1], steps.length ? steps[steps.length - 1].raw : null);
    if (!d) break;
    steps.push({ raw: { to: d.m.to, captured: d.m.captured, piece: d.m.piece }, san: d.m.san, from: d.m.from, to: d.m.to, fen: d.fen, text: d.text, tags: d.tags, mat: material(d.fen, me), no: +cur.split(' ')[5], white: d.m.color === 'w' });
    cur = d.fen;
    if (d.tags.mate) break;
  }
  return steps;
}

const matTxt = (d) => (d === 0 ? 'matériel inchangé' : d > 0 ? `+${d} point${d > 1 ? 's' : ''} de matériel pour toi` : `${d} point${d < -1 ? 's' : ''} de matériel pour toi`.replace('-', '−'));

// Idée du meilleur coup, raison de l'échec du coup joué, bilan comparé.
export function insight(fen, me, best, ref) {
  const opp = me === 'w' ? 'b' : 'w', ch = new Chess(fen), B0 = ch.board(), m0 = material(fen, me);
  const b0 = best[0], r0 = ref[0], r1 = ref[1];
  const bestD = best.length ? best[best.length - 1].mat - m0 : 0, refD = ref.length ? ref[ref.length - 1].mat - m0 : 0;
  const myMate = best.some((s) => s.tags.mate && s.tags.mine), oppMate = ref.some((s) => s.tags.mate && !s.tags.mine);
  const myFork = best.find((s) => s.tags.mine && s.tags.fork), oppFork = ref.find((s) => !s.tags.mine && s.tags.fork);
  let idee, pourquoi;
  if (!b0) idee = 'Le moteur préfère un autre coup, sans suite forcée à montrer ici.';
  else if (myMate) idee = `Le roi adverse est mal protégé : ${fr(b0.san)} lance une suite où chaque coup lui retire des cases, jusqu’au mat. Quand tu attaques un roi, examine tous les échecs avant tout autre coup.`;
  else if (b0.tags.capture && b0.tags.gain >= 2) idee = `${cap(poss(b0.tags.target.type, opp, me))} en ${b0.tags.target.sq} était mal défendu${e_(b0.tags.target.type)}. Le prendre est le coup le plus simple et le plus fort. Avant de chercher un plan, passe toujours en revue tes captures.`;
  else if (oppMate) idee = `Le danger principal était sur ton roi. ${fr(b0.san)} pare la menace de mat avant toute autre idée : la sécurité du roi passe avant le matériel.`;
  else if (b0.tags.escape) idee = `${cap(poss(b0.tags.escape.type, me, me))} en ${b0.tags.escape.sq} était attaqué${e_(b0.tags.escape.type)} par ${poss(b0.tags.escape.by.type, opp, me)}. La priorité était de ${FEM[b0.tags.escape.type] ? 'la' : 'le'} sauver${b0.tags.threat || b0.tags.fork ? ', et le bon coup en profite pour créer une menace' : ''}.`;
  else if (b0.tags.defend) idee = `${cap(poss(b0.tags.defend.type, me, me))} en ${b0.tags.defend.sq} était attaqué${e_(b0.tags.defend.type)} et pas assez défendu${e_(b0.tags.defend.type)}. Le bon coup ${FEM[b0.tags.defend.type] ? 'la' : 'le'} protège sans rien céder.`;
  else if (myFork) idee = `Le bon coup mène à une fourchette : une seule pièce attaque deux cibles à la fois, et ton adversaire ne peut en sauver qu’une. Cherche-les dès que deux pièces adverses sont à portée d’un cavalier, d’un pion ou d’un échec.`;
  else if (b0.tags.capture && (b0.tags.fork || b0.tags.threat)) { const tg = b0.tags.fork || b0.tags.threat; idee = `${fr(b0.san)} fait deux choses à la fois : il prend du matériel et attaque ${poss(tg.type, opp, me)} en ${tg.sq}. Ton adversaire ne peut pas répondre aux deux. Un coup qui prend en créant une menace est presque toujours le bon.`; }
  else if (bestD >= 2) {
    const k = best.findIndex((q, j) => j > 0 && q.tags.mine && q.tags.capture && q.tags.gain >= 2), win = best[k];
    idee = win ? `${fr(b0.san)} prépare un gain de matériel : ${fr(win.san)} prend ensuite ${poss(win.tags.target.type, opp, me)} en ${win.tags.target.sq}. Déroule la suite pour voir pourquoi ton adversaire ne peut pas l’empêcher.` : `${fr(b0.san)} gagne du matériel en quelques coups forcés. Déroule la suite : chaque coup adverse est contraint par une menace.`;
  }
  else if (b0.tags.threat) idee = `${fr(b0.san)} crée une menace concrète sur ${poss(b0.tags.threat.type, opp, me)} en ${b0.tags.threat.sq}. Ton adversaire doit y répondre, et c’est toi qui gardes la main.`;
  else if (b0.tags.castle) idee = 'Le bon coup met ton roi à l’abri. Tant que le roi reste au centre, chaque ouverture de ligne devient un danger.';
  else idee = `${fr(b0.san)} garde toutes tes pièces défendues et améliore ta position sans rien donner. Quand aucune tactique n’existe, le bon coup est celui qui ne laisse rien en prise.`;

  if (!r0) pourquoi = '';
  else if (oppMate) pourquoi = `${fr(r0.san)} laisse un mat forcé : après ${fr(r1?.san || '…')}, ton roi n’a plus de défense suffisante.`;
  else if (r1 && r1.raw.captured && r1.to === r0.to && r0.raw.captured && VAL[r1.raw.captured] > VAL[r0.raw.captured]) {
    const lost = r1.raw.captured, got = r0.raw.captured;
    pourquoi = `${fr(r0.san)} prend ${UN[got]} (${VAL[got]} point${VAL[got] > 1 ? 's' : ''}), mais ${poss(lost, me, me)} (${VAL[lost]} points) est repris${e_(lost)} par ${poss(r1.raw.piece, opp, me)} : tu donnes ${VAL[lost]} pour ${VAL[got]}. Avant de prendre, compte ce qui peut reprendre sur la case.`;
  } else if (r1 && r1.tags.capture && r1.to === r0.to && r1.tags.gain > 0) {
    const guard = cheapest(attackers(new Chess(r0.fen).board(), r0.to, opp));
    pourquoi = `${fr(r0.san)} pose ${poss(r1.tags.target.type, me, me)} en ${r0.to}, une case contrôlée par ${guard ? poss(guard.type, opp, me) : 'une pièce adverse'}. ${cap(il(r1.tags.target.type))} est pris${e_(r1.tags.target.type)} au coup suivant. Avant de lâcher une pièce, regarde qui attaque sa case d’arrivée.`;
  } else if (r1 && r1.tags.capture && r1.tags.gain > 0) {
    const sq = r1.to, tp = r1.tags.target.type, was = attackers(B0, sq, opp), guarded = attacksFrom(B0, ...rf(r0.from)).some(([a, b]) => sqOf(a, b) === sq);
    if (was.length) pourquoi = `${cap(poss(tp, me, me))} en ${sq} était déjà attaqué${e_(tp)} par ${poss(cheapest(was).type, opp, me)} avant ton coup. ${fr(r0.san)} n’y répond pas, et ${fr(r1.san)} le${FEM[tp] ? ' la' : ''} prend.`.replace('le la', 'la');
    else if (guarded) pourquoi = `${fr(r0.san)} retire le défenseur de ${poss(tp, me, me)} en ${sq}. ${cap(il(tp))} n’est plus protégé${e_(tp)} et ${fr(r1.san)} gagne du matériel. Avant de déplacer une pièce, vérifie ce qu’elle défendait.`;
    else pourquoi = `${fr(r0.san)} ouvre une ligne vers ${poss(tp, me, me)} en ${sq}, que ${fr(r1.san)} prend. Après chaque coup, vérifie les lignes que tu viens d’ouvrir.`;
  } else if (oppFork) pourquoi = `${fr(r0.san)} permet ${fr(oppFork.san)} : une fourchette. Deux de tes pièces sont attaquées en même temps et tu ne peux en sauver qu’une.`;
  else if (myMate) pourquoi = `${fr(r0.san)} laisse passer le mat. Le roi adverse n’avait plus de case : il suffisait de donner les bons échecs.`;
  else if (refD < 0) pourquoi = `${fr(r0.san)} perd du matériel en quelques coups : déroule la suite « Ton coup » pour voir comment ton adversaire en profite.`;
  else if (bestD > refD) pourquoi = `${fr(r0.san)} ne perd rien tout de suite, mais laisse passer l’occasion : le gain de matériel était là et ton adversaire a maintenant le temps de se défendre.`;
  else pourquoi = `${fr(r0.san)} ne perd pas de matériel tout de suite, mais donne la main à ton adversaire : c’est lui qui crée les menaces ensuite.`;
  return { idee, pourquoi, bestD, refD, bestTxt: matTxt(bestD), refTxt: matTxt(refD), n: Math.ceil(Math.max(best.length, ref.length) / 2) };
}

// Question d'orientation avant de jouer, selon la nature du meilleur coup.
export function hintFor(fen, bestMv, me) {
  const d = describe(fen, bestMv, me);
  if (!d) return 'Que menace le dernier coup adverse ?';
  const t = d.tags;
  if (t.mate || t.check) return 'Commence par les coups les plus forçants : quels échecs peux-tu donner ?';
  if (t.capture) return 'Passe en revue toutes tes captures possibles. L’une d’elles gagne du matériel.';
  if (t.escape) return 'Une de tes pièces est attaquée. Laquelle, et par quoi ?';
  if (t.defend) return 'Une de tes pièces est attaquée et mal défendue. Comment la protéger ?';
  if (t.fork || t.threat) return 'Cherche une pièce adverse mal défendue. Quel coup l’attaque ?';
  if (t.castle) return 'Où est ton roi ? Est-il en sécurité ?';
  return 'Aucune tactique immédiate ici. Vérifie que chacune de tes pièces est défendue, puis améliore la moins active.';
}

// Ce que vient de faire l'adversaire, pour apprendre à lire son dernier coup.
export function lastMoveText(g, ply, me) {
  if (ply < 1) return '';
  const t = moveText(g, ply, me);
  return t.replace(/^Ton adversaire (\S+)/, (_, vb) => 'Ton adversaire vient de ' + ({ prend: 'prendre', reprend: 'reprendre', met: 'mettre', pare: 'parer', joue: 'jouer', roque: 'roquer' }[vb] || vb));
}

// Description d'un coup quelconque de la partie (k = nombre de coups joués).
export function moveText(g, k, me) {
  const ch = new Chess();
  for (let i = 0; i < k - 1; i++) if (!ch.move(g.san[i], { sloppy: true })) return '';
  const prev = k > 1 ? ch.history({ verbose: true }).slice(-1)[0] : null;
  const d = describe(ch.fen(), g.san[k - 1], me, g.san[k], prev ? { to: prev.to, captured: prev.captured } : null);
  return d ? d.text : '';
}
