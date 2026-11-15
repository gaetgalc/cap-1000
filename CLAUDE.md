# Cap 1000 : contexte du projet

Coach d'échecs personnel de Gaëtan (pseudo Chess.com `gaetcc`, GitHub `gaetgalc`).
Objectif : passer 1000 Elo en Rapide avant le 1er janvier 2027.
Site : https://gaetgalc.github.io/cap-1000/?u=gaetcc

Le journal complet des échanges et des décisions est dans `docs/JOURNAL.md`. Le lire avant toute évolution.

## Ce que veut l'utilisateur

- Arriver sur le site et comprendre tout de suite quoi faire (séance du jour, un seul bouton principal).
- Apprendre sur ses propres parties : erreurs rejouées en puzzles, cours illustrés par ses positions.
- Cours rédigés par Claude, comme une leçon particulière (questions guidées, explication, règle, quiz).
- Voir en un clic ce qu'il a réellement joué dans la partie.
- Interface dans l'esprit de Chess.com (sombre, échiquier vert), sans reprendre leur logo, leurs pièces ni leurs éléments graphiques.
- Réponses en français, directes, sans remplissage.

## Architecture

Site statique sans build, servi par GitHub Pages depuis `main` (racine). Tout tourne dans le navigateur.

| Fichier | Rôle |
|---|---|
| `index.html` | Coquille, navigation |
| `css/app.css` | Thème unique sombre, jetons dans `:root` |
| `js/app.js` | État `S`, routage par hash, toutes les vues, événements |
| `js/chesscom.js` | Import via l'API publique Chess.com, normalisation des parties |
| `js/engine.js` | Stockfish (worker), analyse d'une partie, classement des erreurs par thème |
| `js/stats.js` | Agrégats, ouvertures, forces et faiblesses |
| `js/alltime.js` | Page Stats (depuis la première partie) |
| `js/lessons.js` | Fiches de cours statiques (principe, routine), règles courtes par thème |
| `js/explain.js` | Explications sans IA : description de chaque coup, idée du meilleur coup, raison de l'échec du coup joué, bilan matériel |
| `js/drills.js` | Échauffements : 4 exercices de vérification générés depuis les positions des parties, réponse établie par les règles |
| `js/lichess.js` | Puzzles inédits : `GET lichess.org/api/puzzle/next?angle=&difficulty=` (anonyme), reconstruction de la position depuis le PGN |
| `js/coach.js` | Cours privés Claude : faits vérifiés, prompt, appel API, lecture du JSON |
| `js/store.js` | IndexedDB (`data:<user>`, `an:<user>`, `ai:<user>`) et localStorage (préfixe `cap1000:` ; clés principales : `pz` répétition espacée, `hist` journal d'entraînement, `ui` état de l'écran à reprendre, `act` activité par jour, `focus` chantier) |
| `tests/parcours.js` | Test de bout en bout (Playwright, parties simulées, `api.chess.com` intercepté) |
| `vendor/` | chess.js 0.10.3, chessground 9, Stockfish 19 lite single-thread (WASM), polices Sora et IBM Plex Sans |

Routes : `#accueil`, `#puzzles`, `#historique` (journal des exercices faits), `#erreur/<end_time>/<ply>` (travail d'une erreur précise), `#plus` (menu mobile), `#exos`, `#inedits` (puzzles Lichess), `#drill/<sur|menace|cadeau|compte>`, `#cours`, `#cours/<id>[/fiche]`, `#ouvertures`, `#parties`, `#partie/<end_time>[/<ply>]`, `#plan`, `#stats`.

## Écran de travail (puzzles, erreurs, positions de cours)

`workScreen` + `solveBoard` + `explainUI` dans `app.js`. Avant la solution : coach qui décrit le dernier coup adverse, indices en deux niveaux, « Mon coup », points sur les cases où la pièce choisie peut aller. Après : deux films calculés en direct par Stockfish (`getLines`, suites coupées sur une position calme par `settle`) : « La bonne suite » se joue toute seule (`film` : flèche qui annonce le coup, déplacement, commentaire, flèches de menace `stepShapes`, bilan matériel), puis « Voir mon erreur » joue ce que le coup de la partie permettait. Pause, pas à pas, « Revoir », idée, comparaison, règle à retenir.

Mise en page : sur téléphone, barre du haut (retour, avancée du jour), échiquier juste dessous, texte du coach et commentaires dans le bandeau sous l'échiquier (`.capi`), barre d'actions fixe en bas, 5 onglets ; tout doit tenir sans défiler sur 390 × 664. Sur ordinateur, échiquier à gauche, coach, bandeau et explication à droite (`.split.work`, `.bwrap` en `display: contents`).

## Journal et reprise

- `pzRecord` enregistre chaque puzzle dès la solution (`pzMark` pour la répétition espacée, `logHist` pour le journal, `bump` pour la séance), quel que soit l'écran d'où il est fait (file, `#erreur`, cours privé). Un seul résultat par puzzle et par jour compte ; les suivants sont notés « révision ».
- Résultat : 2 du premier coup, 1 trouvé avec aide (mauvais essai ou indice), 0 solution vue. Raté : revient le lendemain. Réussi : 1, 3, 7, 21, 60 jours. Jamais de retour le jour même, sauf « Refaire mes ratés du jour » (`S.pz.redo`).
- Objectif du jour (`pzDay`) : 8 puzzles ; bilan `pzRecap` affiché une fois quand il est atteint, avec `nextStep` (prochaine étape de la séance).
- `keepUi` / `restoreUi` : puzzle en cours, étape du cours, échauffement entamé, position inédite sont repris après rechargement.

## Boucle pédagogique

1. **Chantier** (`focus`, `focusStats`, `focusCard`) : un seul type d'erreur à la fois, choisi sur le coût mesuré ; validé quand son taux par partie est divisé par deux sur au moins 5 parties jouées depuis le début du chantier. Stocké dans `cap1000:focus`.
2. **Séance du jour** en 4 étapes : échauffement lié au chantier (`DRILL_FOR`), puzzles du chantier, cours, 2 parties avec la règle du chantier.
3. **Mesure** : `themeTrend` (10 dernières parties analysées contre les 10 précédentes) et `themeSeries` (courbe par paquets de 5).
4. **Prédire avant d'expliquer** : dans `explainUI`, en pas à pas seulement (lecture en pause), l'élève peut jouer lui-même la punition de son coup et ses propres coups de la bonne suite. La lecture automatique ne s'interrompt pas (demande du 15/11).

Idées non faites : import des parties Lichess, comptes et synchronisation, traduction.

## Contraintes à connaître

- Un artefact Claude ne peut pas appeler l'API Chess.com (requêtes externes bloquées) : d'où le site hébergé.
- L'environnement cloud de Claude ne peut pas joindre `api.chess.com` ni `*.github.io` : impossible d'y tester sur les vraies parties ou de vérifier le site en ligne. Les tests se font avec des parties simulées.
- Claude peut pousser sur ce dépôt (app GitHub installée) mais pas modifier ses réglages (Pages).
- L'abonnement Claude Pro n'inclut pas l'API : les cours passent soit par copier-coller dans une conversation Claude, soit par une clé API saisie dans le site (stockée en localStorage, jamais dans le dépôt).
- Pas de synchronisation entre appareils : analyses, cours et progression sont locaux.
- Dépôt public : ne jamais y écrire de clé, d'e-mail ni de donnée personnelle.

## Tester

```bash
python3 -m http.server 8000   # puis http://localhost:8000/?u=gaetcc
```

```bash
node tests/parcours.js        # parcours puzzles, journal, reprise, échauffement ; 1 à 2 minutes
```

Le test génère des parties par coups semi-aléatoires au format Chess.com, intercepte `api.chess.com` et pilote Chromium avec Playwright. Ajouter `&debug` à l'URL expose l'état `S` dans `window.__cap`. Pour un cours privé, injecter un cours dans `S.ai` ; pour Lichess, intercepter `lichess.org`. Toujours vérifier le rendu par captures en 390 × 664 (iPhone avec les barres de Safari) et en 1280 × 860.

## Règles internes à respecter

- Tout rendu déclenché en arrière-plan (fin d'analyse, import, génération) passe par `bgRender()`, qui ne touche pas à un exercice en cours. `render()` est réservé aux actions de l'utilisateur.
- `data-act` = actions globales, `data-ex` = actions de l'explication en cours (`S.exui`), `data-f` = filtres et sélecteurs, `data-mini` = mini-échiquiers des fiches.
- Les analyses marquées `bad` (partie illisible) sont exclues de toutes les statistiques.
- Relecture de partie : `gvGo(k)` met l'écran à jour sur place (`gvSync`), sans `render()`.
- Profondeur d'analyse unique (`DEPTH = 12`) sur tous les appareils.
- `Engine.evalFen(fen, depth, urgent)` : `urgent` fait passer la vérification d'un coup devant les calculs de suites.
- Tout exercice terminé est noté par `logHist` au moment où il se termine, jamais au changement d'écran.
- Boutons de contrôle : icônes SVG de `ico()`, pas de flèches Unicode (émojis sur iPhone). Une barre mise à jour pendant une lecture passe par `setHtml` pour ne pas remplacer un bouton sous le doigt.
- `board()` signale l'échec à chaque `cg.set({ fen })` ; ne pas créer d'échiquier sans passer par `board()`.

## Points ouverts

- Aucun retour encore sur l'import avec le vrai compte `gaetcc`.
- Qualité réelle des cours générés par Claude non évaluée (testé avec une API simulée).
- Interface mobile refaite le 14/11 au soir puis réorganisée le 15/11 (échiquier en haut, texte dessous) sans retour encore ; si elle ne convient toujours pas, demander une capture de l'écran précis.
- Cause exacte du « ça a oublié mes 8 puzzles » non confirmée. Si cela se reproduit malgré le journal : vérifier que le site est ouvert dans le même navigateur (Safari et le navigateur intégré d'une autre app ont des stockages séparés, la navigation privée efface tout).
- Rythme de lecture des suites (`film`, environ 3 s par coup) à ajuster sur retour ; pas de réglage de vitesse.
- Les explications de `explain.js` reposent sur des heuristiques (attaquants, défenseurs, matériel, clouages, enfilades, attaques à la découverte) : elles ignorent qu'une pièce clouée ne défend pas réellement, et les coups purement positionnels restent commentés sobrement.
- Stockage : toutes les parties d'un compte tiennent dans une seule entrée IndexedDB (sans effet avant plusieurs milliers de parties).
- Puzzles Lichess codés d'après la documentation de l'API et testés avec une API simulée seulement : format réel de la réponse (coupe du PGN, `initialPly`) à confirmer au premier essai ; `fetchPuzzle` essaie plusieurs coupes et garde celle où la solution est légale.
- Noms d'ouvertures en anglais (source Chess.com).
- Licence : GPL-3.0-or-later (imposée par chessground et Stockfish).
