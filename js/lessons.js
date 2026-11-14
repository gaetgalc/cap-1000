// Contenu des cours. Les exemples viennent des parties du joueur (voir app.js).
export const LESSONS = {
  en_prise_pose: {
    titre: 'Ne plus poser une pièce en prise',
    principe: 'La pièce que tu viens de jouer se fait prendre gratuitement au coup suivant. Ce n’est pas un problème de stratégie, c’est un contrôle oublié. Sous 1000 Elo, c’est l’erreur qui décide le plus de parties.',
    routine: [
      'Avant de lâcher la pièce, regarde sa case d’arrivée : quelles pièces adverses la visent ?',
      'Compte les attaquants et les défenseurs de cette case. S’il y a plus d’attaquants, ne joue pas le coup.',
      'Vérifie aussi la valeur : une pièce défendue attaquée par un pion reste perdue.',
    ],
  },
  en_prise_ignore: {
    titre: 'Voir la menace de l’adversaire',
    principe: 'Ton adversaire attaquait déjà une pièce, ou ton coup a retiré son défenseur, et tu as joué ailleurs. Chaque coup adverse change quelque chose sur l’échiquier : c’est ce changement qu’il faut lire avant de penser à ton propre plan.',
    routine: [
      'Après chaque coup adverse, pose la question : qu’est-ce que ce coup attaque maintenant ?',
      'Passe en revue tes pièces non défendues. Ce sont elles qui tombent.',
      'Avant de déplacer une pièce, vérifie qu’elle ne défendait rien.',
    ],
  },
  cadeau_rate: {
    titre: 'Prendre ce que l’adversaire donne',
    principe: 'Une pièce adverse était en prise et tu ne l’as pas capturée. À ton niveau, les adversaires laissent du matériel presque à chaque partie : le voir suffit souvent à gagner.',
    routine: [
      'À chaque coup, liste toutes tes captures possibles avant tout autre coup.',
      'Pour chaque capture : la pièce est-elle défendue ? Par quoi ?',
      'Si la capture gagne du matériel sans danger, joue-la. Le plan attendra.',
    ],
  },
  mat_autorise: {
    titre: 'Ne plus encaisser de mat évitable',
    principe: 'Ton coup a laissé un mat forcé à l’adversaire alors que la position tenait encore. Le plus souvent : roi sans case de fuite sur la dernière rangée, ou dame et pièce adverse braquées sur le même point près de ton roi.',
    routine: [
      'Avant chaque coup, regarde tous les échecs que l’adversaire peut donner au coup suivant.',
      'Si ton roi n’a aucune case de fuite, crée-en une (h3 ou g3 après le petit roque).',
      'Quand la dame adverse s’approche de ton roi, traite-la en priorité.',
    ],
  },
  mat_rate: {
    titre: 'Conclure quand le mat est là',
    principe: 'Tu avais un mat forcé et tu as joué autre chose. Les échecs sont les coups les plus forçants : ils se calculent en premier, toujours.',
    routine: [
      'Quand tu attaques le roi, regarde chaque échec possible, même ceux qui semblent absurdes.',
      'Pour chaque échec, compte les réponses adverses. Une seule réponse : calcule un coup plus loin.',
      'Cherche d’abord les échecs qui retirent des cases de fuite au roi.',
    ],
  },
  tactique_subie: {
    titre: 'Repérer les fourchettes et attaques doubles',
    principe: 'Ton coup a permis une tactique en deux temps : un coup adverse crée deux menaces à la fois et tu ne peux en parer qu’une. Cavaliers, pions et échecs intermédiaires en sont les auteurs habituels.',
    routine: [
      'Repère tes pièces alignées ou à portée de cavalier l’une de l’autre : ce sont des cibles de fourchette.',
      'Regarde les échecs adverses : un échec qui attaque aussi une pièce la gagne.',
      'Méfie-toi des pièces non défendues, elles rendent chaque tactique possible.',
    ],
  },
  tactique_ratee: {
    titre: 'Saisir les tactiques à ta portée',
    principe: 'Une combinaison courte gagnait du matériel et tu es passé à côté. La méthode est toujours la même : examiner les coups forçants dans l’ordre échecs, captures, menaces.',
    routine: [
      'À chaque coup, cherche dans l’ordre : échecs, captures, menaces.',
      'Repère les pièces adverses non défendues : peux-tu en attaquer deux à la fois ?',
      'Un roi et une pièce sur la même ligne ou diagonale : pense clouage ou enfilade.',
    ],
  },
  ouverture: {
    titre: 'Sortir proprement de l’ouverture',
    principe: 'L’erreur arrive dans les dix premiers coups. Inutile d’apprendre de la théorie : trois principes suffisent pour atteindre 1000, à condition de les appliquer à chaque partie.',
    routine: [
      'Un pion au centre (e4 ou d4, e5 ou d5), puis les cavaliers et les fous.',
      'Roque avant le 10e coup. Ne joue pas deux fois la même pièce sans raison.',
      'Garde la dame à la maison tant que les pièces mineures ne sont pas sorties.',
    ],
  },
  plan: {
    titre: 'Choisir un coup utile en milieu de partie',
    principe: 'Pas de tactique immédiate ici, mais un coup qui abîme ta position : pièce qui recule, pion qui affaiblit ton roi, échange défavorable. Quand tu ne sais pas quoi jouer, améliore ta plus mauvaise pièce.',
    routine: [
      'Trouve ta pièce la moins active et donne-lui une meilleure case.',
      'Mets tes tours sur les colonnes ouvertes.',
      'N’avance pas les pions devant ton roi sans nécessité.',
    ],
  },
  finale: {
    titre: 'Jouer les finales avec méthode',
    principe: 'En finale, le roi devient une pièce d’attaque et chaque pion compte. Les erreurs viennent d’un roi resté passif ou d’un pion passé qu’on oublie de pousser, ou d’arrêter.',
    routine: [
      'Amène ton roi vers le centre dès que les dames sont échangées.',
      'Pousse tes pions passés, bloque ceux de l’adversaire.',
      'Mets tes tours derrière les pions passés, les tiens comme les siens.',
    ],
  },
  conversion: {
    titre: 'Gagner les parties gagnantes',
    principe: 'Tu as eu une position largement gagnante et la partie t’a échappé. Avec du matériel en plus, le but change : simplifier et supprimer tout contre-jeu, sans chercher le beau coup.',
    routine: [
      'Avec une pièce d’avance, échange les pièces (pas les pions).',
      'Vérifie deux fois chaque coup : l’adversaire n’a plus que des pièges à tenter.',
      'Mets ton roi en sécurité avant de lancer l’attaque finale.',
    ],
  },
  temps: {
    titre: 'Gérer ta pendule',
    principe: 'Le temps est une ressource : le finir sans l’avoir utilisé est aussi coûteux que d’en manquer. En partie de 10 minutes, vise environ 15 secondes par coup et garde tes longues réflexions pour les moments où des pièces sont en contact.',
    routine: [
      'Joue l’ouverture vite, tu connais tes premiers coups.',
      'Prends 30 secondes dès qu’une capture ou un échec est possible.',
      'Préfère le 15|10 : l’incrément supprime les défaites à la pendule et laisse le temps de vérifier.',
    ],
  },
  tilt: {
    titre: 'Arrêter la série noire',
    principe: 'Tes résultats chutent après une défaite. Rejouer tout de suite pour récupérer les points est le moyen le plus sûr d’en perdre davantage.',
    routine: [
      'Deux défaites de suite : la session de parties est terminée.',
      'Remplace la partie suivante par dix minutes de puzzles sur tes erreurs.',
      'Revois la défaite ici avant de relancer une partie.',
    ],
  },
  principes: {
    titre: 'Les principes d’ouverture qui te manquent',
    principe: 'Tes statistiques montrent que la partie est souvent compromise avant le 20e coup. Les causes sont mesurables : roi resté au centre, dame sortie trop tôt, pièces non développées.',
    routine: [
      'Roque avant le 10e coup dans toutes tes parties.',
      'Sors cavaliers et fous avant de bouger la dame.',
      'Contrôle le centre avec un pion, puis développe une pièce à chaque coup.',
    ],
  },
};
export const ENGINE_LESSONS = ['en_prise_pose', 'en_prise_ignore', 'cadeau_rate', 'mat_autorise', 'mat_rate', 'tactique_subie', 'tactique_ratee', 'ouverture', 'plan', 'finale'];

// Une phrase à se répéter en partie, par type d'erreur.
export const RULES = {
  en_prise_pose: 'Avant de lâcher une pièce, je regarde qui attaque sa case d’arrivée.',
  en_prise_ignore: 'Après chaque coup adverse, je cherche ce qu’il attaque.',
  cadeau_rate: 'À chaque coup, je passe en revue toutes mes captures.',
  mat_autorise: 'Avant de jouer, je regarde tous les échecs que mon adversaire peut donner.',
  mat_rate: 'Quand j’attaque le roi, j’examine tous les échecs d’abord.',
  tactique_subie: 'Je repère mes pièces non défendues : ce sont les cibles des fourchettes.',
  tactique_ratee: 'Échecs, captures, menaces : je les examine dans cet ordre.',
  ouverture: 'Un pion au centre, les pièces dehors, le roque avant le 10e coup.',
  plan: 'Sans tactique, j’améliore ma pièce la moins active sans rien laisser en prise.',
  finale: 'En finale, mon roi avance et mes pions passés aussi.',
};
