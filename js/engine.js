// Stockfish (WASM, dans le navigateur) : file de calculs et évaluation brute d'une partie.
// Le classement des erreurs est dans classify.js.
/* global Chess */
import { MATE, replay } from './classify.js';

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

// Évalue chaque position d'une partie. Renvoie les données brutes { ev, best, pv, nb, depth },
// ou null si la partie est illisible ou si l'analyse est interrompue (alive() faux).
export async function evaluateGame(engine, game, depth, alive = () => true) {
  const r = replay(game);
  if (!r) return null;
  const ev = [], best = [], pv = [];
  for (const fen of r.fens) {
    if (!alive()) return null;
    const c = new Chess(fen), white = c.turn() === 'w';
    if (c.game_over()) { ev.push(c.in_checkmate() ? (white ? -MATE : MATE) : 0); best.push(null); pv.push([]); continue; }
    const e = await engine.evalFen(fen, depth);
    ev.push(white ? e.cp : -e.cp); best.push(e.best); pv.push(e.pv.slice(0, 4));
  }
  return { ev, best, pv, nb: r.mv.length, depth };
}
