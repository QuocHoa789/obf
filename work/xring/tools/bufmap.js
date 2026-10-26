// Dev helper: decode the obfuscated `self.<field> = buffer[<name>]` wiring and
// report each alias field -> buffer function, plus how often it is called.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');

function luaUnescape(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') { out += c; continue; }
    const n = s[++i];
    if (n === 'z') { while (i + 1 < s.length && /\s/.test(s[i + 1])) i++; continue; }
    if (n === 'x') { out += String.fromCharCode(parseInt(s.substr(i + 1, 2), 16)); i += 2; continue; }
    if (n === 'u') {
      const m = /^\{([0-9a-fA-F]+)\}/.exec(s.slice(i + 1));
      out += String.fromCodePoint(parseInt(m[1], 16));
      i += m[0].length;
      continue;
    }
    if (n === '\n') continue;
    if (/[0-9]/.test(n)) {
      let d = n;
      while (d.length < 3 && /[0-9]/.test(s[i + 1] || '')) d += s[++i];
      out += String.fromCharCode(parseInt(d, 10));
      continue;
    }
    out += n;
  }
  return out;
}

const strings = new Map();
for (const m of src.matchAll(/([A-Za-z_]\w{0,3})="((?:[^"\\]|\\.)*)"/g)) {
  if (!strings.has(m[1])) strings.set(m[1], luaUnescape(m[2]));
}
const map = new Map();
for (const m of src.matchAll(/([A-Za-z_]\w{0,3})\.([A-Za-z_]\w{0,3})\)?=\(?(?:[A-Za-z_]\w{0,3})\)?\[(?:[A-Za-z_]\w{0,3})\.([A-Za-z_]\w{0,3})\]/g)) {
  const fld = m[2], key = m[3];
  const name = strings.get(key);
  if (name) map.set(fld, name);
}
for (const [f, name] of map) {
  const n = (src.match(new RegExp('\\.' + f + '\\(', 'g')) || []).length;
  console.log(f.padEnd(4), name.padEnd(12), 'calls=' + n);
}
