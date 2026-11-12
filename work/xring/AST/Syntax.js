'use strict';

/**
 * Lua 5.1 lexer for Xring.
 * Produces a flat token stream consumed by AST/Parser.js.
 */

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true',
  'until', 'while',
]);

const SYMBOLS = [
  '...', '..=', '..', '==', '~=', '<=', '>=',
  '+=', '-=', '*=', '/=', '%=', '//',
  '+', '-', '*', '/', '%', '^', '#',
  '=', '<', '>', '(', ')', '{', '}', '[', ']',
  ';', ':', ',', '.',
];

class SyntaxErrorLua extends Error {
  constructor(message, line, col) {
    super(`${message} at ${line}:${col}`);
    this.name = 'LuaSyntaxError';
    this.line = line;
    this.col = col;
  }
}

class Lexer {
  constructor(source, filename) {
    this.src = String(source);
    this.filename = filename || '=stdin';
    this.i = 0;
    this.line = 1;
    this.col = 1;
    // skip shebang
    if (this.src.startsWith('#!')) {
      const nl = this.src.indexOf('\n');
      if (nl >= 0) this._advance(nl + 1);
      else this._advance(this.src.length);
    }
  }

  tokenize() {
    const tokens = [];
    for (;;) {
      this._skipTrivia();
      if (this.i >= this.src.length) {
        tokens.push(this._tok('eof', '', this.line, this.col));
        break;
      }
      tokens.push(this._next());
    }
    return tokens;
  }

  _tok(type, value, line, col) {
    return { type, value, line, col, file: this.filename };
  }

  _peek(n) {
    return this.src.charCodeAt(this.i + (n || 0));
  }

  _ch(n) {
    return this.src.charAt(this.i + (n || 0));
  }

  _advance(n) {
    const count = n || 1;
    for (let k = 0; k < count; k++) {
      if (this.src[this.i] === '\n') {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
      this.i++;
    }
  }

  _skipTrivia() {
    for (;;) {
      while (this.i < this.src.length) {
        const c = this._ch();
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '\f' || c === '\v') {
          this._advance(1);
        } else break;
      }
      if (this._ch() === '-' && this._ch(1) === '-') {
        this._advance(2);
        if (this._ch() === '[') {
          const long = this._tryLongBracket(true);
          if (long !== null) continue;
        }
        while (this.i < this.src.length && this._ch() !== '\n') this._advance(1);
        continue;
      }
      break;
    }
  }

  _tryLongBracket(isComment) {
    const saveI = this.i;
    const saveLine = this.line;
    const saveCol = this.col;
    if (this._ch() !== '[') return null;
    this._advance(1);
    let eq = 0;
    while (this._ch() === '=') {
      eq++;
      this._advance(1);
    }
    if (this._ch() !== '[') {
      this.i = saveI;
      this.line = saveLine;
      this.col = saveCol;
      return null;
    }
    this._advance(1);
    const close = ']' + '='.repeat(eq) + ']';
    const start = this.i;
    const idx = this.src.indexOf(close, start);
    if (idx < 0) {
      throw new SyntaxErrorLua(
        isComment ? 'unfinished long comment' : 'unfinished long string',
        saveLine,
        saveCol,
      );
    }
    const content = this.src.slice(start, idx);
    this._advance(idx - start + close.length);
    return content;
  }

  _next() {
    const line = this.line;
    const col = this.col;
    const c = this._ch();

    if (c === '"' || c === "'") return this._shortString();
    if (c === '[') {
      const long = this._tryLongBracket(false);
      if (long !== null) {
        // Mark long-bracket strings so later passes (printer, string
        // encryption) can keep them byte-identical — notably the blob.
        const t = this._tok('string', this._normalizeLong(long), line, col);
        t.long = true;
        return t;
      }
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(this._ch(1)))) return this._number();

    if (/[A-Za-z_]/.test(c)) {
      let s = '';
      while (/[A-Za-z0-9_]/.test(this._ch())) {
        s += this._ch();
        this._advance(1);
      }
      if (KEYWORDS.has(s)) return this._tok(s, s, line, col);
      return this._tok('name', s, line, col);
    }

    for (const sym of SYMBOLS) {
      if (this.src.startsWith(sym, this.i)) {
        this._advance(sym.length);
        return this._tok(sym, sym, line, col);
      }
    }

    throw new SyntaxErrorLua(`unexpected character ${JSON.stringify(c)}`, line, col);
  }

  _normalizeLong(s) {
    // Lua skips a first newline in long strings
    if (s.startsWith('\r\n')) return s.slice(2);
    if (s.startsWith('\n') || s.startsWith('\r')) return s.slice(1);
    return s;
  }

  _shortString() {
    const line = this.line;
    const col = this.col;
    const q = this._ch();
    this._advance(1);
    let out = '';
    while (this.i < this.src.length) {
      const c = this._ch();
      if (c === q) {
        this._advance(1);
        return this._tok('string', out, line, col);
      }
      if (c === '\n' || c === '\r') {
        throw new SyntaxErrorLua('unfinished string', line, col);
      }
      if (c === '\\') {
        this._advance(1);
        out += this._escape();
      } else {
        out += c;
        this._advance(1);
      }
    }
    throw new SyntaxErrorLua('unfinished string', line, col);
  }

  _escape() {
    const c = this._ch();
    const map = {
      a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v',
      '\\': '\\', '"': '"', "'": "'", '\n': '\n', '\r': '\n',
    };
    if (c in map) {
      const extra = c === '\r' && this._ch(1) === '\n' ? 2 : 1;
      this._advance(c === '\r' && this._ch(1) === '\n' ? 2 : extra);
      return map[c];
    }
    if (c === 'x') {
      const h = this.src.slice(this.i + 1, this.i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(h)) {
        this._advance(3);
        return String.fromCharCode(parseInt(h, 16));
      }
    }
    if (c === 'u' && this._ch(1) === '{') {
      let j = this.i + 2;
      let hex = '';
      while (j < this.src.length && /[0-9a-fA-F]/.test(this.src[j])) {
        hex += this.src[j];
        j++;
      }
      if (this.src[j] === '}' && hex) {
        this._advance(j - this.i + 1);
        return String.fromCharCode(parseInt(hex, 16));
      }
    }
    if (c === 'z') {
      this._advance(1);
      while (this.i < this.src.length && /[ \t\r\n]/.test(this._ch())) this._advance(1);
      return '';
    }
    if (/[0-9]/.test(c)) {
      let n = '';
      for (let k = 0; k < 3 && /[0-9]/.test(this._ch()); k++) {
        n += this._ch();
        this._advance(1);
      }
      return String.fromCharCode(parseInt(n, 10) % 256);
    }
    this._advance(1);
    return c;
  }

  _number() {
    const line = this.line;
    const col = this.col;
    const start = this.i;
    const c1 = this._ch(1);

    if (this._ch() === '0' && (c1 === 'x' || c1 === 'X')) {
      this._advance(2);
      this._scanDigits(/[0-9a-fA-F]/, line, col, 'malformed hex number');
      const raw = this.src.slice(start, this.i);
      const tok = this._tok('number', parseInt(raw.slice(2).replace(/_/g, ''), 16), line, col);
      tok.raw = raw;
      return tok;
    }

    if (this._ch() === '0' && (c1 === 'b' || c1 === 'B')) {
      this._advance(2);
      this._scanDigits(/[01]/, line, col, 'malformed binary number');
      const raw = this.src.slice(start, this.i);
      const tok = this._tok('number', parseInt(raw.slice(2).replace(/_/g, ''), 2), line, col);
      tok.raw = raw;
      return tok;
    }

    this._scanDigits(/[0-9]/, line, col, 'malformed number', true);
    if (this._ch() === '.') {
      this._advance(1);
      while (/[0-9_]/.test(this._ch())) this._advance(1);
    }
    if (this._ch() === 'e' || this._ch() === 'E') {
      this._advance(1);
      if (this._ch() === '+' || this._ch() === '-') this._advance(1);
      this._scanDigits(/[0-9]/, line, col, 'malformed number');
    }
    const raw = this.src.slice(start, this.i);
    const n = parseFloat(raw.replace(/_/g, ''));
    if (!Number.isFinite(n)) throw new SyntaxErrorLua('malformed number', line, col);
    const tok = this._tok('number', n, line, col);
    tok.raw = raw;
    return tok;
  }

  _scanDigits(re, line, col, msg, optional) {
    let seen = false;
    for (;;) {
      const c = this._ch();
      if (re.test(c)) {
        seen = true;
        this._advance(1);
        continue;
      }
      // Luau/Xrings: `_` separators, including trailing `0x6_` / `0B1_`.
      if (c === '_' && seen) {
        this._advance(1);
        continue;
      }
      break;
    }
    if (!seen && !optional) throw new SyntaxErrorLua(msg, line, col);
  }
}

function tokenize(source, filename) {
  return new Lexer(source, filename).tokenize();
}

module.exports = { Lexer, tokenize, SyntaxErrorLua, KEYWORDS };
