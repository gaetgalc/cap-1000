# Refonte de l'interface (à partir du 15/11)

Référence : le skill « design-taste-frontend » (dépôt `Leonxlnx/taste-skill`), adapté à un outil d'entraînement.
Maquette validée par Gaëtan le 15/11 : écrans Aujourd'hui et Puzzle, téléphone et ordinateur (artefact Claude privé).

## Décisions

| Sujet | Décision |
|---|---|
| Ce qu'on prend du skill | Jetons partagés (espacement par 4, une échelle de titres, une échelle d'arrondis), un seul bouton plein par vue, boutons de 44 px minimum, texte lu à 16 px, rien sous 13 px, contraste 7:1 (texte) et 4.5:1 (secondaire), une couleur d'accent, mouvement court (150 à 240 ms, `transform` et `opacity` seulement, survol réservé à la souris, `prefers-reduced-motion`), pas de capitales espacées ni de mise en valeur par couleur |
| Ce qu'on laisse | Héro, « une section par écran », photos, effets, scènes, tirage de palette (le vert de l'échiquier reste) |
| Bouton principal | Garde son relief (ombre basse `--btn-edge`), choix de Gaëtan contre la règle du skill. Vert assombri `#3a8020` pour un libellé blanc à 4.9:1 |
| Polices | Geist (titres et texte), Geist Mono (notation des coups). Choisies dans la table du skill (`library/type.json`, poids 3 sur « software » et « tech ») ; à servir depuis `vendor/fonts/` comme les polices actuelles. Graisses 400 et 500, 600 au plus, jamais 700 |
| Échelle de texte | 13, 14, 16, 20, 28 px, plus 40 px pour un grand chiffre (Elo, stats) |
| Arrondis | 8 px (petits éléments), 12 px (cartes, boutons), 50 % (pastilles rondes) |
| Thème | Sombre unique, échiquier vert |
| Navigation | 5 entrées : Aujourd'hui, S'entraîner, Apprendre, Parties, Progrès. Pas de volet au survol, pas de « Plus ». Pendant un exercice sur ordinateur, la colonne se réduit aux icônes |
| Anciennes adresses | Toutes gardées et redirigées vers leur nouvelle place |
| Publication | Chaque étape fusionnée dans `main` quand les tests passent |

## Étape 1 : état des lieux (15/11)

Outil : `node tests/audit-ui.js [dossier]`. Il ouvre 22 écrans sur les parties simulées de `tests/fixture.js`, aux 4 tailles (390 × 664, 390 × 760, 1366 × 768, 1280 × 860), fait une capture de chacun et mesure : défilement d'un écran d'échiquier, débordement horizontal, tailles de texte, texte sous 13 px, contraste réel du texte sur son fond, cibles tactiles sous 44 px, boutons pleins visibles, arrondis. Résultat détaillé dans `audit.json` du dossier de sortie (`tests/out/audit` par défaut, ignoré par git).

Le script de contrôle du skill (`gate.mjs`) n'a pas été lancé : l'exécution des scripts du dépôt du skill est bloquée dans l'environnement de Claude. `audit-ui.js` reprend ses mesures utiles à une application.

### Ce qui va bien

- Aucun écran d'échiquier ne défile, à aucune des 4 tailles. Aucun débordement horizontal.
- Aucune erreur JavaScript sur les 22 écrans.
- L'accueil remanié le 15/11 suit déjà la logique visée : un seul bouton plein, séance en premier.

### Écarts mesurés (sur `main` du 15/11, après l'accueil épuré)

| Écart | Mesure | Où | Étape qui le corrige |
|---|---|---|---|
| Trop de tailles de texte | 21 tailles : 10, 11, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 20, 22, 23, 24, 26, 28, 30, 46, 52 | partout | 2 |
| Trop d'arrondis | 14 valeurs : 2 à 14 px, 50 %, 99 px, 999 px | partout | 2 |
| Texte sous 13 px | jusqu'à 37 éléments par écran ; barre du bas en 11 px, pastilles en 12.5 px (Elo, série, dates, étiquettes) | Stats, Partie, Parties, Bilan, Ouvertures | 2 |
| Libellé blanc sur le vert du bouton principal | contraste 3.16:1 (minimum 4.5:1) | chaque bouton plein | 2 |
| Plusieurs boutons pleins sur un écran | 8 sur une fiche de cours (« Travailler cette position »), 6 sur une fiche d'ouverture (« Jouer »), 3 sur Ouvertures, 2 sur Plan | fiches | 2 (style) et 5 (choix du bouton principal) |
| Cibles trop petites | barre d'onglets à 32 px, boutons à 36 px, liens « Ouvrir » à 20 px, cases à cocher à 18 px, coups de la relecture à 29 px, entrées de liste à 37 px | presque tous les écrans | 2 (hauteurs) et 7 (contrôle final) |
| Navigation sur 3 niveaux | entrées principales, puis volet « Leçons » au survol, puis sous-onglets (Coach : 3, Puzzles : 3, Ouvertures : 2) ; Échauffements, Gagner et Historique accessibles seulement par des liens ou par « Plus » | navigation | 3 |
| Onglets qui débordent | la fiche d'ouverture coupe « Tes parties » en 390 px | fiche d'ouverture | 5 |
| Trois boutons dans la barre d'un exercice | Indice, Mon coup, Solution (le skill en veut deux au plus par rangée) | puzzle, erreur | à trancher en étape 5 (« Mon coup » peut passer dans le panneau) |
| Notation des coups en police de texte | les coups (« Fb7 », « 1.e4 e5 ») ne sont pas en chasse fixe | relecture, lignes | 2 (Geist Mono) |

### Captures de référence

Les captures « avant » ne sont pas versionnées (poids). Pour les refaire : `git checkout fcae6c5 -- . && node tests/audit-ui.js tests/out/avant`, ou relancer l'audit à chaque étape et comparer les `audit.json`.

## Étapes suivantes

2. Jetons et nettoyage du CSS : Geist et Geist Mono dans `vendor/fonts/`, variables de couleur, d'espacement, de rayon, de durée dans `:root`, aucune couleur en dur ailleurs, échelle de texte réduite à 6 tailles, contraste du bouton principal, hauteurs de 44 px. L'audit doit tomber à 6 tailles de texte, 3 arrondis, aucun contraste faible.
3. Navigation à 5 entrées et redirections ; `tests/parcours.js` mis à jour. À concilier avec la demande du 16/11 (JOURNAL §25) : Séance du jour, Mon jeu et Plan et réglages dans un volet déroulant sous « Coach », accueil sans défilement.
4. Aujourd'hui.
5. S'entraîner et Apprendre (un bouton plein par fiche, onglets qui tiennent en 390 px).
6. Parties et Progrès.
7. Mouvement et accessibilité.
8. Contrôle final : audit à zéro écart, tests, captures aux 4 tailles, journal et `CLAUDE.md`.
