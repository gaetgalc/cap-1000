// Plan et réglages (#plan) : objectif, cadence suivie, clé API, apparence, sauvegarde.
import { ls } from '../store.js';
import { $, F_DLONG, esc, tabs, iosBrowser } from '../ui.js';
import { DAY } from '../progress.js';
import { board } from '../board.js';
import { MODELS, coachKey, coachModel } from '../coach.js';
import { toast } from '../toast.js';
import * as sound from '../sound.js';
import { PRO_TABS } from '../nav.js';
import * as look from '../look.js';
import { S, dkey, goal, rapidAll } from '../state.js';
import { cadenceField, upToDate } from './cartes.js';
import { keyForm } from './cours.js';
import { render } from '../app.js';

// Sauvegarde : rien n'est synchronisé entre appareils, le fichier sert de copie de sécurité et de transfert.
function backupCard() {
  const at = ls.get('bak', null), ago = at ? Math.floor((Date.now() - at) / DAY) : null;
  return `<div class="card"><h2>Sauvegarde</h2><p class="sub">Tes puzzles, ton journal, tes analyses et tes cours ne vivent que dans ce navigateur. Garde une copie, ou passe-les sur un autre appareil.</p>
    <p class="small">${at ? `Dernière sauvegarde ${ago === 0 ? 'aujourd’hui' : ago === 1 ? 'hier' : `il y a ${ago} jours`}.` : 'Aucune sauvegarde depuis cet appareil.'} La clé du coach n’est jamais mise dans le fichier.</p>${iosBrowser() ? '\n    <p class="small">Sur iPhone, Safari peut effacer les données d’un site non ouvert pendant 7 jours. Pour les garder, ajoute Cap 1000 à l’écran d’accueil (Partager, puis « Sur l’écran d’accueil »), puis restaure ta sauvegarde dans l’app.</p>' : ''}
    <div class="row"><button class="btn ${!at || ago >= 14 ? 'pri' : ''}" data-act="bakexp">Télécharger ma sauvegarde</button><button class="btn" data-act="bakimp">Restaurer un fichier</button><input type="file" id="bakfile" accept="application/json,.json" hidden></div>
    <p class="small" id="bakmsg" role="status"></p></div>`;
}
// Apparence de l'échiquier (lot 8 du 16/11) : palette, pièces, coordonnées, vitesse des suites ; js/look.js.
const LOOK_FEN = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'; // mat du berger : dernier coup, échec, coordonnées
function lookCard() {
  const l = look.look();
  const seg = (k, label, opts) => `<div class="stack lookrow"><span class="small" id="lk-${k}">${label}</span><div class="seg2" role="group" aria-labelledby="lk-${k}">${opts.map(([v, t]) => {
    const on = String(l[k]) === String(v);
    return `<button type="button" class="${on ? 'on' : ''}" aria-pressed="${on}" data-act="look" data-k="${k}" data-v="${v}">${t}</button>`;
  }).join('')}</div></div>`;
  return `<div class="card look"><h2>Apparence</h2><div class="lookgrid"><div class="board mini lookb" id="lookb" aria-label="Aperçu de l’échiquier"></div><div class="stack">
    ${seg('pal', 'Échiquier', look.PALETTES)}${seg('pc', 'Pièces', look.PIECES)}${seg('coords', 'Coordonnées', [[true, 'Oui'], [false, 'Non']])}${seg('speed', 'Lecture des suites', look.SPEEDS)}${seg('glass', 'Barres en verre', [[true, 'Oui'], [false, 'Non']])}
    <p class="small">Sur ordinateur, glisse le coin bas droit de l’échiquier d’un exercice pour le redimensionner.${l.size ? ` Taille choisie : ${l.size} px. <a href="#" data-act="look" data-k="size" data-v="">Revenir à la taille automatique</a>` : ''}</p></div></div></div>`;
}
function weekKey() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); }
function viewPlan() {
  // Liste à cocher de la semaine retirée le 18/11 (la séance du jour fait ce travail) : les clés plan:<semaine> restent stockées.
  const hours = ls.get('hours', 6), wk = weekKey();
  const monday = new Date(wk + 'T00:00:00').getTime() / 1000;
  const played = rapidAll().filter((g) => g.t >= monday).length;
  const target = Math.max(4, Math.round((hours * 60 * 0.5) / 25));
  const g = goal();
  return `${tabs('plan', PRO_TABS)}<h1>Plan et réglages</h1>
  <div class="card stack"><h2>Données</h2><p class="sub">Compte ${esc(S.user)}. Les nouvelles parties sont récupérées toutes seules.</p><div class="row">${cadenceField()}</div><div class="row"><button class="btn" data-act="refresh" ${S.importing && !S.importing.err ? 'aria-busy="true"' : ''}>Mettre à jour</button><span class="sub">${upToDate()}</span></div></div>
  <div class="card"><h2>Semaine du ${F_DLONG(new Date(wk + 'T00:00:00'))}</h2>
      <div class="row"><label for="hrs" class="sub">Temps disponible</label><select id="hrs">${[3, 4, 5, 6, 8, 10].map((h) => `<option value="${h}" ${h === hours ? 'selected' : ''}>${h} h par semaine</option>`).join('')}</select></div>
      <div class="stack"><b>Jouer : <span class="num">${played} / ${target}</span> parties rapides cette semaine</b>
        <div class="goalbar" aria-hidden="true"><i style="width:${Math.min(100, (100 * played) / target)}%"></i></div>
        <p class="small">Compté automatiquement à chaque mise à jour. Cadence conseillée : 15|10, l’incrément laisse le temps de vérifier chaque coup.</p></div>
    </div>
  <div class="grid">
    <div class="card"><h2>Avant chaque coup</h2><ol class="routine"><li>Que menace le dernier coup adverse ?</li><li>Ai-je un échec, une capture ou une menace ?</li><li>La case où je vais est-elle attaquée ?</li><li>Après mon coup, qu’est-ce que je laisse sans défense ?</li></ol></div>
    <div class="card"><h2>Règles de session</h2><ol class="routine"><li>Deux défaites de suite : fin des parties pour aujourd’hui, place aux puzzles.</li><li>Jamais de partie classée en étant pressé ou fatigué.</li><li>Après chaque défaite, mise à jour ici et relecture des moments clés.</li></ol></div>
    <div class="card"><h2>Objectif</h2><div class="row"><label for="gelo" class="sub">Elo visé</label><input type="number" id="gelo" value="${g.elo}" min="100" max="3000" step="50" style="width:100px"></div>
      <div class="row"><label for="gdate" class="sub">Échéance</label><input type="date" id="gdate" value="${g.date}"></div>
      <div><button class="btn sm" data-act="reset">Changer de pseudo ou effacer les données</button></div></div>
    <div class="card"><h2>Sons</h2><label class="check"><input type="checkbox" data-f="snd" ${sound.enabled() ? 'checked' : ''}><span>Sons des coups, des bonnes réponses et de l’objectif atteint <span class="small">Coupés par défaut. Aussi réglables pendant un exercice.</span></span></label></div>
    ${lookCard()}
    ${backupCard()}
    <div class="card"><h2>Coach Claude</h2>${coachKey() ? `<p class="sub">Coach activé. Clé enregistrée sur cet appareil (…${esc(coachKey().slice(-4))}).</p>
      <div class="row"><label for="cmodel" class="sub">Modèle</label><select id="cmodel">${MODELS.map(([v, l]) => `<option value="${v}" ${coachModel() === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><button class="btn sm" data-act="keydel">Supprimer la clé de cet appareil</button></div>` : keyForm()}</div>
  </div>`;
}
function mountPlan() {
  $('#hrs').onchange = (e) => { ls.set('hours', +e.target.value); render(true); toast('Temps par semaine enregistré'); };
  const save = () => { const elo = +$('#gelo').value, date = $('#gdate').value; if (elo >= 100 && date) { ls.set('goal', { elo, date }); render(true); toast('Objectif enregistré'); } };
  $('#gelo').onchange = save; $('#gdate').onchange = save;
  const cm = $('#cmodel'); if (cm) cm.onchange = () => ls.set('model', cm.value);
  board($('#lookb'), { fen: LOOK_FEN, viewOnly: true, lastMove: ['h5', 'f7'] });
}

export { mountPlan, viewPlan };
