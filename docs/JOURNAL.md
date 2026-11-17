# Journal du projet Cap 1000

Compte rendu des conversations entre Gaëtan et Claude depuis le samedi 14 novembre 2026, dans l'ordre.
Les demandes de Gaëtan sont citées telles quelles ; le reste est résumé.

## 1. Demande initiale (16:26)

> je veux avoir un app fonctionelle sur app (ou via artefact) qui me permettrait d'ingérer toutes les données de chess.com via unique ajoute de mon id. je veux que ça analyse mes points forts, mes points fiable, me donne de la data sur mes ouvertures et globalement m'aide à apprendre et devenir meilleure. je veux que cet endroit devienne idéal pour m'améliorer. j'aimerai bien qu'il y ait des cours qui utilise des vraies parties que j'ai pu faire pour m'expliquer comment ne plus les reproduire. mon onbjectif est de passer 1000 elo avant 2027. pose moi des questions pour cerner mon besoin

Réponses aux questions de cadrage :

| Question | Réponse |
|---|---|
| Cadence visée | Rapide (10 min et plus) |
| Temps disponible | Plus de 5 h par semaine |
| Formats voulus | Puzzles sur ses erreurs, cours expliqués, répertoire d'ouvertures, plan hebdo et suivi |
| Appareil | Téléphone et ordinateur à parts égales |

## 2. Choix de l'hébergement (16:31)

Constat : un artefact Claude ne peut pas appeler l'API Chess.com. Deux options présentées : site web hébergé (import par pseudo seul, cours par règles) ou artefact (import manuel de fichiers, cours par Claude).

> pseudo gaetcc. github gaetgalc. solutino hébergeur

Décision : site statique sur GitHub Pages, tout dans le navigateur.

## 3. Première version

Construite et testée sur 70 parties simulées (ordinateur et mobile) :
import par pseudo avec cache, analyse Stockfish dans le navigateur, classement des erreurs en 10 thèmes, accueil avec objectif et projection, puzzles à répétition espacée, 14 cours, ouvertures avec explorateur, relecture de partie, plan hebdomadaire.

Limite : l'API Chess.com est inaccessible depuis l'environnement de Claude, donc aucun test sur les vraies parties.

## 4. Mise en ligne (16:49 à 17:01)

> comment faire sans cli ?

Procédure par glisser-déposer sur github.com fournie.

> le github est connecté

Compte lié, mais Claude ne peut pas créer de dépôt.

> tu l'es déjà + j'ai créé le repo

L'app Claude était autorisée mais pas installée sur le dépôt : push refusé. Après installation de l'app sur `gaetgalc/cap-1000` (« done »), le code a été poussé.

> comment faire pour que ça soit dans tes accès

Réponse : impossible, l'accès de Claude se limite au code du dépôt ; l'activation de Pages est un réglage à faire une fois à la main. Gaëtan l'a activée (« done »). Depuis, chaque push redéploie le site.

## 5. Interface et coup réellement joué (17:03)

> rend l'ui comme chess.com. + laisse moi la possibilité en un clic de voir ce que j'ai fais dans la vraie partie.

Fait : thème sombre, échiquier vert et crème, menu latéral sur ordinateur, onglets en bas sur mobile. Inspiré de Chess.com sans reprendre leur logo, leurs pièces ni leurs éléments graphiques.
Dans les puzzles : bouton « Voir ce que j'ai joué en partie » (coup réel en flèche rouge, puis réponse réelle de l'adversaire) et lien « Ouvrir la partie à ce coup ».

## 6. Page de statistiques (17:06)

> ajoute un endroit avec plein de data depuis le début du jeu

Fait : onglet « Stats » couvrant toutes les parties depuis la première (totaux, par cadence, courbes, activité par mois et par année, records, fins de partie, jour et heure, niveau de l'adversaire, longueur des parties, répartition des coups).

## 7. Refonte et cours par Claude (17:11)

> applique les insights de chess.com en terme d'ui, de ce qui est poussé etc pour rendre l'interaction attractive + rend le site le plus apte à répondre à mes attentes. je dois arriver sur le site et comprendre immédiatement ce que je dois faire. je suis pas satisafait de l'ui, rend le truc mieux. Globalement, j'aimerais que les cours soient généré par claude, comme un cours privé donné par un professionnel, avec la pédagogie

Fait :
- Accueil « Ta séance du jour » en trois étapes (puzzles, cours, 2 parties), un seul bouton principal, compteur de série.
- Cours privés par Claude : diagnostic, idée centrale, positions du joueur avec question guidée puis coup à jouer, indice, explication, règle, routine, quiz, questions libres au coach.
- Claude ne reçoit que des faits vérifiés par le moteur, avec consigne de ne rien inventer.
- Relecture de partie : annotations `??`, `?`, `?!`, bilan chiffré, bouton « Erreur suivante », bulles de coach.

Point resté ouvert : Gaëtan n'a pas précisé ce qui lui déplaît dans l'interface.

## 8. Abonnement et journal (17:21)

> Pas possible de gérer ça via l'abonnement à 20€ que jai ?
> Ensuite log toute notre discussion dans un projet dans dédié à ce repo

Réponse : l'abonnement Pro n'inclut pas l'API, facturée à part. Ajout d'une voie sans clé : dans chaque cours, « Copier le brief du cours », à coller dans une conversation Claude, puis coller la réponse dans le site, qui la transforme en cours interactif. La clé API reste possible pour la génération en un clic et pour les questions libres au coach.

Ce journal et `CLAUDE.md` ont été ajoutés au dépôt pour servir de mémoire du projet.

## 9. Accès sur téléphone (17:26 à 17:33)

> Comment accéder au site sur tel ?
> Je vois pas le bouton partager sur safari

Lien donné, ajout à l'écran d'accueil expliqué (bouton Partager parfois sous « ⋯ » selon la version d'iOS).

## 10. Refonte mobile et pédagogie (19:25, redemandé à 22:15)

> Reprend totalement l'ui sur téléphone, c'est pas assez bon. Rapproche toi de l'app chess.com
> Je veux dans les puzzles pouvoir suivre les meilleurs coups ensuite (l'enchaînement logique qui explique cela) ainsi qu'une explication de pourquoi ce coup est mieux qu'un autre avec l'idée derrière
> Globalement c'est pas assez pédagogique il faut que ça le soit plus. Applique toi vraiment que cette tâche

Fait :
- Téléphone : 5 onglets (Séance, Puzzles, Cours, Parties, Plus), barre du haut avec Elo et série, écrans de travail plein cadre avec bouton retour, échiquier bord à bord, bandeau de commentaire sous l'échiquier, barre d'actions fixe en bas, tuiles d'accès rapide sur l'accueil.
- Puzzles : le coach décrit d'abord le dernier coup adverse ; indices en deux niveaux (question d'orientation, puis pièce à jouer) ; après la solution, « La bonne suite » et « Ton coup » se déroulent coup par coup, chaque coup expliqué en clair avec le bilan matériel ; carte « L'idée derrière le coup », carte « Pourquoi pas ton coup » avec comparaison chiffrée, règle à retenir.
- Même explication accessible depuis les cours (« Travailler cette position ») et la relecture de partie (« Comprendre cette erreur »), où chaque coup de la partie est désormais commenté.
- Nouveau module `js/explain.js`, sans IA : tout est déduit des règles et des suites du moteur.

## 11. Demande de copie exacte de Chess.com (22:33)

> reverse engineer l'ui de chess com je veux exactement la meme

Refusé : pas de reproduction à l'identique du design de leur produit. L'app garde sa propre identité ; les améliorations se font écran par écran sur retour précis.

## 12. Pédagogie et ambition (22:38 à 22:41)

> réfléchis. comment etre plus pedagogue et faire une app qui pisse être utilisé par des millions de personne
> go. soit exhaustif et itère jusqua etre fier

Analyse rendue : expliquer une erreur ne suffit pas, il faut un seul chantier à la fois, entraîner le geste de vérification, mesurer la baisse réelle des erreurs, faire prédire avant d'expliquer. Pour l'échelle : première minute plus rapide, import Lichess, langues, comptes, coût du coach, licences GPL.

Fait :
- Chantier du moment : un type d'erreur, sa règle, taux avant et depuis, objectif (divisé par deux), validation sur 5 parties, passage au suivant.
- Séance du jour en 4 étapes, alignée sur le chantier.
- Échauffements : « Ce coup est-il sûr ? », « Que menace ce coup ? », « Trouve le cadeau », « Compte les coups forçants ». Séries de 10 positions tirées de ses parties, réponse établie par les règles, score et historique.
- Tableau « Tes erreurs graves par partie » : avant, maintenant, tendance.
- Dans les suites commentées : l'élève joue lui-même la punition de son coup et ses coups de la bonne suite.
- Premier aperçu de l'accueil dès 3 parties analysées.

## 13. Puzzles Lichess (22:50)

> importe lichess ?

Précision demandée, réponse : « Des puzzles inédits ». Fait : onglet « Positions inédites » dans Puzzles, alimenté par l'API publique de Lichess (base dans le domaine public), sans compte. Choix du thème (par défaut celui du chantier) et du niveau, solution à jouer coup par coup, puis solution commentée et idée. Bouton d'accès depuis la carte du chantier. Non testé contre la vraie API (bloquée depuis l'environnement de Claude).

## 14. Audit du projet (22:56)

> "Read this entire project and find everything that's broken, inconsistent, inefficient, or no longer needed. Fix what you're sure about and list the rest for me to review."

Corrigé : rendus d'arrière-plan qui interrompaient un exercice en cours, échec de mise à jour silencieux, vérification d'un coup qui aboutissait après avoir quitté l'écran, analyses illisibles comptées dans les statistiques, chantier épuisé affichant « tout est à jour », étape puzzles impossible à valider sans puzzle dû, touches hors pièce comptées comme réponses dans les échauffements, puzzle Lichess désynchronisé après un nouveau rendu, clé de semaine en UTC, plan non aligné sur le chantier, chiffre non sourcé (« 100 Elo »), collision d'attributs `data-ex`, file d'attente du moteur sans priorité, code mort, README périmé, fichier LICENSE manquant. Points laissés à l'arbitrage listés dans `CLAUDE.md` (points ouverts).

## 15. Plus de défilement sur les écrans d'échiquier (15/11)

> fais en sorte que je n'ai pas à scroller sur ordi et sur tel

Fait : puzzles, erreurs, positions inédites, échauffements, positions de cours et relecture de partie tiennent dans la fenêtre. Ordi : échiquier calé sur la hauteur de l'écran à gauche (610 px sur 1366×768, 820 px sur grand écran), commentaire dessous, consigne, explications et boutons à droite ; les explications longues défilent dans leur panneau. Téléphone : échiquier quasi pleine largeur, consigne dans le bandeau sous l'échiquier, panneau d'explications court qui défile seul, boutons fixes en bas. Vérifié sur 5 tailles d'écran (parties simulées). Les pages de tableau de bord (Séance, Stats, Parties) défilent toujours.

## 16. Simplicité d'usage : historique, animation, points de déplacement (15/11)

> réfléchis à tout ce qui pourrait m'aider à ce que l'app soit plus user friendly. par exemple, il n'y a pas d'historique quand je fais le puzzle. je viens d'en faire 8, j'ai quitté la page et ça a oublié que j'avais tout fait. résultat je suis frustré.
> Pareil après un bon coup j'aimerai avoir une animation qui me montre l'enchainement logique des coups ensuite pour comprendre l'idée d'un échange ou d'une prise. globalement je veux rendre le plus simple possible l'utilisation, qui n'est pas encore idéal. je veux aussi des petits points pour montrer les cases potentiels d'une pièce

Causes trouvées de l'impression d'oubli : un puzzle raté (un seul mauvais essai ou un indice suffisait) était reprogrammé 5 minutes plus tard et repassait en tête de file ; aucun écran ne listait ce qui avait été fait ; le compteur « maîtrisés » restait à 0 tant qu'un puzzle n'avait pas été réussi trois fois à plusieurs jours d'écart ; le puzzle en cours, l'étape d'un cours et un échauffement entamé étaient perdus au rechargement ; les puzzles faits depuis un cours ou depuis « Comprendre cette erreur » n'étaient pas comptés. Cause précise chez Gaëtan non confirmée (pas de capture).

Fait :
- Journal d'entraînement : chaque puzzle, position inédite et échauffement terminé est enregistré tout de suite avec son résultat (du premier coup, trouvé avec aide, solution vue). Nouvel onglet « Historique » dans Puzzles, par jour, avec « Refaire ».
- Avancée du jour visible partout : pastilles colorées et « 3 / 8 » pendant les puzzles, sur l'accueil et dans le bilan.
- Un puzzle fait aujourd'hui ne revient plus aujourd'hui : raté, il revient demain ; réussi, après 1, 3, 7, 21 puis 60 jours. Un seul résultat par jour compte.
- Bilan quand l'objectif du jour est atteint : résultats, bouton « Étape suivante » de la séance, « Refaire mes ratés du jour », « Continuer ». Même bouton « Étape suivante » à la fin d'un échauffement et d'un cours.
- Reprise : puzzle en cours, étape du cours, échauffement entamé et position inédite sont retrouvés après avoir quitté ou rechargé la page.
- Animation : après la solution, la bonne suite se joue toute seule (flèche qui annonce le coup, pièce qui bouge, commentaire, flèches sur ce que le coup attaque, bilan matériel), puis « Voir mon erreur » joue ce que le coup de la partie permettait. Pause, pas à pas, « Revoir », clavier (flèches, espace). Les suites ne s'arrêtent plus au milieu d'un échange, ce qui faussait le bilan matériel.
- Points sur les cases où la pièce choisie peut aller, anneau sur une pièce à prendre, roi en échec signalé en rouge.
- Mise en page : ce travail a été mené en parallèle de la section 15 (autre conversation) et fusionné dessus. La mise en page sans défilement de la section 15 sert de base ; s'y ajoutent, sur téléphone, l'avancée du jour dans la barre du haut à la place de l'en-tête, et une place réservée au commentaire de la lecture sous l'échiquier (échiquier un peu plus petit sur les fenêtres basses : 558 px au lieu de 610 sur 1366×768).
- Icônes dessinées à la place des flèches Unicode (affichées en émojis sur iPhone).
- Corrigé au passage : plantage de l'explication quand une suite finissait par un mat ; course entre « Solution » et le retour d'un mauvais coup.
- Test de bout en bout versionné : `node tests/parcours.js`.

## 17. Rangement du code et revue d'architecture (15/11)

> https://github.com/mattpocock/skills utilise ce skill pour ranger le code du projet. ensuite, réfléchis à des améliorations de structure en pronfondeur du projet

Skill retenu dans ce dépôt : `improve-codebase-architecture` (avec le vocabulaire de `codebase-design` : module, interface, profondeur, couture, adaptateur, levier, localité). Exploration faite dans la conversation, sans sous-agent ; rapport publié comme page privée au lieu d'un fichier temporaire.

Rangé, sans changement de comportement :
- `app.js` passe de 1490 à 1300 lignes. Quatre modules en sortent : `ui.js` (aides d'affichage), `charts.js` (courbes), `board.js` (échiquier et lecture animée), `progress.js` (répétition espacée, journal, activité, objectif du jour).
- `progress.js` reçoit son stockage et son horloge : ses règles se testent sans navigateur. C'est là que vivait le défaut des puzzles qui revenaient 5 minutes après.
- Supprimés : le sac d'aides passé à la page Stats, trois copies de `fr()`, deux copies de `VAL`, deux exports inutiles. `settle` (coupe d'une suite) rejoint `explain.js`.
- 17 tests unitaires (`node --test tests/*.test.mjs`) en plus du test de bout en bout.

Revue d'architecture : six pistes d'approfondissement présentées (écran d'exercice, analyse en deux temps, plan d'entraînement, écrans autonomes, données versionnées et sauvegarde, feuille de style par composant). Recommandation : commencer par l'écran d'exercice. Aucune n'est engagée : le choix revient à Gaëtan.

## 18. Pistes 1 et 2 de la revue d'architecture (15/11)

> go, puis 1 et 2.

Le rangement de la section 17 est publié dans `main`. Puis les deux pistes notées « Fort » :

**Piste 2, analyse en deux temps.** `engine.evaluateGame` ne produit plus que les données brutes (évaluation, meilleur coup, début de suite pour chaque position) ; `classify.js` en déduit erreurs, thèmes et précision, sans moteur. Chaque analyse garde ses données brutes et la version des règles : changer un seuil ou un thème ne demande plus de relancer Stockfish, les parties sont reclassées à l'ouverture du site. Les analyses déjà faites n'avaient pas ces données : elles sont réévaluées une fois, en arrière-plan, l'ancienne restant en place en attendant. Vérifié : résultats identiques à l'ancien code sur 20 parties simulées.

**Piste 1, écran d'exercice.** Nouveau module `exercise.js` : les six écrans à échiquier (puzzle, erreur précise, position inédite, échauffement, position de cours, relecture) lui confient la structure sans défilement, le bandeau, la barre d'actions, les actions des boutons et la lecture des suites. Disparaissent : le déplacement du DOM après le rendu (`fitLayout`), quatre poignées de l'état global (`S.solve`, `S.liapi`, `S.drcg`, `S.exui`), sept branches du gestionnaire de clics, le second lecteur de suites (celui des positions inédites). Aucun changement visible, sauf un détail : sur une position inédite, « Lecture » devient le bouton principal quand la lecture est en pause, comme sur les puzzles. Mesures de mise en page identiques sur les quatre tailles d'écran.

Méthode : le skill prévoit un interrogatoire avant d'écrire le code. Les décisions étant techniques, elles ont été prises sans le faire ; deux choix de produit restent ouverts (voir points ouverts de `CLAUDE.md`).

Tests : 23 tests unitaires, test de bout en bout à 16 vérifications (dont reclassement sans moteur et réévaluation des anciennes analyses).

## 19. Idées reprises d'autres dépôts (15/11)

> j'aimerai que tu réfléchisses à des repos github qui font ce que je fais avec chess.com et qu'on puisses s'inspirer de leurs bonnes idées pour les intégrer au repo

Une trentaine de dépôts passés en revue (chess-academy, personalized-chess-trainer, chess-blunder-trainer, botvinnik, better_tactics, patzer, woodpecker…). Six idées proposées, par ordre de rentabilité.

> fais les 6

1. **Sauvegarde et restauration** (botvinnik). Un fichier JSON avec parties, analyses, cours, répétition espacée, journal, activité, chantier ; jamais la clé du coach. Dans Plan et réglages et dans Plus. La restauration montre le contenu du fichier avant de remplacer quoi que ce soit.
2. **Erreurs selon la pendule** (chess-academy). Part des coups qui sont des erreurs graves selon le temps restant et le temps pris, à partir du 9e coup. Carte sur la page Stats, chiffres dans le cours « Gérer ta pendule », deux signaux possibles dans les points faibles. L'incrément est maintenant lu à l'import ; pour les parties déjà importées, il est déduit de la pendule.
3. **Erreurs qui reviennent** (chess-academy, blunder-trainer). Même position, faute commise dans au moins deux parties : bloc en tête de la page Ouvertures, avec le bouton « Travailler », et signal dans les points faibles à partir de 3 fois.
4. **Coups qui tiennent** (personalized-chess-trainer). Sur chaque position d'erreur, le moteur cherche aussi les deuxième et troisième meilleurs coups. La consigne du puzzle dit s'il y a un seul bon coup ou plusieurs. Les erreurs sans motif tactique (ouverture, plan, finale) où au moins 3 coups tenaient ne sont plus des puzzles. Règles de classement en version 2 ; les analyses existantes sont complétées une fois en arrière-plan, sur les seules positions d'erreur.
5. **Gagner les parties gagnées** (botvinnik, Lichess). Nouvelle page `#gagner` : les parties où tu as eu au moins +5 sans gagner, reprises au premier moment gagnant et jouées jusqu'au mat contre un moteur bridé. Indice possible, abandon, reprise après rechargement, résultat au journal. Accès : Échauffements, Plus, cours « Gagner les parties gagnantes ».
6. **Ton avis sur le puzzle** (better_tactics). Après une réussite du premier coup : Facile, Normal ou Difficile, avec le délai de retour affiché sur chaque bouton. Un palier de plus ou de moins, jamais de retour le jour même.

Écarté : synchronisation par phrase secrète (il faudrait un serveur), coach en conversation libre (existe déjà), multi-utilisateur.

Tests : 31 tests unitaires (8 nouveaux), test de bout en bout à 27 vérifications (11 nouvelles : avis, partie rejouée et reprise, pendule, sauvegarde et restauration, complément des anciennes analyses). Captures en 390 × 664 et 1366 × 768 : pas de défilement sur les écrans d'échiquier.

## 20. Meilleur coup dans la relecture (15/11)

Demande : dans l'onglet Parties, voir le meilleur coup sur l'échiquier par défaut. Fait : à chaque position de la relecture, flèche verte du coup du moteur (`a.best[k]`, déjà calculé à l'analyse, sans nouveau calcul) et « meilleur coup X » sur la ligne du coup, avec « (joué) » s'il a été joué en partie. Aux moments clés, flèches rouge (coup joué) et verte inchangées. Rien sur une partie non analysée. Test de bout en bout : 3 vérifications de plus. Captures aux 4 tailles : pas de défilement.

Puis, à la demande, couleurs plus vives : flèches de tous les échiquiers (vert #2bd46a, rouge #f0443c, bleu, orange) au lieu des teintes sombres de chessground, opacité 85 % au lieu de 60 %, ombre légère pour le contraste sur les cases claires ; « Meilleur Cf3 » en pastille verte sur la ligne du coup.

Puis : coup joué depuis la position en flèche rouge (sous la verte), seulement s'il diffère du meilleur, avec une pastille rouge « Joué h4 ». Couleurs du site ravivées dans `:root` (accent, bouton principal, vert, orange, rouge, cases de l'échiquier) ; ombre du bouton principal en jeton `--btn-edge`.

## 21. Apprendre les ouvertures (15/11)

> dans l'onglet ouverture je veux pouvoir apprendre, travailler les ouvertures pour ma culture G (utilisation dans le temps, etc..) et par les principales lignes à savoir

Fait : onglet « Apprendre » dans Ouvertures (l'ancien contenu devient « Mes ouvertures »).
- 10 ouvertures (italienne, espagnole, écossaise, Londres ; sicilienne, française, Caro-Kann, scandinave ; gambit Dame, est-indienne), 29 lignes. Ton répertoire conseillé (italienne, gambit Dame) est marqué.
- Fiche : position de départ, plan des deux camps, lignes à connaître avec leur état, « Histoire et utilisation dans le temps », pièges à connaître, et « Dans tes parties » (nombre, score par couleur, première et dernière fois, courbe par trimestre).
- « Utilisation dans le temps » compris des deux façons : l'histoire de l'ouverture au fil des siècles, et ton propre usage au fil des trimestres.
- Ligne : « Découvrir » la joue toute seule, commentée ; « M'entraîner » te la fait réciter de mémoire, les coups adverses viennent seuls, une faute montre le bon coup. Révision espacée comme les puzzles.

Non vérifié : les faits historiques sont écrits de mémoire, sans source consultée ; à relire.

## 22. Les 5 ouvertures les plus jouées (15/11)

> tu peux ajouter les 5 ouvertures que j'ai le plus fait en dehors de celle déjà là ?

L'environnement cloud bloquait `api.chess.com` : création, avec accord, d'un environnement personnel « cap-1000 » qui l'autorise. Relevé sur 6 096 parties (4 548 rapides), hors des 10 ouvertures déjà présentes : 2.Dh5 (385 parties), gambit Englund (346), partie du fou (290), Petrov (163), Philidor (118, surtout face à elle avec les Blancs). « Queen's Pawn Opening » (211) écartée : ce n'est qu'une étiquette pour un 1.d4 sans suite reconnue.

Fait : 5 fiches de plus (histoire, idées, pièges, 15 lignes), lignes choisies d'après les suites réellement jouées (par exemple la version 2…Fc5 de l'Englund, 3.Fc4 contre la Petrov et la Philidor, le mat de Légal). Les chiffres personnels ne sont pas écrits dans les fiches (dépôt public, site partageable) : chaque fiche montre à la place « Tes suites les plus fréquentes », calculé sur les parties de la personne qui consulte.

## 23. Ouvertures plus claires (15/11)

> réorganise pour que ça soit bien plus claire. les zones sont trop grosses

Catalogue : les grandes cartes deviennent une liste serrée (nom, code ECO, nombre de tes parties, lignes apprises et petite barre de progression), filtrée par couleur (Blancs, Noirs contre 1.e4, Noirs contre 1.d4) ; ton répertoire puis tes ouvertures les plus jouées en tête. La bulle du coach devient une phrase ; la révision du jour, une bande d'une ligne.
Fiche : en-tête compact (petite position, coups, résumé, étiquettes), puis des onglets Lignes, Plans, Histoire, Pièges, Tes parties : un seul bloc à la fois, les lignes d'abord. Chaque ligne tient sur une rangée (coups abrégés, boutons « Voir » et « Jouer »).

## 24. Accueil épuré (15/11)

> réfléchis à une homepage pour le site, épuré et utile — puis « go »

Avant : 9 blocs empilés (salutation, séance en 4 étapes à boutons, chantier avec courbe, tuiles, objectif détaillé, courbe Elo, points forts et faibles, tendance, bilan), environ 4 écrans de défilement sur téléphone.

Fait : l'accueil répond à trois questions, quoi faire maintenant, est-ce que ça marche, que s'est-il passé dans ma dernière partie.
- Objectif sur une ligne : Elo, barre jusqu'à l'objectif, points manquants, jours restants, rythme nécessaire, évolution sur 30 jours (si non nulle), série sur ordinateur (déjà dans la barre du haut sur téléphone).
- Séance : barre de 4 étapes cliquables, l'étape en cours avec un seul bouton vert. Séance finie : « Refaire mes ratés du jour » et lignes d'ouverture à réviser, s'il y en a.
- Chantier : thème, règle, avant → maintenant, objectif ; « Détail » vers Mon jeu.
- Nouveau : dernière partie de la cadence suivie, avec sa pire faute (coup joué, coup juste, thème, perte) et deux boutons vers la relecture à ce coup et vers l'exercice `#erreur`.
- Liens rapides : Puzzles (nombre à faire), Lignes à réviser (ou Ouvertures), Parties, Échauffements, Mon jeu.

Le reste part dans un nouveau sous-onglet « Mon jeu » (`#bilan`) : objectif détaillé, courbe du classement, chantier complet avec sa courbe et son sélecteur, points forts et faibles, tendance par thème, bilan. Le Plan perd l'objectif détaillé (doublon). Salutation supprimée.

Captures 390 × 664 : séance et chantier visibles sans défiler, la dernière partie juste en dessous. Ordinateur 1366 × 768 : l'accueil tient sur l'écran.

## 25. Refonte de l'interface, étape 1 : état des lieux (15/11)

> https://github.com/leonxlnx/taste-skill fais un plan pour reprendre le site avec ce skill, tout en pensant à l'ux et la facilité d'utilisation et à la logique

Plan proposé : garder du skill le système (jetons, typographie, contraste, un bouton plein, mouvement court), laisser sa partie site vitrine (héro, photos, effets), et revoir la navigation (5 entrées au lieu de 3 niveaux). Choix de Gaëtan : bouton principal en relief gardé, polices laissées au skill, maquette d'abord. Maquette (Aujourd'hui et Puzzle, téléphone et ordinateur) validée avec Geist.

Fait : `tests/fixture.js` (parties simulées communes, sorties de `parcours.js`), `tests/audit-ui.js` (22 écrans, 4 tailles, captures et mesures), `docs/REFONTE.md` (décisions, écarts, étapes). Principaux écarts : 21 tailles de texte, 14 arrondis, texte jusqu'à 10 px, libellé du bouton principal à 3.16:1, jusqu'à 8 boutons pleins sur un écran, la plupart des boutons sous 44 px. Aucun écran d'échiquier ne défile.

Non fait : le script de contrôle du skill (`gate.mjs`) et son tirage de polices (`start.mjs`) n'ont pas pu être lancés dans l'environnement de Claude ; la table de polices a été lue directement.

## 25. Accueil sans défilement, Coach en menu déroulant (16/11)

> je veux que les 3 toggle en haut aille dans le menu déroulant à gauche. je veux une homepage non scrollable avec les principales infos à avoir de manière épurée et claire

Fait :
- Les sous-onglets Séance du jour / Mon jeu / Plan et réglages disparaissent du haut des pages. Sur ordinateur, ils s'ouvrent au survol de « Coach » dans la colonne de gauche, comme le volet « Leçons ». Sur téléphone, « Coach » mène à l'accueil ; Mon jeu et Plan et réglages sont en tête de « Plus ».
- Accueil sans défilement à toutes les tailles : objectif sur une ligne, séance, chantier, dernière partie. Liens rapides supprimés (la navigation les porte déjà).
- Ordinateur : deux colonnes centrées en hauteur. À gauche la séance, avec sous le bouton le programme des 4 étapes et leur état ; à droite le chantier (clic : Mon jeu) et la dernière partie.
- Téléphone : titres de carte retirés pour tenir en 390 × 664 (« Chantier : … » en une ligne, « Voir mon coup » au lieu de « Voir ce que j'ai joué »). Contenu fini 28 px au-dessus de la barre du bas.

Écart avec `docs/REFONTE.md` (plan du 15/11 d'une autre session) : il prévoyait « pas de volet au survol ». La demande de Gaëtan du 16/11 prime ; à reprendre à l'étape 3 de la refonte (navigation).

## 26. Refonte de l'interface, étapes 2 à 8 (16/11)

> lance tout

Fait (détail dans `docs/REFONTE.md`) : polices Geist et Geist Mono, toutes les valeurs visuelles dans `:root` (6 tailles de texte au lieu de 21, 2 rayons au lieu de 14), bouton principal lisible avec son relief, navigation à 5 entrées (Aujourd'hui, S'entraîner, Apprendre, Parties, Progrès) avec une page S'entraîner nouvelle, un seul bouton plein par écran, cibles de 44 px sur téléphone, survol réservé à la souris, colonne réduite aux icônes pendant un exercice.

Conciliation avec la session parallèle du 16/11 (§25) : son accueil sans défilement est gardé ; sa demande d'un menu déroulant à gauche à la place des onglets du haut est appliquée à « Progrès » (Mon jeu, Stats, Plan et réglages) ; sur téléphone, Mon jeu propose Stats et Plan en tête, comme le faisait « Plus ».

Vérifié : `audit-ui.js` sans écart sur 22 écrans aux 4 tailles, 34 tests unitaires, test de bout en bout complet. Non vérifié : rendu sur un vrai iPhone et sur le site en ligne.

## 27. Relecture jouable, comme sur Chess.com (16/11)

> dans les parties que j'analyse je veux pouvoir toucher les parties en direct pour pouvoir jouer les lignes que je veux. là c'est figé c'est inutile. le rendu de chess.com est utile et fluide inspire toi

Fait : l'échiquier de la relecture (`#partie`) n'est plus figé. Les deux camps se jouent (glisser ou toucher-toucher). Le coup de la partie avance simplement ; tout autre coup ouvre une variante, affichée dans le bandeau (coups cliquables), évaluée par Stockfish à chaque position avec la flèche verte du meilleur coup et le commentaire du coup joué. Un coup joué au milieu de la variante la remplace. Retour : « Revenir à la partie », Échap, ou clic sur un coup de la partie. Clic droit : flèches et cases, comme sur Chess.com.

Vérifié : 5 contrôles ajoutés au test de bout en bout, captures en 390 × 664 et 1366 × 768 sans défilement. Non fait : arbre de plusieurs variantes gardées dans la liste des coups (une seule variante à la fois).

## 28. Flèche en L pour le cavalier (16/11)

> Pour le cavalier j'ai envie d'avoir un L et pas une flèche droite pour le meilleur coup

Fait : sur tous les échiquiers (relecture, puzzles, suites commentées), une flèche de saut de cavalier est tracée en L, grande branche puis petite, avec la couleur et l'épaisseur des autres flèches. Les flèches tracées soi-même au clic droit restent droites (chessground).

## 29. Plan d'agrément : 8 lots en parallèle (16/11)

> fais un plan pour rendre le site plus agréable niveau front end. inspire toi des meilleures pratiques lichess et chess.com pour ça
> sons coupés par défaut, vert adouci, lance tous les lots en parrallèl

Plan dans `docs/PLAN-AGREMENT.md`. Cinq agents en parallèle (copies isolées du dépôt), puis fusion :

- **Échiquier** : vert adouci propre au site (`#e7ead5` / `#7b9c63`), coordonnées dans les coins (corrige le chevauchement sur l'échiquier retourné), coins arrondis et ombre, dernier coup en jaune léger, points de destination discrets, halo d'échec, poignée de redimensionnement sur ordinateur.
- **Apparence** (Plan et réglages) : 3 palettes, 3 jeux de pièces libres, coordonnées, vitesse de lecture des suites (`js/look.js`, `cap1000:look`).
- **Retour immédiat** : pastille ✓ / ✗ sur la case, pièce qui revient en glissant après un coup faux, bandeau teinté, rond de l'objectif qui rebondit, « N d'affilée » (`progress.run`).
- **Sons** synthétisés (`js/sound.js`), coupés par défaut, bouton dans la barre du haut (téléphone) ou la colonne d'icônes (ordinateur).
- **Relecture façon Game Review** : barre d'évaluation, courbe cliquable avec les fautes, symboles `??` `?` `?!` `!` sur la case, coups en 2 colonnes (ordinateur) ou en bande (téléphone), erreur précédente / suivante. Fusionnée avec la relecture jouable (§27) : la liste `#gvm` remplace l'ancienne carte « Coups » ; le clavier passe par l'écouteur global (variante comprise, plus Début / Fin).
- **Mouvement** : fondu de 150 ms entre les pages, blocs gris de chargement, barre d'avancement de l'analyse, messages éphémères (`js/toast.js`).
- **Fin de séance** : anneau qui se ferme, quatre chiffres, un seul bouton vers l'étape suivante.
- **Accueil ordinateur** calé en haut, mini-échiquier de la pire faute.

Vérifié : 49 tests unitaires, parcours complet, audit sans écart sur 23 écrans aux 4 tailles, captures relues. Non vérifié : sons à l'oreille, rendu sur iPhone, site en ligne.

## 30. Survol de tous les boutons (16/11)

> ajoute une surbrillance à tous les boutons quand je passe la souris pour améliorer la navigation

- Survol unifié en fin de `css/app.css`, à la souris seulement (`hover: hover` et `pointer: fine`) : fond `--hover` et bord `--hover-line` (jetons de `:root`) sur les boutons, onglets, entrées de navigation, lignes et cartes cliquables, coups de la relecture ; bouton plein éclairci ; liens soulignés plus épais. Transition de 150 ms.
- Bug trouvé en vérifiant : la fusion du §29 avait perdu l'accolade fermante du bloc téléphone des sons. Toutes les règles suivantes (Apparence, échiquier en multiple de 8 px) ne s'appliquaient que sur téléphone. Corrigé, et nouveau test `tests/css.test.mjs` (accolades équilibrées), rouge sur l'ancienne feuille.

## 31. Menus déroulants, icônes en couleur, idées de logo (16/11)

> quel autre ajout de ce type pourriat être utile ? ajoute aussi de la couleur aux logos . apprendre et s'entrainer doivent être le même onlget -> tout doit s'ouvrir un menu déroulant. propose moi également des idées de logo du site très simple. fais tout ça en parrallèle

- **Navigation** : Apprendre réuni dans S'entraîner, 4 entrées, chacune ouvre un menu (survol, clavier, appui sur téléphone). `PROG_MENU` supprimé. Les menus n'ont pas d'icône. Un message éphémère est masqué tant qu'un menu est ouvert.
- **Icônes** colorées par section (détail dans `docs/REFONTE.md`).
- **Logo** : 6 propositions (boussole, drapeau, escalier en damier, « 1000 », sommet en damier, viseur), planche envoyée à Gaëtan ; recommandé : sommet en damier, puis escalier. En attente de son choix, rien de changé sur le site.
- **Idées d'ajouts proposées** : raccourcis clavier dans les exercices, info-bulles sur la colonne d'icônes, pastille « reste à faire » sur la navigation, pièce soulevée au glisser, état appuyé au toucher, fil d'Ariane, mémoire du défilement des listes, recherche rapide. Recommandées : raccourcis et pastille. Non faites.

Vérifié : 50 tests unitaires, parcours (dont 4 contrôles de la navigation au téléphone), audit sans écart sur 23 écrans aux 4 tailles, captures avec menu ouvert relues. Non vu sur iPhone.

## 32. Logo « le cap », raccourcis clavier, pastilles de navigation (16/11)

> le cap. ok pour les deux ajouts

- **Logo** : proposition 1, aiguille de boussole dans un anneau vert (« garder le cap »), dans la barre (`.brand-mark`, SVG en ligne, jetons `--logo-a` / `--logo-b`) et en icône d'onglet (`index.html`).
- **Raccourcis clavier** dans tout exercice (`exercise.js`, `key`) : H indice, M mon coup, S solution ou voir la suite, Entrée le bouton plein, ? l'aide (fenêtre `dialog.keys`). Les touches d'une lecture (flèches, espace) passent avant. Les boutons concernés portent `aria-keyshortcuts` et une info-bulle « Indice (H) ».
- **Pastilles** (`navBadges`, appelée par `header()`) : nombre d'étapes de la séance restantes sur Aujourd'hui, lignes d'ouverture à réviser sur S'entraîner, couleur de la section ; dans les volets, puzzles restants pour l'objectif et lignes dues.

Vérifié : tests unitaires, parcours, audit sans écart, essai des touches et captures (ordinateur et téléphone).

## 33. Page S'entraîner refaite (16/11)

> reprends la partie vu d'ensmeble de la partie s'entainer - elle est moche et donne pas envie

Avant : 8 lignes identiques avec la même icône « lecture », sans hiérarchie ni échiquier.
Après (`viewEntrainer`, `entNext`, `mountEntrainer`) :
- **En tête, « À faire maintenant »** : la position de ton prochain puzzle (échiquier, sans flèche), la faute d'origine (adversaire, coût, thème), les 8 ronds de l'objectif et le seul bouton plein. Si les puzzles du jour sont faits : lignes d'ouverture à réviser, sinon échauffement.
- **Pratiquer** et **Apprendre** en tuiles : un dessin par activité (nouvelles icônes `tgt`, `clock`, `lines`, `flag`, `spark`, `book`, `tree`, `log` dans `ui.js`), couleur de la section, étiquette d'état quand il y a un nombre utile (« 3 parties », « 2 à réviser »). La tuile Puzzles disparaît quand la tête de page la porte déjà.
- **Historique** en simple lien en bas.

Vérifié : tests, parcours, audit sans écart, captures aux 4 tailles.

## 34. Liste des parties enrichie (16/11)

Demande : « dans mes parties, ajoute l'elo de l'adversaire et le mien à chaque fois, et toutes les stats utiles, en gardant une ligne claire et structurée ».

- `#parties` n'est plus un tableau : une ligne par partie (`partieRow`), joueurs empilés comme sur un échiquier (adversaire en haut avec son Elo et l'écart avec le tien, toi en bas avec ton Elo et la variation de la partie), résultat et manière (abandon, temps, mat…), ouverture, coups, précision (analyse du site, sinon Chess.com), fautes (?? gaffes, ? erreurs), temps restant à ta pendule, date et heure (cadence si « Toutes cadences »). Liseré vert, gris ou rouge selon le résultat.
- Synthèse de la sélection au-dessus (`partiesSummary`) : parties et bilan V/N/D, score, Elo de fin de période et variation, Elo moyen des adversaires, performance estimée (adversaire moyen + 400 × (V − D) / n), barre victoires/nulles/défaites. Suit les filtres cadence et période.
- Calculs purs dans `stats.js` : `gameFacts` (variation d'Elo depuis la dernière partie classée de la même cadence, écart, pendule) et `listSummary`, testés dans `tests/stats.test.mjs`.
- Téléphone : joueurs et résultat sur la première ligne, ouverture et date, puis chiffres sans libellés (légende en tête de liste, libellés lus par les lecteurs d'écran). Ordinateur : colonnes avec en-tête.

## 35. Détail d'une ouverture jouée (16/11)

Demande : dans « Mes ouvertures », cliquer sur une ouverture pour la détailler (usage dans le temps, stats, lignes jouées). Le tableau n'était pas cliquable.

- Chaque ligne du tableau ouvre `#monouv/<w|b>/<famille>` (`viewMonOuv`, `mountMonOuv`).
- Contenu : échiquier sur le tronc commun à toutes les parties, score et barre victoires/nulles/défaites, verdict ; « En chiffres » (part des parties de la couleur, première et dernière fois, classement moyen des adversaires, évaluation après 10 coups, précision, fautes avant le 12e coup) ; courbe « Dans le temps » (par semaine, mois ou trimestre selon la durée, survol : score et part des parties) ; suites jouées au moins deux fois, chacune ouvre l'explorateur sur ses coups ; variantes ; dernières fautes de l'ouverture avec « Rejouer » ; 6 dernières parties ; lien vers la fiche du catalogue quand l'ouverture y figure.
- Calcul pur dans `stats.famDetail`, testé dans `tests/stats.test.mjs` ; parcours et audit (écran `mon-ouverture`) étendus.

## 36. Un vrai coach privé : les 5 idées du tier 1 (16/11)

> comment faire pour que le site agisse vraiment comme un coach privé ? […] j'aimerai qu'il me dise que l'idée d'un coup ici est d'attaquer ci ou ça par la suite, de garder bloquer une de ses pièces etc.

20 idées proposées et classées ; Gaëtan a demandé les 5 premières (« fais toutes les t1 »).

1. **Mot du coach sur l'accueil** (`brief.js`, `briefCard`) : à la place du chantier en 3 lignes, un diagnostic chiffré sur les 10 dernières parties (défaites liées au chantier, coup moyen, pendule sous 2 min), la consigne du jour (ordinateur) et l'objectif chiffré. La cause que l'élève donne à ses erreurs (point 5) remplace la règle du chantier dans la consigne.
2. **Intention des coups** (`plan.js`, `geom.js`) : sur un coup calme, ce qu'il prépare (le coup suivant de la suite devient jouable, avec sa cible), la pièce adverse qu'il enferme, le pion passé qu'il bloque, l'avant-poste, la colonne ouverte ou semi-ouverte, les cases visées autour du roi, la rupture de pions, le gain d'activité. Dit dans chaque coup des suites commentées, dans « L'idée derrière… » (fini la phrase passe-partout « améliore ta position sans rien donner »), dans la relecture (coup joué, lu dans la suite réelle de la partie ; idée du meilleur coup sur ordinateur). Géométrie commune sortie d'`explain.js` dans `geom.js`.
3. **Demande au coach** (`coach.positionPrompt`, `askPosition`, `positionText`) : sur le panneau d'explication et dans la relecture (bouton « Coach » du bandeau), Claude commente la position comme un entraîneur (plan, cible, pièce gênée, règle), à partir de faits vérifiés seulement : pièces, coup joué, suite du moteur, intention calculée, repères (`plan.features` : pions passés, colonnes ouvertes, pièces sans case). Sans clé API, la question est copiée pour une conversation Claude.
4. **Débrief raconté** (`debrief.js`, `gvDb`) : 5 moments au plus, dans l'ordre (sortie de l'ouverture, tournant donné par l'adversaire et ta réponse, occasion manquée, faute décisive, fin). Bouton « Débrief » dans la relecture, lien sur la dernière partie de l'accueil (ordinateur), adresse `#partie/<end_time>/d`. Le coach parle dans le bandeau, l'échiquier suit, barre « Moment suivant / Quitter ».
5. **Pourquoi tu t'es trompé** (`progress.recordCause`, `causes`, clé `why`) : après un puzzle tiré de tes parties, 4 réponses (pas vu sa menace, mal calculé, trop vite, autre idée). Une cause dominante (3 réponses, 40 %) change la consigne du brief et l'échauffement du jour (`CAUSES[c].drill` : menace, compte). Carte « Pourquoi tu te trompes » dans Mon jeu.

Vérifié : 75 tests unitaires (nouveaux : `plan`, `brief`, `debrief`, `coach`, causes dans `progress`), parcours de bout en bout (étapes coach, cause, débrief ajoutées), audit sans écart sur 24 écrans (nouvel écran `partie-debrief`), captures en 390 × 664 et 1366 × 768 avec une API Claude simulée.

## 37. Coach privé, tier 2 : suivi dans la durée (16/11)

> fais toutes les t2

6. **Idées de plan** (`#idees`, `ideas.js`) : sur une position calme de tes parties (imprécision ou erreur de plan après le 8e coup, position pas encore décidée), choisir la bonne idée parmi trois, rédigées comme des plans (« Installer ton cavalier en d5… »). La bonne : l'intention du meilleur coup ; les autres : ton coup en partie et un coup plausible, que Stockfish doit confirmer moins bon d'au moins 0,5 (sinon il est retiré). Journal `k: 'i'` (`progress.recordIdea`). Tuile dans S'entraîner.
7. **Programme de 4 semaines** (`program.js`) : Comprendre, Automatiser, Appliquer, Vérifier, semaines du lundi au dimanche depuis le début du chantier. Carte « Ton programme » dans Mon jeu avec le bilan de la semaine passée (parties, taux d'erreur du chantier contre la semaine d'avant, puzzles, échauffements). Le lundi, ce bilan remplace le diagnostic du mot du coach ; la semaine en cours s'ajoute à sa consigne (ordinateur).
8. **Portrait** (`portrait.js`) : phase où tu perds tes points, pendule, menaces subies ou occasions ratées, camp, parties gagnantes laissées filer. Carte « Ton portrait » en tête de Mon jeu (5 parties analysées au moins).
9. **Plan de l'ouverture jouée** (`theory.planOf`) : ajouté au moment « Sortie de l'ouverture » du débrief, d'après les idées de la fiche du catalogue pour ton camp.
10. **Sortie de théorie** (`theory.theoryExits`) : pour les ouvertures du catalogue, le coup où tu quittes la ligne apprise (tes coups seulement), regroupé et compté. Carte « Où tu sors de la théorie » dans Mon jeu, chaque ligne ouvre la ligne commentée.
11. **Avant et après la partie** : l'étape « Joue 2 parties » mène à `#avantpartie` (règle, routine du cours, consigne de la cause dominante, semaine du programme, puis Chess.com). Après une partie analysée de moins de 3 jours, le mot du coach demande « As-tu appliqué ta règle ? » (`progress.recordSelf`, clé `self`) ; la réponse est confrontée à l'analyse (`brief.selfVerdict`) pendant 20 heures.

Écran de 664 px de haut : le mot du coach passe à 2 lignes, sans objectif chiffré, boutons Oui / Non sur la ligne de la question (bandeau d'objectif sur deux lignes et séance entamée faisaient déborder la dernière partie de 26 px).

Vérifié : 90 tests unitaires (nouveaux : `ideas`, `program`, `portrait`, `theory`, auto-évaluation et idées dans `progress`, `selfVerdict`, plan dans `debrief`), parcours de bout en bout (étapes du tier 2 en fin de parcours), audit sans écart sur 27 écrans (nouveaux : `idees`, `avantpartie`), captures en 390 × 664.

## 38. Premier essai sur les vraies parties de gaetcc (16/11)

> comment testé sur des vraies parties ? pourquoi tu ne le fais pas ?

`api.chess.com` répond désormais depuis l'environnement de Claude (bloqué jusqu'ici). 6 112 parties téléchargées (4 564 en rapide), servies au vrai site dans Chromium ; 40 dernières parties rapides analysées par le site lui-même (Stockfish du navigateur, environ 40 s par lot de 20), aucune erreur JavaScript. Textes du coach relus un à un. Défauts trouvés et corrigés, chacun avec un test tiré de la vraie partie :

- **Sortie de théorie** : reprochait des coups de théorie corrects (« 161 fois sur 163, 4.Cg5 au lieu de 4.d3 » dans l'Italienne, « 2…Cc6 au lieu de 2…d6 » dans la Sicilienne) parce qu'ils ne suivaient pas la ligne du catalogue. Désormais seules les parties analysées comptent, et un écart n'est retenu que s'il coûte au moins 5 points de chances de gain (`EXIT_DROP`). Sur les 40 parties analysées : aucun écart coûteux, la carte reste masquée.
- **Idées de plan** : deux idées au texte identique (Db7 et Dc7 « préparent Tg4 ») ; roque décrit « Jouer ton roi en g1 » ; prises et échecs (Fxd7+, Th8+, De7+) proposés comme plans. Le meilleur coup doit être calme, le coup joué est décrit simplement si son idée est la même, le roque se dit « Roquer côté roi ».
- **Enfermement** : « Fe3 enferme sa tour en a8 » pour une tour jamais sortie. Une pièce sur sa rangée de départ n'est plus dite enfermée.
- **Débrief** : « La faute décisive » donnée à une erreur de 61 % → 38 % alors que le tournant racontait une faute de 79 % → 10 %. Elle s'appelle alors « Une autre faute ».

Constat à trancher : le chantier choisi automatiquement est « Mauvais coup en milieu de partie » (thème `plan`, le plus vague), avec une règle générale.

## 39. Remonter ses gaffes depuis l'accueil (16/11)

> dans "tes dernières parties" je veux une flèche qui montre toutes les anciennes parties et les gaffes. un flèche une gaffe (débrouille toi pour montrer clairement si il y a plus d'une gaffe dans un match

Carte « Ta dernière partie » : flèches de part et d'autre des deux boutons (› plus ancienne, ‹ plus récente : on avance vers la droite pour remonter le temps, demande du 16/11), une gaffe par clic, de la partie la plus récente à la plus ancienne (`review.gaffeTrail`, état `S.lg`). Plusieurs gaffes dans une partie : la pastille dit « Gaffe 2 sur 4 » (dans l'ordre de la partie). Partie sans gaffe : une seule étape, sa pire erreur ou « Aucune gaffe ». En-tête « Partie du 12/11 » et compteur « 4 / 49 » (ordinateur), date sous l'adversaire (téléphone). Libellés raccourcis pour tenir sur une ligne : « Voir mon coup » / « Rejouer l'erreur » (téléphone : « Mon coup » / « Rejouer »). Vérifié sur les vraies parties (49 étapes sur les 40 parties analysées), test de `gaffeTrail`, parcours, audit sans écart.

## 40. Six idées reprises de la structure de Chess.com (16/11)

> cherche sur la structure du site de chess.com des points qu'on pourrait ajouter au site · fais les 6

Comparaison des rubriques de Chess.com (Jouer, Puzzles, Apprendre, Analyse, Insights) avec le site. Six manques, tous faits :

1. **Rush** (`#rush`, `#rush/t3`, `#rush/surv`), d'après Puzzle Rush : les questions des échauffements (`sur`, `menace`, `cadeau`, tirées de tes parties) à la chaîne, en 3 minutes ou en survie (3 fautes). Record par mode, fautes relues à la fin. `progress.recordRush` (clé `rush`, journal `k: 'r'`).
2. **Jouer d'ici** (`#jouer/<t>/<k>`, `#jouer/<t>/v` pour une variante) : bouton « Jouer » du bandeau de la relecture, la position reprise contre le moteur bridé de `#gagner`. `progress.recordPlay` (journal `k: 'j'`). La partie contre le moteur est désormais commune à `#gagner`, `#jouer` et `#finale` (`botGame` dans `app.js`).
3. **Finales de base** (`#finales`, `#finale/<id>`), d'après Practice : 11 positions dans `js/endgames.js` (mats dame, tour, deux tours ; carré, roi devant le pion, opposition, défense, percée, mauvais fou ; Lucena, Philidor), contre Stockfish à pleine force. Buts `mat`, `promo` (dame qui ne peut pas être prise), `nulle` (tenir N coups ou nulle réglementaire). Manquée si l'avantage tombe sous +1,5 (but de gain), sous −5 (défense, sauf `noEval` : forteresse du mauvais fou), ou si la limite de coups est dépassée. Répétition espacée comme les lignes (`progress.recordEndgame`, mémoire `fin`, journal `k: 'f'`). Résultat théorique de chaque position contrôlé avec Stockfish profondeur 22 à 24 (l'opposition d'abord choisie, roi e3 pion e2, était nulle : remplacée).
4. **Insights** (« Quand et comment tu perds », Mon jeu) : précision et fautes graves par phase, fautes par pièce jouée, score selon l'heure et selon le rang de la partie dans la session (pause de plus d'une heure = nouvelle session), phrases seulement sur les écarts nets. `js/insights.js`, `tests/insights.test.mjs`. `phase` de `classify.js` est exportée (règle inchangée, pas de nouvelle `VERSION`).
5. **Explorateur Lichess filtré par niveau** (Ouvertures, sous l'explorateur de tes parties) : `explorer.lichess.ovh`, joueurs Lichess 1200 à 1800, blitz et rapide. Un coup touché prolonge la ligne explorée, même hors de tes parties. `js/explorer.js`, testé sur réponse simulée : `explorer.lichess.ovh` n'est pas joignable depuis l'environnement de Claude, format réel et besoin éventuel d'une connexion à confirmer au premier essai (message clair en cas de refus 401).
6. **Elo estimé de la partie** (relecture : à côté de la précision sur ordinateur, dans la barre du haut sur téléphone à la place du classement et de la série) : repère personnel, ta précision moyenne des 30 dernières parties analysées vaut ton classement moyen, 25 points par point de précision, borné à ±400, rien sous 10 parties.

## 41. Encarts plus nets, titres en serif, fluidité (17/11)

> comment faire pour rendre plus propre les encarts ? […] peut-être changer la police, j'aime bien celle de claude. j'ai aussi envie de réfléchir à améliorer la fluidité […] c'est plutôt un à-coup par à-coup, au lieu d'une expérience fluide · fais moi voir un avant après et je valide · je valide, applique et passe à la fluidité

**Encarts** (avant / après montré sur le site avec parties simulées, validé) :
- Cartes sans bordure, séparées par le fond seulement, comme Chess.com (`--bg` #302e2b, `--surface` #262421 : écart creusé). La bordure reste là, transparente : aucune taille ne bouge.
- Rayons resserrés : `--r` 8 px (cartes, boutons), `--r-s` 6 px.
- Pastilles (`.chip`) : texte simple, l'état passe par un point de couleur, plus de fond coloré.
- « Ta séance » : trait vert à gauche au lieu d'un contour vert ; règle du chantier sans contour.
- Boutons en semi-gras, boutons secondaires `#3c3a37`.
- Titres (h1, h2, logo, grands chiffres) en **Source Serif 4** 600 (OFL, `vendor/fonts/`), la serif libre la plus proche de celle de Claude (propriétaire) ; le reste en Geist.

**Fluidité**, mesurée avant correction (Playwright, parties simulées) :
- Entrée et sortie d'un exercice : saut de mise en page (colonne 208 → 72 px), sans fondu en sortie. Désormais fondu aussi en sortie, la colonne glisse (`view-transition-name: side`, images découpées, non étirées), la barre du bas du téléphone reste immobile (`tabs`).
- « Mon jeu » figeait l'écran 290 ms pour 12 parties (`phaseStats` rejoue chaque partie avec chess.js) : `replay` garde chaque partie en mémoire (`classify.js`), et `warmReplays` les rejoue d'avance quand le navigateur est libre. 40 ms ensuite.
- Relecture : images régulières (17 ms) ; la liste des coups ne relance plus un défilement doux à chaque coup quand les coups s'enchaînent (moins de 250 ms).

## 42. Relecture de partie à la Chess.com (17/11)

> prend les best practices pour améliorer cette page de parties. j'aime bien voir le graphique […] mais l'espace à droite est inexploité + toutes les infos en haut ne sont pas suffisamment différenciées. « joué comme un 750 » j'aime pas, au lieu de ça mets « Elo estimé → 750 », dans un encart dédié

- **En-tête** : les deux joueurs l'un sous l'autre (adversaire en haut, comme sur l'échiquier), pastille de couleur, Elo, résultat sur ta ligne ; ouverture, date et cadence en petit dessous ; Débrief et Chess.com à droite. Le titre « Blancs contre … » reste pour les lecteurs d'écran (`.sr`).
- **Encarts** (`gvTiles`) : Précision, Elo estimé (avec son explication au survol), Fautes (`??`, `?`, `?!` colorés). « Jouée comme un » devient « Elo estimé » partout (barre du haut sur téléphone comprise).
- **Liste des coups** : une ligne par coup complet sur toute la largeur, lignes alternées, et colonne du temps passé par coup pour chaque camp (barre proportionnelle au coup le plus long, `moveTimes` / `clockFmt` dans `review.js`). Sur téléphone, bande horizontale inchangée (`.gvr` en `display: contents`).
- Courbe ramenée à 104 px pour laisser la place aux coups.

Suite (« oui mets les joueurs autour de l'échiquier comme chess.com […] essaye de mieux exploiter l'espace ») :
- **Joueurs autour de l'échiquier** (ordinateur) : adversaire au-dessus, toi au-dessous avec le résultat, pendule au coup affiché (celle du camp au trait en clair, `clocksAt` dans `review.js`, `gvClocks`). `exo.screen` accepte `above` / `below`.
- **Commentaire dans la colonne de droite** sur ordinateur (`capSide`) : l'échiquier grandit (environ 450 px au lieu de 400 en 1366 × 768) malgré les deux bandeaux. Sur téléphone, le bandeau reste sous l'échiquier ; au passage d'une largeur à l'autre, la relecture se reconstruit.
- En-tête réduit à une ligne (ouverture, date, cadence, Débrief, Chess.com), légende de la courbe passée en info-bulle : la liste des coups gagne environ 4 lignes.
- (« centre tout + je veux pas avoir à défiler en haut à droite ») Le commentaire prend la hauteur de son contenu (112 px au moins, jamais de défilement ; la liste des coups absorbe l'écart), sans le bouton « Débrief de la partie » en double ; boutons du bas centrés ; colonnes de coups resserrées (150 px), temps à droite.

## 43. Liste des parties plus claire (17/11)

> je veux que ça soit plus clair au niveau des infos. par exemple je trouve que les erreurs « flottent » un peu trop et ne sont pas assez claires et encadrées. aussi centre mieux les éléments

- Fautes : deux pastilles de largeur fixe et fond teinté (`.flt` : gaffes en rouge, erreurs en orange), toujours présentes, 0 en gris ; elles s'alignent d'une ligne à l'autre. Nombre au survol (« 2 gaffes »).
- Colonnes chiffrées (coups, précision, fautes, pendule) centrées sous leur titre ; la date reste à droite.

## 44. Accueil : encarts de l'objectif (17/11)

> pareil sur la home ajoute un encart pour tous les points en haut à droite. que rajouter dessus pour remplir l'espace ?

- Ordinateur : l'objectif devient une carte, barre 735 → 1000 en haut, puis 5 encarts (Il manque, Échéance, Rythme nécessaire, 30 derniers jours, Série), comme le bilan de « Parties ». Téléphone inchangé (ligne sous la barre, série dans la barre du haut), la page ne défile toujours pas.

## Décisions à retenir

| Sujet | Décision | Raison |
|---|---|---|
| Hébergement | Site statique GitHub Pages | Seule voie pour l'import par pseudo seul |
| Analyse | Stockfish lite mono-thread dans le navigateur | Aucun serveur, fonctionne sur mobile |
| Données | Locales à chaque appareil | Pas de backend |
| Cours par Claude | Copier-coller via l'abonnement, ou clé API | L'abonnement n'ouvre pas l'API |
| Identité visuelle | Inspirée de Chess.com, éléments propres | Ne pas copier leur marque |
| Licence | GPL-3.0-or-later | Imposée par chessground et Stockfish |
| Puzzle raté | Revient le lendemain, plus 5 minutes après | Donnait l'impression que l'app oubliait le travail fait |
| Prédiction dans les suites | En pas à pas seulement, la lecture est automatique | Demande d'une animation après le bon coup |
| Anciennes analyses | Réévaluées une fois, automatiquement, en arrière-plan | Sans données brutes, elles ne pourraient pas suivre un changement de règle |
| Synchronisation | Fichier de sauvegarde, pas de serveur | Le site reste statique, sans compte |
| Refonte | Système du skill taste-skill, sans sa partie site vitrine ; Geist ; bouton principal en relief ; 5 entrées, Progrès en volet | Maquette validée le 15/11, faite le 16/11 ; voir `docs/REFONTE.md` |
| Explications positionnelles | Heuristiques (`plan.js`) d'abord, Claude à la demande | Gratuit et sans clé ; Claude seulement pour les positions où la règle ne suffit pas |
| Puzzles flous | Écartés s'ils n'ont pas de motif tactique et que 3 coups tenaient | Un puzzle sans réponse nette n'apprend rien |

## Non vérifié à ce jour

- Import et analyse sur le vrai compte `gaetcc`.
- Qualité des cours réellement générés par Claude, et des réponses de « Demande au coach ».
- Justesse des intentions (`plan.js`) sur de vraies parties : heuristiques testées sur des positions construites.
- Explorateur Lichess (`explorer.js`) et finales contre le moteur jamais essayés sur le site en ligne ; Elo estimé non comparé à celui de Chess.com.
- Rendu du site en ligne (inaccessible depuis l'environnement de Claude).
- Rythme de l'animation des suites (environ 3 secondes par coup) et lisibilité des points de déplacement sur le téléphone de Gaëtan.
