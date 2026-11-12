'use strict';

/*
 * Port of luasrcdiet llex.lua (Lua 5.1+ lexical analyzer).
 * Token arrays are 0-based; all source positions are 1-based (Lua).
 */

const L = require('./lstr');

const kw = {};
'and break continue do else elseif end false for function if in local nil not or repeat return then true until while'
  .split(/\s+/).forEach(function (w) { kw[w] = true; });

let z, sourceid, I, buff, ln, tok, seminfo, tokln;

const M = {};
M.error = undefined;

function addtoken(token, info) {
  tok.push(token);
  seminfo.push(info);
  tokln.push(ln);
}

function inclinenumber(i, is_tok) {
  let old = L.sub(z, i, i);
  i = i + 1;
  const c = L.sub(z, i, i);
  if ((c === "\n" || c === "\r") && c !== old) {
    old = old + c;
    i = i + 1;
  }
  if (is_tok) addtoken("TK_EOL", old);
  ln = ln + 1;
  I = i;
  return i;
}

function chunkid() {
  if (sourceid != null && L.matchstring(sourceid, '^[=@]') != null) {
    return L.sub(sourceid, 2);
  }
  return "[string]";
}

function errorline(s, line) {
  const e = M.error || (function (msg) { throw new Error(msg); });
  e(L.format("%s:%d: %s", chunkid(), (line != null ? line : ln), s));
}

function skip_sep(i) {
  const s = L.sub(z, i, i);
  i = i + 1;
  const count = L.matchstring(z, "=*", i).length;
  i = i + count;
  I = i;
  return (L.sub(z, i, i) === s) ? count : (-count) - 1;
}

function read_long_string(is_str, sep) {
  let i = I + 1;
  const c = L.sub(z, i, i);
  if (c === "\r" || c === "\n") i = inclinenumber(i);
  while (true) {
    const m = L.find(z, "([\r\n%]])", i);
    if (!m) {
      errorline(is_str ? "unfinished long string" : "unfinished long comment");
      return undefined;
    }
    i = m[0];
    const r = m[2];
    if (r === "]") {
      if (skip_sep(i) === sep) {
        buff = L.sub(z, buff, I);
        I = I + 1;
        return buff;
      }
      i = I;
    } else {
      i = inclinenumber(i);
    }
  }
}

function read_string(del) {
  let i = I;
  while (true) {
    const m = L.find(z, "([\n\r\\\"\'])", i);
    if (m) {
      if (m[2] === "\n" || m[2] === "\r") {
        errorline("unfinished string");
        return undefined;
      }
      i = m[0];
      let r = m[2];
      if (r === "\\") {
        i = i + 1;
        r = L.sub(z, i, i);
        if (r === "") break;
        const x = L.find("abfnrtv\n\r", r, 1, true);
        if (x) {
          if (x[0] > 7) {
            i = inclinenumber(i);
          } else {
            i = i + 1;
          }
        } else if (L.find(r, "%D") != null) {
          i = i + 1;
        } else {
          const m2 = L.find(z, "^(%d%d?%d?)", i);
          i = m2[1] + 1;
          if (L.tonumber(L.sub(z, m2[0], m2[1])) + 1 > 256) {
            errorline("escape sequence too large");
            return undefined;
          }
        }
      } else {
        i = i + 1;
        if (r === del) {
          I = i;
          return L.sub(z, buff, i - 1);
        }
      }
    } else {
      break;
    }
  }
  errorline("unfinished string");
  return undefined;
}

function init(_z, _sourceid) {
  z = _z;
  sourceid = _sourceid;
  I = 1;
  ln = 1;
  tok = [];
  seminfo = [];
  tokln = [];

  const m = L.find(z, "^(#[^\r\n]*)(\r?\n?)");
  if (m) {
    I = I + m[2].length;
    addtoken("TK_COMMENT", m[2]);
    if (m[3].length > 0) inclinenumber(I, true);
  }
}

function lex(source, source_name) {
  init(source, source_name);
  while (true) {
    let i = I;
    while (true) {
      let m = L.find(z, "^([_%a][_%w]*)", i);
      if (m) {
        const r = m[2];
        I = i + r.length;
        addtoken(kw[r] ? "TK_KEYWORD" : "TK_NAME", r);
        break;
      }

      m = L.find(z, "^(%.?)%d", i);
      if (m) {
        const r = m[2];
        if (r === ".") i = i + 1;
        let m2 = L.find(z, "^%d*[%.%d]*([eE]?)", i);
        let q = m2[1];
        const re = m2[2];
        i = q + 1;
        if (re.length === 1) {
          if (L.matchstring(z, "^[%+%-]", i) != null) i = i + 1;
        }
        m2 = L.find(z, "^[_%w]*", i);
        q = m2[1];
        I = q + 1;
        const v = L.sub(z, m[0], q);
        if (L.tonumber(v) == null) errorline("malformed number");
        addtoken("TK_NUMBER", v);
        break;
      }

      m = L.find(z, "^((%s)[ \t\v\f]*)", i);
      if (m) {
        const t = m[3];
        const r = m[2];
        if (t === "\n" || t === "\r") {
          inclinenumber(i, true);
        } else {
          I = m[1] + 1;
          addtoken("TK_SPACE", r);
        }
        break;
      }

      m = L.find(z, "^::", i);
      if (m) {
        I = m[1] + 1;
        addtoken("TK_OP", "::");
        break;
      }

      m = L.find(z, "^//", i);
      if (m) {
        I = m[1] + 1;
        addtoken("TK_OP", "//");
        break;
      }

      let r = L.matchstring(z, "^%p", i);
      if (r != null) {
        buff = i;
        const p = "-[\"'.=<>~".indexOf(r) + 1;
        if (p !== 0) {
          if (p <= 2) {
            if (p === 1) {
              const c = L.matchstring(z, "^%-%-(%[?)", i);
              if (c != null) {
                i = i + 2;
                let sep = -1;
                if (c === "[") sep = skip_sep(i);
                if (sep >= 0) {
                  addtoken("TK_LCOMMENT", read_long_string(false, sep));
                } else {
                  const nlm = L.find(z, "[\n\r]", i);
                  I = nlm ? nlm[0] : (z.length + 1);
                  addtoken("TK_COMMENT", L.sub(z, buff, I - 1));
                }
                break;
              }
            } else {
              const sep = skip_sep(i);
              if (sep >= 0) {
                addtoken("TK_LSTRING", read_long_string(true, sep));
              } else if (sep === -1) {
                addtoken("TK_OP", "[");
              } else {
                errorline("invalid long string delimiter");
              }
              break;
            }
          } else if (p <= 5) {
            if (p < 5) {
              I = i + 1;
              addtoken("TK_STRING", read_string(r));
              break;
            }
            r = L.matchstring(z, "^%.%.?%.?", i);
          } else {
            r = L.matchstring(z, "^%p=?", i);
          }
        }
        I = i + r.length;
        addtoken("TK_OP", r);
        break;
      }

      r = L.sub(z, i, i);
      if (r !== "") {
        I = i + 1;
        addtoken("TK_OP", r);
        break;
      }
      addtoken("TK_EOS", "");
      return [tok, seminfo, tokln];
    }
  }
}

M.lex = lex;

module.exports = M;