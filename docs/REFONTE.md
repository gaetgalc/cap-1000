# Refonte de l'interface (à partir du 15/11)

Référence : le skill « design-taste-frontend » (dépôt `Leonxlnx/taste-skill`), adapté à un outil d'entraînement.
Maquette validée par Gaëtan le 15/11 : écrans Aujourd'hui et Puzzle, téléphone et ordinateur (artefact Claude privé).

## Décisions

| Sujet | Décision |
|---|---|
| Ce qu'on prend du skill | Jetons partagés (espacement par 4, une échelle de titres, une échelle d'arrondis), un seul bouton plein par vue, boutons de 44 px minimum, texte lu à 16 px, rien sous 13 px, contraste 7:1 (texte) et 4.5:1 (secondaire), une couleur d'accent, mouvement court (150 à 240 ms, `transform` et `opacity` seulement, survol réservé à la souris, `prefers-reduced-motion`), pas de capitales espacées ni de mise en valeur par couleur |
| Ce qu'on laisse | Héro, « une section par écran », photos, effets, scènes, tirage de palette (le vert de l'échiquier reste) |
| Bouton principal | Garde son relief (ombre basse `--btn-edge`), choix de Gaëtan contre la règle du skill. Vert assombri `#3a8020` pour un libellé blanc à 4.9:1 |
| Polices | Geist (texte), Source Serif 4 600 (h1, h2, logo, grands chiffres : `--serif`, demande du 17/11), Geist Mono (notation des coups). Choisies dans la table du skill (`library/type.json`, poids 3 sur « software » et « tech ») ; à servir depuis `vendor/fonts/` comme les polices actuelles. Graisses 400 et 500, 600 au plus, jamais 700 |
| Échelle de texte | 13, 14, 16, 20, 28 px, plus 40 px pour un grand chiffre (Elo, stats) |
| Arrondis | 6 px (petits éléments), 8 px (cartes, boutons), 50 % (pastilles rondes) ; 8 et 12 jusqu’au 16/11 |
| Thème | Sombre unique, échiquier vert |
| Navigation | 5 entrées : Aujourd'hui, S'entraîner, Apprendre, Parties, Progrès. Pas de volet au survol, pas de « Plus ». Pendant un exercice sur ordinateur, la colonne se réduit aux icônes |
| Anciennes adresses | Toutes gardées et redirigées vers leur nouvelle place |
| Publication | Chaque étape fusionnée dans `main` quand les tests passent |

## Étape 1 : état des lieux (15/11)

Outil : `node tests/audit-ui.js [dossier]`. Il ouvre 22 écrans sur les parties simulées de `tests/fixture.js`, aux 4 tailles (390 × 664, 390 × 760, 1366 × 768, 1280 × 860), fait une capture de chacun et mesure : défilement d'un écran d'échiquier, débordement horizontal, tailles de texte, texte sous 13 px, contraste réel du texte sur son fond, cibles tactiles sous 44 px, boutons pleins visibles, arrondis. Résultat détaillé dans `audit.json` du dossier de sortie (`tests/out/audit` par défaut, ignoré par git).

Le script de contrôle du skill (`gate.mjs`) n'a pas été lancé : l'exécution des scripts du dépôt du skill est bloquée dans l'environnement de Claude. `audit-ui.js` reprend ses mesures utiles à une application.

### Ce qui va bien

- Aucun écran d'échiquier ne défile, à aucune des 4 tailles. Aucun débordement horizontal.
- Aucune erreur JavaScript sur les 22 écrans.
- L'accueil remanié le 15/11 suit déjà la logique visée : un seul bouton plein, séance en premier.

### Écarts mesurés (sur `main` du 15/11, après l'accueil épuré)

| Écart | Mesure | Où | Étape qui le corrige |
|---|---|---|---|
| Trop de tailles de texte | 21 tailles : 10, 11, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 20, 22, 23, 24, 26, 28, 30, 46, 52 | partout | 2 |
| Trop d'arrondis | 14 valeurs : 2 à 14 px, 50 %, 99 px, 999 px | partout | 2 |
| Texte sous 13 px | jusqu'à 37 éléments par écran ; barre du bas en 11 px, pastilles en 12.5 px (Elo, série, dates, étiquettes) | Stats, Partie, Parties, Bilan, Ouvertures | 2 |
| Libellé blanc sur le vert du bouton principal | contraste 3.16:1 (minimum 4.5:1) | chaque bouton plein | 2 |
| Plusieurs boutons pleins sur un écran | 8 sur une fiche de cours (« Travailler cette position »), 6 sur une fiche d'ouverture (« Jouer »), 3 sur Ouvertures, 2 sur Plan | fiches | 2 (style) et 5 (choix du bouton principal) |
| Cibles trop petites | barre d'onglets à 32 px, boutons à 36 px, liens « Ouvrir » à 20 px, cases à cocher à 18 px, coups de la relecture à 29 px, entrées de liste à 37 px | presque tous les écrans | 2 (hauteurs) et 7 (contrôle final) |
| Navigation sur 3 niveaux | entrées principales, puis volet « Leçons » au survol, puis sous-onglets (Coach : 3, Puzzles : 3, Ouvertures : 2) ; Échauffements, Gagner et Historique accessibles seulement par des liens ou par « Plus » | navigation | 3 |
| Onglets qui débordent | la fiche d'ouverture coupe « Tes parties » en 390 px | fiche d'ouverture | 5 |
| Trois boutons dans la barre d'un exercice | Indice, Mon coup, Solution (le skill en veut deux au plus par rangée) | puzzle, erreur | à trancher en étape 5 (« Mon coup » peut passer dans le panneau) |
| Notation des coups en police de texte | les coups (« Fb7 », « 1.e4 e5 ») ne sont pas en chasse fixe | relecture, lignes | 2 (Geist Mono) |

### Captures de référence

Les captures « avant » ne sont pas versionnées (poids). Pour les refaire : `git checkout fcae6c5 -- . && node tests/audit-ui.js tests/out/avant`, ou relancer l'audit à chaque étape et comparer les `audit.json`.

## Étapes 2 à 8 (16/11)

| Étape | Fait |
|---|---|
| 2. Jetons | Geist et Geist Mono dans `vendor/fonts/` ; `:root` porte couleurs, 6 tailles de texte, 2 rayons (+ 50 %), espacements, durées, `--hit` ; plus aucune couleur en dur dans les règles ; graisse 700 remplacée par 600 ; bouton principal `#3a8020` (4.9:1) avec son relief ; notation des coups en Geist Mono |
| 3. Navigation | 5 entrées : Aujourd'hui, S'entraîner (page nouvelle `#entrainer`), Apprendre (`#cours`, onglets Cours / Ouvertures), Parties (onglets Parties / Mes ouvertures), Progrès (Mon jeu). `#plus` redirige vers `#plan`. Toutes les anciennes adresses fonctionnent |
| 4. Aujourd'hui | Accueil sans défilement de la session parallèle du 16/11 conservé tel quel (JOURNAL §25), passé aux jetons |
| 5-6. Écrans | Un seul bouton plein par écran : « Travailler cette position », « Jouer », « Travailler », « Activer le coach », « Copier le brief », « M'entraîner sur ce thème », « Les rejouer » passent en secondaire ; le choix Blancs / Noirs devient un bouton sélectionné (`.btn.on`), plus un bouton plein. Onglet « Tes parties » de la fiche d'ouverture renommé « Parties » pour tenir en 390 px |
| 7. Mouvement et accessibilité | Survol réservé à la souris (`hover: hover` et `pointer: fine`), appui des boutons en 90 ms (`transform` seulement), plus d'animation de largeur, `prefers-reduced-motion` respecté ; cibles de 44 px sur téléphone (boutons, onglets, liens seuls sur leur ligne, lignes de tableau cliquables, coups de la relecture) |
| 8. Contrôle | `audit-ui.js` : 6 tailles de texte, 3 rayons, aucun contraste faible, aucun texte sous 13 px, un bouton plein au plus, aucune cible sous 44 px sur téléphone, aucun écran d'échiquier qui défile, sur les 22 écrans et les 4 tailles. Tests unitaires et test de bout en bout passent |

### Écarts assumés avec le skill

- **Volet au survol pour Progrès** (le skill n'en veut pas) : demande explicite de Gaëtan du 16/11, « les 3 toggle en haut dans le menu déroulant à gauche ».
- **Trois boutons dans la barre d'un puzzle** (Indice, Mon coup, Solution ; le skill en veut deux) : « Mon coup » répond à une demande de départ (« voir en un clic ce que j'ai joué »).
- **Relief du bouton principal** : choix de Gaëtan du 15/11.
- **Cibles de 44 px seulement sur téléphone** : le skill les exige aux largeurs tactiles ; à la souris, les boutons restent à 44 px mais les petits liens et les coups de la relecture gardent leur taille.
- Pas de lien d'évitement (« aller au contenu ») : le routage par `#` le transformerait en changement de page.

## Plan d'agrément (16/11)

Suite de la refonte, détail dans `docs/PLAN-AGREMENT.md`. Écarts assumés en plus de ceux ci-dessus :

- **Coordonnées de l'échiquier en 12 px** (`--t-coord`), sous le minimum de 13 px : elles sont dans le coin des cases, comme sur Lichess et Chess.com. L'audit ne les compte pas (elles sont dans `cg-container`).
- **Anneau du bilan de fin de séance en 700 ms** (`--m-ring`, `stroke-dashoffset`), au-delà des 240 ms : en 240 ms la fermeture ne se voit pas. Coupé par `prefers-reduced-motion`.
- **Relecture sur téléphone** : échiquier de 273 px en 390 × 664 (et non bord à bord) pour garder visibles la bande de coups et la courbe d'avantage sans défilement ; les boutons Début et Fin sont masqués (touches du clavier, bande de coups).

## Navigation et icônes (16/11, demande de Gaëtan)

> apprendre et s'entraîner doivent être le même onglet -> tout doit s'ouvrir un menu déroulant. ajoute aussi de la couleur aux logos

- **Navigation à 4 entrées** (Aujourd'hui, S'entraîner, Parties, Progrès), chacune avec un menu déroulant sur ordinateur seulement (sur téléphone, voir « Revue HIG » : ce sont des onglets). Écart assumé avec la règle « pas de volet au survol », étendu à toutes les entrées à la demande de Gaëtan.
- **Icônes de section colorées** : 5 teintes douces (vert, ambre, bleu, violet, corail), seule l'icône est colorée, jamais le texte ; inactive à 72 %, active en pleine couleur avec un fond teinté à 12 %. Écart assumé avec « une seule couleur d'accent », limité aux icônes.

## Fonds et alignement (16/11, demande de Gaëtan)

> intègre la couleur plus claire comme sur Chess.com ; centre uniquement quand ça fait sens

- **Fonds inversés, comme Chess.com** : page en gris chaud clair (`--bg` #2b2926), colonne de navigation, barres et cartes plus sombres posées dessus (`--surface` #22211e), encarts, champs et onglets choisis plus clairs que la carte (`--sunken`, `--raised`). Boutons secondaires pleins gris clair sans bord visible (`--btn2`, `--btn2-hover`). Contraste revérifié par l'audit.
- **Centrage** : une seule colonne de contenu (`.view`, 1 120 px au plus), centrée dans l'espace à droite de la navigation ; l'accueil n'a plus sa propre largeur (1 040 px), donc le bord gauche du contenu ne bouge plus d'une page à l'autre. Le texte reste aligné à gauche ; on ne centre que les éléments autonomes (icônes dans leur pastille, compteurs, anneau du bilan, libellés des onglets et des boutons, échiquier dans sa zone).

## Encarts nets et fluidité (17/11, demande de Gaëtan)

> rendre plus propre les encarts […] j'aime bien [la police] de claude · à-coup par à-coup, au lieu d'une expérience fluide

- **Cartes sans contour** : séparées par le fond seulement (`--surface` sur `--bg`), bordure transparente gardée pour ne rien décaler. Un état (séance en cours) se marque par un trait de 3 px à gauche, pas par un contour.
- **Pastilles** : texte simple, couleur d'état portée par un point de 6 px ; jamais de fond coloré.
- **Serif** (`--serif`) réservée aux titres h1 / h2, au logo et aux grands chiffres ; tout texte de lecture, bouton ou chiffre de tableau reste en Geist.
- **Transitions** : la navigation garde son `view-transition-name` (`side` sur ordinateur, `tabs` sur téléphone) ; un nouvel élément fixe de la coquille en reçoit un aussi pour ne pas fondre avec la page. Un calcul de vue de plus de 50 ms se garde en mémoire ou se prépare quand le navigateur est libre.

## Revue HIG (17/11)

Règles ajoutées par la revue selon les règles d'interface d'Apple : voir `docs/PLAN-HIG.md`.

- **Texte agrandi** (Safari à 125 % : 312 × 531 px CSS, cinquième taille de l'audit `312x531`) : aucun libellé court (titre, puces, onglets, boutons de barre, navigation) sur deux lignes, et l'échiquier d'un écran d'exercice garde au moins 240 px (200 px en relecture). Sous 560 px de haut, un écran d'exercice retire les onglets des puzzles, les ronds de progression (le compteur reste) et la ligne de contexte ; le bloc est juste avant la poignée de redimensionnement de l'échiquier dans `css/app.css`, rien ne change au-dessus.
- **Contraste renforcé** (réglage « Augmenter le contraste », `prefers-contrast: more`, passe `390x664-hc` de l'audit, qui l'émule) : texte à 7:1 au moins sur son fond réel, bord de chaque carte à 3:1 contre la page, anneau de focus à 3 px. Tout passe par les jetons redéfinis dans un seul bloc `@media (prefers-contrast: more)` en fin de `css/app.css` (`--ink2`, `--ink3`, `--bad`, `--bad-ink`, `--warn`, `--good`, `--accent-ink`, `--line`, `--btn` assombri pour le texte blanc des boutons pleins) ; un nouveau jeton de texte coloré s'y ajoute s'il tombe sous 7:1. Les palettes d'échiquier ne changent pas.
- **Bord estompé des panneaux qui défilent** : tout conteneur en `overflow-y: auto` d'un écran d'exercice (`#xpanel`, `#xcap`, `.coach-b`, liste des coups `.gvm`) porte `data-edge` ; `watchEdges()` (`js/ui.js`, appelé par `exo.attach()`) pose `edge-b` tant qu'il reste du contenu dessous et `edge-t` une fois défilé, et le CSS estompe 24 px (`--s-5`) de ce bord avec `mask-image`. Au bout du défilement, `edge-b` disparaît : la dernière ligne n'est jamais estompée. L'audit refuse un panneau qui défile sans `edge-b`, et un `edge-b` resté après défilement jusqu'en bas. Un nouveau conteneur qui défile reçoit `data-edge`.
- **Un réglage garde sa place** (tâche 5) : plus de filtres au bas de la colonne de navigation, donc plus de fonction qui change de place avec la largeur. La cadence suivie est un réglage nommé (`<label>` « Cadence suivie », Plan et réglages) ; la période est un contrôle segmenté `.seg2.mini` « Tout · 90 j · 30 j » à côté du titre de chaque vue qui la lit (Mon jeu, Parties). La mise à jour est automatique (au chargement et au retour sur l'onglet, données de plus de 10 minutes) ; Parties dit « À jour, il y a 3 min » (`#upd`) et garde un bouton icône « Mettre à jour » (`aria-busy` pendant l'import). Un import automatique ne reconstruit jamais un exercice ni une relecture.
- **La période ne filtre jamais en silence** : elle ne s'applique que là où son sélecteur est visible (Mon jeu, Parties, Mes ouvertures, détail d'une ouverture, tous par `periodSeg()`). Cours, priorités et chantier lisent `cadenceGames()`, sans période.
- **Un onglet navigue** (tâche 4, décision D1 = A) : sur téléphone (< 860 px), l'appui sur une entrée de la barre du bas mène à la dernière page vue de sa section (`navLast`, en mémoire), ou à l'entrée de la section s'il n'y en a pas ; un second appui sur l'onglet actif mène à l'entrée (`tabTarget`, `js/nav.js`, source unique des sections). Plus de volet ni de `aria-haspopup` sous 860 px ; les menus au survol, au focus clavier et à Échap restent ceux de l'ordinateur. Mon jeu, Stats et Plan portent en tête les onglets `.seg2.pztabs` « Mon jeu · Stats · Plan », comme Parties et Cours.
