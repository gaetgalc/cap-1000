# Cap 1000

Coach d'échecs personnel, 100 % dans le navigateur.

- Import de toutes tes parties Chess.com avec ton seul pseudo (API publique, aucun mot de passe).
- Analyse des parties par Stockfish (WASM) sur ton appareil, erreurs classées par type.
- Chantier du moment : un seul type d'erreur travaillé à la fois, avec son taux par partie avant et depuis.
- Séance du jour en quatre étapes : échauffement, puzzles, cours, parties.
- Échauffements : quatre exercices de vérification rapide générés depuis tes positions.
- Puzzles tirés de tes propres erreurs (répétition espacée). Après la solution, la bonne suite se joue toute seule, commentée coup par coup, puis ce que ton coup permettait.
- Historique : chaque puzzle et chaque échauffement est noté avec son résultat ; tu reprends là où tu t'es arrêté, même après avoir fermé la page.
- Positions inédites : puzzles de la base Lichess, par thème et par niveau.
- Cours par type d'erreur, illustrés par tes positions ; cours privés rédigés par Claude en option.
- Relecture de partie commentée, statistiques d'ouvertures, explorateur de tes coups, page de statistiques complètes, plan hebdomadaire et suivi de l'objectif Elo.

## Mise en ligne (GitHub Pages)

1. Pousse ce dossier sur la branche `main` d'un dépôt GitHub.
2. Dans le dépôt : Settings > Pages > Source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Ouvre `https://<ton-compte>.github.io/<depot>/?u=<pseudo-chess.com>`.

En local : `python3 -m http.server` dans ce dossier, puis http://localhost:8000. Tests : `node --test tests/*.test.mjs` (règles, sans navigateur), `node tests/parcours.js` (bout en bout, Playwright), `node tests/audit-ui.js` (audit de l'interface), `node tests/perf.js` (fluidité sur 5 000 parties simulées) et `node tests/shots-diff.js` (comparaison pixel de deux audits).

## Données

Tout est stocké sur l'appareil (IndexedDB et localStorage) ; analyses, cours et progression ne sont pas synchronisés entre appareils.

Le navigateur ne contacte que :
- `api.chess.com` : lecture de tes parties publiques ;
- `lichess.org` : un puzzle à la fois, uniquement dans « Positions inédites » ;
- `api.anthropic.com` : uniquement si tu saisis une clé API pour le coach Claude (la clé reste dans le navigateur).

Les polices sont embarquées dans `vendor/fonts/` : l'affichage ne dépend d'aucun service tiers.

## Licences

Code de l'application sous GPL-3.0-or-later (texte dans `LICENSE`). Bibliothèques incluses dans `vendor/` :
chessground (GPL-3.0-or-later, pièces cburnett), jeux de pièces de `vendor/pieces/` (Merida GPLv2+, Chessnut Apache 2.0, Maestro et Cardinal CC BY-NC-SA 4.0, voir `vendor/pieces/LICENSES.txt`), Stockfish.js (GPL-3.0, voir `vendor/STOCKFISH-COPYING.txt`), chess.js 0.10.3 (BSD-2-Clause), polices Geist, Geist Mono et Source Serif 4 (SIL Open Font License 1.1).
