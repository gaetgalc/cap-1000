# Cap 1000

Coach d'échecs personnel, 100 % dans le navigateur.

- Import de toutes tes parties Chess.com avec ton seul pseudo (API publique, aucun mot de passe).
- Analyse des parties par Stockfish (WASM) sur ton appareil, erreurs classées par type.
- Chantier du moment : un seul type d'erreur travaillé à la fois, avec son taux par partie avant et depuis.
- Séance du jour en quatre étapes : échauffement, puzzles, cours, parties.
- Échauffements : quatre exercices de vérification rapide générés depuis tes positions.
- Puzzles tirés de tes propres erreurs (répétition espacée), avec suites commentées coup par coup, idée du meilleur coup et comparaison avec le tien.
- Positions inédites : puzzles de la base Lichess, par thème et par niveau.
- Cours par type d'erreur, illustrés par tes positions ; cours privés rédigés par Claude en option.
- Relecture de partie commentée, statistiques d'ouvertures, explorateur de tes coups, page de statistiques complètes, plan hebdomadaire et suivi de l'objectif Elo.

## Mise en ligne (GitHub Pages)

1. Pousse ce dossier sur la branche `main` d'un dépôt GitHub.
2. Dans le dépôt : Settings > Pages > Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Ouvre `https://<ton-compte>.github.io/<depot>/?u=<pseudo-chess.com>`.

En local : `python3 -m http.server` dans ce dossier, puis http://localhost:8000.

## Données

Tout est stocké sur l'appareil (IndexedDB et localStorage) ; analyses, cours et progression ne sont pas synchronisés entre appareils.

Le navigateur ne contacte que :
- `api.chess.com` : lecture de tes parties publiques ;
- `lichess.org` : un puzzle à la fois, uniquement dans « Positions inédites » ;
- `api.anthropic.com` : uniquement si tu saisis une clé API pour le coach Claude (la clé reste dans le navigateur) ;
- `fonts.googleapis.com` et `fonts.gstatic.com` : polices d'affichage.

## Licences

Code de l'application sous GPL-3.0-or-later (texte dans `LICENSE`). Bibliothèques incluses dans `vendor/` :
chessground (GPL-3.0-or-later, pièces cburnett), Stockfish.js (GPL-3.0, voir `vendor/STOCKFISH-COPYING.txt`), chess.js 0.10.3 (BSD-2-Clause).
