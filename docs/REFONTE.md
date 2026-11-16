# Refonte de l'interface (à partir du 15/11)

Référence : le skill « design-taste-frontend » (dépôt `Leonxlnx/taste-skill`), adapté à un outil d'entraînement.
Maquette validée par Gaëtan le 15/11 : écrans Aujourd'hui et Puzzle, téléphone et ordinateur (artefact Claude privé).

## Décisions

| Sujet | Décision |
|---|---|
| Ce qu'on prend du skill | Jetons partagés (espacement par 4, une échelle de titres, une échelle d'arrondis), un seul bouton plein par vue, boutons de 44 px minimum, texte lu à 16 px, rien sous 13 px, contraste 7:1 (texte) et 4.5:1 (secondaire), une couleur d'accent, mouvement court (150 à 240 ms, `transform` et `opacity` seulement, survol réservé à la souris, `prefers-reduced-motion`), pas de capitales espacées ni de mise en valeur par couleur |
| Ce qu'on laisse | Héro, « une section par écran », photos, effets, scènes, tirage de palette (le vert de l'échiquier reste) |
| Bouton principal | Garde son relief (ombre basse `--btn-edge`), choix de Gaëtan contre la règle du skill. Vert assombri `#3a8020` pour un libellé blanc à 4.9:1 |
| Polices | Geist (titres et texte), Geist Mono (notation des coups). Choisies dans la table du skill (`library/type.json`, poids 3 sur « software » et « tech ») ; à servir depuis `vendor/fonts/` comme les polices actuelles. Graisses 400 et 500, 600 au plus, jamais 700 |
| Échelle de texte | 13, 14, 16, 20, 28 px, plus 40 px pour un grand chiffre (Elo, stats) |
| Arrondis | 8 px (petits éléments), 12 px (cartes, boutons), 50 % (pastilles rondes) |
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

- **Navigation à 4 entrées** (Aujourd'hui, S'entraîner, Parties, Progrès), chacune avec un menu déroulant. Écart assumé avec la règle « pas de volet au survol », étendu à toutes les entrées à la demande de Gaëtan.
- **Icônes de section colorées** : 5 teintes douces (vert, ambre, bleu, violet, corail), seule l'icône est colorée, jamais le texte ; inactive à 72 %, active en pleine couleur avec un fond teinté à 12 %. Écart assumé avec « une seule couleur d'accent », limité aux icônes.

## Fonds et alignement (16/11, demande de Gaëtan)

> intègre la couleur plus claire comme sur Chess.com ; centre uniquement quand ça fait sens

- **Fonds inversés, comme Chess.com** : page en gris chaud clair (`--bg` #2b2926), colonne de navigation, barres et cartes plus sombres posées dessus (`--surface` #22211e), encarts, champs et onglets choisis plus clairs que la carte (`--sunken`, `--raised`). Boutons secondaires pleins gris clair sans bord visible (`--btn2`, `--btn2-hover`). Contraste revérifié par l'audit.
- **Centrage** : une seule colonne de contenu (`.view`, 1 120 px au plus), centrée dans l'espace à droite de la navigation ; l'accueil n'a plus sa propre largeur (1 040 px), donc le bord gauche du contenu ne bouge plus d'une page à l'autre. Le texte reste aligné à gauche ; on ne centre que les éléments autonomes (icônes dans leur pastille, compteurs, anneau du bilan, libellés des onglets et des boutons, échiquier dans sa zone).
