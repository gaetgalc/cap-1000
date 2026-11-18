# Plan : revue selon les règles d'interface d'Apple (17/11)

> **Pour un agent :** skill requis `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans`, tâche par tâche. Étapes en cases à cocher.

**État : fait (18/11). Décisions de Gaëtan : D1 = A, D2 = B, D3 = A (recommandations retenues).** Exécuté par sous-agents ; le contrôleur a fusionné dans `main` et poussé après la relecture de chaque tâche, puis une vague de corrections finale a suivi la relecture de l'ensemble. Compte rendu pour Gaëtan : JOURNAL §48 ; règles ajoutées : REFONTE § « Revue HIG (17/11) ».

**But :** appliquer la revue faite avec le skill `apple-design` (dépôt `dickwu/apple-design-skill` : 123 pages des Human Interface Guidelines d'Apple, plus un regard de studio) : corriger ce que l'audit actuel ne mesure pas (navigation sur téléphone, texte agrandi, contraste renforcé, fonctions qui changent de place selon la largeur), sans toucher à l'identité (thème sombre, échiquier vert, Geist et Source Serif 4).

**Architecture :** chaque règle nouvelle entre d'abord dans `tests/audit-ui.js` ou dans un test unitaire, et échoue ; le CSS ou la vue la fait ensuite passer. Un seul module nouveau, `js/nav.js` (pur), pour la logique des onglets.

**Technique :** site statique en modules ES, chessground, Playwright 1.63 (Chromium préinstallé), `node --test`.

**Spec :** §1 « Revue » de ce document ; règles de fond dans `docs/REFONTE.md`.

## Contraintes globales

- Règles de `docs/REFONTE.md` inchangées : jetons de `:root` seulement, 6 tailles de texte (13, 14, 16, 20, 28, 40), rayons 6 / 8 / 50 %, un bouton plein par vue, cibles de 44 px sur téléphone, mouvement de 150 à 240 ms en `transform` / `opacity`, `prefers-reduced-motion`.
- Aucun écran d'échiquier ne défile aux 4 tailles de référence ; l'accueil ne défile pas en 390 × 664.
- `render()` pour les actions de l'utilisateur, `bgRender()` pour tout le reste ; écrans d'exercice par `exo.screen` uniquement.
- Icônes par `ico()`, jamais de flèche Unicode. Interface en français, phrases sans capitales de titre.
- Dépôt public : aucune donnée personnelle.
- Fin de chaque tâche : `node --test tests/*.test.mjs`, `node tests/parcours.js`, `node tests/audit-ui.js` sans écart ; la règle ajoutée est notée dans `docs/REFONTE.md` § « Revue HIG (17/11) » ; les lignes de `CLAUDE.md` devenues fausses sont corrigées ; commit sur la branche de travail. La fusion dans `main` et le push sont faits par le contrôleur après la relecture de la tâche (règle du 15/11, sans pull request) : « Publier » dans une tâche veut dire « commit ».

## Points à surveiller (non couverts par les tests)

1. **Safari réel** : le zoom de 125 % est émulé par une fenêtre de 312 × 531 ; les barres de Safari qui se replient ne le sont pas. Attendu : la barre d'actions d'un exercice reste entière. À vérifier par Gaëtan sur son iPhone.
2. **Mise à jour automatique pendant un exercice** (tâche 5) : l'échiquier en cours ne doit pas être reconstruit. Test ajouté dans la tâche 5.
3. **Onglet qui rouvre une page mémorisée devenue invalide** (tâche 4) : partie disparue, route d'un autre compte. Attendu : la page d'entrée de la section. Test ajouté dans la tâche 4.
4. **Bord estompé sur un panneau défilé jusqu'en bas** (tâche 3) : l'estompage doit disparaître, sinon la dernière ligne paraît coupée. Test ajouté dans la tâche 3.
5. **Contraste renforcé avec les palettes bois et bleu** : les coordonnées de l'échiquier sont hors mesure (`cg-container`). Attendu : inchangées. Contrôle visuel sur les captures de la tâche 2.

---

## 1. Revue

**Cadre.** Application web, utilisée surtout dans Safari sur iPhone, et sur ordinateur. Le skill applique à une appli web les principes et les fondations (accessibilité, couleur, typographie, mise en page, écriture) ; les conventions iOS (barre d'onglets, feuilles) servent ici de principes, pas de règles d'App Store.

**Matériau.** Audit du 17/11 (32 écrans aux 4 tailles, aucun écart sur les règles de la refonte), 5 captures de plus (menu ouvert sur téléphone, zoom 125 % sur l'accueil, un puzzle et les parties), contrastes calculés depuis les jetons de `:root`. Pages lues : `accessibility`, `layout`, `typography`, `color`, `dark-mode`, `designing-for-ios`, `designing-for-macos`, `tab-bars`, `sidebars`, `toolbars`, `buttons`, `popovers`, `sheets`, `segmented-controls`, `motion`, `feedback`, `loading`, `progress-indicators`, `writing`, `settings`, `generative-ai`, `branding`, `design-principles`, plus `cross-platform`.

**Thèse.** « Arriver et savoir quoi faire. » L'accueil la tient : un bouton plein, la séance d'abord. Ce dont on se souviendra : la barre 755 → 1000 et la séance en 4 étapes.

**Note : à retravailler (« Needs work » dans le barème du skill).** Aucun défaut critique. Trois écarts hauts, tous dans la coquille (navigation sur téléphone, filtres, texte agrandi) ; les écrans eux-mêmes sont solides.

### Haut

**H1. Sur téléphone, un onglet ouvre un menu au lieu de naviguer.**
Mesure : un appui sur « S'entraîner » laisse l'adresse sur `#accueil` et ouvre un panneau de 13 entrées qui déborde (coupé à « Ouvertures à apprendre ») ; le trait de l'onglet actif reste sous « Aujourd'hui » (`js/app.js:2475`).
Règles : `tab-bars.md › Best practices` : « Use a tab bar to support navigation, not to provide actions. » ; « […] switch between sections of the view while preserving the current navigation state within each section. » `popovers.md › Mobile` : « Avoid displaying popovers in compact views […] use a sheet instead. »
Arbitrage : le menu répond à la demande du 16/11 (« tout doit s'ouvrir un menu déroulant »). Voir décision D1.

**H2. Les mêmes fonctions changent de place selon la largeur, et la navigation porte des actions.**
Mesure : sur ordinateur, Cadence, Période et « Mettre à jour » sont en bas de la colonne de navigation ; sur téléphone, dans Progrès > Plan et réglages > Tes données, sans libellé visible (« Rapide », « Depuis le début »).
Règles : `layout.md › Size classes` : « Keep functionality the same as size classes change. » `sidebars.md › Desktop` : « Avoid putting critical information or actions at the bottom of a sidebar. » `settings.md › Best practices` : « prefer letting people modify task-specific options without going to your settings area. » `toolbars.md › Item groupings` : « Keep consistent groupings and placement across platforms. »
Correction : la cadence suivie (elle change aussi la file des puzzles) devient un réglage, avec libellé, aux deux tailles ; la période devient un sélecteur dans Mon jeu, la seule vue qui l'utilise ; la mise à jour devient automatique (au retour sur l'onglet après 10 min) avec une ligne d'état et un bouton dans Parties. Tâche 5.

**H3. Le texte agrandi casse l'écran d'exercice.**
Mesure, zoom 125 % de Safari (312 × 531) : échiquier du puzzle à 160 px, titre coupé « Puzz… », compteur « 0 / 8 » sur deux lignes, onglets « Mes erreurs » sur deux lignes, coordonnées qui se chevauchent ; l'accueil défile (623 px pour 531) et le mot du coach est coupé.
Règles : `accessibility.md › Vision` : « give people the option to enlarge text by at least 200 percent ». `typography.md` : « Keep text truncation to a minimum as font size increases. » ; « Prioritize important content when responding to text-size changes. »
Correction : une cinquième taille de contrôle (312 × 531) avec ses règles ; sous 560 px de haut, l'exercice cache ce qui est secondaire (onglets, ronds de l'objectif, ligne de contexte). Tâche 1. Testé à 125 % seulement.

### Moyen

**M1. La barre du haut répète le nom du site sur chaque page.** Téléphone : « Cap 1000 » + Elo + série sur une rangée, puis le titre de la page dessous ; sur l'accueil, l'Elo apparaît deux fois (puce « 755 Elo » et barre « 755 → 1000 »). `toolbars.md › Titles` : « Don't title windows with your app name. » `branding.md` : « Resist the temptation to display your logo throughout your app […] ». Correction : le titre de la page monte dans la barre du haut, le logo reste sur l'accueil, la puce Elo quitte l'accueil. Décision D3, tâche 6.

**M2. Une même couleur dit deux choses.** Icône de Progrès `#f39a80` (teinte 14°) contre `--bad` `#ff7a6e` (5°) ; S'entraîner `#f2b65c` (36°) contre `--warn` `#ffb534` (38°). `color.md › Best practices` : « Avoid using the same color to mean different things. » Décision D2, tâche 7.

**M3. Des panneaux coupent le texte en pleine ligne, sans signe qu'il reste à lire.** Relecture en 390 × 664 : « chaque coup est commenté ici » coupé au bas du commentaire. `layout.md › Visual hierarchy` : « use a scroll edge effect » ; `typography.md` (troncature). Correction : bord estompé automatique sur tout panneau qui défile. Tâche 3.

**M4. Aucune réponse au réglage « Augmenter le contraste ».** Le contraste de base passe partout (le plus faible : `--ink3` sur `--btn2`, 4.72:1), donc ce n'est pas un défaut ; mais `dark-mode.md › Best practices` demande de tester « with Increase Contrast » et le skill veut une réponse (objectif : texte à 7:1, bords de cartes visibles). Tâche 2.

**M5. Les messages d'arrière-plan masquent le contenu.** « 12 parties analysées » couvre « Mon coup » / « Rejouer » sur l'accueil et les dates de la courbe dans Mon jeu, 2,5 s. `accessibility.md › Cognitive` : « Minimize use of time-boxed interface elements. » `feedback.md` : « Consider integrating status feedback into your interface. » Correction : messages éphémères réservés aux actions de l'utilisateur. Tâche 8.

**M6. Sur ordinateur, l'échiquier d'exercice laisse de la place.** Puzzle en 1366 × 768 : échiquier de 544 px, bandeau dessous de 175 px pour une ligne (« Trait aux Noirs »). La relecture, avec le bandeau dans la colonne de droite (`capSide`), atteint 680 px. `layout.md › Visual hierarchy` : « Order content by relative importance. » Tâche 9.

### Bas

- **Pastille « 4 » sur Aujourd'hui** : `tab-bars.md` réserve les pastilles aux informations critiques. Gardée (écart assumé, voir plus bas).
- **Deux voix sur un même écran** : onglet « Mes erreurs » et titre « Puzzles sur tes erreurs ». `writing.md` : « Build language patterns » ; « Use possessive pronouns sparingly ». Hors plan, à proposer.
- **Son coupé en bas de la colonne sur ordinateur pendant un exercice** (`sidebars.md`, bas de colonne). Traité avec H2 : la colonne ne garde que la navigation et ce bouton, qui n'est pas critique.

### Regard de studio (craft)

- **Point de vue** : celui de Chess.com (gris chaud, échiquier vert), voulu ; c'est le principe « Familiarity ». Le vert vient de l'échiquier : ce n'est pas le gabarit « fond noir et un vert acide » que le skill signale.
- **Hardiesse dispersée** : vert d'accent, 5 couleurs de section, couleurs d'état, serif, bouton en relief. L'accessoire à retirer en premier, ce sont les couleurs de section (D2).
- **Signature** : la barre 755 → 1000 est la bonne. Piste hors plan : l'aiguille de la boussole du logo qui pointe selon l'avancée.

### Ce qui marche (à garder)

- Contraste : tout texte ≥ 4.5:1 sur toutes les surfaces ; libellé blanc du bouton principal à 4.9:1.
- Cibles de 44 px sur téléphone, un bouton plein par vue, état d'appui en 90 ms (`buttons.md` : « Always include a press state »).
- `prefers-reduced-motion` respecté, mouvement court, focus clavier visible, raccourcis sur ordinateur avec aide (?).
- Analyse avec progression chiffrée et bouton « Mettre en pause » (`progress-indicators.md` : indicateur déterminé, arrêt possible).
- Coach : Claude nommé, clé sur l'appareil, tout fonctionne sans clé (`generative-ai.md` : « Communicate where your app uses AI », « Ensure a great experience even when generative features aren't available »).
- Sons coupés par défaut et doublés à l'écran (pastilles ✓ / ✗) (`accessibility.md › Hearing`).
- Restauration d'une sauvegarde confirmée avant d'écraser (`feedback.md` : perte de données irréversible).
- Courbes en `role="img"` avec libellé.

### Écarts assumés (gardés malgré le skill)

- **Thème sombre seul**, sans thème clair : `dark-mode.md` le permet « in rare cases » pour une appli centrée sur un contenu (ici l'échiquier), et le site n'offre pas de réglage d'apparence, ce que la page interdit.
- **Pas de verre (Liquid Glass)** : le skill le réserve à la couche de commandes flottante ; la barre du bas repose sur des fonds unis, le gain serait nul et le coût réel sur iPhone.
- **Pastille du nombre d'étapes restantes** sur Aujourd'hui.
- **Menus au survol sur ordinateur** : inchangés quelle que soit D1.

---

## 2. Décisions à prendre

| | Question | A | B | Recommandation |
|---|---|---|---|---|
| D1 | Appui sur un onglet, téléphone (tâche 4) | L'onglet navigue : page où tu étais dans cette section, ou sa page d'entrée ; second appui = page d'entrée. Les pages de la section sont listées dans la section (S'entraîner l'a déjà, Parties a ses onglets, Progrès en reçoit). Menus gardés sur ordinateur | Le menu reste, mais en feuille du bas : voile sombre, poignée, fermeture par glissement ou appui à côté, onglet ouvert marqué actif | **A** : c'est la convention que l'iPhone t'a apprise, et elle garde ta place dans chaque section |
| D2 | Couleurs des icônes (tâche 7) | Icônes grises, seule celle de l'onglet actif en couleur | Couleurs gardées, mais S'entraîner passe au bleu `#93c2f5` et Progrès au turquoise `#6fd3c6`, loin de l'ambre et du rouge d'état | **B** : garde ta demande du 16/11 et règle le vrai problème (une couleur = un sens) |
| D3 | Barre du haut, téléphone (tâche 6) | Titre de la page dans la barre, logo sur l'accueil seulement, plus de puce Elo sur l'accueil | Inchangée | **A** : une rangée de gagnée sur chaque page |

---

## 3. Tâches

Ordre : 0, puis 1, 2, 3 (indépendantes), puis 5, 4, 6, 7, 8, 9. Les tâches 4, 6 et 7 attendent leur décision.

### Task 0 : audit ciblé

**Fichiers :** modifier `tests/audit-ui.js`, `CLAUDE.md` (bloc « Tester »).

**Interfaces :** produit les variables d'environnement `ONLY` (noms d'écrans séparés par des virgules) et `SIZES` (identifiants de tailles), utilisées par toutes les tâches suivantes.

- [x] **Étape 1** : lancer `ONLY=accueil SIZES=390x664 node tests/audit-ui.js`. Attendu aujourd'hui : les 32 écrans aux 4 tailles (3 à 4 min), les variables étant ignorées.
- [x] **Étape 2** : filtrer `SIZES` et `SCREENS` sur ces variables quand elles sont présentes ; sans elles, tout tourne comme avant.
- [x] **Étape 3** : relancer la commande de l'étape 1. Attendu : une seule ligne `390x664  accueil  rien à signaler`, en moins d'une minute.
- [x] **Étape 4** : ajouter l'exemple au bloc « Tester » de `CLAUDE.md`, créer dans `docs/REFONTE.md` la section vide « Revue HIG (17/11) » qui renvoie à ce plan. Publier (contraintes globales).

### Task 1 : texte agrandi (H3)

**Fichiers :** modifier `tests/audit-ui.js`, `css/app.css`.

**Interfaces :** consomme `ONLY`, `SIZES` (tâche 0). Produit la taille `312x531` et la règle « libellé sur une ligne », valables pour la suite.

- [x] **Étape 1 : la mesure.** Dans `SIZES`, ajouter `{ id: '312x531', width: 312, height: 531, mobile: true, zoom: true }` (390 × 664 au zoom 125 % de Safari). Dans `measure`, à toutes les tailles : tout élément visible de `#ttl, .tools .chip, .seg2 > *, .actbar .btn, .nav .grp-h span` plus haut que 1,6 fois sa hauteur de ligne est noté « libellé sur deux lignes ». À la taille `zoom` seulement : le défilement de la page est permis hors écran d'échiquier ; l'échiquier `#xb` d'un écran `body.fit` mesure au moins 240 px (200 px pour `partie` et `partie-debrief`).
- [x] **Étape 2** : `SIZES=312x531 ONLY=puzzles,erreur,drill-sur,partie,accueil node tests/audit-ui.js`. Attendu : écarts sur `puzzles` (échiquier de 160 px, libellés sur deux lignes), au moins.
- [x] **Étape 3 : le correctif**, un bloc `@media (max-width: 859px) and (max-height: 560px)` dans `css/app.css` : cacher sur un écran d'exercice (`body.fit` seulement : les onglets des autres pages restent) les onglets `.seg2.pztabs` (le retour mène à S'entraîner, qui les liste), les ronds `.dots` de la barre du haut (le compteur reste) et la ligne de contexte `.meta` ; `white-space: nowrap` sur `#ttl` (avec `overflow: hidden`, `text-overflow: ellipsis`, `min-width: 0`, car la tâche 6 y mettra des titres longs) et sur les puces de `.tools`. Ne rien changer au-dessus de 560 px de haut. Si un écran d'échiquier n'atteint pas le seuil après ces retraits, ne pas baisser le seuil : rendre compte de la mesure obtenue et de la cause (statut DONE_WITH_CONCERNS).
- [x] **Étape 4** : relancer l'étape 2, puis l'audit complet (5 tailles). Attendu : aucun écart, et toujours aucun aux 4 tailles d'origine.
- [x] **Étape 5** : noter la règle dans `REFONTE.md`, passer « 4 tailles » à « 5 tailles » dans `CLAUDE.md`. Publier.

### Task 2 : contraste renforcé (M4)

**Fichiers :** modifier `tests/audit-ui.js`, `css/app.css`.

**Interfaces :** produit la passe `390x664-hc` de l'audit.

- [x] **Étape 1 : la mesure.** Ajouter une passe `{ id: '390x664-hc', width: 390, height: 664, mobile: true, hc: true }` qui appelle `page.emulateMedia({ contrast: 'more' })` avant la première page. Dans cette passe, le seuil de contraste du texte passe de 4.5 à 7, et le bord de chaque `.card` visible doit atteindre 3:1 contre le fond de la page.
- [x] **Étape 2** : `SIZES=390x664-hc node tests/audit-ui.js`. Attendu : écarts de contraste (`--ink3` sur `--btn2` à 4.72:1) et de bord de carte (transparent).
- [x] **Étape 3 : le correctif**, `@media (prefers-contrast: more) { :root { … } }` dans `css/app.css`. Valeurs de départ, contraste sur `--surface` / `--bg` : `--ink2: #e4e1da` (11.85 / 10.37), `--ink3: #d8d5cd` (10.55 / 9.23), `--bad: #ffb0a6` (8.85 / 7.74), `--warn: #ffcc70` (10.41 / 9.10), `--line: #8a877f` (4.31 / 3.77) ; `.card` y prend `border-color: var(--line)` ; anneau de focus à 3 px. Si un texte reste sous 7:1 (rouge sur `--btn2` à 6.48:1 par exemple), éclaircir ce jeton jusqu'à passer.
- [x] **Étape 4** : relancer l'étape 2, puis l'audit complet. Regarder `puzzles.png` et `partie.png` de la passe `-hc` avec les palettes bois et bleu (point à surveiller 5). Noter la règle, publier.

### Task 3 : bord estompé des panneaux qui défilent (M3)

**Fichiers :** modifier `js/ui.js`, `js/exercise.js`, `css/app.css`, `tests/audit-ui.js`.

**Interfaces :** produit `watchEdges(root: ParentNode = document): void` dans `js/ui.js` : pour chaque élément `[data-edge]` pas encore suivi, pose `edge-b` tant qu'il reste du contenu en dessous et `edge-t` dès qu'il est défilé depuis le haut, recalculés au défilement et au changement de taille (contenu compris, `ResizeObserver` sur l'élément et son premier enfant).

- [x] **Étape 1 : la mesure.** Dans `measure`, tout élément visible en `overflow-y: auto | scroll` (hors `textarea`, `select`, `input`) à qui il reste plus de 4 px de contenu sous la partie visible (`scrollHeight - scrollTop - clientHeight > 4`) doit porter `edge-b`. Après la mesure, une seconde évaluation fait défiler chaque `[data-edge]` jusqu'en bas, attend deux images, et note tout `edge-b` restant (point à surveiller 4).
- [x] **Étape 2** : `ONLY=partie,puzzles,cours-position SIZES=390x664,1366x768 node tests/audit-ui.js`. Attendu : écart « panneau qui défile sans bord » sur `partie` en 390 × 664.
- [x] **Étape 3** : `data-edge` sur `#xpanel` et `#xcap` dans `exo.screen` ; `exo.attach()` appelle `watchEdges()`. Tout autre conteneur que la mesure signale (liste des coups de la relecture, par exemple) reçoit aussi `data-edge` et passe par `watchEdges`. CSS : `.edge-b` masque les 24 px du bas (`mask-image` et `-webkit-mask-image`, dégradé vers transparent), `.edge-t` les 24 px du haut, les deux ensemble se combinent.
- [x] **Étape 4** : relancer l'étape 2, puis l'audit complet. Ajouter `watchEdges` à la ligne de `ui.js` dans `CLAUDE.md`, noter la règle, publier.

### Task 5 : filtres, réglage de cadence, mise à jour automatique (H2)

**Fichiers :** modifier `js/ui.js`, `js/app.js` (`filtersHtml`, `header`, vue Plan, vue Mon jeu, vue Parties, gestion de `data-f`, démarrage), `css/app.css` ; créer `tests/ui.test.mjs` ; modifier `tests/parcours.js`.

**Interfaces :** produit `agoFr(ms: number): string` dans `js/ui.js`, et la ligne d'état de Parties (`#upd`) que la tâche 8 utilise.

- [x] **Étape 1 : test rouge**, `tests/ui.test.mjs` :

```js
test('agoFr', () => {
  assert.equal(agoFr(30e3), 'à l’instant');
  assert.equal(agoFr(3 * 60e3), 'il y a 3 min');
  assert.equal(agoFr(2 * 3600e3), 'il y a 2 h');
  assert.equal(agoFr(30 * 3600e3), 'hier');
  assert.equal(agoFr(5 * 86400e3), 'il y a 5 jours');
});
```

- [x] **Étape 2** : `node --test tests/ui.test.mjs`. Attendu : échec, `agoFr` absent.
- [x] **Étape 3** : écrire `agoFr` (moins d'une minute, minutes, heures jusqu'à 24, « hier » jusqu'à 48 h, puis jours). Relancer : vert.
- [x] **Étape 4 : étapes rouges du parcours** (`tests/parcours.js`) : en 1366 × 768, `#tools select` est absent ; `#plan` montre un `<label>` « Cadence suivie » ; `#bilan` montre un sélecteur de période ; pendant un puzzle, `__cap.data.fetchedAt = 0` puis un `visibilitychange` laisse le même nœud `#xb` en place (point à surveiller 2). Attendu : échecs.
- [x] **Étape 5 : le correctif.**
  - `header()` ne rend plus les filtres ; sur ordinateur la colonne ne garde que la navigation et le bouton son.
  - Vue Plan, carte « Tes données » (les deux tailles, plus de `m-only`) : sélecteur de cadence avec `<label>` « Cadence suivie », « Mettre à jour » et « À jour : » + `agoFr`.
  - Vue Mon jeu, et toute autre vue qui lit `S.f.days` (le vérifier avec `grep`) : sélecteur `.seg2.mini` « Tout · 90 j · 30 j » à côté du titre, en boutons `data-f="days" data-v="0|90|30"` ; le gestionnaire de `data-f` accepte ces boutons.
  - Vue Parties : ligne d'état `#upd` (« À jour, il y a 3 min ») et bouton icône `data-act="refresh"` avec `aria-label="Mettre à jour"`, `aria-busy` pendant l'import (icône `refresh` à ajouter à `IC` si elle manque).
  - Démarrage : seuil unique `STALE = 10 * 60000` au chargement (au lieu de 6 h) et à chaque `visibilitychange` vers visible ; l'import ainsi lancé passe par `bgRender()`.
- [x] **Étape 6** : `node --test tests/*.test.mjs`, `node tests/parcours.js`, audit complet. Mettre à jour `CLAUDE.md` (barre de navigation, `agoFr`, vue Plan), noter la règle, publier.

### Task 4 : onglets du téléphone (H1), D1 = A

**Fichiers :** créer `js/nav.js`, `tests/nav.test.mjs` ; modifier `js/app.js` (état actif de la navigation, appui sur `.grp-h`, vues Mon jeu, Stats et Plan), `index.html` (retirer `data-grp`), `css/app.css`, `tests/parcours.js`.

**Interfaces :** produit dans `js/nav.js` :
- `SECTIONS` : `{ acc: [...], ent: [...], par: [...], pro: [...] }`, les routes de chaque section, reprises des `data-grp` actuels d'`index.html` (source unique désormais) ;
- `ROOT` : `{ acc: 'accueil', ent: 'entrainer', par: 'parties', pro: 'bilan' }` ;
- `sectionOf(hash: string): 'acc' | 'ent' | 'par' | 'pro' | null`, avec la règle actuelle de `#ouvertures` : sans argument → `par`, avec argument → `ent` ;
- `tabTarget(sec: string, cur: string, last: Record<string, string>): string` : même section que `cur` → `'#' + ROOT[sec]` ; sinon `last[sec]` s'il appartient bien à `sec` ; sinon `'#' + ROOT[sec]`.

- [x] **Étape 1 : test rouge**, `tests/nav.test.mjs` :

```js
test('sectionOf', () => {
  assert.equal(sectionOf('#partie/1700000000/12'), 'par');
  assert.equal(sectionOf('#ouvertures'), 'par');
  assert.equal(sectionOf('#ouvertures/italienne'), 'ent');
  assert.equal(sectionOf('#avantpartie'), 'acc');
  assert.equal(sectionOf('#inconnu'), null);
});
test('tabTarget', () => {
  assert.equal(tabTarget('ent', '#accueil', {}), '#entrainer');
  assert.equal(tabTarget('pro', '#parties', { pro: '#stats' }), '#stats');
  assert.equal(tabTarget('pro', '#stats', { pro: '#stats' }), '#bilan');
  assert.equal(tabTarget('par', '#accueil', { par: '#bilan' }), '#parties'); // mémoire invalide (point à surveiller 3)
});
```

- [x] **Étape 2** : `node --test tests/nav.test.mjs`. Attendu : échec, module absent. Écrire `js/nav.js`. Relancer : vert.
- [x] **Étape 3 : étape rouge du parcours**, en 390 × 664 : un appui sur `#nh-ent` mène à `#entrainer` sans `.fly` visible ; depuis `#stats`, appui sur `#nh-par` puis `#nh-pro` → `#stats` ; nouvel appui sur `#nh-pro` → `#bilan`. Attendu : échec.
- [x] **Étape 4 : le correctif.** `app.js` garde `navLast` en mémoire (pas de stockage), mis à jour à chaque changement de route par `sectionOf` ; l'état actif des liens passe par `sectionOf`. Sur téléphone (`phoneNav`), l'appui sur `.grp-h` va à `tabTarget(...)` ; `.fly` reste caché sous 860 px ; `aria-haspopup` et `aria-expanded` ne sont posés que sur ordinateur. Mon jeu, Stats et Plan reçoivent en tête les onglets `.seg2.pztabs` « Mon jeu · Stats · Plan » (aide `tabs()` existante).
- [x] **Étape 5** : tests, parcours, audit complet. Ajouter `js/nav.js` à la table de `CLAUDE.md`, réécrire la ligne `index.html`, noter la règle, publier.


### Task 6 : titre de la page dans la barre du haut (M1), D3 = A

**Fichiers :** modifier `js/app.js` (`header`, ordre d'appel dans `render`), `css/app.css`, `tests/audit-ui.js`.

- [x] **Étape 1 : la mesure**, tailles téléphone : hors accueil et hors pages à barre de retour (`body.imm`), `.brand` invisible, `#ttl` non vide, et aucun `h1` visible de même texte que `#ttl` ; sur l'accueil, `.brand` visible et aucune puce « Elo » dans `#tools`.
- [x] **Étape 2** : `ONLY=accueil,entrainer,parties,bilan,plan SIZES=390x664 node tests/audit-ui.js`. Attendu : écarts sur les 5.
- [x] **Étape 3 : le correctif.** Après l'écriture de la vue, `header()` recopie dans `#ttl` le texte du premier `h1` de `#view` et lui pose la classe `vh` (caché à l'écran, lu par les lecteurs d'écran), sous 860 px seulement ; `.brand` caché sous 860 px hors accueil ; puce Elo retirée sur l'accueil.
- [x] **Étape 4** : audit complet (l'accueil doit rester sans défilement en 390 × 664). Mettre à jour `CLAUDE.md`, noter la règle, publier.

### Task 7 : couleurs de section (M2)

**Fichiers :** modifier `tests/css.test.mjs`, `css/app.css`.

- [x] **Étape 1 : test rouge** dans `tests/css.test.mjs` (D2 = B) : lire les jetons de `:root` ; l'écart de teinte entre chacune de `--c-train`, `--c-games`, `--c-prog` et chacune de `--warn`, `--bad` est d'au moins 40°. Aujourd'hui : 2° (S'entraîner / avertissement), 9° (Progrès / erreur).
- [x] **Étape 2** : `node --test tests/css.test.mjs`. Attendu : échec.
- [x] **Étape 3** : `--c-train: #93c2f5` (8.31:1 sur `--surface`, 7.27:1 sur `--bg`), `--c-prog: #6fd3c6` (8.70 / 7.61) ; `--c-learn` supprimé s'il ne sert plus, sinon `var(--c-train)`.
- [x] **Étape 4** : tests, audit complet, coup d'œil sur les captures de navigation. Corriger la note des couleurs dans `REFONTE.md` (§ « Navigation et icônes »), publier.

### Task 8 : messages d'arrière-plan (M5)

**Fichiers :** modifier `js/app.js` (`doImport`, fin d'analyse, action `analyse`), `tests/parcours.js`.

**Interfaces :** consomme la ligne d'état `#upd` (tâche 5).

- [x] **Étape 1 : étape rouge du parcours** : après l'analyse automatique du démarrage, 500 ms plus tard, aucun `.toast` ne contient « analysée ». Attendu : échec.
- [x] **Étape 2 : le correctif.** Message éphémère d'import seulement si `first || manual` ; message de fin d'analyse seulement si l'analyse a été lancée par un clic (`S.job.manual`, posé par l'action `analyse`). Sinon, rien : les nombres changent sur place (ligne `#upd`, pastilles).
- [x] **Étape 3** : parcours, audit complet. Mettre à jour la ligne `toast.js` de `CLAUDE.md`, publier.

### Task 9 : échiquier d'exercice plus grand sur ordinateur (M6)

**Fichiers :** modifier `js/exercise.js` (ligne 25), `tests/audit-ui.js`.

- [x] **Étape 1 : la mesure** : aux tailles 1366 × 768 et 1280 × 860, l'échiquier des écrans `body.fit` mesure au moins 640 px. Si un écran ne peut pas l'atteindre pour une raison de structure, ne pas baisser le seuil : rendre compte de la mesure et de la cause (DONE_WITH_CONCERNS).
- [x] **Étape 2** : `ONLY=puzzles,erreur,drill-sur,ligne-reciter,finale,jouer SIZES=1366x768,1280x860 node tests/audit-ui.js`. Attendu : écarts (544 px sur `puzzles` en 1366 × 768).
- [x] **Étape 3** : `capSide` vrai par défaut (`spec.capSide !== false`) : sur ordinateur, le bandeau passe en tête de la colonne de droite sur tous les écrans d'exercice, comme la relecture.
- [x] **Étape 4** : audit complet ; regarder chaque capture d'ordinateur des 6 écrans (colonne de droite sans défilement de page, bandeau lisible). Mettre à jour la description de `capSide` dans `CLAUDE.md`, publier.

### Fin

- [x] `superpowers:verification-before-completion`, puis `/code-review` et `/simplify` sur l'ensemble.
- [x] `docs/JOURNAL.md` : un paragraphe par tâche faite ; ce plan passe en « fait » avec la date.

---

## 4. Hors plan (idées issues de la revue, à proposer plus tard)

- Une seule voix dans les libellés : la navigation sans possessifs (« Erreurs », « Inédits »), le coach au tutoiement (`writing.md`).
- Aiguille de la boussole du logo qui pointe selon l'avancée vers 1000 (signature, `design-principles.md › Delight` : sens, pas décor).
- Respect du réglage « Texte plus grand » d'iOS par `font: -apple-system-body` et des tailles en `rem` : à ne tenter qu'après la tâche 1, et à vérifier sur iPhone.
