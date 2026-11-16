# Plan : rendre le site plus agréable (16/11)

Suite de `docs/REFONTE.md`. La refonte a réglé la structure (jetons, navigation, contraste, cibles de 44 px). Ce plan porte sur la **sensation** : échiquier, retour immédiat, sons, relecture, récompense. Inspiré des pratiques de Lichess et Chess.com, sans reprendre leurs pièces, sons, logos ni couleurs exactes.

Constat sur les captures de l'audit du 16/11 (`node tests/audit-ui.js`, 22 écrans sans écart) :

- Échiquier : coordonnées posées au milieu des cases, lettres qui se chevauchent sur le bord bas quand l'échiquier est retourné (puzzle avec les Noirs). Vert saturé, coins carrés, aucune ombre : il fait « collé ».
- Puzzle : aucun retour visuel ni sonore quand le coup est bon ou faux ; seul le bandeau change de texte.
- Relecture sur téléphone : échiquier de 290 px avec 50 px de marge de chaque côté, courbe coupée sous le pli.
- Accueil ordinateur : bloc centré en hauteur avec 100 px de vide en haut ; aucune image d'échecs sur la page d'un site d'échecs.

## Lots, par ordre de gain pour l'effort

### Lot 1. L'échiquier (le plus visible, 1 session)

| Pratique | Source | À faire |
|---|---|---|
| Coordonnées dans les coins, couleur de la case opposée | Lichess, Chess.com | Chiffres en haut à gauche de la colonne a, lettres en bas à droite de la rangée 1, 11-12 px semi-gras ; corriger le chevauchement à l'envers |
| Palette douce | les deux | Vert moins saturé, propre au site (ni `#769656` ni `#eeeed2`), validé au contraste des pièces |
| Coins arrondis + ombre portée | Chess.com | `--r-s` sur le cadre, ombre basse ; le cadre seulement, pas les cases |
| Surlignage du dernier coup léger | Lichess | Jaune translucide (≈ 40 %) au lieu du jaune plein actuel |
| Cases jouables discrètes | Lichess | Petit point centré, anneau sur une case de prise |
| Échec en halo rouge radial | les deux | Déjà signalé par `board()`, à styliser |
| Échiquier bord à bord sur téléphone | les deux | Relecture et cours : largeur de l'écran moins 8 px |
| Poignée de redimensionnement sur ordinateur | Lichess | Taille gardée en `localStorage` |

Fichiers : `css/app.css` (jetons `--sq-*`, styles `cg-wrap`), `js/board.js`. Contrôle : nouvelle mesure dans `audit-ui.js` (coordonnées ne se chevauchant pas, échiquier ≥ 360 px en 390 de large).

### Lot 2. Retour immédiat dans les exercices (1 session)

| Pratique | Source | À faire |
|---|---|---|
| Pastille ✓ / ✗ sur la case d'arrivée | Chess.com | Icône SVG ronde verte ou rouge sur la case, 600 ms |
| Coup faux qui revient en place | Lichess | Animation de retour de la pièce au lieu d'un remplacement sec |
| Bandeau qui change de teinte | les deux | Vert au succès, rouge bref à l'échec (transition 150 ms) |
| Pastilles de l'objectif qui se remplissent | Chess.com | Les 8 ronds `0 / 8` se remplissent avec un petit rebond |
| Série en cours | Puzzle Streak (Lichess) | « 3 d'affilée » dans la barre quand ≥ 3 réussites du premier coup |

Fichiers : `js/exercise.js`, `js/app.js` (`solveBoard`), `css/app.css`. Tout respecte `prefers-reduced-motion`.

### Lot 3. Sons (½ session)

Déplacement, prise, échec, roque, bon coup, erreur, objectif atteint. **Synthétisés en Web Audio** (pas de fichier : les sons de Chess.com sont protégés, ceux de Lichess ont des licences variées). Bouton muet dans la barre de l'exercice, réglage dans Plan et réglages. Rien ne joue avant une première interaction (règle iOS).

Fichiers : nouveau `js/sound.js`, appelé depuis `board.js` (après chaque `cg.set`) et `exercise.js`.

### Lot 4. Relecture de partie façon « Game Review » (1 à 2 sessions)

| Pratique | Source | À faire |
|---|---|---|
| Barre d'évaluation verticale | les deux | Fine (8 px), à gauche de l'échiquier, animée ; horizontale sur téléphone |
| Courbe d'avantage cliquable | Lichess | Sous les coups ; points rouges / orange sur gaffes et erreurs ; clic = `gvGo(k)` |
| Symbole sur la case | Chess.com | `??`, `?`, `?!`, `!` en pastille dans le coin de la case d'arrivée, couleurs du site |
| Liste de coups en 2 colonnes | Lichess | Ordinateur : numéro, Blancs, Noirs, coup courant surligné, défile seul |
| Bande de coups horizontale | applis mobiles des deux | Téléphone : une ligne qui défile, coup courant centré |
| « Moments clés » | Chess.com | Boutons « Erreur précédente / suivante » (déjà « Erreur suivante ») |

Données déjà disponibles (`ev`, `errs` dans `S.an`). Fichiers : `js/app.js` (relecture), `js/charts.js`, `js/board.js`.

### Lot 5. Mouvement et chargement (½ session)

- Transition entre vues : fondu de 150 ms (View Transitions API, sans effet si absente).
- Squelettes gris à la place des textes « Analyse en cours… » ; barre d'avancement de l'analyse Stockfish.
- Toasts courts en bas pour « Sauvegardé », « 3 parties importées ».

### Lot 6. Récompense de fin de séance (½ session)

- Écran de fin de séance (`pzRecap`) : anneau de l'objectif qui se ferme, chiffres du jour (réussis du premier coup, série, temps), un seul bouton vers l'étape suivante. Inspiré du bilan de fin de Puzzle Rush, sans confettis.
- Jour de série marqué sur l'objectif du jour de l'accueil.

### Lot 7. Accueil ordinateur (½ session)

- Ancrer en haut au lieu de centrer (fin du vide de 100 px).
- Mini-échiquier de la position de la pire faute dans « Ta dernière partie » (Chess.com montre toujours une position). Doit garder la page sans défilement en 1366 × 768.

### Lot 8. Réglages d'apparence (½ session)

Comme Lichess : 3 palettes d'échiquier (vert du site, bois, bleu-gris), 2 ou 3 jeux de pièces libres compatibles GPL (cburnett actuel, plus un ou deux à licence vérifiée), coordonnées oui / non, sons oui / non, **vitesse de lecture des suites** (répond au point ouvert « environ 3 s par coup »). Stockés sous `cap1000:look`, inclus dans la sauvegarde.

## Ordre proposé

1, 2, 3 d'abord : ce sont les écrans où Gaëtan passe le plus de temps (puzzles, erreurs). Puis 4 (relecture), puis 5 à 8.

Chaque lot : retouche dans les règles de `docs/REFONTE.md`, `node tests/audit-ui.js` sans écart, captures aux 4 tailles relues, `node tests/parcours.js`, fusion dans `main`.

## À trancher par Gaëtan

1. Sons activés par défaut, ou coupés jusqu'à activation ?
2. Palette : garder le vert actuel adouci, ou proposer une maquette de 3 palettes avant de choisir ?
3. Lot 4 avant ou après les lots 5 à 8 ?
