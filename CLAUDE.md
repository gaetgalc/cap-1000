# Cap 1000 : contexte du projet

Coach d'échecs personnel de Gaëtan (pseudo Chess.com `gaetcc`, GitHub `gaetgalc`).
Objectif : passer 1000 Elo en Rapide avant le 1er janvier 2027.
Site : https://gaetgalc.github.io/cap-1000/?u=gaetcc

Le journal complet des échanges et des décisions est dans `docs/JOURNAL.md`. Le lire avant toute évolution.

Refonte de l'interface en cours (depuis le 15/11) : décisions, état des lieux et étapes dans `docs/REFONTE.md`. Toute retouche visuelle suit ses règles (Geist, titres en Source Serif 4, cartes sans contour, jetons de `:root`, un bouton plein par vue, cibles de 44 px sur téléphone) et se vérifie avec `node tests/audit-ui.js`, qui doit rester sans écart. Suite prévue, en attente de 3 décisions de Gaëtan : `docs/PLAN-HIG.md` (revue selon les règles d'interface d'Apple, 17/11).

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
| `index.html` | Coquille, navigation à 4 entrées (16/11) : Aujourd'hui `#accueil`, S'entraîner `#entrainer` (réunit l'ancien Apprendre), Parties `#parties`, Progrès `#bilan`. Les routes de chaque section sont dans `js/nav.js` (plus d'attribut `data-grp`). Chaque entrée est un `.grp` (`data-menu` acc / ent / par / pro) avec un volet `.fly` de ses pages. **Ordinateur** : volet ouvert par la classe `open` (`navOpen` dans `app.js`) au survol, au focus clavier, aux flèches ; Échap le ferme ; `aria-haspopup` / `aria-expanded` posés par `navAria`. **Téléphone (< 860 px, revue HIG)** : pas de volet, l'entrée est un onglet qui mène à la dernière page vue de sa section (`navLast` en mémoire, `tabTarget`), ou à l'entrée de la section si l'on y est déjà ; Progrès porte les onglets `PRO_TABS` « Mon jeu · Stats · Plan ». Liens `data-fill` complétés à l'ouverture (`navFill`). Pastilles « reste à faire » (`navBadges`, à chaque `header()`). Logo « le cap » (boussole) en SVG en ligne dans `.brand-mark` et en icône d'onglet. Le clic sur le titre mène à la page principale de la section. Icônes colorées par section selon la section de la page (`sectionOf`, jetons `--c-jour`, `--c-train`, `--c-learn`, `--c-games`, `--c-prog`, variable `--sec`). Pendant un exercice, la colonne de gauche se réduit aux icônes (`body.fit`, `--side`) |
| `css/app.css` | Thème unique sombre, fonds à la Chess.com (page claire `--bg`, navigation et cartes plus sombres `--surface`, boutons secondaires `--btn2`). Toute couleur, taille de texte (6 : `--t-xs` 13 à `--t-xxl` 40), rayon (`--r-s` 6, `--r` 8), durée et la cible tactile `--hit` (44 px) viennent de `:root` : aucune valeur en dur ailleurs |
| `js/nav.js` | Sections de la navigation, sans DOM : `SECTIONS` (routes de chaque entrée, source unique), `ROOT`, `sectionOf(hash)` (`#ouvertures` seul : Parties ; avec argument : S'entraîner), `tabTarget(sec, cur, last)` (cible d'un onglet du téléphone) |
| `js/app.js` | État `S`, routage par hash, toutes les vues, événements |
| `js/ui.js` | Aides d'affichage sans état : `$`, `esc`, formats, icônes `ico()`, bulle du coach, barre victoires/nulles/défaites, `agoFr` (durée écoulée : « il y a 3 min », « hier »), `watchEdges` (bord estompé des panneaux `[data-edge]` qui défilent : classes `edge-b` / `edge-t`) |
| `js/charts.js` | `lineChart` : courbe SVG interactive |
| `js/exercise.js` | Écran d'exercice : structure sans défilement, bandeau, barre d'actions, actions `data-x`, lecteur de suites (`player`), raccourcis clavier (`key` : H indice, M mon coup, S solution, Entrée bouton plein, ? aide ; un bouton `data-x="hint|real|show"` reçoit son raccourci tout seul). Tous les écrans à échiquier passent par lui |
| `js/board.js` | Échiquier : `board()` (chessground, roi en échec signalé), flèches, `film()` (lecture animée d'une suite), `destroyBoards()` |
| `js/progress.js` | Mémoire de l'entraînement : répétition espacée, journal, activité par jour, objectif du jour. Stockage et horloge injectés (`makeProgress(store, now)`), donc testable sans navigateur |
| `js/chesscom.js` | Import via l'API publique Chess.com, normalisation des parties |
| `js/engine.js` | Stockfish (worker) : file de calculs, `evaluateGame` (évaluation brute de chaque position d'une partie) |
| `js/classify.js` | Classement des erreurs à partir des évaluations brutes : seuils, thèmes, suites. Calcul pur, sans moteur. `VERSION` des règles |
| `js/stats.js` | Agrégats, ouvertures, forces et faiblesses, erreurs selon la pendule (`clockErrors`), erreurs qui reviennent dans la même position (`repeatedErrors`), détail d'une ouverture jouée (`famDetail` : tronc commun, suites, variantes, usage par semaine, mois ou trimestre) |
| `js/alltime.js` | Page Stats (depuis la première partie) |
| `js/openings.js` | Catalogue des 15 ouvertures à apprendre (les 5 dernières : les plus jouées par Gaëtan hors des 10 premières, relevé du 15/11 ; texte neutre, sans ses chiffres, car le site est partageable) : histoire et utilisation dans le temps, idées des deux camps, pièges, lignes principales (coups, camp joué, commentaires par demi-coup). `matchGame` reconnaît une partie par ses premiers coups |
| `js/lessons.js` | Fiches de cours statiques (principe, routine), règles courtes par thème |
| `js/explain.js` | Explications sans IA : description de chaque coup (avec son intention si le coup est calme, `withIntent`), idée du meilleur coup (règle par type d'intention, `PLAN_RULE`), raison de l'échec du coup joué, bilan matériel, coupe d'une suite sur une position calme (`settle`). Réexporte `fr()` et `VAL` de `geom.js` |
| `js/geom.js` | Géométrie sans moteur : `VAL`, `NOM`, `fr()` (notation française, source unique), cases, `attacksFrom`, `attackers`, `poss` (« ton », « sa »), `play` (coup UCI ou SAN) |
| `js/plan.js` | Intention d'un coup calme (`intent(fen, suite, me)` → `{ k, text }` ou `null`) : prépare, enferme, bloque, avant-poste, colonne, roi, rupture, activité. `features` : repères de la position pour le coach Claude |
| `js/brief.js` | Mot du coach de l'accueil : `briefFacts` (10 dernières parties analysées), `coachBrief` (diagnostic, consigne, objectif), `CAUSES` (causes d'erreur, consigne et échauffement associés), `mainCause` |
| `js/ideas.js` | Idées de plan : `ideaPositions` (positions calmes de tes parties), `ideaChoices` (trois idées, la bonne = intention du meilleur coup, `check` = à confirmer par le moteur) |
| `js/program.js` | Programme de 4 semaines par chantier (`STAGES`, `programWeek`, semaines du lundi au dimanche), bilan de la semaine (`weekStats`, `reviewText`) |
| `js/portrait.js` | Portrait du joueur en phrases (`portrait`) : phase, pendule, menaces subies ou occasions ratées, camp, conversion |
| `js/theory.js` | Sortie de théorie dans les ouvertures du catalogue (`theoryExits`), plan de l'ouverture jouée pour ton camp (`planOf`) |
| `js/debrief.js` | Débrief d'une partie en 5 moments au plus (`moments(g, a)`) : sortie de l'ouverture, tournant, occasion manquée, faute décisive, fin |
| `js/drills.js` | Échauffements : 4 exercices de vérification générés depuis les positions des parties, réponse établie par les règles |
| `js/lichess.js` | Puzzles inédits : `GET lichess.org/api/puzzle/next?angle=&difficulty=` (anonyme), reconstruction de la position depuis le PGN |
| `js/sound.js` | Sons synthétisés en Web Audio (coup, prise, échec, roque, bon coup, erreur, objectif), coupés par défaut (`cap1000:snd`). Écoute l'événement `cap:feedback` émis par `exo.feedback(kind)` ; les sons de coups partent de `board()` quand la position change d'un seul coup légal |
| `js/look.js` | Réglages d'apparence (`cap1000:look`) : palette d'échiquier (vert, bois, bleu-gris), pièces (Maestro par défaut depuis le 17/11, Cardinal, classiques, Merida, Chessnut dans `vendor/pieces/` ; ombre portée `--piece-shadow`, plus marquée sur la pièce saisie `--piece-lift`), coordonnées, vitesse des suites (`speed`, lue par `film()`), taille d'échiquier choisie à la poignée |
| `js/toast.js` | Messages éphémères (`toast(texte)`, 2,5 s, `role="status"`) |
| `js/insights.js` | « Quand et comment tu perds » (Mon jeu) : `phaseStats`, `pieceStats`, `hourStats`, `sessionStats`, `insightText` ; Elo estimé d'une partie (`perfRef`, `gameRating`) |
| `js/endgames.js` | 11 finales de base à jouer contre le moteur (`ENDGAMES` : fen, but `mat` / `promo` / `nulle`, limite de coups, règle, plan) |
| `js/explorer.js` | Explorateur Lichess filtré par niveau (`explorer.lichess.ovh`, 1200 à 1800) : `fetchExplorer` (cache), `explorerRows` |
| `js/review.js` | Calculs purs de la relecture : symbole d'un coup (`moveMark`), part des Blancs dans la barre d'évaluation (`evalShare`), erreur précédente ou suivante (`errStep`), temps passé par coup (`moveTimes`, `clockFmt`), pendules au coup affiché (`clocksAt`) |
| `js/coach.js` | Cours privés Claude : faits vérifiés, prompt, appel API, lecture du JSON. « Demande au coach » sur une position : `positionPrompt`, `askPosition` (clé API), `positionText` (à copier sans clé) |
| `js/backup.js` | Sauvegarde et restauration en un fichier JSON (parties, analyses, cours, toutes les clés `cap1000:` sauf `key`). `pack` / `unpack` purs |
| `js/store.js` | IndexedDB (`data:<user>`, `an:<user>`, `ai:<user>`) et localStorage (préfixe `cap1000:` ; clés principales : `pz` répétition espacée, `hist` journal d'entraînement, `ui` état de l'écran à reprendre, `act` activité par jour, `focus` chantier, `bak` date de la dernière sauvegarde, `why` cause donnée à chaque erreur, `self` réponse à « As-tu appliqué ta règle ? » par partie) |
| `tests/fixture.js` | Parties simulées au format Chess.com, serveur local, interception de `api.chess.com` : commun aux tests navigateur |
| `tests/parcours.js` | Test de bout en bout (Playwright, parties simulées, `api.chess.com` intercepté) |
| `tests/audit-ui.js` | Audit de l'interface : 32 écrans aux 5 tailles (dont 312 × 531, Safari à 125 %) et une passe `390x664-hc` en contraste renforcé (texte 7:1, bord de carte 3:1), captures et mesures (coordonnées sans chevauchement, échiquier ≥ 360 px sur les écrans `.xwide` en 390 de large, défilement, tailles de texte, contraste, cibles de 44 px, boutons pleins, arrondis, libellés sur une ligne, échiquier ≥ 240 px à 312 × 531) |
| `tests/*.test.mjs` | Tests unitaires sans navigateur : sections et onglets de `nav.js`, légalité de chaque ligne de `openings.js`, règles de `progress.js`, positions de référence de `explain.js`, classement de `classify.js` sur des évaluations enregistrées, pendule et erreurs répétées de `stats.js`, format de `backup.js`, intentions de `plan.js`, brief de `brief.js`, moments de `debrief.js`, idées de `ideas.js`, programme de `program.js`, portrait de `portrait.js`, sortie de théorie de `theory.js`, prompt de position de `coach.js`, regards croisés et Elo estimé de `insights.js`, finales de `endgames.js`, lecture de l'explorateur de `explorer.js`, accolades équilibrées de `css/app.css` (`css.test.mjs`) |
| `vendor/` | chess.js 0.10.3, chessground 9, pièces Merida (GPLv2+), Chessnut (Apache 2.0), Maestro et Cardinal (CC BY-NC-SA 4.0, usage non commercial) dans `vendor/pieces/` (licences jointes), Stockfish 19 lite single-thread (WASM), polices Geist, Geist Mono et Source Serif 4 600 pour les titres (`vendor/fonts/`, licence OFL ; Sora et IBM Plex Sans ne sont plus chargées) |

Routes : `#accueil` (séance du jour), `#bilan` (Mon jeu : objectif détaillé, courbe du classement, chantier complet, points forts et faibles, tendance, bilan), `#puzzles`, `#historique` (journal des exercices faits), `#erreur/<end_time>/<ply>` (travail d'une erreur précise), `#entrainer` (S'entraîner : puzzles, échauffements, lignes à réviser, parties gagnées, inédits, historique, cours, ouvertures), `#plus` (ancien menu mobile, redirigé vers `#plan`), `#exos`, `#inedits` (puzzles Lichess), `#drill/<sur|menace|cadeau|compte>`, `#cours`, `#cours/<id>[/fiche]`, `#gagner` (parties gagnantes gâchées), `#gagner/<end_time>` (la rejouer contre le moteur), `#ouvertures`, `#ouvertures/apprendre` (catalogue), `#ouvertures/<id>` (fiche), `#ligne/<id>/<k>[/voir]` (réciter une ligne de mémoire, ou la découvrir commentée), `#parties` (une ligne par partie : Elo des deux joueurs, variation, écart, fin, coups, précision, fautes, pendule ; synthèse de la sélection au-dessus, `gameFacts` / `listSummary` de `stats.js`), `#monouv/<w|b>/<famille encodée>` (détail d'une ouverture jouée, ouvert d'un clic sur une ligne du tableau de « Mes ouvertures » : chiffres, courbe dans le temps, suites qui mènent à l'explorateur, variantes, fautes avant le 12e coup, dernières parties), `#partie/<end_time>[/<ply>|/d]` (`d` : débrief d'entrée), `#idees` (idées de plan), `#avantpartie` (avant de jouer : règle, routine, puis Chess.com), `#plan`, `#stats`, `#rush` et `#rush/<t3|surv>` (Rush), `#finales` et `#finale/<id>` (finales de base), `#jouer/<t>/<k|v>` (reprendre une position de la relecture contre le moteur).

## Écran d'exercice (`js/exercise.js`)

Les six écrans à échiquier (puzzle, erreur précise `#erreur`, position inédite, échauffement, position de cours, relecture de partie) sont construits par le même module. Un exercice ne fournit que ses règles :

- **Vue** : `exo.screen({ head, cap, panel, bar, top, live, … })` renvoie tout le HTML de l'écran. `head` = onglets, titre, consigne du coach ; `cap` = bandeau sous l'échiquier (en tête de la colonne de droite sur ordinateur si `capSide`, relecture) ; `above` / `below` = bandeaux autour de l'échiquier (joueurs et pendules de la relecture) ; `panel` = explication (défile seule) ; `bar` = boutons ; `top()` = avancée montrée dans la barre du haut sur téléphone ; `live: true` = écran qu'un rendu d'arrière-plan ne doit pas reconstruire.
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
- Partie contre le moteur : `botGame(X, o)` dans `app.js`, commune à `#gagner`, `#jouer` (`progress.recordPlay`, `k: 'j'`) et `#finale` (`progress.recordEndgame`, mémoire `fin`, `k: 'f'`, même calendrier que les lignes ; moteur à pleine force `S.fin`). Rush : `progress.recordRush` (record par mode dans `rush`, `k: 'r'`).
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

La page ne défile jamais (`body.homefit`, posé par `header()`), aux 4 tailles de contrôle. Contenu : objectif sur une ligne (`goalStrip`), séance du jour avec un seul bouton principal sur l'étape en cours (`sessionCard` ; téléphone : barre des 4 étapes cliquables ; ordinateur : programme des 4 étapes sous le bouton), mot du coach qui mène à Mon jeu (`briefCard`), dernière partie de la cadence suivie et ses gaffes, parcourues une par une avec les flèches ‹ › jusqu'aux plus anciennes parties (« Gaffe 2 sur 4 » quand une partie en a plusieurs ; `lastGameCard`, `review.gaffeTrail`, `S.lg`), boutons « Voir mon coup » / « Rejouer l'erreur ». Ordinateur : séance à gauche, chantier et dernière partie à droite (avec un mini-échiquier de la pire faute, flèche rouge du coup joué, sans la solution), calé en haut. Tout ajout doit garder la page sans défilement en 390 × 664. Tout le détail chiffré est dans « Mon jeu » (`viewBilan`, `mountBilan`) ; le Plan ne garde que la semaine et les réglages. Ne pas rajouter de bloc d'analyse sur l'accueil : il va dans « Mon jeu ». Exception demandée le 17/11 (JOURNAL §45) : sur ordinateur, la carte de l'objectif porte 6 encarts (il manque, échéance, rythme, 30 jours avec mini-courbe `sparkline`, série avec la semaine en 7 cases `progress.week`, prochaine révision `nextReview`).

## Coach privé (16/11, JOURNAL §36)

- **Mot du coach** (`briefCard`, accueil) : diagnostic chiffré, consigne, objectif. Garder la page sans défilement en 390 × 664 (diagnostic limité à 3 lignes sur téléphone, consigne sur ordinateur seulement).
- **Intention des coups** : toute nouvelle idée positionnelle se code dans `plan.js` avec son test dans `tests/plan.test.mjs`, et sa règle dans `PLAN_RULE` (`explain.js`). Une intention n'est dite que si elle est nette (`null` sinon).
- **Demande au coach** : le prompt ne contient que des faits calculés (pièces, moteur, `intent`, `features`). Réponses gardées en mémoire le temps de la session (`ASK`).
- **Débrief** (`gvDb`, `v.db`) et **réponse du coach** (`v.ask`) s'affichent dans le bandeau de la relecture ; tout `gvGo` les quitte.
- **Tier 2 (JOURNAL §37)** : « Mon jeu » commence par le portrait, puis chantier, programme de 4 semaines, causes, sortie de théorie. Le mot du coach : question « As-tu appliqué ta règle ? » après une partie récente (`selfGame`), verdict pendant 20 heures, bilan de la semaine le lundi. Sous 700 px de haut, 2 lignes et pas d'objectif chiffré.
- **Cause des erreurs** : `whyCard` dans le panneau d'explication (après « L'idée derrière… ») ; une cause dominante change la consigne du brief et l'échauffement du jour (`session`).

## Boucle pédagogique

1. **Chantier** (`focus`, `focusStats`, `focusCard`) : un seul type d'erreur à la fois, choisi sur le coût mesuré ; validé quand son taux par partie est divisé par deux sur au moins 5 parties jouées depuis le début du chantier. Stocké dans `cap1000:focus`.
2. **Séance du jour** en 4 étapes : échauffement lié au chantier (`DRILL_FOR`) ou à la cause dominante des erreurs (`CAUSES`), puzzles du chantier, cours, 2 parties avec la règle du chantier, préparées sur `#avantpartie`.
3. **Mesure** : `themeTrend` (10 dernières parties analysées contre les 10 précédentes) et `themeSeries` (courbe par paquets de 5).
4. **Prédire avant d'expliquer** : dans le lecteur de suites (`guess` d'un film), en pas à pas seulement (lecture en pause), l'élève peut jouer lui-même la punition de son coup et ses propres coups de la bonne suite. La lecture automatique ne s'interrompt pas (demande du 15/11).

Idées non faites : import des parties Lichess, comptes et synchronisation (la sauvegarde en fichier en tient lieu), traduction.

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
```

Le test génère des parties par coups semi-aléatoires au format Chess.com, intercepte `api.chess.com` et pilote Chromium avec Playwright. Ajouter `&debug` à l'URL expose l'état `S` dans `window.__cap`. Pour un cours privé, injecter un cours dans `S.ai` ; pour Lichess, intercepter `lichess.org`. Toujours vérifier le rendu par captures en 390 × 664 (iPhone avec les barres de Safari), 390 × 760, 1366 × 768 et 1280 × 860 : la page ne doit jamais défiler sur un écran d'échiquier.

## Règles internes à respecter

- Publication (demande de Gaëtan du 15/11) : une fois les tests passés, fusionner directement dans `main` et pousser, sans pull request et sans redemander.

- Tout rendu déclenché en arrière-plan (fin d'analyse, import, génération) passe par `bgRender()`, qui ne touche pas à un exercice en cours. `render()` est réservé aux actions de l'utilisateur.
- Filtres (revue HIG, 17/11) : la colonne de navigation ne porte plus de filtres. La cadence se règle dans Progrès > Plan et réglages (« Cadence suivie », avec « Mettre à jour » et « À jour : … »), la période (`S.f.days`, boutons `data-f="days" data-v="0|90|30"`, `periodSeg()`) dans Mon jeu, Parties, Mes ouvertures et le détail d'une ouverture (`#monouv`) : la période ne filtre que les vues où son sélecteur est visible (`games()`). Cours, priorités et chantier lisent `cadenceGames()` (cadence seule, toute la période). Parties affiche la ligne d'état `#upd` et un bouton `data-act="refresh"`. Mise à jour automatique : au chargement et au retour sur l'onglet si les données ont plus de 10 minutes (`STALE`), par `bgRender()` (jamais pendant un exercice ; rien dans une relecture).
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
- Couleur des icônes : une nouvelle route se range dans sa section dans le bloc « Couleur des icônes par section » de `css/app.css`.
- Survol : un seul bloc en fin de `css/app.css` (jetons `--hover`, `--hover-line`), à la souris seulement ; un nouvel élément cliquable s'y ajoute.
- Pas de sac d'aides passé en paramètre : un module importe ce dont il a besoin depuis `ui.js`, `charts.js`, `explain.js`.

## Points ouverts

- Aucun retour encore sur l'import avec le vrai compte `gaetcc`.
- Qualité réelle des cours générés par Claude non évaluée (testé avec une API simulée).
- Interface mobile refaite le 14/11 au soir puis réorganisée le 15/11 (échiquier en haut, texte dessous) sans retour encore ; si elle ne convient toujours pas, demander une capture de l'écran précis.
- Cause exacte du « ça a oublié mes 8 puzzles » non confirmée. Si cela se reproduit malgré le journal : vérifier que le site est ouvert dans le même navigateur (Safari et le navigateur intégré d'une autre app ont des stockages séparés, la navigation privée efface tout).
- Rythme de lecture des suites (`film`, environ 3 s par coup) : réglable depuis le 16/11 (Plan et réglages > Apparence : lente, normale, rapide).
- Plan d'agrément du 16/11 (`docs/PLAN-AGREMENT.md`, 8 lots faits) testé sur parties simulées seulement : sons jamais écoutés (pas de sortie audio dans l'environnement de Claude), rendu sur iPhone non vu, `!` (seul coup qui tenait) de la relecture jamais observé sur les parties simulées.
- Taille de l'échiquier sur téléphone après la solution (258 px sur un écran de 664 px de haut) : deux options proposées à Gaëtan le 15/11, sans réponse encore (réduire le panneau d'explication à une ligne, ou autoriser le défilement après la solution).
- Depuis `exercise.js`, deux alignements deviennent peu coûteux et n'ont pas été faits, faute de demande : indice en deux niveaux sur les positions inédites, lecture automatique d'une partie dans la relecture.
- Pistes 3 à 6 de la revue d'architecture du 15/11 non engagées : plan d'entraînement hors de l'affichage, un module par écran, données versionnées et sauvegarde, feuille de style par composant.
- Les explications de `explain.js` reposent sur des heuristiques (attaquants, défenseurs, matériel, clouages, enfilades, attaques à la découverte) : elles ignorent qu'une pièce clouée ne défend pas réellement, et les coups purement positionnels restent commentés sobrement.
- Stockage : toutes les parties d'un compte tiennent dans une seule entrée IndexedDB (sans effet avant plusieurs milliers de parties).
- Explorateur Lichess (`explorer.js`) testé sur une réponse simulée seulement (hôte injoignable depuis l'environnement de Claude) : format réel et accès anonyme à confirmer au premier essai.
- Puzzles Lichess codés d'après la documentation de l'API et testés avec une API simulée seulement : format réel de la réponse (coupe du PGN, `initialPly`) à confirmer au premier essai ; `fetchPuzzle` essaie plusieurs coupes et garde celle où la solution est légale.
- Noms d'ouvertures en anglais (source Chess.com).
- Licence : GPL-3.0-or-later (imposée par chessground et Stockfish).
- Contenu historique des fiches d'ouvertures rédigé par Claude sans source consultée en ligne : à relire, et à corriger sur signalement.
- Ajouts du 15/11 inspirés d'autres dépôts (voir `docs/JOURNAL.md` §19), testés sur parties simulées seulement : force réelle du moteur adverse de `#gagner` (`Skill Level` 6) à ajuster sur retour ; seuils de la pendule (moins de 1 min, moins de 5 s) pensés pour le 10 minutes ; téléchargement du fichier de sauvegarde sur iPhone non vérifié.
