// Stockfish (WASM, dans le navigateur) : file de calculs et évaluation brute d'une partie.
// Le classement des erreurs est dans classify.js.
/* global Chess */
import { MATE, replay, candidates } from './classify.js';

export class Engine {
  // opts : options UCI envoyées au démarrage, par exemple { 'Skill Level': 6 } pour un adversaire bridé.
  constructor(opts = {}) {
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
        if (line === 'uciok') { for (const [k, v] of Object.entries(opts)) this.w.postMessage(`setoption name ${k} value ${v}`); this.w.postMessage('isready'); }
        else if (line === 'readyok') res();
        else if (this.cur) this.cur(line);
      };
      this.w.postMessage('uci');
    });
  }
  // Score du point de vue du camp au trait. cp borné, mat encodé en ±(MATE - n).
  // urgent : passe devant les calculs en attente (vérification d'un coup joué par l'utilisateur).
  // multi : nombre de lignes demandées ; le résultat porte alors lines: [{ cp, pv }], de la meilleure à la moins bonne.
  evalFen(fen, depth, urgent, multi = 1) {
    return new Promise((res, rej) => {
      if (this.dead) { rej(new Error('Le moteur d’analyse s’est arrêté.')); return; }
      const job = { fen, depth, multi, res, rej };
      if (urgent) this.jobs.unshift(job); else this.jobs.push(job);
      this.pump();
    });
  }
  async pump() {
    if (this.busy) return;
    const job = this.jobs.shift();
    if (!job) return;
    this.busy = true;
    try { await this.ready; job.res(await this.run(job.fen, job.depth, job.multi)); } catch (e) { job.rej(e); }
    this.busy = false;
    this.pump();
  }
  run(fen, depth, multi = 1) {
    return new Promise((res, rej) => {
      this.fail = rej;
      const lines = [];
      this.cur = (line) => {
        if (line.startsWith('info') && line.includes(' pv ') && !/bound/.test(line)) {
          const m = line.match(/score (cp|mate) (-?\d+)/);
          if (m) {
            const n = +m[2], k = +(line.match(/ multipv (\d+)/)?.[1] || 1) - 1;
            const cp = m[1] === 'cp' ? n : (n > 0 ? MATE - n : -MATE - n);
            lines[k] = { cp, pv: line.split(' pv ')[1].trim().split(/\s+/).slice(0, 10) };
          }
        } else if (line.startsWith('bestmove')) {
          this.cur = null; this.fail = null;
          if (multi > 1) this.w.postMessage('setoption name MultiPV value 1');
          const b = line.split(' ')[1], got = lines.filter(Boolean);
          res({ ...(got[0] || { cp: 0, pv: [] }), best: b && b !== '(none)' ? b : null, lines: got });
        }
      };
      if (multi > 1) this.w.postMessage('setoption name MultiPV value ' + multi);
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
  const mp = await multiPass(engine, game, ev, depth, alive);
  return mp ? { ev, best, pv, mp, nb: r.mv.length, depth } : null;
}

// Sur les positions où le joueur s'est trompé, cherche les 3 meilleurs coups : combien tenaient la position ?
// Renvoie { ply: [cp, cp, cp] } (point de vue du camp au trait), ou null si l'analyse est interrompue.
export async function multiPass(engine, game, ev, depth, alive = () => true) {
  const r = replay(game), mp = {};
  if (!r) return null;
  for (const i of candidates(game, ev)) {
    if (!alive()) return null;
    if (new Chess(r.fens[i]).game_over()) continue;
    const e = await engine.evalFen(r.fens[i], depth, false, 3);
    mp[i] = e.lines.map((l) => l.cp);
  }
  return mp;
}
