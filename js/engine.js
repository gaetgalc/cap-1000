// Stockfish (WASM, dans le navigateur) + détection et classement des erreurs.
/* global Chess */
export const MATE = 100000;
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export class Engine {
  constructor() {
    this.jobs = [];
    this.busy = false;
    this.cur = null;
    this.ready = new Promise((res, rej) => {
      try {
        this.w = new Worker('vendor/stockfish-19-lite-single.js');
      } catch (e) { rej(e); return; }
      this.w.onerror = () => {
        this.dead = true;
        const err = new Error('Le moteur d’analyse s’est arrêté.');
        rej(err);
        if (this.fail) this.fail(err);
        for (const j of this.jobs.splice(0)) j.rej(err);
      };
      this.w.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data);
        if (line === 'uciok') this.w.postMessage('isready');
        else if (line === 'readyok') res();
        else if (this.cur) this.cur(line);
      };
      this.w.postMessage('uci');
    });
  }
  // Score du point de vue du camp au trait. cp borné, mat encodé en ±(MATE - n).
  // urgent : passe devant les calculs en attente (vérification d'un coup joué par l'utilisateur).
  evalFen(fen, depth, urgent) {
    return new Promise((res, rej) => {
      if (this.dead) { rej(new Error('Le moteur d’analyse s’est arrêté.')); return; }
      const job = { fen, depth, res, rej };
      if (urgent) this.jobs.unshift(job); else this.jobs.push(job);
      this.pump();
    });
  }
  async pump() {
    if (this.busy) return;
    const job = this.jobs.shift();
    if (!job) return;
    this.busy = true;
    try { await this.ready; job.res(await this.run(job.fen, job.depth)); } catch (e) { job.rej(e); }
    this.busy = false;
    this.pump();
  }
  run(fen, depth) {
    return new Promise((res, rej) => {
      this.fail = rej;
      let last = { cp: 0, pv: [] };
      this.cur = (line) => {
        if (line.startsWith('info') && line.includes(' pv ') && !/bound/.test(line)) {
          const m = line.match(/score (cp|mate) (-?\d+)/);
          if (m) {
            const n = +m[2];
            const cp = m[1] === 'cp' ? n : (n > 0 ? MATE - n : -MATE - n);
            last = { cp, pv: line.split(' pv ')[1].trim().split(/\s+/).slice(0, 10) };
          }
        } else if (line.startsWith('bestmove')) {
          this.cur = null; this.fail = null;
          const b = line.split(' ')[1];
          res({ ...last, best: b && b !== '(none)' ? b : null });
        }
      };
      this.w.postMessage('position fen ' + fen);
      this.w.postMessage('go depth ' + depth);
    });
  }
  stop() { try { this.w.terminate(); } catch { /* rien */ } }
}

// Probabilité de gain (%) pour un score en centipions.
export function winPct(cp) {
  if (cp >= MATE - 1000) return 100;
  if (cp <= -MATE + 1000) return 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
export function fmtEval(cp) {
  if (cp >= MATE - 1000) return 'M' + (MATE - cp);
  if (cp <= -MATE + 1000) return '-M' + (MATE + cp);
  return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
}
const isMate = (cp) => Math.abs(cp) >= MATE - 1000;

export function uciMove(ch, uci) {
  if (!uci) return null;
  return ch.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
}
// Une prise gagne-t-elle du matériel ? gain = valeur prise (si non reprise) ou différence.
function freeCapture(fen, uci) {
  const c = new Chess(fen);
  const m = uciMove(c, uci);
  if (!m || !m.captured) return null;
  const rec = c.moves({ verbose: true }).some((x) => x.to === m.to);
  const capV = VAL[m.captured];
  return { m, gain: rec ? capV - VAL[m.piece] : capV };
}
function tacticIn(fen, pv) {
  if (!pv || pv.length < 3) return false;
  const c = new Chess(fen);
  if (!uciMove(c, pv[0]) || !uciMove(c, pv[1])) return false;
  const f = freeCapture(c.fen(), pv[2]);
  return !!f && f.gain >= 2;
}
function phase(fen, ply) {
  if (ply < 20) return 'ouverture';
  let tot = 0, queens = 0;
  for (const ch of fen.split(' ')[0].toLowerCase()) { if ('nbrq'.includes(ch)) tot += VAL[ch]; if (ch === 'q') queens++; }
  return (tot <= 10 || (queens === 0 && tot <= 16)) ? 'finale' : 'milieu';
}
function sanLine(fen, pv, n = 4) {
  const c = new Chess(fen); const out = [];
  for (const u of (pv || []).slice(0, n)) { const m = uciMove(c, u); if (!m) break; out.push(m.san); }
  return out;
}

// Analyse complète d'une partie. Renvoie { ev[], errs[], acc, nb } ou null si illisible.
export async function analyzeGame(engine, game, depth, alive = () => true) {
  const ch = new Chess();
  const fens = [ch.fen()], mv = [];
  for (const s of game.san) {
    const m = ch.move(s, { sloppy: true });
    if (!m) break;
    mv.push(m); fens.push(ch.fen());
  }
  if (mv.length < 4) return null;
  const ev = [], best = [], pvs = [];
  for (let i = 0; i < fens.length; i++) {
    if (!alive()) return null;
    const c = new Chess(fens[i]);
    const white = c.turn() === 'w';
    if (c.game_over()) {
      ev.push(c.in_checkmate() ? (white ? -MATE : MATE) : 0); best.push(null); pvs.push([]);
    } else {
      const r = await engine.evalFen(fens[i], depth);
      ev.push(white ? r.cp : -r.cp); best.push(r.best); pvs.push(r.pv);
    }
  }
  const pov = (cp) => (game.w ? cp : -cp);
  const errs = []; let sumDrop = 0, nMine = 0, maxAdv = -MATE;
  for (let i = 0; i < mv.length; i++) {
    const mine = (i % 2 === 0) === game.w;
    if (!mine) continue;
    const e0 = pov(ev[i]), e1 = pov(ev[i + 1]);
    maxAdv = Math.max(maxAdv, e0);
    const drop = Math.max(0, winPct(e0) - winPct(e1));
    sumDrop += drop; nMine++;
    if (drop < 5 || !best[i]) continue;
    const played = mv[i].from + mv[i].to + (mv[i].promotion || '');
    if (played === best[i]) continue;
    const kind = drop >= 20 ? 'gaffe' : drop >= 10 ? 'erreur' : 'imprecision';
    let theme = null;
    if (kind !== 'imprecision') {
      const reply = pvs[i + 1]?.[0];
      const fc = reply ? freeCapture(fens[i + 1], reply) : null;
      const bc = freeCapture(fens[i], best[i]);
      if (isMate(e0) && e0 > 0 && !(isMate(e1) && e1 > 0)) theme = 'mat_rate';
      else if (isMate(e1) && e1 < 0 && !(isMate(e0) && e0 < 0)) theme = 'mat_autorise';
      else if (fc && fc.gain >= 2) theme = fc.m.to === mv[i].to ? 'en_prise_pose' : 'en_prise_ignore';
      else if (bc && bc.gain >= 2) theme = 'cadeau_rate';
      else if (tacticIn(fens[i + 1], pvs[i + 1])) theme = 'tactique_subie';
      else if (tacticIn(fens[i], pvs[i])) theme = 'tactique_ratee';
      else { const ph = phase(fens[i], i); theme = ph === 'milieu' ? 'plan' : ph; }
    }
    const cb = new Chess(fens[i]); const bm = uciMove(cb, best[i]);
    errs.push({
      ply: i, kind, theme, drop: Math.round(drop), fen: fens[i], e0, e1,
      played: mv[i].san, playedUci: played, best: best[i], bestSan: bm ? bm.san : best[i],
      prev: i > 0 ? mv[i - 1].from + mv[i - 1].to : null,
      punish: sanLine(fens[i + 1], pvs[i + 1], 3), line: sanLine(fens[i], pvs[i], 4),
      ph: phase(fens[i], i),
    });
  }
  return {
    ev, errs, nb: mv.length, maxAdv,
    acc: nMine ? Math.round((100 - sumDrop / nMine) * 10) / 10 : null,
    last: pov(ev[ev.length - 1]), depth,
  };
}
