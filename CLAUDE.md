# Cap 1000 : contexte du projet

Coach d'échecs personnel de Gaëtan (pseudo Chess.com `gaetcc`, GitHub `gaetgalc`).
Objectif : passer 1000 Elo en Rapide avant le 1er janvier 2027.
Site : https://gaetgalc.github.io/cap-1000/?u=gaetcc

Le journal complet des échanges et des décisions est dans `docs/JOURNAL.md`. Le lire avant toute évolution.

Refonte de l'interface en cours (depuis le 15/11) : décisions, état des lieux et étapes dans `docs/REFONTE.md`. Toute retouche visuelle suit ses règles (Geist, jetons de `:root`, un bouton plein par vue, cibles de 44 px sur téléphone) et se vérifie avec `node tests/audit-ui.js`, qui doit rester sans écart.

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
| `index.html` | Coquille, navigation à 5 entrées (refonte du 16/11) : Aujourd'hui `#accueil`, S'entraîner `#entrainer`, Apprendre `#cours`, Parties `#parties`, Progrès `#bilan`. Chaque lien porte dans `data-grp` les routes de sa section (une fiche d'ouverture compte pour Apprendre, `#ouvertures` seul pour Parties). Sur ordinateur, Progrès ouvre au survol un volet Mon jeu / Stats / Plan et réglages (`.grp`, `.fly` ; demande du 16/11 : pas d'onglets en haut) ; sur téléphone, Mon jeu propose Stats et Plan en tête (`PROG_MENU`). Pendant un exercice, la colonne de gauche se réduit aux icônes (`body.fit`, `--side`) |
| `css/app.css` | Thème unique sombre. Toute couleur, taille de texte (6 : `--t-xs` 13 à `--t-xxl` 40), rayon (`--r-s` 8, `--r` 12), durée et la cible tactile `--hit` (44 px) viennent de `:root` : aucune valeur en dur ailleurs |
| `js/app.js` | État `S`, routage par hash, toutes les vues, événements |
| `js/ui.js` | Aides d'affichage sans état : `$`, `esc`, formats, icônes `ico()`, bulle du coach, barre victoires/nulles/défaites |
| `js/charts.js` | `lineChart` : courbe SVG interactive |
| `js/exercise.js` | Écran d'exercice : structure sans défilement, bandeau, barre d'actions, actions `data-x`, lecteur de suites (`player`). Tous les écrans à échiquier passent par lui |
| `js/board.js` | Échiquier : `board()` (chessground, roi en échec signalé), flèches, `film()` (lecture animée d'une suite), `destroyBoards()` |
| `js/progress.js` | Mémoire de l'entraînement : répétition espacée, journal, activité par jour, objectif du jour. Stockage et horloge injectés (`makeProgress(store, now)`), donc testable sans navigateur |
| `js/chesscom.js` | Import via l'API publique Chess.com, normalisation des parties |
| `js/engine.js` | Stockfish (worker) : file de calculs, `evaluateGame` (évaluation brute de chaque position d'une partie) |
| `js/classify.js` | Classement des erreurs à partir des évaluations brutes : seuils, thèmes, suites. Calcul pur, sans moteur. `VERSION` des règles |
| `js/stats.js` | Agrégats, ouvertures, forces et faiblesses, erreurs selon la pendule (`clockErrors`), erreurs qui reviennent dans la même position (`repeatedErrors`) |
| `js/alltime.js` | Page Stats (depuis la première partie) |
| `js/openings.js` | Catalogue des 15 ouvertures à apprendre (les 5 dernières : les plus jouées par Gaëtan hors des 10 premières, relevé du 15/11 ; texte neutre, sans ses chiffres, car le site est partageable) : histoire et utilisation dans le temps, idées des deux camps, pièges, lignes principales (coups, camp joué, commentaires par demi-coup). `matchGame` reconnaît une partie par ses premiers coups |
| `js/lessons.js` | Fiches de cours statiques (principe, routine), règles courtes par thème |
| `js/explain.js` | Explications sans IA : description de chaque coup, idée du meilleur coup, raison de l'échec du coup joué, bilan matériel, coupe d'une suite sur une position calme (`settle`). Source unique de `fr()` (notation française) et de `VAL` (valeur des pièces) |
| `js/drills.js` | Échauffements : 4 exercices de vérification générés depuis les positions des parties, réponse établie par les règles |
| `js/lichess.js` | Puzzles inédits : `GET lichess.org/api/puzzle/next?angle=&difficulty=` (anonyme), reconstruction de la position depuis le PGN |
| `js/coach.js` | Cours privés Claude : faits vérifiés, prompt, appel API, lecture du JSON |
| `js/backup.js` | Sauvegarde et restauration en un fichier JSON (parties, analyses, cours, toutes les clés `cap1000:` sauf `key`). `pack` / `unpack` purs |
| `js/store.js` | IndexedDB (`data:<user>`, `an:<user>`, `ai:<user>`) et localStorage (préfixe `cap1000:` ; clés principales : `pz` répétition espacée, `hist` journal d'entraînement, `ui` état de l'écran à reprendre, `act` activité par jour, `focus` chantier, `bak` date de la dernière sauvegarde) |
| `tests/fixture.js` | Parties simulées au format Chess.com, serveur local, interception de `api.chess.com` : commun aux tests navigateur |
| `tests/parcours.js` | Test de bout en bout (Playwright, parties simulées, `api.chess.com` intercepté) |
| `tests/audit-ui.js` | Audit de l'interface : 22 écrans aux 4 tailles, captures et mesures (défilement, tailles de texte, contraste, cibles de 44 px, boutons pleins, arrondis) |
| `tests/*.test.mjs` | Tests unitaires sans navigateur : légalité de chaque ligne de `openings.js`, règles de `progress.js`, positions de référence de `explain.js`, classement de `classify.js` sur des évaluations enregistrées, pendule et erreurs répétées de `stats.js`, format de `backup.js` |
| `vendor/` | chess.js 0.10.3, chessground 9, Stockfish 19 lite single-thread (WASM), polices Geist et Geist Mono (`vendor/fonts/`, licence OFL ; Sora et IBM Plex Sans ne sont plus chargées) |

Routes : `#accueil` (séance du jour), `#bilan` (Mon jeu : objectif détaillé, courbe du classement, chantier complet, points forts et faibles, tendance, bilan), `#puzzles`, `#historique` (journal des exercices faits), `#erreur/<end_time>/<ply>` (travail d'une erreur précise), `#entrainer` (S'entraîner : puzzles, échauffements, lignes à réviser, parties gagnées, inédits, historique), `#plus` (ancien menu mobile, redirigé vers `#plan`), `#exos`, `#inedits` (puzzles Lichess), `#drill/<sur|menace|cadeau|compte>`, `#cours`, `#cours/<id>[/fiche]`, `#gagner` (parties gagnantes gâchées), `#gagner/<end_time>` (la rejouer contre le moteur), `#ouvertures`, `#ouvertures/apprendre` (catalogue), `#ouvertures/<id>` (fiche), `#ligne/<id>/<k>[/voir]` (réciter une ligne de mémoire, ou la découvrir commentée), `#parties`, `#partie/<end_time>[/<ply>]`, `#plan`, `#stats`.

## Écran d'exercice (`js/exercise.js`)

Les six écrans à échiquier (puzzle, erreur précise `#erreur`, position inédite, échauffement, position de cours, relecture de partie) sont construits par le même module. Un exercice ne fournit que ses règles :

- **Vue** : `exo.screen({ head, cap, panel, bar, top, live, … })` renvoie tout le HTML de l'écran. `head` = onglets, titre, consigne du coach ; `cap` = bandeau sous l'échiquier ; `panel` = explication (défile seule) ; `bar` = boutons ; `top()` = avancée montrée dans la barre du haut sur téléphone ; `live: true` = écran qu'un rendu d'arrière-plan ne doit pas reconstruire.
- **Montage** : `render()` appelle `exo.attach()` juste après l'écriture de la vue (avant la création de l'échiquier, qui naît ainsi à sa taille définitive). `exo.current()` rend la poignée `X` : `X.board(cfg)`, `X.say(classe, html)` (bandeau), `X.setBar(html)`, `X.on({ nom() {…} })` (actions des boutons `data-x="nom"`), `X.btn(nom)`, `X.alive()`, `X.spec`.
- **Lecture des suites** : `X.player({ films, view, arrows, ask, verdict, panel, panelHtml, exit, from, rest, auto })` joue un ou plusieurs films commentés (flèche qui annonce le coup, déplacement, commentaire, flèches de menace, bilan), gère Pause / Lecture / Revoir, le pas à pas, le clavier et le bouton qui propose le film suivant.
- Ids fixes : `#xb` (échiquier), `#xcap` (bandeau), `#xpanel`, `#xbar`. Classes d'état sur `body` : `fit` (écran d'exercice affiché), `solved` (solution trouvée), `imm` (barre du haut avec retour), toutes posées par le module ou par `header()`.

Règles des exercices sur une erreur du joueur, dans `app.js` : `workScreen` (vue), `solveBoard(X, g, e)` (vérifie le coup avec Stockfish, indices en deux niveaux, « Mon coup », solution), `explainUI(X, …)` (deux films calculés par `getLines`, coupés sur une position calme par `settle` : « La bonne suite » se joue toute seule, puis « Voir mon erreur »).

Mise en page (CSS `body.fit`) : `.bwrap` (échiquier + bandeau) et `.fitside` (`.fithead`, `.fitpanel`, `.actbar`). Ordinateur : échiquier dimensionné sur la hauteur de la fenêtre (`--bs`), colonne de droite. Téléphone : échiquier dimensionné par container query, en-tête masqué pendant un exercice, consigne du coach reprise dans le bandeau (`.m-txt`), choix du film en tête du panneau. La page elle-même ne défile jamais sur ces écrans.

## Journal et reprise

- Tout passe par `js/progress.js` : `recordPuzzle` (répétition espacée + journal + activité), `recordLichess`, `recordDrill`, `setLessonRead`, `queue`, `day`, `failedToday`. `app.js` n'écrit jamais directement les clés `pz`, `hist`, `act`, `drills`, `listat`, `lus`. Une règle de planification se change dans ce module, avec son test dans `tests/progress.test.mjs`.
- `pzRecord` (dans `app.js`) appelle `progress.recordPuzzle` dès la solution puis rafraîchit l'avancée affichée, quel que soit l'écran d'où le puzzle est fait (file, `#erreur`, cours privé). Un seul résultat par puzzle et par jour compte ; les suivants sont notés « révision ».
- Résultat : 2 du premier coup, 1 trouvé avec aide (mauvais essai ou indice), 0 solution vue. Raté : revient le lendemain. Réussi : 1, 3, 7, 21, 60 jours. Jamais de retour le jour même, sauf « Refaire mes ratés du jour » (`S.pz.redo`).
- Après une réussite du premier coup, l'élève peut juger le puzzle facile (un palier de plus) ou difficile (un palier de moins, jamais moins d'un jour) : `progress.rateInfo` / `ratePuzzle`, modifiable dans la journée, noté `q` dans le journal.
- Ligne d'ouverture récitée : `progress.recordLine` (mémoire `ln`, même calendrier que les puzzles, ligne `k: 'o'` du journal ; 2 sans faute, 1 avec faute ou indice, 0 suite vue). Une ligne jamais récitée est « nouvelle », pas « à réviser » (`linesDue`).
- Partie gagnante rejouée (`#gagner`) : `progress.recordConversion`, ligne `k: 'c'` du journal (2 gagnée, 0 sinon). Moteur adverse séparé (`S.bot`, `Skill Level` 6, profondeur 10) ; partie en cours reprise après rechargement (`S.cv` dans `ui`).
- Objectif du jour (`pzDay`) : 8 puzzles ; bilan `pzRecap` affiché une fois quand il est atteint, avec `nextStep` (prochaine étape de la séance).
- `keepUi` / `restoreUi` : puzzle en cours, étape du cours, échauffement entamé, position inédite sont repris après rechargement.

## Analyse en deux temps

- **Évaluer** (`engine.evaluateGame`, lent, une fois par partie) : pour chaque position, `ev` (centipions, point de vue des Blancs), `best` (meilleur coup), `pv` (4 premiers coups de la suite du moteur) ; puis `mp` : sur les positions d'erreur (`candidates`), les 3 meilleurs coups (`multiPass`, MultiPV 3).
- **Coups qui tiennent** : `e.alt` = nombre de coups à moins de 6 points du meilleur (1 à 3). La consigne dit « un seul coup tient » ou « plusieurs coups tiennent ». `isPuzzle` écarte les erreurs d'ouverture, de plan ou de finale où 3 coups tenaient. Les analyses sans `mp` sont complétées une fois en arrière-plan (`partial`), sans tout réévaluer.
- **Classer** (`classify.classify(game, raw)`, instantané) : en déduit `errs`, `acc`, `maxAdv`, `last`. Une analyse stockée dans `S.an[id]` contient les deux, plus `v` (version des règles).
- Changer un seuil ou un thème : modifier `classify.js`, augmenter `VERSION`, ajouter le cas dans `tests/classify.test.mjs`. À l'ouverture du site, `reclassify()` reclasse les parties déjà évaluées sans relancer Stockfish.
- Les analyses d'avant le 15/11 n'ont pas de données brutes (`pv` absent) : `autoAnalyse()` les réévalue une fois en arrière-plan, après les nouvelles parties. L'ancienne analyse reste en place tant que la nouvelle n'est pas prête.

## Accueil (`viewAccueil`, refait le 15/11, sans défilement depuis le 16/11)

La page ne défile jamais (`body.homefit`, posé par `header()`), aux 4 tailles de contrôle. Contenu : objectif sur une ligne (`goalStrip`), séance du jour avec un seul bouton principal sur l'étape en cours (`sessionCard` ; téléphone : barre des 4 étapes cliquables ; ordinateur : programme des 4 étapes sous le bouton), chantier en 3 lignes qui mène à Mon jeu (`focusMini`), dernière partie de la cadence suivie avec sa pire faute et deux boutons « Voir ce que j'ai joué » / « Rejouer l'erreur » (`lastGameCard`). Ordinateur : séance à gauche, chantier et dernière partie à droite, centré en hauteur. Tout ajout doit garder la page sans défilement en 390 × 664. Tout le détail chiffré est dans « Mon jeu » (`viewBilan`, `mountBilan`) ; le Plan ne garde que la semaine et les réglages. Ne pas rajouter de bloc d'analyse sur l'accueil : il va dans « Mon jeu ».

## Boucle pédagogique

1. **Chantier** (`focus`, `focusStats`, `focusCard`) : un seul type d'erreur à la fois, choisi sur le coût mesuré ; validé quand son taux par partie est divisé par deux sur au moins 5 parties jouées depuis le début du chantier. Stocké dans `cap1000:focus`.
2. **Séance du jour** en 4 étapes : échauffement lié au chantier (`DRILL_FOR`), puzzles du chantier, cours, 2 parties avec la règle du chantier.
3. **Mesure** : `themeTrend` (10 dernières parties analysées contre les 10 précédentes) et `themeSeries` (courbe par paquets de 5).
4. **Prédire avant d'expliquer** : dans le lecteur de suites (`guess` d'un film), en pas à pas seulement (lecture en pause), l'élève peut jouer lui-même la punition de son coup et ses propres coups de la bonne suite. La lecture automatique ne s'interrompt pas (demande du 15/11).

Idées non faites : import des parties Lichess, comptes et synchronisation (la sauvegarde en fichier en tient lieu), traduction.

## Contraintes à connaître

- Un artefact Claude ne peut pas appeler l'API Chess.com (requêtes externes bloquées) : d'où le site hébergé.
- L'environnement cloud de Claude ne peut pas joindre `api.chess.com` ni `*.github.io` : impossible d'y tester sur les vraies parties ou de vérifier le site en ligne. Les tests se font avec des parties simulées.
- Claude peut pousser sur ce dépôt (app GitHub installée) mais pas modifier ses réglages (Pages).
- L'abonnement Claude Pro n'inclut pas l'API : les cours passent soit par copier-coller dans une conversation Claude, soit par une clé API saisie dans le site (stockée en localStorage, jamais dans le dépôt).
- Pas de synchronisation entre appareils : analyses, cours et progression sont locaux. Transfert possible par fichier (Progrès > Plan et réglages > Sauvegarde).
- Dépôt public : ne jamais y écrire de clé, d'e-mail ni de donnée personnelle.

## Tester

```bash
python3 -m http.server 8000   # puis http://localhost:8000/?u=gaetcc
```

```bash
node --test tests/*.test.mjs  # règles de planification et explications ; moins d'une seconde
node tests/parcours.js        # parcours puzzles, journal, reprise, échauffement ; 1 à 2 minutes
node tests/audit-ui.js        # captures et mesures de chaque écran aux 4 tailles (tests/out/audit) ; 3 à 4 minutes
```

Le test génère des parties par coups semi-aléatoires au format Chess.com, intercepte `api.chess.com` et pilote Chromium avec Playwright. Ajouter `&debug` à l'URL expose l'état `S` dans `window.__cap`. Pour un cours privé, injecter un cours dans `S.ai` ; pour Lichess, intercepter `lichess.org`. Toujours vérifier le rendu par captures en 390 × 664 (iPhone avec les barres de Safari), 390 × 760, 1366 × 768 et 1280 × 860 : la page ne doit jamais défiler sur un écran d'échiquier.

## Règles internes à respecter

- Publication (demande de Gaëtan du 15/11) : une fois les tests passés, fusionner directement dans `main` et pousser, sans pull request et sans redemander.

- Tout rendu déclenché en arrière-plan (fin d'analyse, import, génération) passe par `bgRender()`, qui ne touche pas à un exercice en cours. `render()` est réservé aux actions de l'utilisateur.
- `data-act` = actions globales (navigation, analyse…), `data-x` = actions de l'exercice affiché (indice, solution, lecture d'une suite ; enregistrées par `X.on`), `data-f` = filtres et sélecteurs, `data-mini` = mini-échiquiers des fiches.
- Ne jamais écrire `.bwrap`, `.fitside` ou une barre d'actions à la main dans une vue : passer par `exo.screen`. Ne pas garder de poignée d'écran dans `S` : elle vit dans la fermeture du montage.
- Les analyses marquées `bad` (partie illisible) sont exclues de toutes les statistiques.
- Relecture de partie : `gvGo(k)` met l'écran à jour sur place (`gvSync`), sans `render()`.
- Profondeur d'analyse unique (`DEPTH = 12`) sur tous les appareils.
- Ne jamais modifier une règle de classement sans augmenter `VERSION` dans `classify.js` : sinon les parties déjà analysées gardent l'ancien classement.
- `Engine.evalFen(fen, depth, urgent)` : `urgent` fait passer la vérification d'un coup devant les calculs de suites.
- Tout exercice terminé est noté par `progress.record…` au moment où il se termine, jamais au changement d'écran.
- Boutons de contrôle : icônes SVG de `ico()`, pas de flèches Unicode (émojis sur iPhone). Une barre mise à jour pendant une lecture passe par `setHtml` pour ne pas remplacer un bouton sous le doigt.
- `board()` (dans `board.js`) signale l'échec à chaque `cg.set({ fen })` et enregistre l'échiquier pour `destroyBoards()` ; ne pas créer d'échiquier sans passer par elle (`X.board` sur un écran d'exercice).
- Pas de sac d'aides passé en paramètre : un module importe ce dont il a besoin depuis `ui.js`, `charts.js`, `explain.js`.

## Points ouverts

- Aucun retour encore sur l'import avec le vrai compte `gaetcc`.
- Qualité réelle des cours générés par Claude non évaluée (testé avec une API simulée).
- Interface mobile refaite le 14/11 au soir puis réorganisée le 15/11 (échiquier en haut, texte dessous) sans retour encore ; si elle ne convient toujours pas, demander une capture de l'écran précis.
- Cause exacte du « ça a oublié mes 8 puzzles » non confirmée. Si cela se reproduit malgré le journal : vérifier que le site est ouvert dans le même navigateur (Safari et le navigateur intégré d'une autre app ont des stockages séparés, la navigation privée efface tout).
- Rythme de lecture des suites (`film`, environ 3 s par coup) à ajuster sur retour ; pas de réglage de vitesse.
- Taille de l'échiquier sur téléphone après la solution (258 px sur un écran de 664 px de haut) : deux options proposées à Gaëtan le 15/11, sans réponse encore (réduire le panneau d'explication à une ligne, ou autoriser le défilement après la solution).
- Depuis `exercise.js`, deux alignements deviennent peu coûteux et n'ont pas été faits, faute de demande : indice en deux niveaux sur les positions inédites, lecture automatique d'une partie dans la relecture.
- Pistes 3 à 6 de la revue d'architecture du 15/11 non engagées : plan d'entraînement hors de l'affichage, un module par écran, données versionnées et sauvegarde, feuille de style par composant.
- Les explications de `explain.js` reposent sur des heuristiques (attaquants, défenseurs, matériel, clouages, enfilades, attaques à la découverte) : elles ignorent qu'une pièce clouée ne défend pas réellement, et les coups purement positionnels restent commentés sobrement.
- Stockage : toutes les parties d'un compte tiennent dans une seule entrée IndexedDB (sans effet avant plusieurs milliers de parties).
- Puzzles Lichess codés d'après la documentation de l'API et testés avec une API simulée seulement : format réel de la réponse (coupe du PGN, `initialPly`) à confirmer au premier essai ; `fetchPuzzle` essaie plusieurs coupes et garde celle où la solution est légale.
- Noms d'ouvertures en anglais (source Chess.com).
- Licence : GPL-3.0-or-later (imposée par chessground et Stockfish).
- Contenu historique des fiches d'ouvertures rédigé par Claude sans source consultée en ligne : à relire, et à corriger sur signalement.
- Ajouts du 15/11 inspirés d'autres dépôts (voir `docs/JOURNAL.md` §19), testés sur parties simulées seulement : force réelle du moteur adverse de `#gagner` (`Skill Level` 6) à ajuster sur retour ; seuils de la pendule (moins de 1 min, moins de 5 s) pensés pour le 10 minutes ; téléchargement du fichier de sauvegarde sur iPhone non vérifié.
