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
| `js/lessons.js` | Fiches de cours statiques (principe, routine) |
| `js/coach.js` | Cours privés Claude : faits vérifiés, prompt, appel API, lecture du JSON |
| `js/store.js` | IndexedDB (`data:<user>`, `an:<user>`, `ai:<user>`) et localStorage (préfixe `cap1000:`) |
| `vendor/` | chess.js 0.10.3, chessground 9, Stockfish 19 lite single-thread (WASM) |

Routes : `#accueil`, `#puzzles`, `#cours`, `#cours/<id>[/fiche]`, `#ouvertures`, `#parties`, `#partie/<end_time>[/<ply>]`, `#plan`, `#stats`.

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
- L'utilisateur a dit ne pas être satisfait de l'interface sans préciser quoi : demander une capture avant une nouvelle refonte.
- Noms d'ouvertures en anglais (source Chess.com).
- Licence : GPL-3.0-or-later (imposée par chessground et Stockfish).
