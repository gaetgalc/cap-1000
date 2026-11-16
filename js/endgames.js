// Finales de base à jouer contre le moteur (#finales), à la manière de « Practice » sur Chess.com.
// Chaque position est vérifiée par tests/endgames.test.mjs (légale, trait au joueur, but cohérent) et le résultat
// théorique a été contrôlé avec Stockfish (profondeur 22 à 24) le 16/11 : gain net pour 'mat' et 'promo', 0.00 pour 'nulle' (mauvais fou :
// −1.2, forteresse que le moteur ne voit pas sans tables de finales).
// goal : 'mat' (mater), 'promo' (faire une dame qui reste en vie), 'nulle' (tenir la nulle ou arrêter le pion).
// noEval : forteresse que le moteur sans tables de finales juge mal ; seuls le mat ou la promotion font manquer l'exercice.
// limit : nombre de coups du joueur pour y arriver (au-delà, l'exercice est manqué : la règle des 50 coups approche).
export const ENDGAMES = [
  {
    id: 'dame', t: 'Mat avec la dame', lvl: 1, fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', goal: 'mat', limit: 20,
    intro: 'Roi et dame contre roi seul. Mate en moins de 20 coups.',
    rule: 'Fais un saut de cavalier avec ta dame par rapport au roi adverse pour le repousser, puis amène ton roi. Attention au pat : laisse toujours une case libre.',
    plan: ['Place ta dame à un saut de cavalier du roi adverse : elle lui retire une rangée et une colonne.', 'Suis-le à distance de cavalier jusqu’au bord.', 'Quand il est au bord, arrête la dame et amène ton roi.', 'Mate quand ton roi protège la dame ou couvre les cases de fuite.'],
  },
  {
    id: 'tour', t: 'Mat avec la tour', lvl: 1, fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', goal: 'mat', limit: 32,
    intro: 'Roi et tour contre roi seul. Mate en moins de 32 coups.',
    rule: 'La tour coupe le roi adverse, ton roi vient en opposition, puis la tour donne l’échec et réduit la boîte d’une rangée.',
    plan: ['Coupe le roi adverse avec la tour sur une rangée ou une colonne.', 'Approche ton roi, face au roi adverse (opposition).', 'Donne l’échec avec la tour quand les rois sont face à face : la boîte rétrécit.', 'Si la tour est attaquée, éloigne-la sur la même rangée, le plus loin possible.'],
  },
  {
    id: 'escalier', t: 'Mat de l’escalier', lvl: 1, fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1', goal: 'mat', limit: 12,
    intro: 'Deux tours contre roi seul. Mate en moins de 12 coups, sans l’aide de ton roi.',
    rule: 'Une tour coupe, l’autre donne l’échec, et elles avancent à tour de rôle d’une rangée vers le bord.',
    plan: ['Une tour tient une rangée, l’autre donne l’échec sur la rangée suivante.', 'Alterne : la tour du dessous passe au-dessus, et ainsi de suite.', 'Si le roi adverse s’approche d’une tour, éloigne-la sur l’autre aile.'],
  },
  {
    id: 'carre', t: 'La règle du carré', lvl: 1, fen: '8/8/8/p7/8/8/8/4K2k w - - 0 1', goal: 'nulle', limit: 8, stop: true,
    intro: 'Le pion noir file vers a1. Rattrape-le avec ton roi.',
    rule: 'Trace le carré du pion, de sa case jusqu’à la case de promotion. Si ton roi peut entrer dans ce carré, il rattrape le pion.',
    plan: ['Compte : le pion a besoin de 4 coups pour faire dame.', 'Ton roi doit marcher en diagonale vers le pion, pas en ligne droite derrière lui.', 'Prends le pion : roi contre roi, c’est nul.'],
  },
  {
    id: 'devant', t: 'Le roi devant son pion', lvl: 1, fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', goal: 'promo', limit: 12,
    intro: 'Ton roi est sur la 6e rangée, devant ton pion. Fais dame.',
    rule: 'Roi sur la 6e rangée devant son pion (hors pion de tour) : c’est gagné, quel que soit le trait. Le roi ouvre la route, le pion suit.',
    plan: ['Ne pousse pas le pion trop tôt : place d’abord ton roi à côté de la case devant le pion.', 'Le roi contrôle la case de promotion, le pion avance.', 'Garde un œil sur le pat quand le roi adverse est coincé.'],
  },
  {
    id: 'opposition', t: 'L’opposition', lvl: 2, fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1', goal: 'promo', limit: 20,
    intro: 'Roi et pion contre roi, les rois face à face. Gagne en gardant l’opposition : ton pion a un coup de réserve.',
    rule: 'L’opposition : les rois face à face, une case entre eux, et c’est à l’autre de jouer. Le coup de pion sert à perdre un temps pour la reprendre.',
    plan: ['Avance ton roi devant le pion, pas le pion.', 'Quand les rois sont face à face et que c’est à toi, joue le pion d’une case : l’opposition change de camp.', 'Atteins la 6e rangée devant ton pion, puis fais dame.'],
  },
  {
    id: 'defense', t: 'Défendre roi contre roi et pion', lvl: 2, fen: '4k3/8/8/4P3/4K3/8/8/8 b - - 0 1', goal: 'nulle', limit: 20,
    intro: 'Tu as les Noirs, seul contre roi et pion. Tiens la nulle.',
    rule: 'Reste devant le pion et reprends l’opposition : quand le roi blanc vient à côté de son pion, mets ton roi face à lui.',
    plan: ['Bloque la case devant le pion avec ton roi.', 'Quand le roi blanc se place à côté, va en face de lui (opposition).', 'Acculé sur ta dernière rangée, reste devant le pion : c’est pat ou le pion tombe.'],
  },
  {
    id: 'percee', t: 'La percée de pions', lvl: 2, fen: '6k1/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1', goal: 'promo', limit: 8,
    intro: 'Trois pions contre trois, les rois sont loin. Fais dame le premier.',
    rule: 'Contre trois pions face à face, pousse le pion du milieu en sacrifice : un de tes pions passe forcément.',
    plan: ['Sacrifie le pion du milieu en le poussant d’une case.', 'Quel que soit le pion qui prend, pousse le pion qui se retrouve libre.', 'Encore un sacrifice si besoin, puis fais dame : le roi noir est trop loin.'],
  },
  {
    id: 'mauvaisfou', t: 'Le mauvais fou', lvl: 2, fen: 'k7/8/K7/P7/8/8/8/2B5 b - - 0 1', goal: 'nulle', limit: 15, noEval: true,
    intro: 'Tu as les Noirs : fou et pion de tour contre roi seul. Tiens la nulle.',
    rule: 'Pion de tour avec un fou qui ne contrôle pas la case de promotion : si ton roi atteint le coin, c’est nul.',
    plan: ['Reste dans le coin ou à côté.', 'Le fou ne peut jamais te chasser de la case de promotion, qui n’est pas de sa couleur.', 'Un pat, c’est la nulle que tu cherches.'],
  },
  {
    id: 'lucena', t: 'Lucena : construire le pont', lvl: 3, fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', goal: 'promo', limit: 15,
    intro: 'Finale de tours, ton pion est en 7e et ton roi devant lui. Sors le roi et fais dame.',
    rule: 'Le pont : la tour monte sur la 4e rangée pour couvrir les échecs latéraux de la tour adverse.',
    plan: ['Chasse d’abord le roi adverse d’une colonne de plus avec un échec de ta tour.', 'Place ta tour sur la 4e rangée.', 'Sors ton roi : quand les échecs arrivent, rapproche le roi de ta tour et interpose-la.'],
  },
  {
    id: 'philidor', t: 'Philidor : tenir la nulle en finale de tours', lvl: 3, fen: '4k3/8/r7/3KP3/8/8/8/7R b - - 0 1', goal: 'nulle', limit: 20,
    intro: 'Tu as les Noirs, une tour contre tour et pion. Tiens la nulle.',
    rule: 'Ta tour reste sur ta 3e rangée (la 6e pour les Blancs) pour empêcher le roi d’avancer. Quand le pion y arrive, ta tour passe derrière et donne l’échec de loin.',
    plan: ['Garde ta tour sur la 6e rangée tant que le pion n’y est pas.', 'Ton roi reste devant le pion.', 'Quand le pion avance en 6e, ta tour va sur la 1re rangée et donne l’échec par derrière.'],
  },
];
export const egById = (id) => ENDGAMES.find((x) => x.id === id);
export const GOAL_TXT = { mat: 'Mater', promo: 'Faire dame', nulle: 'Tenir la nulle' };
