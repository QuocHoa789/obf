'use strict';

/*
 * Lua 5.1 string.library + tonumber/tostring/table.concat/table.sort shim.
 * Translated 1:1 from C semantics (lstrlib.c, lobject.c, ltablib.c) so the
 * LuaSrcDiet JS port produces byte-identical output to the Lua original.
 * Positions are 1-based like Lua.
 */

const CHAR_CLASS = {
  a: '[A-Za-z]',
  A: '[^A-Za-z]',
  c: '[\\x00-\\x1f\\x7f]',
  C: '[^\\x00-\\x1f\\x7f]',
  d: '[0-9]',
  D: '[^0-9]',
  l: '[a-z]',
  L: '[^a-z]',
  p: '[!"#$%&\'()*+,\\-./:;<=>?@\\[\\\\\\]\\^_`{|}~]',
  P: '[^!"#$%&\'()*+,\\-./:;<=>?@\\[\\\\\\]\\^_`{|}~]',
  s: '[ \\t\\n\\r\\v\\f]',
  S: '[^ \\t\\n\\r\\v\\f]',
  u: '[A-Z]',
  U: '[^A-Z]',
  w: '[A-Za-z0-9]',
  W: '[^A-Za-z0-9]',
  x: '[0-9A-Fa-f]',
  X: '[^0-9A-Fa-f]',
  z: '[\\x00]',
  Z: '[^\\x00]',
};

function escapeOut(c) {
  return c.replace(/[\\^$.|?*+(){}\[\]]/g, '\\$&');
}

function compile(pattern) {
  let body = '';
  let i = 0;
  let ncap = 0;
  const n = pattern.length;
  let anchored = false;

  while (i < n) {
    const c = pattern[i];

    if (c === '^' && i === 0 && pattern.length > 1) {
      anchored = true;
      i++;
      continue;
    }

    if (c === '(') {
      ncap++;
      body += '(';
      i++;
      continue;
    }
    if (c === ')') {
      body += ')';
      i++;
      continue;
    }
    if (c === ']') throw new Error('malformed pattern (missing \'[\')');
    if (c === '[') {
      i++;
      let cls = '[';
      if (pattern[i] === '^') {
        cls += '^';
        i++;
      }
      for (;;) {
        if (i >= n) throw new Error('malformed pattern (missing \']\')');
        const k = pattern[i];
        if (k === ']') {
          cls += ']';
          i++;
          break;
        }
        if (k === '%') {
          i++;
          const e = pattern[i];
          const mapped = CHAR_CLASS[e];
          if (mapped) {
            cls += mapped.slice(1, -1);
          } else if ('\\^$().[]*+-?'.indexOf(e) >= 0) {
            cls += '\\' + e;
          } else {
            cls += escapeOut(e);
          }
          i++;
        } else if (k === '\\') {
          cls += escapeOut(k);
          i++;
        } else {
          cls += escapeOut(k);
          i++;
        }
      }
      body += cls;
      continue;
    }
    if (c === '%') {
      i++;
      const e = pattern[i];
      if (e >= '0' && e <= '9') {
        body += '\\' + e;
        i++;
        continue;
      }
      const mapped = CHAR_CLASS[e];
      if (mapped) {
        body += mapped;
        i++;
        continue;
      }
      if ('\\^$.()[]*+-?'.indexOf(e) >= 0) {
        body += '\\' + e;
        i++;
        continue;
      }
      body += escapeOut(e);
      i++;
      continue;
    }
    if (c === '.') {
      body += '[\\s\\S]';
      i++;
      continue;
    }
    if ('*+?'.indexOf(c) >= 0) {
      body += c;
      i++;
      continue;
    }
    if (c === '-') {
      body += '*?';
      i++;
      continue;
    }
    if (c === '$') {
      body += '$';
      i++;
      continue;
    }
    body += escapeOut(c);
    i++;
  }

  return { body, anchored, ncap };
}

function asNum(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return tonumberStrict(v);
  return null;
}

function clampInit(init, len) {
  if (init === undefined) return 1;
  if (typeof init === 'boolean') return 1;
  init = asNum(init);
  if (init === null) return 1;
  if (init < 0) {
    let p = len + init + 1;
    if (p < 1) p = 1;
    return p;
  }
  return init;
}

function runMatch(subject, compiled, init) {
  const slice = subject.substring(init - 1);
  const re = compiled.anchored
    ? new RegExp('^(?:' + compiled.body + ')')
    : new RegExp(compiled.body);
  const m = re.exec(slice);
  if (!m) return null;
  const start0 = (init - 1) + m.index;
  const start1 = start0 + 1;
  const end1 = start1 + m[0].length - 1;
  const caps = [];
  for (let k = 1; k <= compiled.ncap; k++) {
    const v = m[k] === undefined ? '' : m[k];
    caps.push(v);
  }
  return [start1, end1].concat(caps);
}

function find(s, pat, init, plain) {
  if (plain || typeof init === 'boolean') {
    if (typeof init === 'boolean' && !plain) plain = init;
    init = 1;
  }
  const len = s.length;
  init = clampInit(init, len);
  if (init > len + 1) return null;
  if (plain) {
    let idx;
    if (pat === '') {
      idx = Math.min(init - 1, len);
      return [idx + 1, idx];
    }
    idx = s.indexOf(pat, init - 1);
    if (idx < 0) return null;
    return [idx + 1, idx + pat.length];
  }
  const compiled = compile(pat);
  return runMatch(s, compiled, init);
}

function matchstring(s, pat, init) {
  init = clampInit(init, s.length);
  if (init > s.length + 1) return null;
  const compiled = compile(pat);
  const r = runMatch(s, compiled, init);
  if (!r) return null;
  const p = r[0];
  const e = r[1];
  const caps = r.slice(2);
  if (compiled.ncap === 0) return s.substring(p - 1, e);
  if (caps.length === 1) return caps[0];
  return caps;
}

function gmatch(s, pat) {
  const compiled = compile(pat);
  const re = new RegExp(compiled.body, 'g');
  const out = [];
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[0].length === 0) {
      if (re.lastIndex > s.length) break;
      re.lastIndex++;
    }
    if (compiled.ncap > 0) {
      const row = [];
      for (let k = 1; k <= compiled.ncap; k++) row.push(m[k] === undefined ? '' : m[k]);
      out.push(row);
    } else {
      out.push([m[0]]);
    }
  }
  return out;
}

function sub(s, i, j) {
  const len = s.length;
  const rel = (k) => (k < 0 ? len + k + 1 : k);
  i = rel(i === undefined ? 1 : i);
  if (j === undefined) j = len;
  else j = rel(j);
  if (i < 1) i = 1;
  if (j > len) j = len;
  if (i > j) return '';
  return s.slice(i - 1, j);
}

function bytes(s, i) {
  i = i === undefined ? 1 : i;
  if (i < 1 || i > s.length) return null;
  return s.charCodeAt(i - 1);
}

function chars() {
  let out = '';
  for (const a of arguments) out += String.fromCharCode(a);
  return out;
}

function rep(s, n) {
  return s.repeat(n);
}

function concatTable(list, sep, i, j) {
  if (sep === undefined) sep = '';
  if (i === undefined) i = 1;
  if (j === undefined) j = list.length;
  const parts = [];
  for (let k = i; k <= j; k++) parts.push(list[k - 1]);
  return parts.join(sep);
}

function luaFormat(fmt) {
  let s = '';
  let aid = 2;
  let i = 0;
  const L = fmt.length;
  while (i < L) {
    const c = fmt[i];
    if (c !== '%') {
      s += c;
      i++;
      continue;
    }
    i++;
    if (i >= L) break;
    if (fmt[i] === '%') {
      s += '%';
      i++;
      continue;
    }
    let left = false;
    if (fmt[i] === '-') {
      left = true;
      i++;
    }
    let width = '';
    while (i < L && fmt[i] >= '0' && fmt[i] <= '9') {
      width += fmt[i];
      i++;
    }
    let precision = -1;
    if (fmt[i] === '.') {
      i++;
      precision = 0;
      while (i < L && fmt[i] >= '0' && fmt[i] <= '9') {
        precision = precision * 10 + (fmt.charCodeAt(i) - 48);
        i++;
      }
    }
    const spec = fmt[i];
    i++;
    const a = arguments[aid++];
    let str;
    if (spec === 's') {
      str = a === undefined || a === null ? 'nil' : String(a);
    } else if (spec === 'd') {
      str = String(Math.trunc(Number(a) || 0));
    } else if (spec === 'f') {
      str = precision < 0 ? String(Number(a)) : Number(a).toFixed(precision);
    } else if (spec === 'g' || spec === 'G') {
      str = num2str(Number(a) || 0);
    } else {
      str = a === undefined || a === null ? '' : String(a);
    }
    if (width) {
      const w = parseInt(width, 10);
      if (str.length < w) {
        const pad = ' '.repeat(w - str.length);
        str = left ? str + pad : pad + str;
      }
    }
    s += str;
  }
  return s;
}

const HEX_RE = /^[ \t\n\r\v\f]*([+-]?)(0[xX])([0-9a-fA-F]+)[ \t\n\r\v\f]*$/;
const DEC_RE = /^[ \t\n\r\v\f]*([+-]?)((?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)[ \t\n\r\v\f]*$/;

function tonumberStrict(v, base) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  if (base !== undefined && base !== 10 && base !== 0) {
    let s = v.trim();
    let sign = 1;
    if (s[0] === '+' || s[0] === '-') { sign = s[0] === '-' ? -1 : 1; s = s.slice(1); }
    if (s.length === 0) return null;
    let n = 0;
    const b = base;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      let d;
      if (c >= 48 && c <= 57) d = c - 48;
      else if (c >= 97 && c <= 122) d = 10 + c - 97;
      else if (c >= 65 && c <= 90) d = 10 + c - 65;
      else return null;
      if (d >= b) return null;
      n = n * b + d;
    }
    return sign * n;
  }
  let m = HEX_RE.exec(v);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    return sign * parseInt(m[3], 16);
  }
  m = DEC_RE.exec(v);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * parseFloat(m[2]);
}

const tonumber = tonumberStrict;

function num2str(x) {
  if (x === 0) return Object.is(x, -0) ? '-0' : '0';
  const P = 14;
  const s = x.toPrecision(P);
  let e10 = 0, sig;
  if (s.indexOf('e') >= 0) {
    const sp = s.split('e');
    e10 = parseInt(sp[1], 10);
    sig = sp[0];
  } else {
    sig = s;
  }
  const dot = sig.indexOf('.');
  const decPos = dot < 0 ? sig.length : dot;
  const digits = sig.replace('.', '');
  const leadZeros = (digits.match(/^0*/))[0].length;
  const exp10 = e10 + decPos - 1 - leadZeros;
  let full;
  if (exp10 >= -4 && exp10 < P) {
    const fracPos = exp10 + 1;
    if (fracPos <= 0) {
      full = '0.' + '0'.repeat(-fracPos) + digits;
    } else if (digits.length <= fracPos) {
      full = digits + '0'.repeat(fracPos - digits.length);
    } else {
      full = digits.slice(0, fracPos) + '.' + digits.slice(fracPos);
    }
    if (full.indexOf('.') >= 0) {
      full = full.replace(/0+$/, '');
      if (full.endsWith('.')) full = full.slice(0, -1);
    }
  } else {
    let mant = digits[0];
    let rest = digits.slice(1).replace(/0+$/, '');
    if (rest) mant += '.' + rest;
    const eAbs = Math.abs(exp10);
    const eStr = (exp10 < 0 ? '-' : '+') + (eAbs < 10 ? '0' + eAbs : '' + eAbs);
    full = mant + 'e' + eStr;
  }
  return full;
}

function tostring(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') {
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    return num2str(v);
  }
  if (v === null || v === undefined) return 'nil';
  if (v === true) return 'true';
  if (v === false) return 'false';
  return String(v);
}

/*
 * Lua 5.1.5 table.sort (ltablib.c auxsort). Sorter operating on a JS array
 * with a comparator `comp(a, b)` returning whether a should come before b
 * (falsy treated like Lua's boolean result).
 */
function luaSort(arr, comp) {
  const n = arr.length;
  if (n <= 1) return arr;
  const A = arr;

  function swap(i, j) {
    const t = A[i - 1];
    A[i - 1] = A[j - 1];
    A[j - 1] = t;
  }

  function c(ai, aj) {
    return comp(ai, aj) === true;
  }

  function auxsort(l, u) {
    while (l < u) {
      /* sort elements a[l], a[(l+u)/2] and a[u] */
      if (c(A[u - 1], A[l - 1])) swap(l, u);
      if (u - l === 1) break; /* only 2 elements */
      let m = Math.floor((l + u) / 2);
      if (c(A[m - 1], A[l - 1])) {
        swap(m, l);
      } else {
        if (c(A[u - 1], A[m - 1])) swap(m, u);
      }
      if (u - l === 2) break; /* only 3 elements */
      /* a[l] <= P == a[u-1] <= a[u], sort from l+1 to u-2 */
      swap(m, u - 1); /* pivot P now sits at a[u-1] */
      const P = A[u - 2]; /* snapshot the pivot (1-based slot u-1), like Lua keeps it on the stack */
      let i = l;
      let j = u - 1;
      for (;;) {
        do {
          i++;
        } while (c(A[i - 1], P)); /* a[i] < P */
        do {
          j--;
        } while (c(P, A[j - 1])); /* P < a[j] */
        if (j < i) break;
        swap(i, j);
      }
      swap(u - 1, i); /* swap pivot (a[u-1]) with a[i] */
      if (i - l < u - i) {
        auxsort(l, i - 1);
        l = i + 1;
      } else {
        auxsort(i + 1, u);
        u = i - 1;
      }
    }
  }

  auxsort(1, n);
  return arr;
}

module.exports = {
  find,
  matchstring,
  gmatch,
  sub,
  byte: bytes,
  char: chars,
  rep,
  concat: concatTable,
  format: luaFormat,
  tonumber,
  tostring,
  sort: luaSort,
  compile,
  num2str,
  asNum,
};