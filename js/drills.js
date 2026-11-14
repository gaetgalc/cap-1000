// Exercices de vérification rapide, générés à partir de positions réelles des parties du joueur.
// La bonne réponse est établie par les règles (coups légaux, attaquants, défenseurs), sans moteur.
/* global Chess */
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
      const c2 = new Chess(c.fen), mm = c2.move(m);
      const caps = c2.moves({ verbose: true }).filter((x) => x.to === mm.to).sort((a, b) => VAL[a.piece] - VAL[b.piece]);
      let bad = null, rec = false;
      for (const x of caps) {
        const c3 = new Chess(c2.fen()); c3.move(x);
        const r = c3.moves({ verbose: true }).some((y) => y.to === mm.to);
        if (!r || VAL[x.piece] < VAL[mm.piece]) { bad = x; rec = r; break; }
      }
      if (!!bad !== wantUnsafe) continue;
      const mine = poss(mm.piece, me, me);
      const text = bad
        ? `Non. ${cap(poss(bad.piece, opp, me))} en ${bad.from} peut prendre ${mine}${rec ? `, et même si tu reprends tu perds au change (${NOM[mm.piece]} contre ${NOM[bad.piece]})` : ', et rien ne peut reprendre'}.`
        : caps.length ? `Oui. ${cap(mine)} est attaqué${fem(mm.piece)}, mais défendu${fem(mm.piece)} : ${fem(mm.piece) ? 'la' : 'le'} prendre ne rapporte rien à ton adversaire.` : `Oui. Aucune pièce adverse n’attaque la case ${mm.to}.`;
      return { fen: c2.fen(), last: [mm.from, mm.to], q: `Tu viens de jouer <b>${fr(mm.san)}</b>. Ta pièce est-elle en sécurité sur ${mm.to} ?`, options: [['oui', 'Oui, sûre'], ['non', 'Non, en prise']], answer: bad ? 'non' : 'oui', text, pre: [arrow(mm.from, mm.to, 'blue')], shapes: bad ? [arrow(bad.from, bad.to, 'red')] : [] };
    }
    return null;
  },
  // Après le vrai coup adverse : quelle pièce vient d'être mise en danger ?
  menace(c, me, out) {
    if (!c.prevFen || !c.last) return null;
    const opp = me === 'w' ? 'b' : 'w', ch = new Chess(c.fen);
    if (ch.in_check()) return null;
    const h0 = new Set(hanging(new Chess(c.prevFen).board(), me).map((h) => h.sq)), h1 = hanging(ch.board(), me);
    const fresh = h1.filter((h) => !h0.has(h.sq));
    const wantNone = out.filter((x) => x.answer === 'none').length < Math.floor((out.length + 1) / 4);
    const q = `Ton adversaire vient de jouer <b>${fr(c.last.san)}</b>. Touche celle de tes pièces qu’il met en danger.`;
    const options = [['none', 'Aucune menace']];
    if (wantNone) {
      if (h1.length || c.last.captured) return null;
      return { fen: c.fen, last: [c.last.from, c.last.to], q, options, tap: true, answer: 'none', text: 'Aucune de tes pièces n’est en danger après ce coup. Le constater vite fait aussi partie de la vérification.', shapes: [] };
    }
    if (fresh.length !== 1 || h1.length !== 1 || fresh[0].type === 'p') return null;
    const t = fresh[0];
    return { fen: c.fen, last: [c.last.from, c.last.to], q, options, tap: true, answer: t.sq, text: `${cap(poss(t.by.type, opp, me))} en ${t.by.sq} attaque ${poss(t.type, me, me)} en ${t.sq}, ${t.defended ? `qui vaut plus cher que l’attaquant` : `qui n’est pas défendu${fem(t.type)}`}.`, shapes: [arrow(t.by.sq, t.sq, 'red')] };
  },
  // Une seule pièce adverse (cavalier ou plus) peut être prise sans reprise possible.
  cadeau(c, me) {
    const opp = me === 'w' ? 'b' : 'w', ch = new Chess(c.fen);
    if (ch.in_check()) return null;
    const free = [];
    for (const m of ch.moves({ verbose: true }).filter((x) => x.captured && VAL[x.captured] >= 3)) {
      const c2 = new Chess(c.fen); c2.move(m);
      if (!c2.moves({ verbose: true }).some((y) => y.to === m.to)) free.push(m);
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

// Une série de n positions, une par partie pour varier.
export function makeRound(type, games, n = 10) {
  const out = [];
  for (const g of shuffle(games.filter((x) => x.san.length >= 24).slice())) {
    if (out.length >= n) break;
    const me = g.w ? 'w' : 'b', ch = new Chess(), cands = [];
    let prevFen = null, last = null;
    for (let i = 0; i < Math.min(g.san.length, 80); i++) {
      const fen = ch.fen();
      if (i >= 10 && (i % 2 === 0) === g.w) cands.push({ fen, prevFen, last });
      prevFen = fen;
      last = ch.move(g.san[i], { sloppy: true });
      if (!last) break;
    }
    for (const c of shuffle(cands)) {
      const it = build[type](c, me, out);
      if (it) { out.push({ ...it, type, white: g.w }); break; }
    }
  }
  return out;
}
