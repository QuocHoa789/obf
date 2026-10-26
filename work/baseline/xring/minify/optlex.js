'use strict';

/*
 * Port of luasrcdiet optlex.lua (lexer-based optimizations).
 * Token arrays are 0-based; all string ops via lstr.js are 1-based.
 */

const L = require('./lstr');

let print;

const M = {};
M.warn = {};

let stoks, sinfos, stoklns;

const is_realtoken = {
  TK_KEYWORD: true,
  TK_NAME: true,
  TK_NUMBER: true,
  TK_STRING: true,
  TK_LSTRING: true,
  TK_OP: true,
  TK_EOS: true,
};

const is_faketoken = {
  TK_COMMENT: true,
  TK_LCOMMENT: true,
  TK_EOL: true,
  TK_SPACE: true,
};

let opt_details;

function atlinestart(i) {
  const tok = stoks[i - 1];
  if (i <= 0 || tok === "TK_EOL") return true;
  if (tok === "") return atlinestart(i - 1);
  return false;
}

function atlineend(i) {
  const tok = stoks[i + 1];
  if (i >= stoks.length - 1 || tok === "TK_EOL" || tok === "TK_EOS") return true;
  if (tok === "") return atlineend(i + 1);
  return false;
}

function commenteols(lcomment) {
  const sep = L.matchstring(lcomment, "^%-%-%[=*%[").length;
  const z = L.sub(lcomment, sep + 1, -(sep - 1));
  let i = 1, c = 0;
  while (true) {
    const m = L.find(z, "([\r\n])([\r\n]?)", i);
    if (!m) break;
    i = m[0] + 1;
    c = c + 1;
    const s = m[3];
    const r = m[2];
    if (s.length > 0 && r !== s) i = i + 1;
  }
  return c;
}

function checkpair(i, j) {
  const t1 = stoks[i], t2 = stoks[j];

  if (t1 === "TK_STRING" || t1 === "TK_LSTRING" ||
      t2 === "TK_STRING" || t2 === "TK_LSTRING") {
    return "";

  } else if (t1 === "TK_OP" || t2 === "TK_OP") {
    if ((t1 === "TK_OP" && (t2 === "TK_KEYWORD" || t2 === "TK_NAME")) ||
        (t2 === "TK_OP" && (t1 === "TK_KEYWORD" || t1 === "TK_NAME"))) {
      return "";
    }
    if (t1 === "TK_OP" && t2 === "TK_OP") {
      const op = sinfos[i], op2 = sinfos[j];
      if ((L.matchstring(op, "^%.%.?$") != null && L.matchstring(op2, "^%.") != null) ||
          (L.matchstring(op, "^[~=<>]$") != null && op2 === "=") ||
          (op === "[" && (op2 === "[" || op2 === "="))) {
        return " ";
      }
      return "";
    }
    let op = sinfos[i];
    if (t2 === "TK_OP") op = sinfos[j];
    if (L.matchstring(op, "^%.%.?%.?$") != null) return " ";
    return "";

  } else {
    return " ";
  }
}

function repack_tokens() {
  const dtoks = [], dinfos = [], dtoklns = [];
  let j = 0;
  for (let i = 0; i < stoks.length; i++) {
    const tok = stoks[i];
    if (tok !== "") {
      dtoks[j] = tok;
      dinfos[j] = sinfos[i];
      dtoklns[j] = stoklns[i];
      j++;
    }
  }
  stoks = dtoks;
  sinfos = dinfos;
  stoklns = dtoklns;
}

function do_number(i) {
  const before = sinfos[i];
  let z = before;
  let y;

  if (L.matchstring(z, "^0[xX]") != null) {
    const v = L.tostring(L.tonumber(z));
    if (v.length <= z.length) {
      z = v;
    } else {
      return;
    }
  }

  if (L.matchstring(z, "^%d+$") != null) {
    const zn = L.tonumber(z);
    if (zn > 0) {
      y = L.matchstring(z, "^0*([1-9]%d*)$");
    } else {
      y = "0";
    }

  } else if (L.matchstring(z, "[eE]") == null) {
    const m = L.matchstring(z, "^(%d*)%.(%d*)$");
    if (m == null) return;
    let p = m[0], q = m[1];
    if (p === "") p = "0";
    if (q === "") q = "0";
    if (L.tonumber(q) === 0 && p === "0") {
      y = ".0";
    } else {
      const zeros_cnt = L.matchstring(q, "0*$").length;
      if (zeros_cnt > 0) q = L.sub(q, 1, q.length - zeros_cnt);
      if (L.tonumber(p) > 0) {
        y = p + "." + q;
      } else {
        y = "." + q;
        const v = L.matchstring(q, "^0*").length;
        const w = q.length - v;
        const nv = L.tostring(q.length);
        if (w + 2 + nv.length < 1 + q.length) {
          y = L.sub(q, -w) + "e-" + nv;
        }
      }
    }

  } else {
    const m = L.matchstring(z, "^([^eE]+)[eE]([%+%-]?%d+)$");
    if (m == null) return;
    let ex = L.tonumber(m[1]);
    let sig = m[0];
    const p = L.matchstring(sig, "^(%d*)%.(%d*)$");
    if (p != null) {
      ex = ex - p[1].length;
      sig = p[0] + p[1];
    }
    if (L.tonumber(sig) === 0) {
      y = ".0";
    } else {
      let v = L.matchstring(sig, "^0*").length;
      sig = L.sub(sig, v + 1);
      v = L.matchstring(sig, "0*$").length;
      if (v > 0) {
        sig = L.sub(sig, 1, sig.length - v);
        ex = ex + v;
      }
      const nex = L.tostring(ex);
      if (ex >= 0 && ex <= 1 + nex.length) {
        y = sig + L.rep("0", ex) + ".";
      } else if (ex < 0 && ex >= -sig.length) {
        v = sig.length + ex;
        y = L.sub(sig, 1, v) + "." + L.sub(sig, v + 1);
      } else if (ex < 0 && nex.length >= -ex - sig.length) {
        v = -ex - sig.length;
        y = "." + L.rep("0", v) + sig;
      } else {
        y = sig + "e" + ex;
      }
    }
  }

  if (y !== undefined && y !== sinfos[i]) {
    if (opt_details !== undefined && opt_details !== false) {
      print("<number> (line " + stoklns[i] + ") " + sinfos[i] + " -> " + y);
      opt_details = opt_details + 1;
    }
    sinfos[i] = y;
  }
}

function do_string(I) {
  const info = sinfos[I];
  let delim = L.sub(info, 1, 1);
  const ndelim = (delim === "'") ? '"' : "'";
  let z = L.sub(info, 2, -2);
  let i = 1;
  let c_delim = 0, c_ndelim = 0;
  let s;

  while (i <= z.length) {
    const c = L.sub(z, i, i);

    if (c === "\\") {
      let j = i + 1;
      const d = L.sub(z, j, j);
      let p = L.find("abfnrtv\\\n\r\"\'0123456789", d, 1, true);

      if (!p) {
        z = L.sub(z, 1, i - 1) + L.sub(z, j);
        i = i + 1;
      } else if (p[0] <= 8) {
        i = i + 2;
      } else if (p[0] <= 10) {
        const eol = L.sub(z, j, j + 1);
        if (eol === "\r\n" || eol === "\n\r") {
          z = L.sub(z, 1, i) + "\n" + L.sub(z, j + 2);
        } else if (p[0] === 10) {
          z = L.sub(z, 1, i) + "\n" + L.sub(z, j + 1);
        }
        i = i + 2;
      } else if (p[0] <= 12) {
        if (d === delim) {
          c_delim = c_delim + 1;
          i = i + 2;
        } else {
          c_ndelim = c_ndelim + 1;
          z = L.sub(z, 1, i - 1) + L.sub(z, j);
          i = i + 1;
        }
      } else {
        const s0 = L.matchstring(z, "^(%d%d?%d?)", j);
        j = i + 1 + s0.length;
        const cv = L.tonumber(s0);
        const cc = L.char(cv);
        p = L.find("\a\b\f\n\r\t\v", cc, 1, true);
        if (p) {
          const ppos = p[0];
          s = "\\" + L.sub("abfnrtv", ppos, ppos);
        } else if (cv < 32) {
          if (L.matchstring(L.sub(z, j, j), "%d") != null) {
            s = "\\" + s0;
          } else {
            s = "\\" + cv;
          }
        } else if (cc === delim) {
          s = "\\" + cc;
          c_delim = c_delim + 1;
        } else if (cc === "\\") {
          s = "\\\\";
        } else {
          s = cc;
          if (cc === ndelim) c_ndelim = c_ndelim + 1;
        }
        z = L.sub(z, 1, i - 1) + s + L.sub(z, j);
        i = i + s.length;
      }
    } else {
      i = i + 1;
      if (c === ndelim) c_ndelim = c_ndelim + 1;
    }
  }

  if (c_delim > c_ndelim) {
    i = 1;
    while (true) {
      const m = L.find(z, "([\'\"])", i);
      if (!m) break;
      const p0 = m[0];
      const r = m[2];
      if (r === delim) {
        z = L.sub(z, 1, p0 - 2) + L.sub(z, p0);
        i = p0;
      } else {
        z = L.sub(z, 1, p0 - 1) + "\\" + L.sub(z, p0);
        i = p0 + 2;
      }
    }
    delim = ndelim;
  }

  z = delim + z + delim;
  if (z !== sinfos[I]) {
    if (opt_details != null && opt_details !== false) {
      print("<string> (line " + stoklns[I] + ") " + sinfos[I] + " -> " + z);
      opt_details = opt_details + 1;
    }
    sinfos[I] = z;
  }
}

function do_lstring(I) {
  const info = sinfos[I];
  const delim1m = L.matchstring(info, "^%[=*%[");
  const sep = delim1m.length;
  let delim1 = delim1m;
  let delim2 = L.sub(info, -sep, -1);
  let z = L.sub(info, sep + 1, -(sep + 1));
  let y = "";
  let i = 1;

  while (true) {
    const m = L.find(z, "([\r\n])([\r\n]?)", i);
    let ln;
    if (!m) {
      ln = L.sub(z, i);
    } else if (m[0] >= i) {
      ln = L.sub(z, i, m[0] - 1);
    }
    if (ln !== "") {
      if (L.matchstring(ln, "%s+$") != null) {
        M.warn.LSTRING = "trailing whitespace in long string near line " + stoklns[I];
      }
      y = y + ln;
    }
    if (!m) break;
    i = m[0] + 1;
    const s = m[3];
    const r = m[2];
    if (s.length > 0 && r !== s) i = i + 1;
    if (!(i === 1 && i === m[0])) {
      y = y + "\n";
    }
  }

  if (sep >= 3) {
    let chk = sep - 1, okay;
    while (chk >= 2) {
      const delim = "%]" + L.rep("=", chk - 2) + "%]";
      if (L.matchstring(y + "]", delim) == null) okay = chk;
      chk = chk - 1;
    }
    if (okay) {
      const newsep = L.rep("=", okay - 2);
      delim1 = "[" + newsep + "[";
      delim2 = "]" + newsep + "]";
      sinfos[I] = delim1 + y + delim2;
    } else {
      sinfos[I] = delim1 + y + delim2;
    }
  } else {
    sinfos[I] = delim1 + y + delim2;
  }
}

function do_lcomment(I) {
  const info = sinfos[I];
  let delim1 = L.matchstring(info, "^%-%-%[=*%[");
  let sep = delim1.length;
  const delim2 = L.sub(info, -(sep - 2), -1);
  const z = L.sub(info, sep + 1, -(sep - 1));
  let y = "";
  let i = 1;

  while (true) {
    const m = L.find(z, "([\r\n])([\r\n]?)", i);
    let ln;
    if (!m) {
      ln = L.sub(z, i);
    } else if (m[0] >= i) {
      ln = L.sub(z, i, m[0] - 1);
    }
    if (ln !== "") {
      const ws = L.matchstring(ln, "%s*$");
      if (ws.length > 0) ln = L.sub(ln, 1, -(ws.length + 1));
      y = y + ln;
    }
    if (!m) break;
    i = m[0] + 1;
    const s = m[3];
    const r = m[2];
    if (s.length > 0 && r !== s) i = i + 1;
    y = y + "\n";
  }

  sep = sep - 2;
  if (sep >= 3) {
    let chk = sep - 1, okay;
    while (chk >= 2) {
      const delim = "%]" + L.rep("=", chk - 2) + "%]";
      if (L.matchstring(y, delim) == null) okay = chk;
      chk = chk - 1;
    }
    if (okay) {
      const newsep = L.rep("=", okay - 2);
      delim1 = "--[" + newsep + "[";
      const delim2b = "]" + newsep + "]";
      sinfos[I] = delim1 + y + delim2b;
      return;
    }
  }
  sinfos[I] = delim1 + y + delim2;
}

function do_comment(i) {
  let info = sinfos[i];
  const ws = L.matchstring(info, "%s*$");
  if (ws.length > 0) info = L.sub(info, 1, -(ws.length + 1));
  sinfos[i] = info;
}

function keep_lcomment(opt_keep, info) {
  if (!opt_keep) return false;
  const delim1 = L.matchstring(info, "^%-%-%[=*%[");
  const sep = delim1.length;
  const z = L.sub(info, sep + 1, -(sep - 1));
  if (L.find(z, opt_keep, 1, true) != null) return true;
  return false;
}

function optimize(option, toklist, semlist, toklnlist) {
  let opt_comments = option["opt-comments"];
  let opt_whitespace = option["opt-whitespace"];
  let opt_emptylines = option["opt-emptylines"];
  const opt_eols = option["opt-eols"];
  const opt_strings = option["opt-strings"];
  const opt_numbers = option["opt-numbers"];
  const opt_x = option["opt-experimental"];
  const opt_keep = option.KEEP;
  opt_details = option.DETAILS ? 0 : undefined;
  print = M.print || (function () {});
  if (opt_eols) {
    opt_comments = true;
    opt_whitespace = true;
    opt_emptylines = true;
  } else if (opt_x) {
    opt_whitespace = true;
  }

  stoks = toklist;
  sinfos = semlist;
  stoklns = toklnlist;
  let i = 0;
  let tok, info;
  let prev;

  function settoken(tok, info, I) {
    I = I === undefined ? i : I;
    stoks[I] = tok || "";
    sinfos[I] = info || "";
  }

  if (opt_x) {
    while (true) {
      tok = stoks[i], info = sinfos[i];
      if (tok === "TK_EOS") break;
      else if (tok === "TK_OP" && info === ";") {
        settoken("TK_SPACE", " ");
      }
      i = i + 1;
    }
    repack_tokens();
  }

  i = 0;
  while (true) {
    tok = stoks[i]; info = sinfos[i];

    const atstart = atlinestart(i);
    if (atstart) prev = undefined;

    if (tok === "TK_EOS") {
      break;
    } else if (tok === "TK_KEYWORD" || tok === "TK_NAME" || tok === "TK_OP") {
      prev = i;
    } else if (tok === "TK_NUMBER") {
      if (opt_numbers) do_number(i);
      prev = i;
    } else if (tok === "TK_STRING" || tok === "TK_LSTRING") {
      if (opt_strings) {
        if (tok === "TK_STRING") do_string(i);
        else do_lstring(i);
      }
      prev = i;
    } else if (tok === "TK_COMMENT") {
      if (opt_comments) {
        if (i === 0 && L.sub(info, 1, 1) === "#") {
          do_comment(i);
        } else {
          settoken();
        }
      } else if (opt_whitespace) {
        do_comment(i);
      }
    } else if (tok === "TK_LCOMMENT") {
      if (keep_lcomment(opt_keep, info)) {
        if (opt_whitespace) do_lcomment(i);
        prev = i;
      } else if (opt_comments) {
        const eols = commenteols(info);
        if (is_faketoken[stoks[i + 1]]) {
          settoken();
          tok = "";
        } else {
          settoken("TK_SPACE", " ");
        }
        if (!opt_emptylines && eols > 0) {
          settoken("TK_EOL", L.rep("\n", eols));
        }
        if (opt_whitespace && tok !== "") {
          i = i - 1;
        }
      } else {
        if (opt_whitespace) do_lcomment(i);
        prev = i;
      }
    } else if (tok === "TK_EOL") {
      if (atstart && opt_emptylines) {
        settoken();
      } else if (info === "\r\n" || info === "\n\r") {
        settoken("TK_EOL", "\n");
      }
    } else if (tok === "TK_SPACE") {
      if (opt_whitespace) {
        if (atstart || atlineend(i)) {
          settoken();
        } else {
          const ptok = stoks[prev];
          if (ptok === "TK_LCOMMENT") {
            settoken();
          } else {
            const ntok = stoks[i + 1];
            if (is_faketoken[ntok]) {
              if ((ntok === "TK_COMMENT" || ntok === "TK_LCOMMENT") &&
                  ptok === "TK_OP" && sinfos[prev] === "-") {
              } else {
                settoken();
              }
            } else {
              const s = checkpair(prev, i + 1);
              if (s === "") settoken();
              else settoken("TK_SPACE", " ");
            }
          }
        }
      }
    } else {
      error("unidentified token encountered");
    }

    i = i + 1;
  }
  repack_tokens();

  if (opt_eols) {
    i = 0;
    if (stoks[0] === "TK_COMMENT") {
      i = 2;
    }
    while (true) {
      tok = stoks[i];
      if (tok === "TK_EOS") break;
      else if (tok === "TK_EOL") {
        const t1 = stoks[i - 1], t2 = stoks[i + 1];
        if (is_realtoken[t1] && is_realtoken[t2]) {
          const s = checkpair(i - 1, i + 1);
          if (s === "" || t2 === "TK_EOS") settoken();
        }
      }
      i = i + 1;
    }
    repack_tokens();
  }

  if (opt_details != null && opt_details > 0) print();
  return [stoks, sinfos, stoklns];
}

M.optimize = optimize;
M.error = function (msg) { throw new Error(msg); };

module.exports = M;