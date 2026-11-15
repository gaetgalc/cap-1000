// Catalogue des ouvertures à apprendre : histoire, idées, pièges, lignes principales.
// Données seulement (et deux aides pures) ; les écrans sont dans app.js. Les coups sont en notation anglaise (chess.js),
// le texte en notation française. tests/openings.test.mjs vérifie que chaque ligne est légale.
// Une ligne : { n: nom, side: 'w' | 'b' (le camp que tu joues), moves, idee, notes: { indice du demi-coup: commentaire }, free (ne suit pas start) }.

export const GROUPS = [['w', 'Avec les Blancs'], ['e4', 'Avec les Noirs contre 1.e4'], ['d4', 'Avec les Noirs contre 1.d4']];

export const OPENINGS = [
  {
    id: 'italienne', nom: 'Partie italienne', eco: 'C50 à C59', group: 'w', rep: true,
    start: 'e4 e5 Nf3 Nc6 Bc4',
    tag: 'La plus ancienne des grandes ouvertures, et ton répertoire conseillé avec les Blancs.',
    histoire: [
      'Décrite à la fin du XVIe siècle par l’Italien Giulio Cesare Polerio, puis rendue célèbre au début du XVIIe par Gioachino Greco, dont les parties courtes et brillantes sont encore étudiées. Son autre nom, Giuoco Piano, veut dire « jeu tranquille ».',
      'Au XIXe siècle, l’époque des attaques romantiques, elle règne avec le gambit Evans, inventé vers 1827 par le capitaine gallois William Evans. Elle recule ensuite devant l’espagnole, jugée plus riche, et passe pour une ouverture de débutant pendant presque un siècle.',
      'Retour spectaculaire dans les années 2010 : sous une forme lente (c3, d3, manœuvres de pièces), elle devient l’une des armes favorites des meilleurs joueurs du monde. Chez les amateurs, elle n’a jamais quitté le haut du classement des ouvertures jouées.',
    ],
    idees: {
      w: 'Le fou en c4 vise f7, la case faible des Noirs, défendue par le seul roi. Plan simple : c3, d3, petit roque, Te1, puis d4 au bon moment pour prendre le centre.',
      b: 'Se développer vite, roquer, surveiller f7. Quand les Blancs poussent c3 et d4, la réponse classique est de frapper le centre par …d5.',
    },
    pieges: [
      'Après 3…Cf6, le coup 4.Cg5 attaque f7. La défense sûre est 4…d5 5.exd5 Ca5. Reprendre 5…Cxd5 ? permet 6.Cxf7 (le « foie frit ») : le roi noir est chassé au milieu de l’échiquier.',
      'Avec les Blancs, méfie-toi de 3…Cd4 : si tu prends 4.Cxe5 ?, 4…Dg5 attaque le cavalier et g2, et 5.Cxf7 ?? Dxg2 6.Tf1 Dxe4+ 7.Fe2 Cf3 est mat. Réponds simplement 4.Cxd4 ou 4.O-O.',
    ],
    lines: [
      { n: 'Giuoco Pianissimo, la ligne moderne', side: 'w', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 h3',
        idee: 'Les Blancs préparent d4 sans se presser. Le fou se met à l’abri en b3 avant que …b5 ou …Ca5 ne le chasse.',
        notes: { 4: 'Le fou vise f7.', 6: 'c3 prépare d4, la poussée centrale.', 8: 'd3 protège e4 : plus de risque sur ce pion.', 14: 'Le fou recule avant d’être chassé par …b5.', 16: 'h3 interdit …Fg4, qui clouerait le cavalier f3.' } },
      { n: 'Contre la défense des deux cavaliers', side: 'w', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6 c3',
        idee: 'Contre 3…Cf6, 4.d3 garde e4 et une position calme : les Blancs jouent ensuite pour d4 avec c3.',
        notes: { 6: 'd3 défend e4, attaqué par le cavalier f6.', 10: 'La tour soutient e4 et prépare d4.' } },
      { n: 'Gambit Evans', side: 'w', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O',
        idee: 'Un pion donné pour gagner du temps et le centre : c’est le style du XIXe siècle. Kasparov l’a ressorti contre Anand en 1995.',
        notes: { 6: 'Le pion b est offert pour attirer le fou.', 8: 'c3 chasse le fou avec gain de temps et prépare d4.', 12: 'Les Blancs roquent et laissent le pion : l’avance de développement compte plus.' } },
      { n: 'Avec les Noirs : contre c3 et d4', side: 'b', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5 exd5 Nxd5 Qb3 Nce7 O-O O-O',
        idee: 'Quand les Blancs construisent un grand centre, échange puis frappe par …d5 : le centre blanc disparaît et tes pièces respirent.',
        notes: { 7: 'Le cavalier attaque e4 : les Blancs doivent agir vite.', 11: 'L’échec force un échange qui allège ta position.', 15: '…d5 ! casse le centre blanc.', 19: 'Le cavalier défend d5 et le pion b7 reste couvert par la dame.' } },
      { n: 'Avec les Noirs : contre 4.Cg5', side: 'b', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5 Bd6',
        idee: 'Ne reprends pas en d5 : donne un pion par …Ca5, chasse le fou, et profite de ton avance de développement.',
        notes: { 6: 'Le cavalier attaque f7.', 7: '…d5 ferme la diagonale du fou c4.', 9: '…Ca5 attaque le fou au lieu de reprendre le pion.', 15: '…h6 chasse le cavalier.', 19: 'Le fou se développe : les Noirs ont deux pièces actives pour un pion.' } },
      { n: 'Avec les Noirs : contre le coup du berger', side: 'b', free: true, moves: 'e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6',
        idee: 'Contre Dh5 et Fc4 qui visent f7, défends par …g6 puis …Cf6 : la dame blanche, sortie trop tôt, va encore devoir bouger.',
        notes: { 4: 'La dame et le fou visent f7 : mat en un si tu ne réagis pas.', 5: '…g6 chasse la dame tout en défendant.', 7: '…Cf6 bloque la dame et développe une pièce.' } },
    ],
  },
  {
    id: 'espagnole', nom: 'Partie espagnole', eco: 'C60 à C99', group: 'w',
    start: 'e4 e5 Nf3 Nc6 Bb5',
    tag: 'La reine des ouvertures ouvertes, de 1561 aux championnats du monde actuels.',
    histoire: [
      'Elle porte le nom de Ruy López de Segura, prêtre espagnol qui l’analyse dans son traité de 1561. Pendant trois siècles, elle reste pourtant dans l’ombre de l’italienne.',
      'À la fin du XIXe siècle, les maîtres découvrent sa richesse : le fou ne vise pas f7 directement, il fait une pression lente sur le cavalier qui défend e5. Elle devient l’une des ouvertures les plus jouées de toute l’histoire des championnats du monde.',
      'En 2000, Vladimir Kramnik prend le titre à Garry Kasparov en neutralisant ses attaques avec la défense berlinoise, surnommée depuis « le mur de Berlin ». Elle reste aujourd’hui un pilier du jeu de haut niveau.',
    ],
    idees: {
      w: 'Pression durable sur e5, puis c3 et d4 pour bâtir un centre. Manœuvre typique du cavalier : Cbd2, Cf1, Cg3.',
      b: '…a6 et …b5 chassent le fou, …d6 tient e5. Les Noirs cherchent ensuite …c5 ou …d5.',
    },
    pieges: [
      'Après 3…a6 4.Fxc6 dxc6, prendre 5.Cxe5 ? ne gagne rien : 5…Dd4 attaque le cavalier et e4, et les Noirs récupèrent leur pion.',
      'Piège de l’arche de Noé : après 3…a6 4.Fa4 d6 5.d4 b5 6.Fb3 Cxd4 7.Cxd4 exd4, reprendre 8.Dxd4 ?? perd le fou : 8…c5 puis …c4 l’enferme en b3.',
    ],
    lines: [
      { n: 'Espagnole fermée', side: 'w', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
        idee: 'La ligne la plus classique : les Blancs préparent d4 et ne laissent jamais …Fg4 clouer leur cavalier.',
        notes: { 4: 'Le fou attaque le défenseur de e5.', 6: 'Le fou garde le contact avec c6 en reculant en a4.', 10: 'La tour défend e4.', 14: 'c3 prépare d4 et une retraite pour le fou en c2.', 16: 'h3 empêche …Fg4.' } },
      { n: 'Avec les Noirs : la berlinoise', side: 'b', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8',
        idee: 'Les dames disparaissent vite : finale solide où la paire de fous compense le roi resté au centre. C’est le « mur de Berlin » de Kramnik.',
        notes: { 7: 'Les Noirs prennent e4 : les Blancs le récupèrent, mais la position se simplifie.', 15: 'Plus de dames : le roi noir au centre ne risque presque rien.' } },
      { n: 'Variante d’échange', side: 'w', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1',
        idee: 'L’arme de Fischer : les Blancs visent une finale où leur majorité de pions à l’aile roi vaut plus que la paire de fous noire.',
        notes: { 6: 'Le fou se donne pour abîmer les pions noirs.', 8: 'Le roque d’abord : e4 est défendu indirectement.', 10: 'd4 ouvre le jeu.' } },
    ],
  },
  {
    id: 'ecossaise', nom: 'Partie écossaise', eco: 'C44 à C45', group: 'w',
    start: 'e4 e5 Nf3 Nc6 d4',
    tag: 'Ouvrir le centre dès le 3e coup : direct, peu de théorie.',
    histoire: [
      'Son nom vient d’une partie par correspondance entre Édimbourg et Londres, en 1824, où les Écossais l’emploient.',
      'Longtemps jugée inoffensive, parce qu’elle libère tout de suite le jeu des Noirs, elle revient au premier plan en 1990, quand Kasparov l’adopte, y compris dans son match de championnat du monde contre Karpov. Elle est depuis une alternative respectée à l’espagnole.',
    ],
    idees: {
      w: 'Échanger le pion d contre le pion e : le centre s’ouvre, les pièces blanches se développent vite et sans théorie lourde.',
      b: 'Attaquer le cavalier d4 et le pion e4 avec …Fc5 ou …Cf6.',
    },
    pieges: [
      'Après 3…exd4 4.Cxd4, le coup 4…Dh4 attaque e4 et f2 : défends avec 5.Cc3 plutôt que de chercher à gagner la dame.',
    ],
    lines: [
      { n: 'Classique : 4…Fc5', side: 'w', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4',
        idee: 'Le cavalier d4 est attaqué deux fois : Fe3 et c3 le soutiennent, puis le fou sort en c4.',
        notes: { 4: 'd4 ouvre le centre tout de suite.', 8: 'Fe3 défend le cavalier attaqué par le fou c5.', 10: 'c3 renforce encore d4.' } },
      { n: 'Variante Mieses : 4…Cf6', side: 'w', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4',
        idee: 'Les Blancs chassent le cavalier f6 avec e5, puis c4 : ils gagnent de l’espace au centre.',
        notes: { 10: 'e5 chasse le cavalier.', 12: 'La dame défend e5 face au clouage.', 14: 'c4 chasse le cavalier de d5.' } },
    ],
  },
  {
    id: 'londres', nom: 'Système de Londres', eco: 'D02, A46, A48', group: 'w',
    start: null, // pas d'ordre de coups fixe : voir matchGame
    tag: 'Toujours la même structure, quoi que fassent les Noirs.',
    histoire: [
      'Il doit son nom au tournoi de Londres 1922, où plusieurs maîtres l’emploient.',
      'Pendant des décennies, il passe pour une ouverture de club sans ambition. Dans les années 2010, il connaît un essor spectaculaire : adopté par des joueurs de l’élite mondiale, il devient l’une des ouvertures les plus jouées en ligne, parce qu’il se joue presque toujours de la même façon.',
    ],
    idees: {
      w: 'd4, Ff4, e3, Cf3, c3, Cbd2, Fd3, petit roque. Le fou f4 sort avant e3 pour ne pas rester enfermé derrière ses pions.',
      b: 'Frapper tout de suite par …c5, et …Db6 pour viser b2, que le fou f4 ne défend plus.',
    },
    pieges: [
      'Après …c5 et …Db6, le pion b2 est attaqué : un développement automatique permet …Dxb2. Pare avec Db3 ou Dc1.',
      'Si les Noirs jouent …Ch5, garde ton fou : Fg3 ou Fe5, sinon il est échangé et ta structure perd son sens.',
    ],
    lines: [
      { n: 'Ligne principale contre …d5', side: 'w', moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
        idee: 'La structure type : pyramide de pions c3-d4-e3, fou f4 actif, roque puis Ce5 ou e4 selon les cas.',
        notes: { 2: 'Le fou sort avant e3.', 8: 'c3 soutient d4 contre …c5.', 12: 'Le fou recule en g3 plutôt que d’accepter l’échange.' } },
      { n: 'Contre le fianchetto du roi', side: 'w', moves: 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3 c5 c3',
        idee: 'Contre …g6, le fou va en e2 et h3 garde une case de retraite pour le fou f4.',
        notes: { 8: 'Le fou va en e2 : en d3, il se heurterait au pion g6.', 10: 'h3 offre la case h2 au fou f4.' } },
      { n: 'Contre l’attaque rapide …Db6', side: 'w', moves: 'd4 d5 Bf4 c5 e3 Nc6 c3 Qb6 Qb3 c4 Qc2',
        idee: 'Db3 propose l’échange des dames et défend b2 ; si …c4, la dame revient en c2 où elle vise h7.',
        notes: { 7: 'La dame noire attaque b2.', 8: 'Db3 défend b2.', 10: 'La dame se replace en c2 : b2 est encore défendu.' } },
    ],
  },
  {
    id: 'sicilienne', nom: 'Défense sicilienne', eco: 'B20 à B99', group: 'e4',
    start: 'e4 c5',
    tag: 'La réponse la plus jouée à 1.e4 chez les forts joueurs : déséquilibre garanti.',
    histoire: [
      'Analysée dès la fin du XVIe siècle par Polerio, elle reste longtemps marginale : les maîtres du XIXe siècle la trouvent trop passive.',
      'Au XXe siècle, des champions offensifs en font la défense la plus populaire contre 1.e4 : Najdorf, puis Fischer et Kasparov, qui gagnent avec elle certaines de leurs parties les plus célèbres.',
      'Sous 1000, elle demande beaucoup de théorie. À connaître pour la reconnaître et savoir quoi jouer contre elle, pas forcément à jouer soi-même.',
    ],
    idees: {
      w: 'Ouvrir le jeu par d4, se développer vite, souvent grand roque et attaque des pions de l’aile roi.',
      b: 'Échanger le pion c contre le pion d blanc : les Noirs gagnent une majorité au centre et la colonne c ouverte pour la contre-attaque.',
    },
    pieges: [
      'Dans le Dragon, le fou g7 est la pièce clé de la défense : s’il est échangé (Fh6 des Blancs), le roi noir devient très vulnérable.',
      'Contre 2.Fc4, fréquent en club, les Noirs jouent …e6 puis …d5 : le fou blanc vise f7 mais se heurte au mur e6.',
    ],
    lines: [
      { n: 'Najdorf', side: 'b', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
        idee: 'Le petit coup …a6 interdit Cb5 et Fb5, et prépare …e5 ou …b5. L’arme de Fischer et de Kasparov.',
        notes: { 5: 'Le pion c s’échange contre le pion d : majorité centrale pour les Noirs.', 9: '…a6 : ni Cb5 ni Fb5 ne sont possibles.' } },
      { n: 'Dragon', side: 'b', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6',
        idee: 'Le fou g7 « crache le feu » sur la grande diagonale. Les Blancs attaquent à l’aile roi, les Noirs à l’aile dame : course de vitesse.',
        notes: { 9: '…g6 prépare le fou en g7.', 12: 'f3 empêche …Cg4 qui chasserait le fou e3.' } },
      { n: 'Ton arme : l’Alapin 2.c3', side: 'w', moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4',
        idee: 'Avec les Blancs, 2.c3 évite toute la théorie de la Sicilienne : tu prépares d4 et tu obtiens un centre de pions.',
        notes: { 2: 'c3 prépare d4.', 4: 'e5 chasse le cavalier.', 10: 'Les Blancs reprennent avec le pion c : centre d4-e5.', 12: 'Le fou attaque le cavalier d5.' } },
    ],
  },
  {
    id: 'francaise', nom: 'Défense française', eco: 'C00 à C19', group: 'e4',
    start: 'e4 e6',
    tag: 'Solide et stratégique : on cède un peu d’espace pour attaquer le centre ensuite.',
    histoire: [
      'Elle doit son nom à un match par correspondance entre Londres et Paris en 1834 : les joueurs parisiens l’emploient avec succès.',
      'Au XXe siècle, le champion du monde Mikhaïl Botvinnik en fait une arme redoutable, puis des générations de joueurs positionnels la suivent. Elle reste une valeur sûre, plus populaire chez les amateurs que dans l’élite actuelle.',
    ],
    idees: {
      w: 'Gagner de l’espace avec e5, puis attaquer à l’aile roi, où les Noirs ont moins de place.',
      b: 'Attaquer la chaîne de pions blanche à sa base : …c5 contre d4, puis …f6 contre e5. Le fou c8, gêné par e6, est la pièce à soigner.',
    },
    pieges: [
      'Dans l’avance, après 5…Db6 6.Fd3 cxd4 7.cxd4, ne prends pas deux fois en d4 : 7…Cxd4 8.Cxd4 Dxd4 ?? 9.Fb5+ découvre la dame d1, qui prend la dame noire.',
      'Le fou c8 est le « mauvais fou » des Noirs : cherche à l’échanger (…b6 et …Fa6) ou à le sortir par d7 avant de l’oublier.',
    ],
    lines: [
      { n: 'Variante d’avance', side: 'b', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Be2 cxd4 cxd4 Nh6',
        idee: 'Toute la pression va sur d4 : …c5, …Cc6, …Db6, puis …Cf5 par h6.',
        notes: { 4: 'e5 gagne de l’espace.', 5: '…c5 attaque la base de la chaîne.', 9: 'La dame attaque d4 et b2.', 13: 'Le cavalier va en f5, d’où il attaque d4 une fois de plus.' } },
      { n: 'Variante d’échange', side: 'b', moves: 'e4 e6 d4 d5 exd5 exd5 Bd3 Nc6 c3 Bd6 Nf3 Nge7 O-O Bg4',
        idee: 'Position symétrique : le fou c8 est libéré, les Noirs n’ont plus aucun souci.',
        notes: { 4: 'L’échange libère ton fou c8.', 13: 'Le fou sort enfin, en g4.' } },
      { n: 'Winawer', side: 'b', moves: 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7',
        idee: 'Les Noirs donnent leur bon fou pour abîmer les pions blancs : position tendue, chère à Botvinnik.',
        notes: { 5: 'Le fou cloue le cavalier qui défend e4.', 9: 'Les Noirs échangent : les pions blancs sont doublés.' } },
    ],
  },
  {
    id: 'carokann', nom: 'Défense Caro-Kann', eco: 'B10 à B19', group: 'e4',
    start: 'e4 c6',
    tag: 'Le grand frère solide de la française : le fou c8 sort avant de s’enfermer.',
    histoire: [
      'Analysée dans les années 1880 par Horatio Caro, Anglais installé à Berlin, et Marcus Kann, de Vienne : d’où son nom double.',
      'Réputée défensive, elle devient l’arme de champions du monde au sens positionnel aigu, comme Capablanca, Botvinnik et Karpov. Depuis les années 2010, elle est très populaire en ligne : une structure saine et peu de pièges.',
    ],
    idees: {
      w: 'Gagner de l’espace avec e5 ou se développer vite en gardant le centre.',
      b: 'Préparer …d5 avec …c6, sortir le fou c8 en f5 ou g4, puis seulement …e6.',
    },
    pieges: [
      'Mat étouffé célèbre : 1.e4 c6 2.Cc3 d5 3.Cf3 dxe4 4.Cxe4 Cd7 5.De2 Cgf6 ?? 6.Cd6#. Le pion e7 est cloué par la dame e2 et ne peut pas prendre.',
    ],
    lines: [
      { n: 'Variante classique', side: 'b', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6',
        idee: 'Le fou sort en f5 avant …e6, recule devant les attaques et s’échange : position sans faiblesse.',
        notes: { 7: 'Le fou sort avant …e6.', 11: '…h6 garde une case au fou.', 17: 'Les Noirs échangent leur fou contre le bon fou blanc.' } },
      { n: 'Variante d’avance', side: 'b', moves: 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 O-O Nc6',
        idee: 'Contre e5, le fou sort en f5, puis …c5 attaque le centre comme dans la française, mais avec le fou dehors.',
        notes: { 5: 'Le fou sort avant que e6 ne l’enferme.', 9: '…c5 attaque d4.' } },
      { n: 'Variante d’échange', side: 'b', moves: 'e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7',
        idee: 'Structure symétrique : …Fg4 développe le fou, et la dame défend b7 face à Db3.',
        notes: { 11: 'Le fou sort en g4.', 12: 'Db3 attaque b7.', 13: '…Dd7 défend b7.' } },
    ],
  },
  {
    id: 'scandinave', nom: 'Défense scandinave', eco: 'B01', group: 'e4',
    start: 'e4 d5',
    tag: 'Tu choisis la position dès le premier coup.',
    histoire: [
      'C’est la plus ancienne ouverture moderne connue : on la trouve dans une partie jouée à Valence vers 1475, décrite dans le poème catalan Scachs d’amor.',
      'Son nom rend hommage aux analystes scandinaves qui l’étudient au XIXe siècle. Rare au sommet, elle fait une apparition en championnat du monde en 1995, quand Anand la joue contre Kasparov. Très appréciée en club : peu de théorie, des positions connues d’avance.',
    ],
    idees: {
      w: 'Gagner du temps en attaquant la dame noire avec Cc3, puis se développer et prendre le centre.',
      b: 'Échanger tout de suite le pion e4. La dame revient en a5 ou d6, à l’abri, puis …Cf6, …Ff5, …e6, …c6.',
    },
    pieges: [
      'La dame sortie tôt est une cible : chaque coup qui l’attaque te fait perdre un temps. Ne la laisse pas au centre, où les cavaliers blancs la chassent.',
      'Avec la dame en a5, surveille Fd2 et Cd5 : la dame doit toujours garder une case de retraite.',
    ],
    lines: [
      { n: 'Avec 3…Da5', side: 'b', moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 Bf5 Bc4 e6 Bd2 c6',
        idee: 'La dame cloue le cavalier c3 depuis a5 ; le fou sort en f5, …c6 et …e6 donnent une structure solide.',
        notes: { 3: 'La dame reprend le pion.', 5: 'La dame se met à l’abri en a5.', 9: 'Le fou sort avant …e6.', 13: '…c6 offre une retraite à la dame en c7.' } },
      { n: 'Avec 3…Dd6', side: 'b', moves: 'e4 d5 exd5 Qxd5 Nc3 Qd6 d4 Nf6 Nf3 a6',
        idee: 'La dame en d6 est plus centrale ; …a6 empêche Cb5 qui l’attaquerait.',
        notes: { 5: 'La dame recule en d6.', 9: '…a6 interdit Cb5.' } },
      { n: 'Variante moderne 2…Cf6', side: 'b', moves: 'e4 d5 exd5 Nf6 d4 Nxd5 Nf3 g6 Be2 Bg7 O-O O-O',
        idee: 'Les Noirs reprennent avec le cavalier, sans sortir la dame : jeu calme, fianchetto du fou.',
        notes: { 3: 'Le cavalier reprendra en d5 : pas de dame exposée.' } },
    ],
  },
  {
    id: 'gambitdame', nom: 'Gambit Dame', eco: 'D06 à D69', group: 'd4', rep: true,
    start: 'd4 d5 c4',
    tag: 'Le classique contre 1.d4 : ton répertoire conseillé avec les Noirs.',
    histoire: [
      'Connu dès la fin du XVe siècle : il figure déjà dans le manuscrit de Göttingen, l’un des plus anciens traités d’échecs.',
      'Le gambit Dame refusé domine le jeu de haut niveau au début du XXe siècle : lors du championnat du monde 1927 entre Capablanca et Alekhine, il est joué dans la grande majorité des parties. Il reste un pilier de l’élite.',
      'Ce n’est pas un vrai gambit : si les Noirs prennent le pion c4, les Blancs le récupèrent presque toujours.',
    ],
    idees: {
      w: 'Pression sur d5 avec c4, Cc3 et Fg5, puis jeu à l’aile dame (attaque de minorité).',
      b: 'Tenir d5 avec …e6 (refusé) ou …c6 (slave), roquer, puis libérer le jeu par …c5 ou …e5.',
    },
    pieges: [
      'Piège de l’éléphant : 1.d4 d5 2.c4 e6 3.Cc3 Cf6 4.Fg5 Cbd7 5.cxd5 exd5 6.Cxd5 ?? Cxd5 ! 7.Fxd8 Fb4+ 8.Dd2 Fxd2+ 9.Rxd2 Rxd8 : les Noirs gagnent une pièce.',
      'Dans le gambit accepté, garder le pion par …b5 est une erreur classique : 3.e3 b5 ? 4.a4 c6 5.axb5 cxb5 6.Df3 et la tour a8 tombe. Laisse partir le pion.',
    ],
    lines: [
      { n: 'Gambit Dame refusé, orthodoxe', side: 'b', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6',
        idee: 'Les Noirs tiennent d5 avec e6 et c6, roquent, puis libèrent le jeu par …dxc4 et …e5, ou par …c5.',
        notes: { 3: '…e6 soutient d5.', 7: 'Le fou défait le clouage.', 11: 'Le cavalier en d7 : attention au piège de l’éléphant, il n’y a pas de vrai danger.', 13: '…c6 renforce d5.' } },
      { n: 'Gambit Dame accepté', side: 'b', moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
        idee: 'Les Noirs prennent le pion puis le rendent : en échange, ils se développent librement et frappent par …c5.',
        notes: { 3: 'Les Noirs prennent, mais ne garderont pas le pion.', 9: '…c5 attaque le centre.', 11: '…a6 prépare …b5.' } },
      { n: 'Défense slave', side: 'b', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O O-O',
        idee: 'Comme la Caro-Kann contre 1.e4 : …c6 tient d5 et le fou c8 sort avant …e6.',
        notes: { 3: '…c6 soutient d5 sans enfermer le fou c8.', 9: 'Le fou sort en f5.', 13: 'Le fou cloue le cavalier c3.' } },
    ],
  },
  {
    id: 'indienneroi', nom: 'Défense est-indienne', eco: 'E60 à E99', group: 'd4',
    start: 'd4 Nf6 c4 g6',
    tag: 'Laisser le centre aux Blancs pour mieux l’attaquer ensuite.',
    histoire: [
      'Longtemps jugée douteuse, elle s’impose après 1945 grâce aux joueurs soviétiques, dont Bronstein et Boleslavski, qui montrent la force de la contre-attaque.',
      'Elle devient ensuite l’arme favorite de Fischer puis de Kasparov. C’est une ouverture de combat : en général, les Blancs attaquent à l’aile dame et les Noirs foncent sur le roi blanc.',
    ],
    idees: {
      w: 'Grand centre c4-d4-e4, puis gain d’espace à l’aile dame.',
      b: 'Fianchetto du fou, roque, puis …e5 et, quand le centre se ferme, poussée …f5 vers le roi blanc.',
    },
    pieges: [
      'Ne laisse pas le centre blanc avancer sans réagir : sans …e5 ou …c5, les pions blancs étouffent ta position.',
    ],
    lines: [
      { n: 'Variante classique', side: 'b', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
        idee: 'Après d5, le centre est fermé : le cavalier va vers l’aile roi et les Noirs préparent …f5.',
        notes: { 5: 'Le fou se place sur la grande diagonale.', 11: '…e5 conteste le centre.', 15: 'Le cavalier part vers g6 ou vers f5.' } },
      { n: 'Sämisch', side: 'b', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5',
        idee: 'Contre f3 et Fe3, les Noirs frappent par …e5 et le cavalier en h5 prépare …f5.',
        notes: { 8: 'f3 solidifie e4 et prépare g4.', 13: 'Le cavalier en h5 soutient la poussée …f5.' } },
    ],
  },
  // ---- Ouvertures très fréquentes sous 1000 en partie rapide (ajoutées le 15/11) ----
  {
    id: 'parham', nom: 'Attaque Parham (2.Dh5)', eco: 'C20', group: 'w',
    start: 'e4 e5 Qh5',
    tag: 'La dame sort dès le 2e coup pour viser f7 et e5 : redoutable sous 1000, à connaître des deux côtés.',
    histoire: [
      'Le coup 2.Dh5 est aussi vieux que le coup du berger, dont il est le point de départ. Les manuels l’ont toujours déconseillé : la dame sort trop tôt et se fait chasser avec gain de temps.',
      'Il doit son nom à l’Américain Bernard Parham, qui l’a défendu sérieusement au XXe siècle. Avec le jeu en ligne, il est devenu l’un des débuts les plus fréquents chez les joueurs de club, et des joueurs de l’élite l’ont sorti ponctuellement pour surprendre. Sous 1000, il marche parce que l’adversaire ne connaît pas les deux ou trois coups précis qui le réfutent.',
    ],
    idees: {
      w: 'Attaquer f7 (avec Fc4) et e5 tout de suite. Si les Noirs se défendent bien, ramener la dame (Df3, puis Ce2, Cbc3, d3) et jouer une position normale : le piège ne doit pas devenir ton seul plan.',
      b: 'Défendre e5 par …Cc6, fermer la diagonale de f7 par …g6, puis …Cf6 en chassant la dame : chaque coup de dame te donne un temps de développement.',
    },
    pieges: [
      'Avec les Noirs : après 2.Dh5 Cc6 3.Fc4, le coup 3…Cf6 ?? perd tout de suite : 4.Dxf7#. C’est la défaite la plus fréquente sous 1000. 3…g6 ou 3…De7 d’abord.',
      'Avec les Blancs : après 2…Cf6 ? 3.Dxe5+ De7, ne prends pas 4.Dxc7 ?? : 4…Dxe4+ reprend le pion avec échec, et ta dame, isolée en c7, se fait chasser pendant que les Noirs se développent. Échange les dames : 4.Dxe7+.',
      'Avec les Noirs, contre 2.Dh5, 2…g6 ?? perd la tour : 3.Dxe5+ fourchette le roi et la tour h8.',
    ],
    lines: [
      { n: 'La ligne principale, avec les Blancs', side: 'w', moves: 'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Ne2 Bg7 Nbc3 d6 d3',
        idee: 'Quand les Noirs se défendent bien, la dame reste en f3 et tu développes normalement : Ce2 laisse la diagonale de la dame ouverte, d3 tient e4.',
        notes: { 2: 'La dame attaque e5 et vise f7.', 4: 'Le fou s’ajoute sur f7 : menace de mat.', 6: 'La dame se replace en f3 : f7 reste visé.', 8: 'Le cavalier va en e2 pour ne pas boucher la dame.', 12: 'd3 défend e4 : la position est saine.' } },
      { n: 'Contre 2…Cf6 ?', side: 'w', moves: 'e4 e5 Qh5 Nf6 Qxe5+ Qe7 Qxe7+ Bxe7 Nc3',
        idee: 'Tu gagnes le pion e5. Si la dame noire vient en e7, échange les dames au lieu de chercher plus : un pion de plus en finale suffit.',
        notes: { 4: 'Le pion e5 tombe avec échec.', 6: 'Échange des dames : pas de Dxc7 ?? qui permet …Dxe4+.', 8: 'Tu défends e4 et tu gardes ton pion de plus.' } },
      { n: 'Avec les Noirs : la réponse modèle', side: 'b', moves: 'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Ne2 Bg7 Nbc3 d6 h3 Be6',
        idee: '…Cc6, …g6, …Cf6, …Fg7 : tu te développes en chassant la dame. Ensuite …Fe6 échange le fou qui vise f7.',
        notes: { 3: '…Cc6 défend e5.', 5: '…g6 chasse la dame et ferme la diagonale.', 7: '…Cf6 bloque la dame sur f7.', 13: '…Fe6 neutralise le fou c4.' } },
      { n: 'Avec les Noirs : contre 5.g4', side: 'b', moves: 'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 g4 Nd4',
        idee: 'Si les Blancs poussent g4 pour chasser ton cavalier, le contre est …Cd4 : la dame f3 et le pion c2 sont attaqués.',
        notes: { 8: 'g4 menace g5 qui chasserait le cavalier f6.', 9: '…Cd4 ! attaque la dame et menace …Cxc2+.' } },
    ],
  },
  {
    id: 'englund', nom: 'Gambit Englund (1.d4 e5)', eco: 'A40', group: 'd4',
    start: 'd4 e5',
    tag: 'Un pion donné dès le premier coup contre 1.d4, pour des pièges redoutables.',
    histoire: [
      'Il porte le nom du joueur suédois Fritz Englund, qui le pratique au début du XXe siècle. Il n’a jamais été joué au plus haut niveau : objectivement, les Noirs donnent un pion sans compensation suffisante.',
      'Il vit grâce à ses pièges, très efficaces en partie rapide et en ligne, où il est devenu courant. La version 2…Fc5 puis …d6, fréquente en ligne, n’est pas la ligne classique (2…Cc6) : bien jouée par les Blancs, elle te laisse un pion de moins pour une avance de développement.',
    ],
    idees: {
      w: 'Garder le pion e5 sans gourmandise (Cf3, Ff4 ou Fg5, e3), se développer, et ne jamais tomber dans …Db4+.',
      b: 'Récupérer le pion e5 ou gagner du temps contre lui : …Cc6, …De7, …d6. Le piège principal vise b2 avec …Db4+.',
    },
    pieges: [
      'Le piège de l’Englund : 1.d4 e5 2.dxe5 Cc6 3.Cf3 De7 4.Ff4 ? Db4+ 5.Fd2 Dxb2 6.Fc3 ? Fb4 ! 7.Dd2 Fxc3 8.Dxc3 Dc1#. Les Blancs prennent souvent le mauvais chemin.',
      'Dans la version 2…Fc5, le fou vise f2. Si les Blancs jouent mal (par exemple Cf3 puis e3 sans roquer), …Fxf2+ peut arriver. Mais ne le tente que si le calcul tient : le pion de moins reste.',
    ],
    lines: [
      { n: 'L’Englund classique', side: 'b', moves: 'd4 e5 dxe5 Nc6 Nf3 Qe7 Qd5 f6 exf6 Nxf6 Qb3 d5',
        idee: 'Les Noirs donnent le pion e5 puis un deuxième pour ouvrir des lignes : en échange, toutes leurs pièces sortent vite.',
        notes: { 3: '…Cc6 attaque e5.', 5: '…De7 attaque e5 une deuxième fois et prépare …Db4+.', 7: '…f6 ouvre des lignes au lieu de défendre.', 11: '…d5 : développement libre pour le fou c8.' } },
      { n: 'Le piège de l’Englund', side: 'b', moves: 'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4 Qd2 Bxc3 Qxc3 Qc1#',
        idee: 'À connaître par cœur : si les Blancs défendent b2 de travers, la dame noire finit par mater en c1.',
        notes: { 7: '…Db4+ attaque le roi et b2 en même temps.', 9: 'La dame prend b2 et attaque la tour a1.', 11: '…Fb4 ! cloue le fou c3.', 15: 'Mat : le roi blanc n’a pas de case.' } },
      { n: 'La version 2…Fc5', side: 'b', moves: 'd4 e5 dxe5 Bc5 Nf3 d6 exd6 Bxd6 e4 Nf6 Nc3 O-O',
        idee: 'Reprends tout de suite le pion d6 (…Fxd6) plutôt que de laisser les Blancs garder deux pions : un seul pion de moins, roque rapide.',
        notes: { 3: 'Le fou vise f2.', 5: '…d6 offre un deuxième pion pour ouvrir le jeu.', 7: 'Reprends : ne reste pas avec deux pions de moins.', 11: 'Roque : ton roi est à l’abri, tes pièces sont sorties.' } },
    ],
  },
  {
    id: 'fou', nom: 'Partie du fou (2.Fc4)', eco: 'C23 à C24', group: 'w',
    start: 'e4 e5 Bc4',
    tag: 'Le fou vise f7 tout de suite, sans s’engager avec le cavalier.',
    histoire: [
      'L’une des plus anciennes ouvertures écrites : elle figure dans le traité de l’Espagnol Lucena, en 1497. Au XVIIIe siècle, Philidor la tient pour le meilleur deuxième coup des Blancs.',
      'Elle cède ensuite la place à 2.Cf3, plus souple. Aujourd’hui, elle sert surtout de chemin détourné vers les positions de l’italienne, en évitant certaines défenses noires comme la Petrov.',
    ],
    idees: {
      w: 'Fc4, d3, Cf3, c3, petit roque : un plan d’italienne lente. Garder la possibilité de f4 pour attaquer.',
      b: 'Le contre le plus simple est 2…Cf6, qui attaque e4. Puis …c6 et …d5 pour prendre le centre avec gain de temps sur le fou.',
    },
    pieges: [
      'Après 2.Fc4, le coup du berger reste dans l’air : Dh5 ou Df3 avec le fou visent f7. Exemple : 2…d6 3.Dh5 Cf6 ?? 4.Dxf7#. Avec les Noirs, avant chaque coup, regarde f7.',
      'Avec les Noirs, 2…Dh4 ?! gagne parfois le pion e4, mais la dame sortie tôt se fait chasser avec gain de temps par Cf3, Cc3 et d4.',
    ],
    lines: [
      { n: 'Avec les Blancs : le plan lent', side: 'w', moves: 'e4 e5 Bc4 Nf6 d3 Bc5 Nf3 d6 c3 O-O O-O',
        idee: 'd3 défend e4 sans risque, puis c3 prépare d4 : tu retrouves les plans de l’italienne.',
        notes: { 4: 'd3 défend e4, attaqué par le cavalier.', 8: 'c3 prépare d4 et une retraite pour le fou.' } },
      { n: 'Avec les Noirs : 2…Cf6 et …d5', side: 'b', moves: 'e4 e5 Bc4 Nf6 d3 c6 Nf3 d5 Bb3 Bd6',
        idee: '…c6 puis …d5 prend le centre en chassant le fou : les Noirs obtiennent une belle position sans risque.',
        notes: { 3: '…Cf6 attaque e4.', 5: '…c6 prépare …d5.', 7: '…d5 frappe le centre et chasse le fou.', 9: 'Le fou défend e5 et prépare le roque.' } },
      { n: 'Avec les Noirs : contre 3.Df3', side: 'b', moves: 'e4 e5 Bc4 Nf6 Qf3 Nc6 Ne2 Bc5 c3 O-O',
        idee: 'La dame et le fou visent f7, qui est défendu par le roi et bientôt par le roque. …Cc6 défend e5, …Fc5 se développe vers f2.',
        notes: { 4: 'La dame s’ajoute sur f7 : f7 est défendu, ne panique pas.', 5: '…Cc6 défend e5 en se développant.', 9: 'Roque : f7 est défendu par la tour.' } },
    ],
  },
  {
    id: 'petrov', nom: 'Défense Petrov (2…Cf6)', eco: 'C42 à C43', group: 'e4',
    start: 'e4 e5 Nf3 Nf6',
    tag: 'Contre-attaquer e4 au lieu de défendre e5 : la défense la plus symétrique.',
    histoire: [
      'Aussi appelée défense russe : elle doit son nom au Russe Alexandre Petrov, qui l’analyse dans les années 1840 avec Carl Jaenisch.',
      'Réputée très solide, elle est devenue au XXe et au XXIe siècle une arme de champions du monde quand ils veulent annuler avec les Noirs sans risque, comme Karpov et Kramnik. Elle demande de connaître un ou deux pièges très précis.',
    ],
    idees: {
      w: 'Prendre e5 (3.Cxe5) ou ouvrir le centre par 3.d4 : les Blancs gardent une petite avance de développement.',
      b: 'Rendre coup pour coup, sans copier aveuglément : après 3.Cxe5, d’abord …d6, puis seulement …Cxe4.',
    },
    pieges: [
      'Le piège de la Petrov : 3.Cxe5 Cxe4 ? 4.De2 ! et si 4…Cf6 ?? 5.Cc6+, échec à la découverte : le cavalier attaque la dame d8, qui tombe. Joue toujours 3…d6 avant de reprendre en e4.',
      'Avec les Blancs, contre 2…Cf6, le coup 3.Fc4 est fréquent : si 3…Cxe4, 4.Cc3 donne un gambit dangereux (Boden-Kieseritzky), mais 4.Fxf7+ ? Rxf7 5.Cxe5+ ne gagne rien de solide.',
    ],
    lines: [
      { n: 'Classique : 3.Cxe5 d6', side: 'b', moves: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7',
        idee: 'D’abord …d6 pour chasser le cavalier, ensuite seulement …Cxe4 : le matériel est rétabli sans piège.',
        notes: { 5: '…d6 ! chasse le cavalier avant de reprendre e4.', 7: 'Maintenant …Cxe4 est sans danger.', 9: '…d5 soutient le cavalier e4.', 13: 'Le fou se développe et prépare le roque.' } },
      { n: 'Contre 3.d4', side: 'b', moves: 'e4 e5 Nf3 Nf6 d4 Nxe4 Bd3 d5 Nxe5 Nd7 Nxd7 Bxd7 O-O Bd6',
        idee: 'Les Noirs prennent e4, le soutiennent par …d5 et échangent le cavalier e5 : position équilibrée et saine.',
        notes: { 5: '…Cxe4 : le pion e4 est pris tout de suite.', 7: '…d5 soutient le cavalier.', 9: '…Cd7 propose l’échange du cavalier actif.' } },
      { n: 'Avec les Blancs : le gambit 3.Fc4', side: 'w', moves: 'e4 e5 Nf3 Nf6 Bc4 Nxe4 Nc3 Nxc3 dxc3 f6 O-O',
        idee: 'Tu donnes le pion e4 pour une grosse avance de développement : colonnes ouvertes, roque rapide, attaque sur le roi noir.',
        notes: { 4: 'Le fou vise f7 ; e4 n’est plus défendu.', 6: 'Le gambit : Cc3 développe au lieu de récupérer le pion.', 8: 'dxc3 ouvre la colonne d et la diagonale du fou c1.', 10: 'Roque : tes pièces sont prêtes, les Noirs ne le sont pas.' } },
    ],
  },
  {
    id: 'philidor', nom: 'Défense Philidor (2…d6)', eco: 'C41', group: 'w',
    start: 'e4 e5 Nf3 d6',
    tag: 'Très fréquente chez les adversaires sous 1000 : solide mais passive.',
    histoire: [
      'Elle porte le nom de François-André Danican Philidor, meilleur joueur du XVIIIe siècle et compositeur d’opéras, dont le traité de 1749 affirme que « les pions sont l’âme des échecs ».',
      'Longtemps jugée trop passive, elle a connu un regain à partir des années 1990 sous une forme moderne (…Cf6, …Cbd7, …Fe7). Sous 1000, elle est surtout jouée par des adversaires qui veulent éviter la théorie : à toi de profiter de l’espace qu’elle te laisse.',
    ],
    idees: {
      w: 'Prendre le centre par d4, se développer vite (Cc3, Fc4 ou Fe2, roque) et profiter du manque d’espace des Noirs.',
      b: 'Tenir e5 avec …d6, …Cf6, …Cbd7, …Fe7, puis libérer le jeu plus tard par …c6 et …d5.',
    },
    pieges: [
      'Le mat de Légal : après 3.Fc4 Fg4, si les Noirs jouent mal, 4.Cc3 g6 ? 5.Cxe5 ! Fxd1 ?? 6.Fxf7+ Re7 7.Cd5#. Tu sacrifies ta dame et tu mates avec trois pièces mineures.',
      'Contre 3.Fc4 Fg4, 4.h3 Fxf3 5.Dxf3 est bon, mais beaucoup de joueurs s’y perdent ensuite : après 5.Dxf3, la dame et le fou visent f7, garde cette pression avec d3 et Cd2 au lieu de chercher un mat trop tôt.',
    ],
    lines: [
      { n: 'La ligne principale : 3.d4', side: 'w', moves: 'e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Be2 O-O O-O',
        idee: 'Le meilleur contre la Philidor : d4 force les Noirs à lâcher le centre. Tu gardes plus d’espace et un développement facile.',
        notes: { 4: 'd4 attaque e5 tout de suite.', 6: 'Le cavalier reprend au centre.', 8: 'Cc3 défend e4.' } },
      { n: 'Contre 3.Fc4 Fg4', side: 'w', moves: 'e4 e5 Nf3 d6 Bc4 Bg4 h3 Bxf3 Qxf3 Nf6 d3 Nc6 c3 Be7 Nd2',
        idee: 'Après l’échange en f3, ta dame et ton fou visent f7. d3 et Cd2 consolident ; le plan est ensuite Cf1-g3 ou Cf1-e3, vers f5 ou d5.',
        notes: { 4: 'h3 demande au fou de choisir.', 8: 'La dame reprend et vise f7 avec le fou.', 10: 'd3 défend e4.', 14: 'Le cavalier part vers f1 puis g3 ou e3.' } },
      { n: 'Le mat de Légal', side: 'w', moves: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#',
        idee: 'Le piège le plus célèbre de l’histoire : la dame est offerte, et si les Noirs la prennent, trois pièces mineures matent.',
        notes: { 8: 'Cxe5 ! laisse la dame en prise.', 10: 'Fxf7+ chasse le roi.', 12: 'Mat : le roi est entouré par ses propres pièces et les cavaliers.' } },
    ],
  },
];

export const byId = (id) => OPENINGS.find((o) => o.id === id);
export const lineKey = (o, k) => o.id + ':' + k;
export const movesOf = (l) => l.moves.split(' ');

// Une partie relève-t-elle de cette ouverture ? Comparaison sur les premiers coups joués.
export function matchGame(o, g) {
  if (o.start) { const s = o.start.split(' '); return s.every((m, i) => g.san[i] === m); }
  // Londres : les Blancs jouent d4 et Ff4 dans leurs 3 premiers coups, sans c4.
  const w = g.san.filter((_, i) => i % 2 === 0).slice(0, 3);
  return w[0] === 'd4' && w.includes('Bf4') && !w.includes('c4');
}
