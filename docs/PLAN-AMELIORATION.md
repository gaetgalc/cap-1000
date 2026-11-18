# Plan d'amélioration (17/11)

**État (18/11) : fait, sauf les tâches 14 (revue écran par écran) et 15 (un module par écran), abandonnées sur décision de Gaëtan pour économiser les jetons. La tâche 12 (commentaire de la relecture) était déjà réglée par la revue HIG (panneau qui défile avec bord estompé). Voir `docs/JOURNAL.md` §48.**

> **Pour les agents :** exécuté par des sous-agents Sonnet, orchestrés depuis la conversation principale (`superpowers:subagent-driven-development`). Chaque tâche se coche (`- [ ]`). Un sous-agent ne committe ni ne pousse : il rend ses fichiers modifiés, ses mesures avant / après et ses doutes ; l'orchestrateur vérifie, committe sur `claude/sleepy-darwin-5alsv1`, puis fusionne dans `main` (règle de `CLAUDE.md`).

**But :** moins de code à capacités égales, aucune vue qui fige sur les vraies parties de Gaëtan, un site plus lisible, un dépôt moins coûteux à faire évoluer.

**Approche :** mesurer d'abord (banc de fluidité sur 5 000 parties simulées, comparaison pixel des captures), puis corriger par vagues de tâches aux fichiers disjoints, chaque refonte de code prouvée par « même rendu, mêmes tests ».

**Pile :** site statique sans build (ES modules, chess.js 0.10.3, chessground, Stockfish WASM), tests `node --test`, Playwright.

**Références :** `CLAUDE.md`, `docs/REFONTE.md` (règles visuelles), `docs/JOURNAL.md`.

## Constat chiffré (17/11)

Mesuré sur les **6 125 vraies parties de gaetcc** (archives téléchargées, servies par `ctx.route`, jamais versionnées), Chromium, plus longue tâche bloquante à l'ouverture de la vue :

| Vue | Ordinateur | Téléphone | Cause trouvée au profileur |
|---|---|---|---|
| Stats | 494 ms | 427 ms | `dfmt` (ui.js:4) : `toLocaleDateString` recrée un formateur à chaque appel, 4 583 fois pour la courbe |
| Mon jeu | 333 ms | 276 ms | même `dfmt` dans `mountBilan` (courbe du classement) |
| Échauffement | 389 ms | 329 ms | `makeRound` (drills.js:89) rejoue chaque partie coup par coup avec chess.js |
| Idées de plan | 292 ms | 266 ms | `ideaPositions` + `intent` recalculés à chaque rendu |
| Relecture | 114 ms | 93 ms | à profiler |
| Rechargement | 8 tâches de 55 à 116 ms | idem | à profiler (lecture IndexedDB, reclassement, premier rendu) |
| Autres vues | < 60 ms | < 60 ms | — |

Le banc actuel (12 parties simulées) ne voit rien de tout cela.

Code : `js/app.js` 236 Ko (2 666 lignes, 89 lignes de plus de 300 caractères), `css/app.css` 87 Ko (868 règles, 19 blocs `max-width: 859px` et 18 blocs `min-width: 860px` dispersés, 8 blocs de survol alors que la règle en veut un), 3 copies de l'encart `.glt`, 11 copies du libellé Victoire / Défaite / Nulle, 5 fichiers de polices jamais chargés (Sora, IBM Plex : 120 Ko).

Interface, relevé sur captures :
- Accueil : les 7 cases de la semaine (encart Série) n'ont aucun repère de jour ; la mini-courbe des 30 jours reste verte quand l'Elo baisse (−47 en rouge au-dessus).
- Relecture sur téléphone (390 × 664) : le commentaire est coupé sous la bande de coups.
- Puzzle sur téléphone : la ligne « Coup 11 de ta partie… · Ouvrir la partie » a des interlignes cassés (lien de 44 px au milieu du texte).
- Parties sur téléphone : synthèse en 3 colonnes avec une case vide, « 2225 V · 172 N · 2181 D » sur deux lignes, paragraphe d'aide de 4 lignes avant la liste.
- Plan et réglages : une liste de 10 cases à cocher à la main (« Séance de puzzles 1 » à « 6 »…) qui double la séance du jour et le programme de 4 semaines.

## Décisions à prendre par Gaëtan avant exécution

1. **Liste à cocher de la semaine (Plan et réglages)** : la supprimer (garder « Jouer X / 7 parties », le temps disponible et les réglages) ? Recommandé : oui, la séance du jour fait ce travail automatiquement.
2. **Découper `app.js` en un module par écran** (tâche 15) : recommandé, sans changement visible ; c'est ce qui rend les évolutions suivantes moins chères et moins risquées.
3. **Alléger `CLAUDE.md`** (tâche 1) : 33 Ko lus par chaque session et chaque sous-agent ; le détail part dans `docs/ARCHITECTURE.md`, rien n'est perdu.

## Contraintes globales

- Site statique, sans build ni dépendance npm ajoutée au site ; les outils de test restent en Node + Playwright déjà installés.
- Règles de `docs/REFONTE.md` : jetons de `:root` (aucune valeur en dur), Geist, Source Serif 4 pour h1/h2 et grands chiffres, cartes sans contour, un seul bouton plein par vue, cibles de 44 px sur téléphone, 6 tailles de texte, rien sous 13 px, survol à la souris seulement, `prefers-reduced-motion`.
- Accueil sans défilement aux 4 tailles (390 × 664, 390 × 760, 1366 × 768, 1280 × 860) ; aucun écran d'échiquier ne défile.
- `node tests/audit-ui.js` reste sans écart ; `node --test tests/*.test.mjs` et `node tests/parcours.js` restent verts.
- **Mêmes capacités** : aucune fonctionnalité ni ancienne adresse ne disparaît, sauf décision 1 validée.
- Dépôt public : aucune vraie partie, clé, e-mail ni donnée personnelle versionnés. Les mesures sur les vraies parties se font hors dépôt (dossier temporaire).
- Format des clés de stockage inchangé (`cap1000:*`, jour `AAAA-MM-JJ` local de `progress.dkey`) : sinon l'historique de Gaëtan est perdu.
- Règles de `CLAUDE.md` : `progress.js` seul à écrire `pz`, `hist`, `act`… ; `bgRender()` pour tout rendu d'arrière-plan ; `VERSION` de `classify.js` augmentée à tout changement de règle ; textes en français ; icônes par `ico()`, jamais de flèche Unicode.
- Tests en parallèle : chaque sous-agent reçoit sa variable `PORT` (8800 + 10 × n° de tâche) et son dossier de sortie `tests/out/t<n>`.

## Points de vigilance (non couverts par les tests actuels)

1. **Cache périmé** : après la fin d'une analyse, un import, une restauration, un changement de filtre ou un changement de jour, une vue mise en cache doit montrer les nouveaux chiffres. → test unitaire de `memo` (tâche 7) et vérification dans `parcours.js` qu'après « Mettre à jour » l'accueil compte la nouvelle partie.
2. **Format des dates** : `dfmt` doit rendre exactement `JJ/MM/AA`, et `dkey` exactement l'ancien `toLocaleDateString('sv')`, autour de minuit compris. → tests de la tâche 3.
3. **Cascade CSS** : regrouper des blocs `@media` peut changer l'ordre d'application sur des états que l'audit ne photographie pas (`body.solved`, `.pop`, focus). → la tâche 8 ne déplace une règle que si aucune règle de même spécificité visant le même élément ne se trouve entre ses deux positions, et ajoute à l'audit l'écran d'erreur après la solution.
4. **Anciennes adresses** (`#plus`, `#ouvertures` et ses variantes, `#cours/<id>/fiche`, `#partie/<t>/d`) et passage ordinateur / téléphone de la relecture après la table des routes. → liste vérifiée dans `parcours.js` (tâche 9).
5. **Semaine de l'accueil** : lettre du jour juste un dimanche et un lundi, fuseau local. → test de `dayLetter` (tâche 11).

---

## Vague 0 : fondations (tâches 1 et 2 en parallèle)

### Tâche 1 : `CLAUDE.md` allégé (si décision 3 validée)

**Fichiers :** modifier `CLAUDE.md` ; créer `docs/ARCHITECTURE.md`.

- [ ] Déplacer dans `docs/ARCHITECTURE.md`, mot pour mot : la table des fichiers, la liste des routes, les sections « Écran d'exercice », « Journal et reprise », « Analyse en deux temps », « Accueil », « Coach privé », « Boucle pédagogique ».
- [ ] Garder dans `CLAUDE.md` (≤ 12 Ko) : contexte et objectif, ce que veut l'utilisateur, architecture en 10 lignes (renvoi vers `docs/ARCHITECTURE.md`), contraintes à connaître, règles internes, tester, skills, points ouverts. Remplacer « lire le journal avant toute évolution » par « lire la section du journal qui concerne l'écran touché ».
- [ ] Vérifier : `wc -c CLAUDE.md` ≤ 12 000 ; chaque titre de section de l'ancien `CLAUDE.md` se retrouve dans l'un des deux fichiers (`git show HEAD:CLAUDE.md | grep '^## '`).

### Tâche 2 : bancs de mesure (fluidité et rendu)

**Fichiers :** modifier `tests/fixture.js` ; créer `tests/perf.js`, `tests/shots-diff.js` ; modifier `tests/audit-ui.js` (captures nommées de façon stable si besoin).

**Produit :**
- `fixture.bigGames(n: number) → objet[]` : les 12 parties de `GAMES` clonées jusqu'à `n`, chacune avec `url` et `end_time` distincts, réparties sur 20 archives mensuelles (`routeChessCom(ctx, { games })` sert ces archives).
- `node tests/perf.js [--report]` : importe 5 000 parties, laisse Stockfish analyser les 12 parties de base, recopie leur analyse sur 300 clones (même suite de coups, donc analyse valide) via `window.__cap`, puis visite `accueil, entrainer, puzzles, bilan, parties, partie/<t>, stats, ouvertures, ouvertures/apprendre, plan, historique, drill/sur, idees, gagner, finales, rush, erreur/<t>/<ply>` en 1366 × 768 et 390 × 664, puis recharge la page. Mesure par vue la plus longue tâche (`PerformanceObserver('longtask')`) et le temps jusqu'à deux images. Écrit `tests/out/perf.json`, affiche un tableau, sort en erreur si une vue dépasse **100 ms** ou le rechargement **150 ms** (sauf `--report`).
- `node tests/shots-diff.js <dossierA> <dossierB> [seuil=0]` : compare pixel à pixel les PNG de même nom des deux dossiers d'audit (canvas dans Chromium, pas de dépendance), liste les écrans qui diffèrent avec leur part de pixels changés, sort en erreur au-delà du seuil.

- [ ] Écrire `bigGames` et l'option `games` de `routeChessCom` ; `node tests/parcours.js` reste vert (il n'utilise pas l'option).
- [ ] Écrire `tests/perf.js` ; lancer `node tests/perf.js --report` ; attendu : Mon jeu, Stats, Échauffement, Idées au-dessus de 100 ms (le banc reproduit le constat).
- [ ] Écrire `tests/shots-diff.js` ; lancer deux audits sur le même code (`tests/out/a`, `tests/out/b`) puis `node tests/shots-diff.js tests/out/a tests/out/b` ; attendu : aucun écran différent (sinon, rendre les captures déterministes : attendre la fin des toasts, masquer le bandeau d'analyse).
- [ ] Ajouter les deux commandes à la section « Tester » de `CLAUDE.md`.

**Après la vague 0 (orchestrateur) :** `node tests/audit-ui.js tests/out/avant` et `node tests/perf.js --report` sur le code de départ, gardés comme référence.

---

## Vague 1 : fluidité

Tâches 3, 4, 5 et 6 en parallèle (fichiers disjoints), puis 7.

### Tâche 3 : formats de date en cache

**Fichiers :** modifier `js/ui.js`, `js/progress.js`, `js/alltime.js`, `js/coach.js` ; créer `tests/ui.test.mjs` ; modifier `tests/progress.test.mjs`.

**Produit :** `datef(opts: Intl.DateTimeFormatOptions) → (ms: number) => string` dans `ui.js` (un `Intl.DateTimeFormat('fr-FR', opts)` créé une fois par jeu d'options) ; `dfmt(t)` (secondes) garde sa signature et passe par `datef`. `progress.dkey(d)` calcule `AAAA-MM-JJ` à partir de `getFullYear/getMonth/getDate`, sans formateur.

- [ ] Tests rouges : `dfmt(Date.UTC(2023, 10, 14, 12) / 1000) === '14/11/23'` ; `datef({ day: 'numeric', month: 'short' })` rend la même chaîne que `toLocaleDateString('fr-FR', …)` sur 50 dates ; 10 000 appels à `dfmt` en moins de 50 ms ; `dkey` identique à `toLocaleDateString('sv')` pour chaque heure de 3 jours autour d'un changement d'heure (29/03/2026) et à 23:59 / 00:00, avec `TZ=Europe/Paris`.
- [ ] Implémenter ; remplacer les `toLocaleDateString` / `toLocaleTimeString` de `alltime.js` et `coach.js` par `datef`.
- [ ] `node --test tests/*.test.mjs` vert ; `node tests/perf.js --report` : Stats et Mon jeu sous 100 ms (sinon, noter la cause restante pour la tâche 7).

### Tâche 4 : échauffements sans rejouer les parties

**Fichiers :** modifier `js/drills.js` ; créer `tests/drills.test.mjs`.

**Consomme :** `replay(game) → { fens: string[], mv: object[] } | null` de `classify.js` (mis en cache, déjà réchauffé pour les parties analysées par `warmReplays`).

- [ ] Tests rouges sur 200 parties de `fixture.GAMES` clonées : `makeRound('sur', games, 10)` rend 10 positions de type `sur`, chacune d'une partie différente ; mêmes contrôles pour `menace`, `cadeau`, `compte` ; un second appel sur les mêmes parties prend moins de 80 ms.
- [ ] Dans `makeRound` : prendre positions et coups dans `replay(g)` au lieu de rejouer les SAN ; parcourir d'abord les parties dont le rejeu est en cache ; limiter le nombre de candidats essayés par partie. Les règles de `build` ne changent pas.
- [ ] Tests verts ; `perf.js --report` : Échauffement sous 100 ms.

### Tâche 5 : préchargement des modules

**Fichiers :** modifier `index.html` ; créer `tests/preload.test.mjs`.

- [ ] Test rouge : parcourir les `import … from './x.js'` à partir de `js/app.js` ; chaque module atteint figure dans un `<link rel="modulepreload" href="js/x.js">` de `index.html`, et chaque `modulepreload` désigne un fichier existant.
- [ ] Ajouter les `modulepreload` (un aller-retour réseau au lieu de 3 niveaux d'imports sur GitHub Pages) ; précharger aussi `geist-sans-latin-500/600` (boutons visibles au premier écran).
- [ ] Test vert ; `node tests/parcours.js` vert.

### Tâche 6 : fichiers morts

**Fichiers :** supprimer `vendor/fonts/ibm-plex-sans-latin-{400,500,600}-normal.woff2`, `vendor/fonts/sora-latin-{600,700}-normal.woff2`, `vendor/fonts/IBM-PLEX-OFL.txt`, `vendor/fonts/SORA-OFL.txt` ; modifier `README.md` (ligne des licences : Geist, Geist Mono, Source Serif 4 ; liste des tests).

- [ ] `grep -rn "sora\|plex" -i css js index.html` ne rend rien avant suppression ; supprimer ; `node tests/parcours.js` vert.

### Tâche 7 : vues mises en cache et rechargement (après la tâche 3)

**Fichiers :** modifier `js/app.js` ; créer `tests/memo.test.mjs` si `memo` est extrait dans un module pur (`js/memo.js`).

**Produit :**
- `S.rev: number`, augmenté par `touch()` à chaque changement de `S.data` ou `S.an` (fin d'import, analyse enregistrée, `reclassify`, restauration, `bad`).
- `memo(name: string, fn: () => T) → T` : résultat gardé tant que la clé `${S.rev}|${S.f.tc}|${S.f.days}|${dkey()}` ne change pas.
- Usages : `session()` (appelée deux fois par rendu de l'accueil, via `navBadges`), `ideaPool()`, `insightsOf` (remplace `insMemo`), et toute autre fonction que le profileur montre au-dessus de 20 ms sur le banc.
- Les `toLocaleDateString` de `app.js` passent par `datef`.

- [ ] Test rouge de `memo` : même résultat sans recalcul tant que la clé est stable ; recalcul après `touch()`, après un changement de filtre, après un changement de jour (horloge injectée).
- [ ] Implémenter ; ajouter à `parcours.js` : après une nouvelle partie servie et « Mettre à jour », l'accueil et la liste des parties la comptent.
- [ ] Profiler le rechargement (CDP `Profiler` dans `perf.js` ou à part) et corriger la cause des tâches longues (lecture des 5 000 parties, `reclassify`, premier rendu) : découpage en tranches ou report à `requestIdleCallback`, sans retarder le premier affichage.
- [ ] `node tests/perf.js` (sans `--report`) : toutes les vues ≤ 100 ms, rechargement ≤ 150 ms, aux deux tailles. Tests et parcours verts.

**Après la vague 1 (orchestrateur) :** contrôle sur les vraies parties hors dépôt (`perfreal.js` du dossier temporaire), tableau avant / après pour Gaëtan.

---

## Vague 2 : moins de code

Tâches 8 et 9 en parallèle (CSS seul / JS seul), puis 10.

### Tâche 8 : feuille de style resserrée

**Fichiers :** modifier `css/app.css` ; modifier `tests/audit-ui.js` (écran `erreur-resolue` : erreur après « Solution ») ; outil jetable de couverture hors dépôt.

- [ ] Ajouter l'écran `erreur-resolue` à l'audit ; refaire `tests/out/avant` pour cet écran.
- [ ] Couverture réelle : `CSS.startRuleUsageTracking` (CDP) pendant l'audit complet (33 écrans × 4 tailles) et `parcours.js` ; liste des règles jamais appliquées.
- [ ] Supprimer les règles mortes confirmées (classe absente du code, état jamais posé) ; garder celles des états posés dynamiquement (`pal-*`, `pc-*`, `pop`, `solved`…) même si l'audit ne les voit pas ; supprimer `--s-7` et les classes `stepn`, `stepa`, `frule`, `qlinks` si confirmées mortes.
- [ ] Regrouper les blocs `@media` de même condition et les 8 blocs de survol en un seul (règle de `CLAUDE.md`), selon la contrainte de cascade des points de vigilance ; fusionner les sélecteurs en double (18 relevés).
- [ ] Vérifier : `node tests/css.test.mjs`, `node tests/audit-ui.js tests/out/t8` sans écart, `node tests/shots-diff.js tests/out/avant tests/out/t8` : **aucun écran différent** ; `parcours.js` vert. Objectif : `css/app.css` ≤ 70 Ko.

### Tâche 9 : table des routes et aides communes

**Fichiers :** modifier `js/app.js`, `js/ui.js` ; modifier `tests/parcours.js`.

**Produit :**
- `ROUTES: { [route: string]: { view: (a, b, c) => string, mount?: () => void, resize?: () => void, title?: string } }` dans `app.js` ; `render()` et le gestionnaire `resize` n'ont plus de chaîne de `if` / ternaires ; `TITLES` disparaît dans la table. Cas particuliers gardés tels quels : `#plus` → `#plan`, `ouvertures` (apprendre / fiche / mes ouvertures), `cours` (liste / leçon).
- Dans `ui.js` : `tile(lab, v, { sub, cls, tip, href })` (remplace les 3 copies de `.glt`), `resChip(out)` (Victoire / Défaite / Nulle, 11 copies), `tabs(on, items)` (remplace aussi `pzTabs`, `LEARN_TABS`, `GAMES_TABS`).

- [ ] Ajouter à `parcours.js` la visite des anciennes adresses (`#plus`, `#ouvertures`, `#ouvertures/apprendre`, `#ouvertures/italienne`, `#cours/en_prise_pose/fiche`, `#partie/<t>/d`, `#erreur/<t>/<ply>`) : chacune affiche son titre attendu sans erreur JavaScript ; lancer sur le code actuel : vert.
- [ ] Écrire la table, les trois aides, remplacer les copies.
- [ ] Vérifier : tests, `parcours.js`, audit sans écart, `shots-diff` : aucun écran différent. Objectif : `app.js` ≥ 6 Ko plus court.

### Tâche 10 : code jamais exécuté (après la tâche 9)

**Fichiers :** modifier `js/*.js` selon la liste ; outil jetable de couverture hors dépôt.

- [ ] Couverture V8 (`page.coverage.startJSCoverage`) pendant `parcours.js` et l'audit complet ; liste des fonctions et branches jamais exécutées, par fichier.
- [ ] Classer chaque entrée : morte (aucun appel atteignable : supprimer), chemin d'erreur ou rare (garder), atteignable mais non testée (garder, la noter). Rendre la liste classée à l'orchestrateur avant toute suppression.
- [ ] Si la décision 1 est validée : supprimer la liste à cocher de la semaine (`viewPlan`, gestionnaire `[data-plan]`, clés `plan:<semaine>` laissées en place dans le stockage), garder « Jouer X / 7 », le temps disponible et les réglages ; mettre à jour l'audit.
- [ ] Vérifier : tests, parcours, audit sans écart, `shots-diff` (seul l'écran Plan change si décision 1), `perf.js`.

---

## Vague 3 : interface

Tâches 11, 12 et 13 confiées à un seul sous-agent, dans l'ordre (mêmes fichiers). Chaque correctif : capture avant / après aux 4 tailles, envoyée à Gaëtan à la fin de la vague.

### Tâche 11 : accueil, une semaine qui se lit

**Fichiers :** modifier `js/app.js` (`weekDots`, `goalStrip`), `js/ui.js`, `js/charts.js` (`sparkline`), `css/app.css` ; créer ou compléter `tests/ui.test.mjs`.

**Produit :** `dayLetter(ms) → 'L' | 'M' | 'J' | 'V' | 'S' | 'D'` (lundi L, mardi M, mercredi M, jeudi J, vendredi V, samedi S, dimanche D, jour local).

- [ ] Test rouge : `dayLetter` sur une semaine complète du lundi 16/11/2026 au dimanche 22/11/2026 rend `L M M J V S D`.
- [ ] Encart « Série » : sous chaque case, sa lettre (13 px, `--ink2`) ; le jour courant : lettre en `--ink` et case cerclée ; sous-titre « Cette semaine » ; légende au survol de l'encart (« plein : entraîné · sombre : partie sans entraînement »). Les cases gardent leurs `title`.
- [ ] Mini-courbe des 30 jours de la couleur du chiffre (`--bad` si l'Elo baisse, `--good` s'il monte).
- [ ] Vérifier : accueil sans défilement aux 4 tailles, audit sans écart, `shots-diff` : seuls les écrans d'accueil ordinateur changent.

### Tâche 12 : relecture sur téléphone, commentaire entier

**Fichiers :** modifier `css/app.css` (et `js/app.js` si la cause y est) ; modifier `tests/audit-ui.js`.

- [ ] Ajouter à l'audit une mesure « texte coupé » : élément visible à `overflow: hidden` dont `scrollHeight` dépasse `clientHeight` de plus de 2 px et qui contient du texte ; lancer : la relecture en 390 × 664 doit être signalée (test rouge).
- [ ] Trouver la cause (`superpowers:systematic-debugging`) et corriger : le commentaire tient entier, ou défile seul dans son bandeau ; l'échiquier ne rétrécit pas sous 273 px.
- [ ] Vérifier : plus aucun texte coupé sur aucun écran, audit sans écart.

### Tâche 13 : puzzle et liste des parties sur téléphone

**Fichiers :** modifier `css/app.css`, `js/app.js` (`viewPuzzles`, `partiesSummary`).

- [ ] Puzzle : la ligne de contexte garde un interligne normal ; « Ouvrir la partie » devient un lien seul sur sa ligne (cible de 44 px sans agrandir la ligne de texte).
- [ ] Parties : synthèse en 2 colonnes sans case vide ; « V · N · D » sur une ligne ; le paragraphe d'aide devient une icône d'information de `ico()` (à dessiner si absente), avec info-bulle `data-tip` et libellé pour lecteur d'écran.
- [ ] Vérifier : audit sans écart, captures avant / après.

### Tâche 14 : revue écran par écran (lecture seule, puis correctifs validés)

**Fichiers :** aucun d'abord ; ensuite selon la liste validée.

- [ ] Avec `frontend-design` et `hallmark` (cités dans `CLAUDE.md`), dans les règles de `docs/REFONTE.md` : parcourir les 33 écrans aux 4 tailles et rendre au plus 10 défauts concrets (hiérarchie, alignement, composant incohérent, libellé flou, information en double), chacun avec capture, cause et correctif proposé. Pas de nouvelle fonctionnalité.
- [ ] L'orchestrateur présente la liste à Gaëtan ; un sous-agent applique les correctifs retenus, avec audit sans écart et captures avant / après.

---

## Vague 4 : dépôt (tâches 15 et 16 en parallèle, puis 17)

### Tâche 15 : un module par écran (si décision 2 validée)

**Fichiers :** créer `js/state.js`, `js/views/*.js` ; modifier `js/app.js`, `CLAUDE.md` / `docs/ARCHITECTURE.md`.

**Produit :** `state.js` exporte `S`, `render`, `bgRender`, `touch`, `memo`, `goal`, `games`, `rapidAll`, `targetTc`, `route` ; chaque vue (`accueil.js`, `bilan.js`, `partie.js` pour la relecture `gv*`, `puzzles.js`, `ouvertures.js`, `cours.js`, `jeu.js` pour `botGame` / Gagner / Jouer / Finales / Rush, `entrainer.js`, `reglages.js` pour Plan et réglages, `plan.js` étant déjà pris par les intentions) exporte son `view`, son `mount` et ses actions ; `app.js` garde l'initialisation, la navigation, les gestionnaires globaux et la table des routes.

- [ ] Pilote : extraire `state.js` et la relecture (`views/partie.js`) seulement ; vérifier tests, parcours, audit sans écart, `shots-diff` : aucun écran différent. Point d'arrêt : rapport à l'orchestrateur.
- [ ] Puis les autres écrans, un par commit, même vérification à chaque fois. Déplacement pur : aucune ligne de logique modifiée.
- [ ] `tests/preload.test.mjs` (tâche 5) mis à jour par l'ajout des nouveaux `modulepreload`.

### Tâche 16 : tests automatiques à chaque push

**Fichiers :** créer `.github/workflows/tests.yml`.

- [ ] Sur `push` et `pull_request` : `node --test tests/*.test.mjs` et `node --check` de chaque `js/*.js` (Node 22, sans installation). Les tests navigateur restent locaux (Playwright et Chromium absents du dépôt).
- [ ] Si l'app GitHub refuse de pousser un fichier de workflow, donner le fichier à Gaëtan avec la marche à suivre (création par l'interface web de GitHub).

### Tâche 17 : documentation à jour

**Fichiers :** `CLAUDE.md` (ou `docs/ARCHITECTURE.md`), `docs/JOURNAL.md` (§47), `docs/REFONTE.md` (nouvelles mesures de l'audit), `README.md`.

- [ ] Décrire les nouvelles aides (`datef`, `dayLetter`, `tile`, `resChip`, `tabs`, `memo`, `ROUTES`, modules de vues), les deux bancs (`perf.js`, `shots-diff.js`) et la règle « toute vue reste sous 100 ms sur `perf.js` ».
- [ ] Journal : demande de Gaëtan citée, tableau avant / après (tailles de fichiers, temps des vues sur les vraies parties).

---

## Clôture (orchestrateur)

- [ ] `node --test tests/*.test.mjs`, `node tests/parcours.js`, `node tests/audit-ui.js` sans écart, `node tests/perf.js` dans le budget.
- [ ] `/code-review` puis `/simplify` sur toute la branche ; correctifs.
- [ ] Mesure finale sur les vraies parties (hors dépôt) ; fusion dans `main` et push ; résumé à Gaëtan avec les chiffres avant / après.

## Ordre d'exécution et sous-agents

| Vague | Tâches | En parallèle | Sous-agents |
|---|---|---|---|
| 0 | 1, 2 | oui | 2 |
| 1 | 3, 4, 5, 6 puis 7 | 4 puis 1 | 5 |
| 2 | 8, 9 puis 10 | 2 puis 1 | 3 |
| 3 | 11 à 13, puis 14 (revue, puis correctifs) | non | 3 |
| 4 | 15, 16 puis 17 | 2 puis 1 | 3 |

Chaque sous-agent reçoit : le texte de sa tâche, les contraintes globales, les points de vigilance qui le concernent, son `PORT` et son dossier de sortie. L'orchestrateur relit chaque diff, relance les vérifications de la tâche, committe, et fusionne dans `main` à la fin de chaque vague verte.
