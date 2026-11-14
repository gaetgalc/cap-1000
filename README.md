# Cap 1000

Coach d'échecs personnel, 100 % dans le navigateur.

- Import de toutes tes parties Chess.com avec ton seul pseudo (API publique, aucun mot de passe).
- Analyse des parties par Stockfish (WASM) sur ton appareil.
- Points forts et points faibles chiffrés, statistiques d'ouvertures, explorateur de tes coups.
- Puzzles tirés de tes propres erreurs, avec répétition espacée.
- Cours par type d'erreur, illustrés par tes positions.
- Plan hebdomadaire et suivi de l'objectif Elo.

## Mise en ligne (GitHub Pages)

1. Pousse ce dossier sur la branche `main` d'un dépôt GitHub.
2. Dans le dépôt : Settings > Pages > Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Ouvre `https://<ton-compte>.github.io/<depot>/?u=<pseudo-chess.com>`.

En local : `python3 -m http.server` dans ce dossier, puis http://localhost:8000.

## Données

Tout est stocké sur l'appareil (IndexedDB et localStorage). Rien n'est envoyé ailleurs qu'à l'API publique de Chess.com.
Les analyses et la progression des puzzles ne sont pas synchronisées entre appareils.

## Licences

Code de l'application sous GPL-3.0-or-later. Bibliothèques incluses dans `vendor/` :
chessground (GPL-3.0-or-later, pièces cburnett), Stockfish.js (GPL-3.0, voir `vendor/STOCKFISH-COPYING.txt`), chess.js 0.10.3 (BSD-2-Clause).
