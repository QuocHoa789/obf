'use strict';

/**
 * StringsEncrypt — Xrings mixed character escaping.
 *
 * Rewrites every SHORT string literal ('...' / "...") with per-byte random
 * escaping: raw char, \xHH, \u{h}, \ddd, and named singles (\n \t ...).
 * Long strings ([[...]] / the XRING blob) and comments are passed through.
 */

const SINGLES = { 7: 'a', 8: 'b', 12: 'f', 10: 'n', 13: 'r', 9: 't', 11: 'v' };

function dec3(code) {
  return '\\' + String(code).padStart(3, '0');
}

function hex2(code) {
  return code.toString(16).padStart(2, '0');
}

function openLevel(src, i) {
  if (src[i] !== '[') return -1;
  let j = i + 1;
  let eq = 0;
  while (src[j] === '=') { eq++; j++; }
  return src[j] === '[' ? eq : -1;
}

function skipLong(src, i, level) {
  const n = src.length;
  let j = i;
  while (j < n) {
    if (src[j] === ']') {
      let k = j + 1;
      let eq = 0;
      while (src[k] === '=') { eq++; k++; }
      if (src[k] === ']' && eq === level) return k + 1;
    }
    j++;
  }
  return n;
}

function decodeShort(src, i, q) {
  const n = src.length;
  let v = '';
  const single = {
    a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11,
    '\\': 92, '"': 34, "'": 39, '\n': 10,
  };
  while (i < n) {
    const c = src[i];
    if (c === q) return { value: v, end: i + 1 };
    if (c === '\n' || c === '\r') return null;
    if (c === '\\') {
      i++;
      if (i >= n) return null;
      const e = src[i];
      if (e === '\r') {
        v += '\n';
        i++;
        if (src[i] === '\n') i++;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(single, e)) {
        v += String.fromCharCode(single[e]);
        i++;
        continue;
      }
      if (e === 'z') {
        i++;
        while (i < n && /[ \t\r\n\f\v]/.test(src[i])) i++;
        continue;
      }
      if (e === 'x') {
        const h = src.slice(i + 1, i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(h)) {
          v += String.fromCharCode(parseInt(h, 16));
          i += 3;
          continue;
        }
      }
      if (e === 'u' && src[i + 1] === '{') {
        let j = i + 2;
        let hex = '';
        while (j < n && /[0-9a-fA-F]/.test(src[j])) {
          hex += src[j];
          j++;
        }
        if (src[j] === '}' && hex) {
          v += String.fromCharCode(parseInt(hex, 16));
          i = j + 1;
          continue;
        }
      }
      if (/[0-9]/.test(e)) {
        let digits = '';
        for (let k = 0; k < 3 && i < n && /[0-9]/.test(src[i]); k++) {
          digits += src[i];
          i++;
        }
        v += String.fromCharCode(parseInt(digits, 10) % 256);
        continue;
      }
      v += e;
      i++;
      continue;
    }
    v += c;
    i++;
  }
  return null;
}

function encByte(code, qCode, rand) {
  if (code === 92) return '\\\\';
  if (code === qCode) return '\\' + String.fromCharCode(qCode);
  const r = rand();
  if (Object.prototype.hasOwnProperty.call(SINGLES, code) && r < 0.22) {
    return '\\' + SINGLES[code];
  }
  if (code >= 32 && code <= 126) {
    if (r < 0.40) return String.fromCharCode(code);
    if (r < 0.62) return '\\x' + hex2(code);
    if (r < 0.84) return '\\u{' + code.toString(16) + '}';
    return dec3(code);
  }
  if (r < 0.34) return '\\x' + hex2(code);
  if (r < 0.67) return '\\u{' + code.toString(16) + '}';
  return dec3(code);
}

function zSkip(rand) {
  const n = 1 + (rand() < 0.5 ? 1 : 0) + (rand() < 0.3 ? 1 : 0);
  return '\\z' + ' '.repeat(n);
}

function encodeValue(value, rand) {
  const hasSingle = value.includes("'");
  const hasDouble = value.includes('"');
  let q;
  if (hasSingle && !hasDouble) q = '"';
  else if (hasDouble && !hasSingle) q = "'";
  else q = rand() < 0.75 ? '"' : "'";
  const qCode = q.charCodeAt(0);
  let body = '';
  for (let k = 0; k < value.length; k++) {
    if ((k === 0 && rand() < 0.08) || (k > 0 && rand() < 0.16)) body += zSkip(rand);
    body += encByte(value.charCodeAt(k), qCode, rand);
  }
  return q + body + q;
}

function mixEscapeStrings(src, rand) {
  if (typeof src !== 'string') throw new TypeError('mixEscapeStrings expects a string');
  rand = rand || Math.random;
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '-' && src[i + 1] === '-') {
      const level = openLevel(src, i + 2);
      if (level >= 0) {
        const end = skipLong(src, i + 2, level);
        out += src.slice(i, end);
        i = end;
      } else {
        let j = i;
        while (j < n && src[j] !== '\n') j++;
        out += src.slice(i, j);
        i = j;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      const d = decodeShort(src, i + 1, ch);
      if (d === null) {
        out += ch;
        i++;
      } else {
        out += encodeValue(d.value, rand);
        i = d.end;
      }
      continue;
    }
    if (ch === '[') {
      const level = openLevel(src, i);
      if (level >= 0) {
        const end = skipLong(src, i, level);
        out += src.slice(i, end);
        i = end;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

function collectDecodedShorts(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '-' && src[i + 1] === '-') {
      const level = openLevel(src, i + 2);
      if (level >= 0) i = skipLong(src, i + 2, level);
      else {
        while (i < n && src[i] !== '\n') i++;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      const d = decodeShort(src, i + 1, ch);
      if (d) {
        out.push(d.value);
        i = d.end;
        continue;
      }
    }
    if (ch === '[') {
      const level = openLevel(src, i);
      if (level >= 0) {
        i = skipLong(src, i, level);
        continue;
      }
    }
    i++;
  }
  return out;
}

module.exports = { mixEscapeStrings, decodeShort, collectDecodedShorts, encodeValue };
