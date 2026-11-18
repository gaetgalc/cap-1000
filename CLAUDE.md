# Cap 1000 : contexte du projet

Coach d'échecs personnel de Gaëtan (pseudo Chess.com `gaetcc`, GitHub `gaetgalc`).
Objectif : passer 1000 Elo en Rapide avant le 1er janvier 2027.
Site : https://gaetgalc.github.io/cap-1000/?u=gaetcc

Le journal des échanges et des décisions est dans `docs/JOURNAL.md` : lire la section qui concerne l'écran touché.

Refonte de l'interface en cours (depuis le 15/11) : décisions, état des lieux et étapes dans `docs/REFONTE.md`. Toute retouche visuelle suit ses règles (Geist, titres en Besley, cartes sans contour, pas d'allure générée : REFONTE § « Pas d'allure générée », jetons de `:root`, un bouton plein par vue, cibles de 44 px sur téléphone) et se vérifie avec `node tests/audit-ui.js`, qui doit rester sans écart. Revue selon les règles d'interface d'Apple (`docs/PLAN-HIG.md`, 17/11) réalisée le 18/11 avec les décisions D1 = A, D2 = B, D3 = A (JOURNAL §48) ; ses règles sont dans REFONTE § « Revue HIG ».

## Ce que veut l'utilisateur

- Arriver sur le site et comprendre tout de suite quoi faire (séance du jour, un seul bouton principal).
- Apprendre sur ses propres parties : erreurs rejouées en puzzles, cours illustrés par ses positions.
- Cours rédigés par Claude, comme une leçon particulière (questions guidées, explication, règle, quiz).
- Voir en un clic ce qu'il a réellement joué dans la partie.
- Interface dans l'esprit de Chess.com (sombre, échiquier vert), sans reprendre leur logo, leurs pièces ni leurs éléments graphiques.
- Réponses en français, directes, sans remplissage.

## Architecture

Site statique sans build, servi par GitHub Pages depuis `main` (racine). Tout tourne dans le navigateur. Table complète des fichiers, routes et fonctionnement des écrans : `docs/ARCHITECTURE.md` (à lire avant de toucher un écran ou un module).

- Coquille et vues : `index.html`, `css/app.css` (jetons de `:root`), `js/app.js` (état `S`, routage par hash, vues), `nav.js` (sections et onglets), `ui.js`, `charts.js`, `toast.js`, `look.js`, `sound.js`.
- Échiquier et exercice : `board.js` (chessground), `exercise.js` (écran commun des six écrans à échiquier), `review.js`.
- Analyse : `engine.js` (Stockfish), `classify.js` (classement pur, `VERSION`), `stats.js`, `insights.js`, `alltime.js`, `debrief.js`, `portrait.js`.
- Explications : `explain.js`, `geom.js`, `plan.js`, `theory.js`.
- Entraînement : `progress.js` (répétition espacée, journal), `program.js`, `drills.js`, `ideas.js`, `endgames.js`, `lichess.js`, `lessons.js`, `openings.js`, `explorer.js`.
- Coach : `coach.js` (cours, demande au coach, clé API), `brief.js`.
- Données : `chesscom.js`, `store.js` (IndexedDB, localStorage `cap1000:`), `backup.js`.
- Tests : `tests/*.test.mjs`, `parcours.js`, `audit-ui.js`, `fixture.js`. `vendor/` : bibliothèques, pièces, Stockfish, polices.

## Contraintes à connaître

- Un artefact Claude ne peut pas appeler l'API Chess.com (requêtes externes bloquées) : d'où le site hébergé.
- Depuis le 16/11, l'environnement cloud de Claude joint `api.chess.com` (pas `*.github.io`) : télécharger les archives de `gaetcc` avec curl, les servir au site par `ctx.route` dans Playwright et relire les textes du coach sur les vraies parties (JOURNAL §38). Les tests automatiques restent sur parties simulées.
- Claude peut pousser sur ce dépôt (app GitHub installée) mais pas modifier ses réglages (Pages).
- L'abonnement Claude Pro n'inclut pas l'API : les cours passent soit par copier-coller dans une conversation Claude, soit par une clé API saisie dans le site (stockée en localStorage, jamais dans le dépôt).
- Pas de synchronisation entre appareils : analyses, cours et progression sont locaux. Transfert possible par fichier (Progrès > Plan et réglages > Sauvegarde).
- Dépôt public : ne jamais y écrire de clé, d'e-mail ni de donnée personnelle.

## Skills et plugins Claude Code

Déclarés dans `.claude/settings.json` : `superpowers` (TDD, débogage méthodique, plans, vérification avant de terminer), `mattpocock-skills` (pratiques d'ingénierie), `frontend-design` (Anthropic) et `hallmark` (design d'interface soigné). En session cloud, seuls les plugins officiels s'installent d'eux-mêmes : le script d'installation de l'environnement `cap-1000` installe les trois autres. S'ils manquent dans la liste des skills, les installer (`claude plugin marketplace add obra/superpowers-marketplace`, `mattpocock/skills`, `Nutlope/hallmark`, puis `claude plugin install <nom>@<marketplace>`) et lire leurs `SKILL.md` dans `~/.claude/plugins/cache/` pour la session en cours.

**Les utiliser par défaut, sans attendre que Gaëtan le demande** (demande du 16/11) :

| Situation | Skill |
|---|---|
| Nouvelle fonctionnalité ou changement de comportement | `superpowers:brainstorming` si la demande est floue, puis `superpowers:writing-plans` si plus de quelques fichiers |
| Écrire ou modifier du code testable (`progress`, `classify`, `stats`, `explain`, `backup`…) | `superpowers:test-driven-development` (test rouge d'abord) |
| Bug ou comportement inattendu | `superpowers:systematic-debugging` (cause avant correctif) |
| Toute retouche visuelle, nouvel écran | `frontend-design` et `hallmark`, dans les règles de `docs/REFONTE.md` |
| Revue d'architecture, découpage de modules | `mattpocock-skills:improve-codebase-architecture`, `codebase-design` |
| Avant d'annoncer « terminé » ou de fusionner dans `main` | `superpowers:verification-before-completion` (tests lancés, captures vérifiées), puis `/code-review` et `/simplify` |

Les règles de ce fichier et de `docs/REFONTE.md` priment sur celles des skills (notamment : fusion directe dans `main` sans pull request, pas de worktree imposé, réponses en français).

## Tester

```bash
python3 -m http.server 8000   # puis http://localhost:8000/?u=gaetcc
```

```bash
node --test tests/*.test.mjs  # règles de planification et explications ; moins d'une seconde
node tests/parcours.js        # parcours puzzles, journal, reprise, échauffement ; 1 à 2 minutes
node tests/audit-ui.js        # captures et mesures de chaque écran aux 6 passes (5 tailles + contraste renforcé) (tests/out/audit) ; 4 à 5 minutes
ONLY=accueil,bilan SIZES=390x664 node tests/audit-ui.js  # audit ciblé : écrans (noms de SCREENS) et tailles au choix, moins d'une minute
node tests/perf.js            # fluidité sur 5 000 parties simulées : toute vue ≤ 100 ms de blocage, rechargement ≤ 150 ms ; --report pour mesurer sans échouer ; 90 s
node tests/shots-diff.js A B  # comparaison pixel de deux dossiers d'audit (même jour : les dates des parties simulées suivent le jour courant)
```

Tests automatiques sur GitHub à chaque push (`.github/workflows/tests.yml`) : tests unitaires et syntaxe des modules ; les tests de temps y ont une marge × 4 (`CI`).

Le test génère des parties par coups semi-aléatoires au format Chess.com, intercepte `api.chess.com` et pilote Chromium avec Playwright. Ajouter `&debug` à l'URL expose l'état `S` dans `window.__cap`. Pour un cours privé, injecter un cours dans `S.ai` ; pour Lichess, intercepter `lichess.org`. Toujours vérifier le rendu par captures en 390 × 664 (iPhone avec les barres de Safari), 390 × 760, 1366 × 768, 1280 × 860, 312 × 531 (Safari à 125 %) et 390 × 664 en contraste renforcé (`390x664-hc`) : la page ne doit jamais défiler sur un écran d'échiquier.

## Règles internes à respecter

- Publication (demande de Gaëtan du 15/11) : une fois les tests passés, fusionner directement dans `main` et pousser, sans pull request et sans redemander.

- Fluidité (17/11) : toute vue reste sous 100 ms de blocage sur `tests/perf.js`. Un calcul qui ne dépend que des parties, des analyses, du filtre et du jour passe par `memo(nom, fn)` ; toute écriture de `S.data` ou `S.an` est suivie de `touch()` (`S.rev`), sinon les vues gardées restent périmées. Un calcul long se fait après l'affichage, par tranches (`idle`, `js/idle.js`), avec un bloc gris (`skel`).
- Tout rendu déclenché en arrière-plan (fin d'analyse, import, génération) passe par `bgRender()`, qui ne touche pas à un exercice en cours. `render()` est réservé aux actions de l'utilisateur.
- Filtres (revue HIG, 17/11) : la colonne de navigation ne porte plus de filtres. La cadence se règle dans Progrès > Plan et réglages (« Cadence suivie », avec « Mettre à jour » et « À jour, … », même texte que `upToDate()`), la période (`S.f.days`, boutons `data-f="days" data-v="0|90|30"`, `periodSeg()`) dans Mon jeu, Parties, Mes ouvertures et le détail d'une ouverture (`#monouv`) : la période ne filtre que les vues où son sélecteur est visible (`games()`). Cours, priorités et chantier lisent `cadenceGames()` (cadence seule, toute la période). Parties affiche la ligne d'état `#upd` (« À jour, il y a … », ou « Mise à jour impossible, dernière réussie … » après un échec, `S.upErr`) et un bouton `data-act="refresh"`. Mise à jour automatique : au chargement et au retour sur l'onglet si les données ont plus de 10 minutes (`STALE`), par `bgRender()` (jamais pendant un exercice ; rien dans une relecture), sans message éphémère, même en cas d'échec ; seuls le premier import et « Mettre à jour » en affichent un. La fin d'une analyse n'en affiche un que si elle a été lancée par un clic (`S.job.manual`).
- `data-act` = actions globales (navigation, analyse…), `data-x` = actions de l'exercice affiché (indice, solution, lecture d'une suite ; enregistrées par `X.on`), `data-f` = filtres et sélecteurs, `data-mini` = mini-échiquiers des fiches.
- Ne jamais écrire `.bwrap`, `.fitside` ou une barre d'actions à la main dans une vue : passer par `exo.screen`. Ne pas garder de poignée d'écran dans `S` : elle vit dans la fermeture du montage.
- Les analyses marquées `bad` (partie illisible) sont exclues de toutes les statistiques.
- Relecture de partie : `gvGo(k)` met l'écran à jour sur place (`gvSync`), sans `render()`. L'échiquier se joue librement (les deux camps, demande du 16/11, « comme Chess.com ») : le coup de la partie avance d'un coup, un autre coup ouvre une variante `S.gv.var` (`{ k0, mv, fens, i, ev }`, `gvMove`), évaluée à la demande par `S.play` (`gvVarEval`, flèche verte du meilleur coup), parcourue par `vgo` / flèches du clavier, quittée par « Revenir à la partie », Échap ou tout clic sur un coup de la partie. Clic droit : flèches et cases dessinées.
- Profondeur d'analyse unique (`DEPTH = 12`) sur tous les appareils.
- Ne jamais modifier une règle de classement sans augmenter `VERSION` dans `classify.js` : sinon les parties déjà analysées gardent l'ancien classement.
- `Engine.evalFen(fen, depth, urgent)` : `urgent` fait passer la vérification d'un coup devant les calculs de suites.
- Tout exercice terminé est noté par `progress.record…` au moment où il se termine, jamais au changement d'écran.
- Boutons de contrôle : icônes SVG de `ico()`, pas de flèches Unicode (émojis sur iPhone). Une barre mise à jour pendant une lecture passe par `setHtml` pour ne pas remplacer un bouton sous le doigt.
- `board()` (dans `board.js`) remplace toute flèche de saut de cavalier par une flèche en L dessinée à la main (`lPath`, calque `customSvg` de chessground, champs `ldest` / `lbrush` à la place de `dest` / `brush`), signale l'échec à chaque `cg.set({ fen })` et enregistre l'échiquier pour `destroyBoards()` ; ne pas créer d'échiquier sans passer par elle (`X.board` sur un écran d'exercice).
- Couleur des icônes : une nouvelle route se range dans sa section dans le bloc « Couleur des icônes par section » de `css/app.css`, et dans `SECTIONS` de `js/nav.js`.
- Survol : un seul bloc en fin de `css/app.css` (jetons `--hover`, `--hover-line`), à la souris seulement ; un nouvel élément cliquable s'y ajoute.
- Pas de sac d'aides passé en paramètre : un module importe ce dont il a besoin depuis `ui.js`, `charts.js`, `explain.js`.

## Points ouverts

- Aucun retour encore sur l'import avec le vrai compte `gaetcc` ; qualité des cours générés par Claude non évaluée (API simulée).
- Interface mobile refaite le 14/11 puis le 15/11, sans retour : si elle ne convient pas, demander une capture de l'écran.
- Cause du « ça a oublié mes 8 puzzles » non confirmée. Si cela revient : vérifier que le site est ouvert dans le même navigateur (stockages séparés entre Safari et navigateurs intégrés, navigation privée = tout effacé).
- Rythme de lecture des suites (`film`, ~3 s par coup) : réglable depuis le 16/11 (Apparence).
- Plan d'agrément du 16/11 (`docs/PLAN-AGREMENT.md`) testé sur parties simulées seulement : sons jamais écoutés, rendu iPhone non vu, `!` (seul coup qui tenait) de la relecture jamais observé.
- Échiquier sur téléphone après la solution (258 px sur 664 px de haut) : deux options proposées le 15/11 sans réponse (explication réduite à une ligne, ou défilement autorisé).
- Non faits faute de demande : indice en deux niveaux sur les positions inédites, lecture automatique d'une partie dans la relecture.
- Plan d'amélioration du 17/11 (`docs/PLAN-AMELIORATION.md`) : revue écran par écran et découpage de `app.js` en un module par écran non faits (décision de Gaëtan du 18/11, coût en jetons).
- Pistes 3 à 6 de la revue d'architecture du 15/11 non engagées : plan d'entraînement hors affichage, un module par écran, données versionnées, feuille de style par composant.
- Les explications de `explain.js` reposent sur des heuristiques (attaquants, défenseurs, matériel, clouages, enfilades, attaques à la découverte) : elles ignorent qu'une pièce clouée ne défend pas, et les coups purement positionnels restent commentés sobrement.
- Stockage : toutes les parties d'un compte dans une seule entrée IndexedDB (sans effet avant plusieurs milliers de parties).
- Explorateur Lichess (`explorer.js`) testé sur réponse simulée seulement (hôte injoignable depuis l'environnement de Claude) : format réel et accès anonyme à confirmer.
- Puzzles Lichess testés avec une API simulée seulement : format réel (coupe du PGN, `initialPly`) à confirmer ; `fetchPuzzle` essaie plusieurs coupes et garde celle où la solution est légale.
- Noms d'ouvertures en anglais (source Chess.com).
- Licence : GPL-3.0-or-later (imposée par chessground et Stockfish).
- Fiches d'ouvertures rédigées par Claude sans source consultée en ligne : à relire, corriger sur signalement.
- Ajouts du 15/11 (JOURNAL §19) testés sur parties simulées seulement : force réelle du moteur de `#gagner` (`Skill Level` 6) à ajuster ; seuils de pendule (moins de 1 min, moins de 5 s) pensés pour le 10 minutes ; téléchargement de la sauvegarde sur iPhone non vérifié.
