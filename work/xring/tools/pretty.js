// Dev helper: split single-line generated Lua into one statement per line so
// runtime tracebacks point at a statement. Purely textual, no reflow of
// expressions.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
let out = '';
let depth = 0;
let i = 0;
while (i < src.length) {
  const c = src[i];
  if (c === '"' || c === "'") {
    const q = c;
    out += c;
    i += 1;
    while (i < src.length) {
      const d = src[i];
      out += d;
      if (d === '\\') { out += src[i + 1]; i += 2; continue; }
      i += 1;
      if (d === q) break;
    }
    continue;
  }
  if (c === '[') {
    const rest = src.slice(i);
    const m = /^\[(=*)\[/.exec(rest);
    if (m) {
      const close = ']' + m[1] + ']';
      const end = src.indexOf(close, i + m[0].length);
      const chunk = end < 0 ? rest : src.slice(i, end + close.length);
      out += chunk;
      i += chunk.length;
      continue;
    }
    depth += 1;
    out += c;
    i += 1;
    continue;
  }
  if (c === '(' || c === '{') { depth += 1; out += c; i += 1; continue; }
  if (c === ')' || c === '}') { depth = Math.max(0, depth - 1); out += c; i += 1; continue; }
  if (c === ']') { depth = Math.max(0, depth - 1); out += c; i += 1; continue; }
  if (c === ';') { out += ';\n'; i += 1; continue; }
  out += c;
  i += 1;
}
fs.writeFileSync(process.argv[3] || '/tmp/pretty.lua', out);
console.log('lines:', out.split('\n').length);
