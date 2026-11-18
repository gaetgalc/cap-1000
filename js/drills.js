// Exercices de vérification rapide, générés à partir de positions réelles des parties du joueur.
// La bonne réponse est établie par les règles (coups légaux, attaquants, défenseurs), sans moteur.
/* global Chess */
import { replay, hasReplay } from './classify.js';
import { attacksFrom } from './geom.js';
import { hanging, poss, fr, VAL, NOM, cap, fem } from './explain.js';

export const DRILLS = {
  sur: { t: 'Ce coup est-il sûr ?', d: 'Tu viens de poser une pièce. Peut-elle être prise ?', why: 'Le réflexe qui évite de poser une pièce en prise : regarder qui attaque la case d’arrivée.' },
  menace: { t: 'Que menace ce coup ?', d: 'Ton adversaire vient de jouer. Trouve la pièce qu’il met en danger.', why: 'Lire le dernier coup adverse avant de penser à ton propre plan.' },
  cadeau: { t: 'Trouve le cadeau', d: 'Une pièce adverse peut être prise gratuitement. Laquelle ?', why: 'Repérer les pièces adverses non défendues, à chaque coup.' },
  compte: { t: 'Compte les coups forçants', d: 'Combien de captures ou d’échecs possibles ?', why: 'Passer en revue échecs et captures avant tout autre coup.' },
};
// Exercice qui entraîne le réflexe manquant pour chaque type d'erreur.
export const DRILL_FOR = { en_prise_pose: 'sur', en_prise_ignore: 'menace', tactique_subie: 'menace', mat_autorise: 'menace', cadeau_rate: 'cadeau', tactique_ratee: 'compte', mat_rate: 'compte', ouverture: 'sur', plan: 'sur', finale: 'sur' };

const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const arrow = (from, to, brush) => ({ orig: from, dest: to, brush });

const build = {
  // Un coup de pièce (hors pion et roi) est joué : la pièce peut-elle être prise avec profit ?
  sur(c, me, out) {
    const opp = me === 'w' ? 'b' : 'w', ch = new Chess(c.fen);
    if (ch.in_check()) return null;
    const wantUnsafe = out.filter((x) => x.answer === 'non').length <= out.filter((x) => x.answer === 'oui').length;
    for (const m of shuffle(ch.moves({ verbose: true }).filter((x) => 'nbrq'.includes(x.piece) && !x.captured))) {
      const mm = ch.move(m); // jouer puis défaire : évite de relire une FEN par essai
      const caps = ch.moves({ verbose: true }).filter((x) => x.to === mm.to).sort((a, b) => VAL[a.piece] - VAL[b.piece]);
      let bad = null, rec = false;
      for (const x of caps) {
        ch.move(x);
        const r = ch.moves({ verbose: true }).some((y) => y.to === mm.to);
        ch.undo();
        if (!r || VAL[x.piece] < VAL[mm.piece]) { bad = x; rec = r; break; }
      }
      const fenAfter = ch.fen();
      ch.undo();
      if (!!bad !== wantUnsafe) continue;
      const mine = poss(mm.piece, me, me);
      const text = bad
        ? `Non. ${cap(poss(bad.piece, opp, me))} en ${bad.from} peut prendre ${mine}${rec ? `, et même si tu reprends tu perds au change (${NOM[mm.piece]} contre ${NOM[bad.piece]})` : ', et rien ne peut reprendre'}.`
        : caps.length ? `Oui. ${cap(mine)} est attaqué${fem(mm.piece)}, mais défendu${fem(mm.piece)} : ${fem(mm.piece) ? 'la' : 'le'} prendre ne rapporte rien à ton adversaire.` : `Oui. Aucune pièce adverse n’attaque la case ${mm.to}.`;
      return { fen: fenAfter, last: [mm.from, mm.to], q: `Tu viens de jouer <b>${fr(mm.san)}</b>. Ta pièce est-elle en sécurité sur ${mm.to} ?`, options: [['oui', 'Oui, sûre'], ['non', 'Non, en prise']], answer: bad ? 'non' : 'oui', text, pre: [arrow(mm.from, mm.to, 'blue')], shapes: bad ? [arrow(bad.from, bad.to, 'red')] : [] };
    }
    return null;
  },
  // Après le vrai coup adverse : quelle pièce vient d'être mise en danger ?
  menace(c, me, out) {
    if (!c.prevFen || !c.last) return null;
    const opp = me === 'w' ? 'b' : 'w', ch = new Chess(c.fen);
    if (ch.in_check()) return null;
    const h1 = hanging(ch.board(), me);
    const wantNone = out.filter((x) => x.answer === 'none').length < Math.floor((out.length + 1) / 4);
    const q = `Ton adversaire vient de jouer <b>${fr(c.last.san)}</b>. Touche celle de tes pièces qu’il met en danger.`;
    const options = [['none', 'Aucune menace']];
    if (wantNone) {
      if (h1.length || c.last.captured) return null;
      return { fen: c.fen, last: [c.last.from, c.last.to], q, options, tap: true, answer: 'none', text: 'Aucune de tes pièces n’est en danger après ce coup. Le constater vite fait aussi partie de la vérification.', shapes: [] };
    }
    if (h1.length !== 1) return null; // la nouvelle menace est forcément dans h1 : inutile de relire la position d'avant sinon
    const h0 = new Set(hanging(new Chess(c.prevFen).board(), me).map((h) => h.sq));
    const fresh = h1.filter((h) => !h0.has(h.sq));
    if (fresh.length !== 1 || fresh[0].type === 'p') return null;
    const t = fresh[0];
    return { fen: c.fen, last: [c.last.from, c.last.to], q, options, tap: true, answer: t.sq, text: `${cap(poss(t.by.type, opp, me))} en ${t.by.sq} attaque ${poss(t.type, me, me)} en ${t.sq}, ${t.defended ? `qui vaut plus cher que l’attaquant` : `qui n’est pas défendu${fem(t.type)}`}.`, shapes: [arrow(t.by.sq, t.sq, 'red')] };
  },
  // Une seule pièce adverse (cavalier ou plus) peut être prise sans reprise possible.
  cadeau(c, me) {
    const opp = me === 'w' ? 'b' : 'w', ch = new Chess(c.fen);
    if (ch.in_check()) return null;
    // Sans pièce adverse (cavalier ou plus) attaquée, aucune capture ne rapporte : inutile de générer les coups (ce qui coûte cher).
    const B = ch.board(), hit = new Set();
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if (B[r][f]?.color === me) for (const [a, b] of attacksFrom(B, r, f)) hit.add(a * 8 + b);
    if (!B.some((row, r) => row.some((p, f) => p && p.color === opp && VAL[p.type] >= 3 && hit.has(r * 8 + f)))) return null;
    const free = [], seen = new Set();
    for (const m of ch.moves({ verbose: true }).filter((x) => x.captured && VAL[x.captured] >= 3)) {
      ch.move(m);
      if (!ch.moves({ verbose: true }).some((y) => y.to === m.to)) { free.push(m); seen.add(m.to); }
      ch.undo();
      if (seen.size > 1) return null; // deux cadeaux : la question n'a plus une seule réponse
    }
    const targets = [...new Set(free.map((m) => m.to))];
    if (targets.length !== 1) return null;
    const m = free.sort((a, b) => VAL[a.piece] - VAL[b.piece])[0];
    return { fen: c.fen, last: c.last ? [c.last.from, c.last.to] : undefined, q: 'À toi de jouer. Une pièce adverse peut être prise gratuitement. Touche-la.', options: [['skip', 'Je ne vois pas']], tap: true, answer: m.to, text: `${fr(m.san)} prend ${poss(m.captured, opp, me)} en ${m.to} : aucune pièce adverse ne peut reprendre.`, shapes: [arrow(m.from, m.to, 'green')] };
  },
  // Compter les captures ou les échecs disponibles.
  compte(c, me, out) {
    const ch = new Chess(c.fen);
    if (ch.in_check()) return null;
    const checks = out.length % 2 === 1, all = ch.moves({ verbose: true });
    const list = all.filter((m) => (checks ? /[+#]/.test(m.san) : !!m.captured));
    if (list.length > 5) return null;
    if (list.length === 0 && out.filter((x) => x.answer === '0').length >= 2) return null;
    const what = checks ? 'échecs' : 'captures';
    return { fen: c.fen, last: c.last ? [c.last.from, c.last.to] : undefined, q: `À toi de jouer. Combien d’<b>${what}</b> peux-tu ${checks ? 'donner' : 'faire'} ici ?`.replace('d’<b>captures', 'de <b>captures'), options: [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4 +']], answer: String(Math.min(list.length, 4)),
      text: list.length ? `${list.length} : ${list.map((m) => fr(m.san)).join(', ')}.` : `Aucun${checks ? '' : 'e'} ${checks ? 'échec' : 'capture'} possible ici.`, shapes: list.map((m) => arrow(m.from, m.to, checks ? 'blue' : 'green')) };
  },
};

// Positions essayées au plus par partie à la première passe : les règles de `build` sont sélectives, mais en essayer
// beaucoup ne change rien à la variété. Si la série reste incomplète, une seconde passe reprend les autres positions.
const TRIES = 6;

// Une série de n positions, une par partie pour varier. Positions et coups viennent du rejeu en cache (`replay`).
export function makeRound(type, games, n = 10) {
  const out = [], rest = [];
  const tryGame = (g, cands) => {
    const r = replay(g), me = g.w ? 'w' : 'b';
    for (const i of cands) {
      const it = build[type]({ fen: r.fens[i], prevFen: r.fens[i - 1], last: r.mv[i - 1] }, me, out);
      if (it) { out.push({ ...it, type, white: g.w }); return true; }
    }
    return false;
  };
  // Parties dont le rejeu est en cache d'abord (mélangées) : un rejeu à froid coûte ~20 ms par partie.
  const pool = games.filter((x) => x.san.length >= 24), warm = shuffle(pool.filter(hasReplay));
  for (const g of warm.concat(shuffle(pool.filter((x) => !hasReplay(x))))) {
    if (out.length >= n) break;
    const r = replay(g);
    if (!r) continue;
    const cands = [];
    for (let i = g.w ? 10 : 11; i < Math.min(r.mv.length, 80); i += 2) cands.push(i);
    shuffle(cands);
    if (!tryGame(g, cands.slice(0, TRIES)) && cands.length > TRIES) rest.push([g, cands.slice(TRIES)]);
  }
  for (const [g, cands] of rest) { if (out.length >= n) break; tryGame(g, cands); }
  return out;
}
