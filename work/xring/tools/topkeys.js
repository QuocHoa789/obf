// Dev helper: list duplicate keys in the outer method table of an obfuscated file.
const { parse } = require('../AST/Parser');
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const ast = parse(src);
const unwrap = (n) => { while (n && n.type === 'ParenExpression') n = n.expr; return n; };
const findTable = (n) => {
  n = unwrap(n);
  if (!n || typeof n !== 'object') return null;
  if (n.type === 'TableConstructor') return n;
  if (n.type === 'CallExpression') return findTable(n.callee);
  if (n.type === 'MethodCallExpression') return findTable(n.object);
  return null;
};
const t = findTable(unwrap(ast.body[0].args[0]));
const keys = [];
for (const f of t.fields || []) if (f.type === 'TableKeyString') keys.push(f.key);
const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
console.log(process.argv[2], 'fields', (t.fields || []).length, 'keys', keys.length, 'dups', JSON.stringify([...new Set(dup)]));
