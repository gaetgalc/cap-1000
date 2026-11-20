// Produit vendor/book.txt à partir des fichiers a.tsv … e.tsv de lichess-org/chess-openings (domaine public, CC0) :
// node scripts/book.mjs <dossier des .tsv>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { posKey } from '../js/book.js';
const { Chess } = createRequire(import.meta.url)('../vendor/chess.js');
const dir = process.argv[2], keys = new Set();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsv'))) {
  for (const line of readFileSync(dir + '/' + f, 'utf8').split('\n').slice(1)) {
    const pgn = line.split('\t')[2]; if (!pgn) continue;
    const ch = new Chess();
    for (const t of pgn.split(/\s+/)) { if (/^\d+\.+$/.test(t) || !t) continue; if (!ch.move(t)) break; keys.add(posKey(ch.fen())); }
  }
}
writeFileSync(new URL('../vendor/book.txt', import.meta.url), [...keys].sort().join('\n') + '\n');
console.log(keys.size + ' positions');
