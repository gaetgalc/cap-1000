// Découpe de js/app.js en modules (docs/PLAN-AMELIORATION.md, tâche 15) : déplacement pur, sans réécrire une ligne.
// node scripts/split-app.mjs plan.json [--dry] [--root js/]
// plan.json : { "views/cours.js": [["viewCours", "mountLecon"], ...] } : chaque paire désigne les déclarations de haut niveau
// de app.js de la première à la dernière nommée, dans l'ordre du fichier ; chaque déclaration emporte les commentaires
// collés au-dessus d'elle. Les imports et exports de chaque module sont calculés d'après les identifiants référencés ;
// les modules qui importaient de app.js un nom déplacé sont corrigés. Ce qui reste dans app.js et sert un module déplacé
// est exporté en fin de app.js (import circulaire : à n'utiliser qu'à l'intérieur des fonctions).
// Analyse approchée : un nom local qui masque un nom de haut niveau peut produire un import en trop (inoffensif, à retirer).
// Dépendances : acorn et acorn-walk (npm i --no-save acorn acorn-walk, ou NODE_PATH vers une installation existante).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const load = (m) => {
  for (const dir of ['', ...(process.env.NODE_PATH || '').split(':').filter(Boolean), '/opt/node-tools/node_modules']) { try { return require(dir ? path.join(dir, m) : m); } catch { /* suivant */ } }
  throw new Error(`${m} introuvable : npm i --no-save acorn acorn-walk`);
};
const acorn = load('acorn'), walk = load('acorn-walk');

const args = process.argv.slice(2), dry = args.includes('--dry');
const ROOT = path.resolve(args.includes('--root') ? args[args.indexOf('--root') + 1] : path.join(path.dirname(new URL(import.meta.url).pathname), '../js')) + '/';
const PLAN = JSON.parse(fs.readFileSync(args[0], 'utf8'));
const src = fs.readFileSync(ROOT + 'app.js', 'utf8'), lines = src.split('\n');
const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });

const decls = ast.body.map((n) => {
  const names = [];
  const add = (p) => { if (!p) return; if (p.type === 'Identifier') names.push(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach((q) => add(q.value || q.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach(add); };
  if (n.type === 'FunctionDeclaration') names.push(n.id.name);
  else if (n.type === 'VariableDeclaration') n.declarations.forEach((d) => add(d.id));
  return { n, names, line: n.loc.start.line, end: n.loc.end.line, imp: n.type === 'ImportDeclaration', exp: n.type === 'ExportNamedDeclaration' && !n.declaration };
});
const imports = {};
decls.filter((d) => d.imp).forEach((d) => d.n.specifiers.forEach((s) => (imports[s.local.name] = { src: d.n.source.value, name: s.type === 'ImportNamespaceSpecifier' ? '*' : s.imported.name })));
const idx = (name) => { const i = decls.findIndex((d) => d.names.includes(name)); if (i < 0) throw new Error(`déclaration introuvable : ${name}`); return i; };
const owner = {};
decls.forEach((d) => { d.mod = d.imp || d.exp ? null : 'app.js'; });
for (const [m, pairs] of Object.entries(PLAN)) for (const [a, b] of pairs) for (let i = idx(a); i <= idx(b ?? a); i++) if (decls[i].mod) decls[i].mod = m;
decls.forEach((d) => d.mod && d.names.forEach((x) => (owner[x] = d.mod)));
const isTop = (x) => x in owner || x in imports;
decls.forEach((d) => {
  d.refs = new Set();
  if (!d.mod) return;
  walk.fullAncestor(d.n, (node, anc) => {
    if (node.type !== 'Identifier') return;
    const p = anc[anc.length - 2];
    if (p?.type === 'MemberExpression' && p.property === node && !p.computed) return;
    if (p?.type === 'Property' && p.key === node && !p.computed && !p.shorthand) return;
    if (isTop(node.name) && !d.names.includes(node.name)) d.refs.add(node.name);
  });
  walk.full(d.n, (node) => {
    const t = node.type === 'AssignmentExpression' ? node.left : node.type === 'UpdateExpression' ? node.argument : null;
    if (t?.type === 'Identifier' && owner[t.name] && owner[t.name] !== d.mod && !d.names.includes(t.name)) throw new Error(`${d.mod} ligne ${d.line} écrit ${t.name}, déclaré dans ${owner[t.name]} : impossible à travers un import`);
  });
});
const mods = [...Object.keys(PLAN), 'app.js'];
const need = Object.fromEntries(mods.map((m) => [m, new Set()]));
decls.forEach((d) => d.mod && d.refs.forEach((r) => need[d.mod].add(r)));
const exportsOf = Object.fromEntries(mods.map((m) => [m, new Set()]));
mods.forEach((m) => need[m].forEach((r) => { if (owner[r] && owner[r] !== m) exportsOf[owner[r]].add(r); }));
const rel = (from, to) => {
  const t = to.replace(/^\.\//, ''), dir = path.posix.dirname(from);
  const r = path.posix.relative(dir, t);
  return r.startsWith('.') ? r : './' + r;
};
const order = (m) => [...new Set(Object.values(imports).map((i) => rel(m, i.src)))];
const importBlock = (m) => {
  const by = new Map(), put = (s, x) => (by.get(s) || by.set(s, []).get(s)).push(x);
  [...need[m]].sort().forEach((r) => {
    if (owner[r] && owner[r] !== m) put(rel(m, owner[r]), r);
    else if (!owner[r]) { const i = imports[r]; put(rel(m, i.src), i.name === '*' ? '* as ' + r : i.name === r ? r : `${i.name} as ${r}`); }
  });
  const o = order(m), keys = [...by.keys()].sort((a, b) => (o.indexOf(a) + 1 || 999) - (o.indexOf(b) + 1 || 999));
  return keys.map((s) => { const xs = by.get(s), ns = xs.find((x) => x.startsWith('* as ')); return ns ? `import ${ns} from '${s}';` : `import { ${xs.join(', ')} } from '${s}';`; }).join('\n');
};
// Lignes : chaque déclaration emporte les commentaires collés au-dessus (et l'en-tête de section « // ---------- » s'il la précède directement).
const lineOwner = new Array(lines.length + 2).fill('app.js');
decls.forEach((d) => {
  if (!d.mod) { for (let i = d.line; i <= d.end; i++) lineOwner[i] = null; return; }
  let a = d.line;
  while (a > 1 && /^\s*\/\//.test(lines[a - 2])) a--;
  for (let i = a; i <= d.end; i++) lineOwner[i] = d.mod;
});
const body = Object.fromEntries(mods.map((m) => [m, []]));
for (let i = 1; i <= lines.length; i++) if (lineOwner[i]) body[lineOwner[i]].push(lines[i - 1]);
const squeeze = (arr) => arr.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trimEnd();
const out = {};
for (const m of Object.keys(PLAN)) {
  const b = squeeze(body[m]), g = /\bChess\b/.test(b) ? '/* global Chess */\n' : '';
  out[m] = `${g}${importBlock(m)}\n\n${b}\n\nexport { ${[...exportsOf[m]].sort().join(', ')} };\n`;
}
const appNeed = need['app.js'];
const kept = decls.filter((d) => d.imp).map((d) => {
  const specs = d.n.specifiers.filter((s) => appNeed.has(s.local.name)); if (!specs.length) return null;
  const ns = specs.find((s) => s.type === 'ImportNamespaceSpecifier');
  return ns ? `import * as ${ns.local.name} from '${d.n.source.value}';` : `import { ${specs.map((s) => (s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`)).join(', ')} } from '${d.n.source.value}';`;
}).filter(Boolean);
const added = Object.keys(PLAN).map((m) => { const xs = [...appNeed].filter((r) => owner[r] === m).sort(); return xs.length ? `import { ${xs.join(', ')} } from '${rel('app.js', m)}';` : null; }).filter(Boolean);
// Modules existants qui importaient de app.js : leurs noms, déplacés ou non, gardés exportés.
const others = fs.readdirSync(ROOT, { recursive: true }).filter((f) => f.endsWith('.js') && f !== 'app.js' && !(f in PLAN));
const fix = {};
for (const f of others) {
  const t = fs.readFileSync(ROOT + f, 'utf8'), re = new RegExp(`^import \\{([^}]*)\\} from '${rel(f, 'app.js').replace(/\./g, '\\.')}';$`, 'm'), m = t.match(re);
  if (!m) continue;
  const names = m[1].split(',').map((x) => x.trim()).filter(Boolean), by = new Map();
  names.forEach((x) => { const o = owner[x]; if (!o) throw new Error(`${f} importe ${x} de app.js, qui ne le déclare pas`); exportsOf[o].add(x); const s = rel(f, o); (by.get(s) || by.set(s, []).get(s)).push(x); });
  fix[f] = t.replace(re, [...by].map(([s, xs]) => `import { ${xs.sort().join(', ')} } from '${s}';`).join('\n'));
}
for (const m of Object.keys(PLAN)) out[m] = out[m].replace(/export \{ (.*) \};\n$/, () => `export { ${[...exportsOf[m]].sort().join(', ')} };\n`);
const appEx = [...exportsOf['app.js']].sort();
out['app.js'] = `${lines[0].startsWith('/*') ? lines[0] + '\n' : ''}${[...kept, ...added].join('\n')}\n\n${squeeze(body['app.js'].filter((l, i) => !(i === 0 && l.startsWith('/*'))).filter((l) => !/^\/\/ Utilisés par les modules d'écran/.test(l)))}\n${appEx.length ? `\n// Utilisés par les modules d'écran (js/views/) : import circulaire, lu seulement à l'intérieur des fonctions.\nexport { ${appEx.join(', ')} };\n` : ''}`;
Object.assign(out, fix);
for (const [m, t] of Object.entries(out)) {
  if (dry) { console.log(`== ${m} : ${t.split('\n').length} lignes`); console.log(t.split('\n').filter((l) => /^(import|export) /.test(l)).join('\n')); continue; }
  fs.mkdirSync(path.dirname(ROOT + m), { recursive: true }); fs.writeFileSync(ROOT + m, t);
}
