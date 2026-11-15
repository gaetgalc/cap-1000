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
