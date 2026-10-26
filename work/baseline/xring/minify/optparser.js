'use strict';

/*
 * Port of luasrcdiet optparser.lua (parser-based optimizations).
 * 0-based arrays, 1-based xrefs.
 */

const L = require('./lstr');

const LETTERS0 = "etaoinshrdlucmfwypvbgkqjxz_ETAOINSHRDLUCMFWYPVBGKQJXZ";
const ALPHANUM0 = "etaoinshrdlucmfwypvbgkqjxz_0123456789ETAOINSHRDLUCMFWYPVBGKQJXZ";
let LETTERS, ALPHANUM;

function resetLetters() { LETTERS = LETTERS0; ALPHANUM = ALPHANUM0; }
resetLetters();

const SKIP_NAME = {};
'and break do else elseif end false for function if in local nil not or repeat return then true until while self _ENV'
  .split(/\s+/).forEach(function (v) { SKIP_NAME[v] = true; });

let toklist, seminfolist, tokpar, seminfopar, xrefpar,
    globalinfo, localinfo, statinfo,
    globaluniq, localuniq, var_new, varlist;

function preprocess(infotable) {
  const uniqtable = {};
  for (let i = 0; i < infotable.length; i++) {
    const obj = infotable[i];
    const name = obj.name;
    if (!uniqtable[name]) uniqtable[name] = { decl: 0, token: 0, size: 0 };
    const uniq = uniqtable[name];
    uniq.decl++;
    const xcount = obj.xref.length;
    uniq.token += xcount;
    uniq.size += xcount * name.length;
    if (obj.decl != null) {
      obj.id = i;
      obj.xcount = xcount;
      if (xcount > 1) {
        obj.first = obj.xref[1];
        obj.last = obj.xref[xcount - 1];
      }
    } else {
      uniq.id = i;
    }
  }
  return uniqtable;
}

function recalc_for_entropy(option) {
  const ACCEPT = {
    TK_KEYWORD: true, TK_NAME: true, TK_NUMBER: true,
    TK_STRING: true, TK_LSTRING: true
  };
  if (!option["opt-comments"]) {
    ACCEPT.TK_COMMENT = true;
    ACCEPT.TK_LCOMMENT = true;
  }
  const filtered = seminfolist.slice();
  for (let i = 0; i < localinfo.length; i++) {
    const obj = localinfo[i];
    for (let j = 0; j < obj.xcount; j++) {
      const p = obj.xref[j];
      filtered[p - 1] = "";
    }
  }
  const freq = [];
  for (let i = 0; i < 256; i++) freq[i] = 0;
  for (let i = 0; i < toklist.length; i++) {
    const tok = toklist[i];
    const info = filtered[i];
    if (ACCEPT[tok]) {
      for (let j = 0; j < info.length; j++) {
        const c = info.charCodeAt(j);
        freq[c]++;
      }
    }
  }
  function resort(symbols) {
    const symlist = [];
    for (let i = 0; i < symbols.length; i++) {
      symlist.push({ c: symbols.charCodeAt(i), freq: freq[symbols.charCodeAt(i)] });
    }
    L.sort(symlist, function (v1, v2) { return v1.freq > v2.freq; });
    return symlist.map(function (s) { return L.char(s.c); }).join('');
  }
  LETTERS = resort(LETTERS);
  ALPHANUM = resort(ALPHANUM);
}

function new_var_name() {
  const cletters = LETTERS.length;
  const calphanum = ALPHANUM.length;
  let v = var_new;
  let varname;
  if (v < cletters) {
    varname = LETTERS[v];
  } else {
    let range = cletters;
    let sz = 1;
    while (true) {
      v -= range;
      range *= calphanum;
      sz++;
      if (range > v) break;
    }
    const n = v % cletters;
    v = (v - n) / cletters;
    varname = LETTERS[n];
    while (sz > 1) {
      const m = v % calphanum;
      v = (v - m) / calphanum;
      varname += ALPHANUM[m];
      sz--;
    }
  }
  var_new++;
  return { name: varname, collide: globaluniq[varname] != null };
}

function stats_summary(globaluniq, localuniq, afteruniq, option) {
  var print = M.print || function () {};
  if (option.QUIET) return;
  let uniq_g = 0, uniq_li = 0, uniq_lo = 0;
  let decl_g = 0, decl_li = 0, decl_lo = 0;
  let token_g = 0, token_li = 0, token_lo = 0;
  let size_g = 0, size_li = 0, size_lo = 0;
  function avg(c, l) { return c === 0 ? 0 : l / c; }
  for (const name in globaluniq) {
    const uniq = globaluniq[name];
    uniq_g++; token_g += uniq.token; size_g += uniq.size;
  }
  for (const name in localuniq) {
    const uniq = localuniq[name];
    uniq_li++; decl_li += uniq.decl; token_li += uniq.token; size_li += uniq.size;
  }
  for (const name in afteruniq) {
    const uniq = afteruniq[name];
    uniq_lo++; decl_lo += uniq.decl; token_lo += uniq.token; size_lo += uniq.size;
  }
  const uniq_ti = uniq_g + uniq_li;
  const decl_ti = decl_g + decl_li;
  const token_ti = token_g + token_li;
  const size_ti = size_g + size_li;
  const uniq_to = uniq_g + uniq_lo;
  const decl_to = decl_g + decl_lo;
  const token_to = token_g + token_lo;
  const size_to = size_g + size_lo;
  const tabf2 = "%-16s%8d%8d%8d%8d%10.2f";
  const hl = L.rep("-", 58);
  print("*** local variable optimization summary ***\n" + hl);
  print(L.format(tabf2, "Global", uniq_g, decl_g, token_g, size_g, avg(token_g, size_g)));
  print(L.format(tabf2, "Local (in)", uniq_li, decl_li, token_li, size_li, avg(token_li, size_li)));
  print(L.format(tabf2, "TOTAL (in)", uniq_ti, decl_ti, token_ti, size_ti, avg(token_ti, size_ti)));
  print(hl);
  print(L.format(tabf2, "Local (out)", uniq_lo, decl_lo, token_lo, size_lo, avg(token_lo, size_lo)));
  print(L.format(tabf2, "TOTAL (out)", uniq_to, decl_to, token_to, size_to, avg(token_to, size_to)));
  print(hl + "\n");
}

function optimize_func1() {
  function is_strcall(j) {
    return (tokpar[j + 1] || "") === "(" &&
           (tokpar[j + 2] || "") === "<string>" &&
           (tokpar[j + 3] || "") === ")";
  }
  const del_list = {};
  let i = 0;
  while (i < tokpar.length) {
    const id = statinfo[i];
    if (id === "call" && is_strcall(i)) {
      del_list[i + 1] = true;
      del_list[i + 3] = true;
      i += 3;
    }
    i++;
  }
  const del_list2 = {};
  {
    let dst = 0;
    for (let src = 0; src < tokpar.length; src++) {
      if (del_list[src]) {
        del_list2[xrefpar[src]] = true;
        continue;
      }
      if (src > dst) {
        tokpar[dst] = tokpar[src];
        seminfopar[dst] = seminfopar[src];
        xrefpar[dst] = xrefpar[src] - (src - dst);
        statinfo[dst] = statinfo[src];
      }
      dst++;
    }
    tokpar.length = dst;
    seminfopar.length = dst;
    xrefpar.length = dst;
    statinfo.length = dst;
  }
  {
    let dst = 0;
    for (let src = 0; src < toklist.length; src++) {
      if (del_list2[src + 1]) continue;
      if (src > dst) {
        toklist[dst] = toklist[src];
        seminfolist[dst] = seminfolist[src];
      }
      dst++;
    }
    toklist.length = dst;
    seminfolist.length = dst;
  }
}

function optimize_locals(option) {
  var_new = 0;
  varlist = [];
  resetLetters();
  globaluniq = preprocess(globalinfo);
  localuniq = preprocess(localinfo);
  if (option["opt-entropy"]) recalc_for_entropy(option);
  const object = localinfo.slice();
  L.sort(object, function (v1, v2) { return v1.xcount > v2.xcount; });
  const temp = [];
  const used_specials = [];
  for (let i = 0; i < object.length; i++) {
    const obj = object[i];
    if (!obj.is_special) {
      temp.push(obj);
    } else {
      used_specials.push(obj.name);
    }
  }
  const objs = temp;
  let nobject = objs.length;
  while (nobject > 0) {
    let varname, gcollide;
    do {
      const r = new_var_name();
      varname = r.name;
      gcollide = r.collide;
    } while (SKIP_NAME[varname]);
    varlist.push(varname);
    let oleft = nobject;
    if (gcollide) {
      const gref = globalinfo[globaluniq[varname].id].xref;
      const ngref = gref.length;
      for (let ii = 0; ii < nobject; ii++) {
        const obj = objs[ii];
        let act = obj.act, rem = obj.rem;
        while (rem < 0) rem = localinfo[-rem - 1].rem;
        let drop = false;
        for (let jj = 0; jj < ngref; jj++) {
          const p = gref[jj];
          if (p >= act && p <= rem) { drop = true; break; }
        }
        if (drop) { obj.skip = true; oleft--; }
      }
    }
    while (oleft > 0) {
      let ii = 0;
      while (objs[ii].skip) ii++;
      oleft--;
      const obja = objs[ii];
      ii++;
      obja.newname = varname;
      obja.skip = true;
      obja.done = true;
      const first = obja.first, last = obja.last;
      const xref = obja.xref;
      if (first != null && oleft > 0) {
        let scanleft = oleft;
        while (scanleft > 0) {
          while (objs[ii].skip) ii++;
          scanleft--;
          const objb = objs[ii];
          ii++;
          let act = objb.act, rem = objb.rem;
          while (rem < 0) rem = localinfo[-rem - 1].rem;
          if (!(last < act || first > rem)) {
            if (act >= obja.act) {
              for (let jj = 0; jj < obja.xcount; jj++) {
                const p = xref[jj];
                if (p >= act && p <= rem) {
                  oleft--;
                  objb.skip = true;
                  break;
                }
              }
            } else {
              if (objb.last != null && objb.last >= obja.act) {
                oleft--;
                objb.skip = true;
              }
            }
          }
          if (oleft === 0) break;
        }
      }
    }
    const temp2 = [];
    for (let ii = 0; ii < nobject; ii++) {
      const obj = objs[ii];
      if (!obj.done) { obj.skip = false; temp2.push(obj); }
    }
    objs.length = 0;
    for (let ii = 0; ii < temp2.length; ii++) objs.push(temp2[ii]);
    nobject = objs.length;
  }
  for (let i = 0; i < localinfo.length; i++) {
    const obj = localinfo[i];
    const xref = obj.xref;
    if (obj.newname != null) {
      for (let j = 0; j < obj.xcount; j++) {
        const p = xref[j];
        seminfolist[p - 1] = obj.newname;
      }
      const tmp = obj.name;
      obj.name = obj.newname;
      obj.oldname = tmp;
    } else {
      obj.oldname = obj.name;
    }
  }
  for (let i = 0; i < used_specials.length; i++) varlist.push(used_specials[i]);
  const afteruniq = preprocess(localinfo);
  stats_summary(globaluniq, localuniq, afteruniq, option);
}

function optimize(option, _toklist, _seminfolist, xinfo) {
  toklist = _toklist;
  seminfolist = _seminfolist;
  tokpar = xinfo.toklist;
  seminfopar = xinfo.seminfolist;
  xrefpar = xinfo.xreflist;
  globalinfo = xinfo.globalinfo;
  localinfo = xinfo.localinfo;
  statinfo = xinfo.statinfo;
  if (option["opt-locals"]) optimize_locals(option);
  if (option["opt-experimental"]) optimize_func1();
}

const M = {
  optimize: optimize,
  print: undefined,
};

module.exports = M;