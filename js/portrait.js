// Portrait du joueur en langage humain : où, quand et comment il perd ses points. Au moins 5 parties analysées.
// Calcul pur, testé dans tests/portrait.test.mjs. Renvoie [{ k, t }].
const SUBIES = new Set(['en_prise_pose', 'en_prise_ignore', 'tactique_subie', 'mat_autorise']);
const RATEES = new Set(['cadeau_rate', 'tactique_ratee', 'mat_rate']);
const pc = (a, b) => Math.round((100 * a) / b);

export function portrait(games, an) {
  const gs = games.filter((g) => an[g.id] && !an[g.id].bad && an[g.id].errs);
  if (gs.length < 5) return [];
  const errs = gs.flatMap((g) => an[g.id].errs.filter((e) => e.kind !== 'imprecision' && e.theme).map((e) => ({ e, g })));
  const out = [];
  if (errs.length >= 5) {
    const no = (e) => Math.floor(e.ply / 2) + 1, ph = [['l’ouverture', 'les coups 1 et 12', (n) => n <= 12], ['milieu de partie', 'les coups 13 et 30', (n) => n > 12 && n <= 30], ['finale', 'le coup 31 et la fin', (n) => n > 30]];
    const [name, range, , n] = ph.map((p) => [...p, errs.filter((x) => p[2](no(x.e))).length]).sort((a, b) => b[3] - a[3])[0];
    if (n / errs.length >= 0.5) out.push({ k: 'phase', t: `Tu perds tes points ${name === 'l’ouverture' ? 'dans l’ouverture' : name === 'finale' ? 'en finale' : 'au milieu de partie'} : ${pc(n, errs.length)} % de tes erreurs graves entre ${range}.` });
    const timed = errs.filter(({ g }) => g.clk?.length === g.san?.length && g.base);
    if (timed.length >= 5) { const low = timed.filter(({ e, g }) => (e.ply >= 2 ? g.clk[e.ply - 2] : g.base) < 120).length; if (low / timed.length >= 0.4) out.push({ k: 'clock', t: `La pendule te coûte cher : ${pc(low, timed.length)} % de tes erreurs graves arrivent avec moins de 2 minutes.` }); }
    const su = errs.filter((x) => SUBIES.has(x.e.theme)).length, ra = errs.filter((x) => RATEES.has(x.e.theme)).length;
    if (su + ra >= 5 && Math.max(su, ra) / (su + ra) >= 0.6) out.push({ k: 'style', t: su > ra ? `Tu subis plus que tu ne rates : ${pc(su, su + ra)} % de tes erreurs tactiques sont des menaces adverses que tu n’as pas vues.` : `Tu laisses passer tes occasions : ${pc(ra, su + ra)} % de tes erreurs tactiques sont des gains que tu n’as pas vus.` });
  }
  const sc = (l) => (l.length ? pc(l.reduce((s, g) => s + (g.out === 'W' ? 1 : g.out === 'D' ? 0.5 : 0), 0), l.length) : null);
  const w = sc(gs.filter((g) => g.w)), b = sc(gs.filter((g) => !g.w));
  if (w != null && b != null && Math.abs(w - b) >= 15) out.push({ k: 'camp', t: `${w > b ? 'Les Blancs te réussissent mieux' : 'Les Noirs te réussissent mieux'} : ${w} % de score avec les Blancs, ${b} % avec les Noirs.` });
  const won = gs.filter((g) => an[g.id].maxAdv >= 300), lost = won.filter((g) => g.out !== 'W');
  if (won.length >= 3 && lost.length / won.length >= 0.3) out.push({ k: 'conv', t: `Tu as laissé filer ${lost.length} parties gagnantes sur ${won.length} (avantage de +3 ou plus) : la conversion est un chantier à part entière.` });
  return out;
}
