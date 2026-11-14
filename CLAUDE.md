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
| `js/store.js` | IndexedDB (`data:<user>`, `an:<user>`, `ai:<user>`) et localStorage (préfixe `cap1000:`) |
| `vendor/` | chess.js 0.10.3, chessground 9, Stockfish 19 lite single-thread (WASM) |

Routes : `#accueil`, `#puzzles`, `#erreur/<end_time>/<ply>` (travail d'une erreur précise), `#plus` (menu mobile), `#exos`, `#inedits` (puzzles Lichess), `#drill/<sur|menace|cadeau|compte>`, `#cours`, `#cours/<id>[/fiche]`, `#ouvertures`, `#parties`, `#partie/<end_time>[/<ply>]`, `#plan`, `#stats`.

## Écran de travail (puzzles, erreurs, positions de cours)

`workScreen` + `solveBoard` + `explainUI` dans `app.js`. Avant la solution : coach qui décrit le dernier coup adverse, indices en deux niveaux, « Mon coup ». Après : suites commentées coup par coup (« La bonne suite » et « Ton coup »), calculées en direct par Stockfish (`getLines`), idée, comparaison, règle à retenir. Sur téléphone : barre du haut avec retour, échiquier plein cadre, bandeau de commentaire sous l'échiquier, barre d'actions fixe en bas, 5 onglets.

## Boucle pédagogique

1. **Chantier** (`focus`, `focusStats`, `focusCard`) : un seul type d'erreur à la fois, choisi sur le coût mesuré ; validé quand son taux par partie est divisé par deux sur au moins 5 parties jouées depuis le début du chantier. Stocké dans `cap1000:focus`.
2. **Séance du jour** en 4 étapes : échauffement lié au chantier (`DRILL_FOR`), puzzles du chantier, cours, 2 parties avec la règle du chantier.
3. **Mesure** : `themeTrend` (10 dernières parties analysées contre les 10 précédentes) et `themeSeries` (courbe par paquets de 5).
4. **Prédire avant d'expliquer** : dans `explainUI`, l'élève joue lui-même la punition de son coup et ses propres coups de la bonne suite.

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

Les tests automatisés des sessions précédentes utilisaient puppeteer-core avec Chrome et interceptaient `api.chess.com` et `api.anthropic.com` (parties générées par coups aléatoires au format Chess.com). Ils ne sont pas versionnés.

## Points ouverts

- Aucun retour encore sur l'import avec le vrai compte `gaetcc`.
- Qualité réelle des cours générés par Claude non évaluée (testé avec une API simulée).
- Interface mobile refaite le 14/11 au soir (coquille d'app) sans retour encore ; si elle ne convient toujours pas, demander une capture de l'écran précis.
- Les explications de `explain.js` reposent sur des heuristiques (attaquants, défenseurs, matériel) : pas de clouages ni d'attaques à la découverte.
- Puzzles Lichess codés d'après la documentation de l'API et testés avec une API simulée seulement : format réel de la réponse (coupe du PGN, `initialPly`) à confirmer au premier essai ; `fetchPuzzle` essaie plusieurs coupes et garde celle où la solution est légale.
- Noms d'ouvertures en anglais (source Chess.com).
- Licence : GPL-3.0-or-later (imposée par chessground et Stockfish).
