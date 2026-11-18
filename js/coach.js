// Coach Claude : cours privés générés à partir des positions réelles du joueur.
// La clé API reste sur l'appareil (localStorage) et n'est envoyée qu'à api.anthropic.com.
/* global Chess */
import { ls } from './store.js';
import { THEMES } from './stats.js';
import { fmtEval } from './classify.js';
import { fr } from './explain.js';
import { intent, features } from './plan.js';
import { play } from './geom.js';
import { datef } from './ui.js';
const DATE_FR = datef({});

export const MODELS = [['claude-sonnet-5-5', 'Sonnet 5.5 (recommandé)'], ['claude-opus-5-5', 'Opus 5.5 (plus fin, plus cher)'], ['claude-haiku-5-5', 'Haiku 5.5 (rapide, économique)']];
export const coachKey = () => ls.get('key', '');
export const coachModel = () => ls.get('model', MODELS[0][0]);
const MINE = { p: 'ton pion', n: 'ton cavalier', b: 'ton fou', r: 'ta tour', q: 'ta dame', k: 'ton roi' };
const WITH = { p: 'un pion', n: 'un cavalier', b: 'un fou', r: 'une tour', q: 'la dame', k: 'le roi' };
const LET = { n: 'C', b: 'F', r: 'T', q: 'D', k: 'R' };

async function call(system, user, maxTokens) {
  const key = coachKey();
  if (!key) throw new Error('Aucune clé API enregistrée.');
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: coachModel(), max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
  } catch { throw new Error('Connexion à l’API Claude impossible. Vérifie ta connexion.'); }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) throw new Error('Clé API refusée. Vérifie-la dans les réglages du coach.');
  if (r.status === 404) throw new Error('Modèle indisponible avec cette clé. Choisis-en un autre dans les réglages du coach.');
  if (r.status === 429 || r.status === 529) throw new Error('L’API Claude est saturée ou ta limite est atteinte. Réessaie dans une minute.');
  if (!r.ok) throw new Error(data?.error?.message || 'Erreur de l’API Claude (' + r.status + ').');
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function pieces(fen) {
  const out = { w: [], b: [], wp: [], bp: [] };
  fen.split(' ')[0].split('/').forEach((row, ri) => {
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) { f += +c; continue; }
      const sq = 'abcdefgh'[f] + (8 - ri), low = c.toLowerCase(), white = c !== low;
      if (low === 'p') out[white ? 'wp' : 'bp'].push(sq); else out[white ? 'w' : 'b'].push(LET[low] + sq);
      f++;
    }
  });
  return `Blancs : ${out.w.join(', ')} ; pions ${out.wp.join(', ') || 'aucun'}.\nNoirs : ${out.b.join(', ')} ; pions ${out.bp.join(', ') || 'aucun'}.`;
}

// Faits vérifiés (moteur + règles) sur une erreur : la seule matière que Claude a le droit d'affirmer.
export function facts(g, e) {
  const side = g.w ? 'Blancs' : 'Noirs';
  const real = g.san[e.ply + 1];
  let cap = '';
  try {
    const c = new Chess(e.fen);
    c.move({ from: e.playedUci.slice(0, 2), to: e.playedUci.slice(2, 4), promotion: e.playedUci[4] || 'q' });
    const m = e.punish[0] ? c.move(e.punish[0]) : null;
    if (m && m.captured) {
      const rec = c.moves({ verbose: true }).some((x) => x.to === m.to);
      cap = `Le coup ${fr(m.san)} capture ${MINE[m.captured]} en ${m.to} avec ${WITH[m.piece]} ; ${rec ? 'tu peux reprendre sur cette case mais l’échange te fait perdre du matériel' : 'tu ne peux pas reprendre sur cette case'}.`;
    } else if (m && c.in_checkmate()) cap = `Le coup ${fr(m.san)} fait échec et mat.`;
    else if (m && c.in_check()) cap = `Le coup ${fr(m.san)} donne échec.`;
  } catch { /* faits partiels */ }
  return [
    `Partie du ${DATE_FR(g.t * 1000)} : tu as les ${side} contre ${g.opp} (${g.or} Elo), ouverture ${g.fam}, résultat ${g.out === 'W' ? 'victoire' : g.out === 'L' ? 'défaite' : 'nulle'}.`,
    `Coup ${Math.floor(e.ply / 2) + 1}, trait aux ${side}.`,
    pieces(e.fen),
    `Ton coup en partie : ${fr(e.played)}. Meilleur coup selon le moteur : ${fr(e.bestSan)}.`,
    `Évaluation de ton point de vue : ${fmtEval(e.e0)} avant, ${fmtEval(e.e1)} après ton coup. Perte : ${e.drop} points de probabilité de gain.`,
    `Type d’erreur détecté : ${THEMES[e.theme] || e.theme}.`,
    e.punish.length ? `Meilleure suite adverse après ton coup (moteur) : ${e.punish.map(fr).join(' ')}.` : '',
    cap,
    real ? `Réponse réellement jouée par ton adversaire : ${fr(real)}.` : '',
    e.line.length ? `Suite recommandée par le moteur à ta place : ${e.line.map(fr).join(' ')}.` : '',
  ].filter(Boolean).join('\n');
}

const SYSTEM = `Tu es un entraîneur d'échecs professionnel qui donne un cours particulier à un adulte débutant-intermédiaire. Tu le tutoies. Ton but : qu'il ne refasse plus l'erreur étudiée.

Pédagogie attendue :
- Une seule idée par cours, annoncée clairement, puis retrouvée dans chacune de ses positions.
- Découverte guidée : pour chaque position, tu poses d'abord une question qui oriente son regard (quelle pièce, quelle case, quelle menace) sans donner le coup, puis un indice plus direct, puis l'explication.
- Langage simple et concret : cases, pièces, menaces. Tout terme technique est expliqué en quelques mots à sa première apparition.
- Ton direct, exigeant et bienveillant, sans flatterie ni formule creuse.
- Notation française (C cavalier, F fou, T tour, D dame, R roi).

Rigueur : sur les positions, tu n'affirmes que ce qui figure dans les faits fournis (emplacement des pièces, coups, suites du moteur, évaluations). Tu n'inventes aucune variante ni aucun coup. Si tu n'es pas sûr d'un détail tactique, tu restes sur ce que les faits établissent.

Tu réponds uniquement par un objet JSON valide, sans texte autour ni balises de code.`;

export function buildPrompt({ theme, base, elo, goal, numbers, examples }) {
  const user = `Élève : environ ${elo || 'moins de 1000'} Elo en parties rapides sur Chess.com, objectif ${goal} Elo.
Thème du cours : ${theme}.
Principe de référence : ${base.principe}
Routine de référence : ${base.routine.join(' | ')}
${numbers ? 'Statistiques de l’élève sur ce thème :\n' + numbers : ''}

${examples.length ? examples.map((f, i) => `=== Position ${i} (tirée de ses parties) ===\n${f}`).join('\n\n') : 'Aucune position disponible pour ce thème : construis le cours à partir de ses statistiques, sans position.'}

Rédige le cours au format JSON suivant :
{
  "titre": "titre court et concret",
  "accroche": "2 à 3 phrases : ce que tu as observé dans SES parties et ce que ce cours va changer",
  "idee": "l'idée centrale du cours expliquée simplement, 4 à 6 phrases",
  "positions": [
    { "i": numéro de la position, "question": "question qui guide son regard avant de jouer, sans révéler le coup", "indice": "indice plus direct, sans donner le coup", "explication": "3 à 5 phrases : pourquoi son coup échoue concrètement et pourquoi le meilleur coup fonctionne", "retenir": "une phrase à retenir de cette position" }
  ],
  "regle": "la règle du cours en une phrase qu'il peut se répéter en partie",
  "methode": ["3 ou 4 étapes d'une routine de vérification à appliquer avant chaque coup"],
  "quiz": [
    { "q": "question de compréhension sur l'idée (pas sur une position précise)", "choix": ["3 réponses possibles"], "bonne": index de la bonne réponse, "pourquoi": "explication courte" }
  ]
}
Une entrée dans "positions" par position fournie (${examples.length}), dans un ordre pédagogique (de la plus simple à la plus subtile). 3 questions dans "quiz".`;
  return { system: SYSTEM, user };
}
export function parseLesson(txt, nEx) {
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  let L;
  try { L = JSON.parse(txt.slice(a, b + 1)); } catch { throw new Error('Le cours est illisible : il faut la réponse complète de Claude, de la première accolade à la dernière.'); }
  if (!L.titre || !L.idee) throw new Error('Le cours est incomplet. Relance la génération.');
  L.positions = (Array.isArray(L.positions) ? L.positions : []).filter((p) => Number.isInteger(p.i) && p.i >= 0 && p.i < nEx);
  L.methode = Array.isArray(L.methode) ? L.methode : [];
  L.quiz = (Array.isArray(L.quiz) ? L.quiz : []).filter((q) => q.q && Array.isArray(q.choix) && Number.isInteger(q.bonne));
  L.at = Date.now();
  return L;
}
export async function genLesson(args) {
  const { system, user } = buildPrompt(args);
  const L = parseLesson(await call(system, user, 6000), args.examples.length);
  L.model = coachModel();
  return L;
}

export async function askCoach(context, question) {
  return call(SYSTEM.replace('Tu réponds uniquement par un objet JSON valide, sans texte autour ni balises de code.', 'Tu réponds en texte simple, sans mise en forme, en 3 à 6 phrases.'),
    `Contexte du cours et de la position :\n${context}\n\nQuestion de l'élève : ${question}`, 700);
}

// « Demande au coach » sur n'importe quelle position : faits vérifiés (pièces, moteur, intention, repères) et consigne d'entraîneur.
// p : { fen, me, played (SAN ou UCI, coup joué en partie depuis cette position), best (UCI), pv (UCI, commence par best), ev (cp, point de vue du joueur), context }
const POS_SYSTEM = SYSTEM.replace('Tu réponds uniquement par un objet JSON valide, sans texte autour ni balises de code.',
  `Tu commentes une position comme un entraîneur assis à côté de l'élève : tu parles de plans et d'idées, pas de chiffres du moteur.
Explique l'idée du meilleur coup (quelle pièce il améliore, quelle cible il prépare, quelle pièce adverse il gêne ou bloque), ce que le coup joué en partie changeait, puis donne une règle courte à retenir.
Tu réponds en texte simple, sans mise en forme, en 4 à 6 phrases.`);
export function positionPrompt(p) {
  const side = (c) => (c === 'w' ? 'Blancs' : 'Noirs'), turn = p.fen.split(' ')[1], no = p.fen.split(' ')[5] || '?';
  const san = (fen, list) => { const c = new Chess(fen), out = []; for (const u of list || []) { const m = play(c, u); if (!m) break; out.push(fr(m.san)); } return out; };
  const line = san(p.fen, p.pv && p.pv.length ? p.pv : p.best ? [p.best] : []), played = p.played ? san(p.fen, [p.played])[0] : null;
  const it = p.best ? intent(p.fen, p.pv && p.pv.length ? p.pv : [p.best], p.me) : null, rep = features(p.fen, p.me);
  const user = [
    p.context || '',
    `Tu joues les ${side(p.me)}. Trait aux ${side(turn)} (${turn === p.me ? 'toi' : 'ton adversaire'}), coup ${no}.`,
    pieces(p.fen),
    played ? `Coup joué en partie : ${played}.` : '',
    line.length ? `Meilleur coup selon le moteur : ${line[0]}. Suite du moteur : ${line.join(' ')}.` : '',
    p.ev != null ? `Évaluation : ${fmtEval(p.ev)}, de ton point de vue (+1 vaut un pion d’avance).` : '',
    it ? `Intention du meilleur coup (calculée) : ${it.text}` : '',
    rep.length ? 'Repères de la position :\n' + rep.map((x) => '- ' + x).join('\n') : '',
    '\nExplique-moi cette position comme mon entraîneur.',
  ].filter(Boolean).join('\n');
  return { system: POS_SYSTEM, user };
}
export const askPosition = (p) => { const { system, user } = positionPrompt(p); return call(system, user, 900); };
// Texte à coller dans une conversation Claude, sans clé API.
export const positionText = (p) => { const { system, user } = positionPrompt(p); return `${system}\n\n${user}`; };
