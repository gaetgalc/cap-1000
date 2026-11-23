// Aides d'affichage sans état : sélection dans la page, échappement, formats, icônes, bulle du coach.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Un Intl.DateTimeFormat par jeu d'options : en créer un à chaque appel coûte cher (des milliers par courbe).
const FMT = new Map();
export const datef = (opts) => {
  const k = JSON.stringify(opts);
  let f = FMT.get(k);
  if (!f) FMT.set(k, f = new Intl.DateTimeFormat('fr-FR', opts));
  return (ms) => f.format(ms);
};
const DFMT = datef({ day: '2-digit', month: '2-digit', year: '2-digit' });
export const dfmt = (t) => DFMT(t * 1000);
export const TC = { rapid: 'Rapide', blitz: 'Blitz', bullet: 'Bullet', daily: 'Différé', all: 'Toutes cadences' };
export const HOW = { checkmated: 'mat', timeout: 'temps', resigned: 'abandon', abandoned: 'partie quittée', stalemate: 'pat', agreed: 'nulle par accord', repetition: 'répétition', insufficient: 'matériel insuffisant', '50move': '50 coups', timevsinsufficient: 'temps contre matériel insuffisant' };
export const coach = (html, cls = '') => `<div class="coach ${cls}"><div class="coach-b" data-edge>${html}</div></div>`;
export const txt = (t) => esc(t).replace(/\n/g, '<br>');
// Lettre du jour de la semaine, jour local (lundi L … dimanche D) : repère sous les cases de la semaine de l'accueil.
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
export const dayLetter = (ms) => DAY_LETTERS[new Date(ms).getDay()];
export const pl = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
export const f1 = (x) => x.toFixed(1).replace('.', ',');
// Icônes dessinées : les flèches Unicode deviennent des émojis sur iPhone.
const LN = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
const LT = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const IC = {
  prev: `<path d="M15 5l-7 7 7 7" ${LN}/>`, next: `<path d="M9 5l7 7-7 7" ${LN}/>`,
  first: `<path d="M18 5l-7 7 7 7M7 5v14" ${LN}/>`,
  arrow: `<path d="M5 19L18 6M10 6h8v8" ${LN}/>`, arrowoff: `<path d="M5 19L18 6M10 6h8v8" ${LN} opacity=".45"/><path d="M4 4l16 16" ${LN}/>`, // flèche du meilleur coup affichée ou masquée
  last: `<path d="M6 5l7 7-7 7M17 5v14" ${LN}/>`,
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>', pause: '<path d="M7 5h3.500v14H7zM13.500 5H17v14h-3.500z" fill="currentColor"/>',
  replay: '<path d="M12 6V2.500L7 6.500l5 4V8a4.500 4.500 0 1 1-4.500 4.500h-2A6.500 6.500 0 1 0 12 6z" fill="currentColor"/>',
  // Exercices de la page S'entraîner (16/11) : un dessin par activité, trait fin
  tgt: `<circle cx="12" cy="12" r="8" ${LT}/><circle cx="12" cy="12" r="3.5" ${LT}/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" ${LT}/>`,
  clock: `<circle cx="12" cy="13" r="8" ${LT}/><path d="M12 9v4l2.500 2.500M10 2h4" ${LT}/>`,
  lines: `<path d="M5 5h3M5 12h3M5 19h3M11 5h8M11 12h8M11 19h5" ${LT}/>`,
  flag: `<path d="M6 21V4M6 4h11l-2.500 4L17 12H6" ${LT}/>`,
  bulb: `<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" ${LT}/>`,
  spark: `<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" ${LT}/>`,
  book: `<path d="M4 5.500C6.500 4.500 9.500 4.500 12 6c2.500-1.500 5.500-1.500 8-.5V19c-2.500-1-5.500-1-8 .5-2.500-1.500-5.500-1.500-8-.5z M12 6v13.500" ${LT}/>`,
  tree: `<circle cx="6" cy="5" r="2" ${LT}/><circle cx="6" cy="19" r="2" ${LT}/><circle cx="18" cy="12" r="2" ${LT}/><path d="M6 7v10M6 12h3a4 4 0 0 0 4-4V7.500M13 12h3" ${LT}/>`,
  log: `<path d="M7 3h10v18H7zM10 8h4M10 12h4M10 16h2" ${LT}/>`,
  bolt: `<path d="M13 2L5 13.500h6L10 22l8-11.500h-6z" ${LT}/>`,
  king: `<path d="M12 2.500v4M10 4.500h4M7 21h10M8 17.500h8l1-6.500a5 5 0 0 0-10 0z" ${LT}/>`,
  // Haut-parleur (sons activés) et haut-parleur barré (sons coupés)
  snd: `<path d="M4 9.5h3.500L12 5.500v13L7.500 14.500H4z" fill="currentColor"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11" ${LN}/>`,
  refresh: `<path d="M20 12a8 8 0 1 1-2.400-5.700M20 4v4.500h-4.500" ${LN}/>`,
  mute: `<path d="M4 9.5h3.500L12 5.500v13L7.500 14.500H4z" fill="currentColor"/><path d="M16 9.500l5 5M21 9.500l-5 5" ${LN}/>`,
};
// Durée écoulée en français : « à l’instant », « il y a 3 min », « il y a 2 h », « hier », « il y a 5 jours ».
export function agoFr(ms) {
  const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), d = Math.floor(ms / 86400000);
  if (m < 1) return 'à l’instant';
  if (h < 1) return `il y a ${m} min`;
  if (h < 24) return `il y a ${h} h`;
  if (h < 48) return 'hier';
  return `il y a ${d} jours`;
}
export const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${IC[n]}</svg>`;
export const setHtml = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } }; // ne reconstruit pas un bouton sous le doigt
export function wdl(s) {
  if (!s.n) return '';
  return `<span class="wdl" title="${s.w} victoires, ${s.d} nulles, ${s.l} défaites">${s.w ? `<i class="w" style="flex:${s.w}"></i>` : ''}${s.d ? `<i class="d" style="flex:${s.d}"></i>` : ''}${s.l ? `<i class="l" style="flex:${s.l}"></i>` : ''}</span>`;
}
// Encart chiffré (.glt) : libellé, valeur (cls : sa couleur), sous-titre en HTML, bulle tip ; lien « revue » quand href est donné.
export const tile = (lab, v, { sub = '', cls = '', tip = '', href } = {}) => {
  const t = href ? 'a' : 'div';
  return `<${t} class="glt${href ? ' revue' : ''}"${href ? ` href="${href}"` : ''}${tip ? ` title="${esc(tip)}"` : ''}><span class="small">${lab}</span><b class="num ${cls}">${v}</b>${sub ? `<span class="small">${sub}</span>` : ''}</${t}>`;
};
// Résultat d'une partie (out : W, L ou D) : le mot, ou la pastille colorée suivie de la manière de finir quand how est donné.
export const resWord = (out) => (out === 'W' ? 'Victoire' : out === 'L' ? 'Défaite' : 'Nulle');
export const resChip = (out, how) => `<span class="chip ${out === 'W' ? 'good' : out === 'L' ? 'bad' : ''}">${resWord(out)}${HOW[how] ? ` (${HOW[how]})` : ''}</span>`;
// Onglets en liens (.seg2 pztabs) : items = [[clé, adresse, libellé], …], on = clé de l'onglet allumé.
export const tabs = (on, items) => `<div class="seg2 pztabs">${items.map(([k, href, t]) => `<a class="${on === k ? 'on' : ''}" href="${href}">${t}</a>`).join('')}</div>`;
export const WDL_LEGEND = '<div class="legend"><span style="--c:var(--good)">Victoires</span><span style="--c:var(--neutral)">Nulles</span><span style="--c:var(--bad)">Défaites</span></div>';

// Bord estompé des panneaux qui défilent : `edge-b` tant qu'il reste du contenu dessous, `edge-t` dès qu'on a défilé.
// Chaque élément [data-edge] n'est suivi qu'une fois ; taille, contenu et défilement remettent les classes à jour.
export function watchEdges(root = document) {
  for (const el of root.querySelectorAll('[data-edge]')) {
    if (el._edge) continue;
    el._edge = true;
    const upd = () => {
      el.classList.toggle('edge-b', el.scrollHeight - el.scrollTop - el.clientHeight > 4);
      el.classList.toggle('edge-t', el.scrollTop > 4);
    };
    const ro = new ResizeObserver(upd);
    const watch = () => { ro.disconnect(); ro.observe(el); for (const c of el.children) ro.observe(c); upd(); }; // tous les enfants : n'importe lequel peut grandir
    el.addEventListener('scroll', upd, { passive: true });
    new MutationObserver(watch).observe(el, { childList: true });
    watch();
  }
}

// Blocs gris de chargement à la place d'un texte « en cours » : largeurs des lignes en %, libellé pour les lecteurs d'écran.
export const skel = (label, ...w) => `<span class="skel-g">${label ? `<span class="vh">${esc(label)}</span>` : ''}${w.map((x) => `<span class="skel" style="width:${x}%" aria-hidden="true"></span>`).join('')}</span>`;

// Formats de date : un Intl.DateTimeFormat par jeu d'options (datef), les mêmes options qu'avec toLocale…String('fr-FR', …).
export const F_HM = datef({ hour: '2-digit', minute: '2-digit' }), F_WDLONG = datef({ weekday: 'long', day: 'numeric', month: 'long' }), F_DSHORT = datef({ day: 'numeric', month: 'short' });
export const F_DNUM = datef({}), F_DMY = datef({ day: 'numeric', month: 'short', year: 'numeric' }), F_WDLONG_MSHORT = datef({ weekday: 'long', day: 'numeric', month: 'short' });
export const F_DSHORT_UTC = datef({ day: 'numeric', month: 'short', timeZone: 'UTC' }), F_MY_UTC = datef({ month: 'short', year: 'numeric', timeZone: 'UTC' });
export const F_DLONG = datef({ day: 'numeric', month: 'long' });
