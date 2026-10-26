'use strict';

/*
 * Port of luasrcdiet lparser.lua (Lua 5.1+ parser).
 * Grammar token arrays are 0-based; xref values are 1-based (original
 * lexer token positions).
 */

const L = require('./lstr');

const M = {};
M.error = undefined;

let toklist, seminfolist, toklnlist, xreflist, tpos,
    line, lastln, tok, seminfo, ln, xref, nameref,
    fs, top_fs,
    globalinfo, globallookup, localinfo, ilocalinfo, ilocalrefs, statinfo;

const block_follow = {};
'else elseif end until <eof>'.split(/\s+/).forEach(function (v) { block_follow[v] = true; });

const binopr_left = {};
const binopr_right = {};
(function () {
  const ops = {
    '+': [6, 6], '-': [6, 6], '*': [7, 7], '/': [7, 7], '//': [7, 7], '%': [7, 7],
    '^': [10, 9], '..': [5, 4],
    '~=': [3, 3], '==': [3, 3], '<': [3, 3], '<=': [3, 3], '>': [3, 3], '>=': [3, 3],
    'and': [2, 2], 'or': [1, 1]
  };
  for (const op in ops) {
    binopr_left[op] = ops[op][0];
    binopr_right[op] = ops[op][1];
  }
})();

const unopr = { 'not': true, '-': true, '#': true };
const UNARY_PRIORITY = 8;

function errorline(s, line) {
  const e = M.error || (function (msg) { throw new Error(msg); });
  e(L.format("(source):%d: %s", (line != null ? line : ln), s));
}

function nextt() {
  lastln = toklnlist[tpos];
  tok = toklist[tpos];
  seminfo = seminfolist[tpos];
  ln = toklnlist[tpos];
  xref = xreflist[tpos];
  tpos = tpos + 1;
}

function lookahead() {
  return toklist[tpos];
}

function syntaxerror(msg) {
  if (tok !== "<number>" && tok !== "<string>") {
    if (tok === "<name>") tok = seminfo;
    tok = "'" + tok + "'";
  }
  errorline(msg + " near " + tok);
}

function error_expected(token) { syntaxerror("'" + token + "' expected"); }

function testnext(c) { if (tok === c) { nextt(); return true; } return false; }

function check(c) { if (tok !== c) error_expected(c); }

function checknext(c) { check(c); nextt(); }

function check_condition(c, msg) { if (!c) syntaxerror(msg); }

function check_match(what, who, where) {
  if (!testnext(what)) {
    if (where === ln) error_expected(what);
    else syntaxerror("'" + what + "' expected (to close '" + who + "' at line " + where + ")");
  }
}

function str_checkname() {
  check("<name>");
  const ts = seminfo;
  nameref = xref;
  nextt();
  return ts;
}

function trimLocalStack() {
  while (ilocalinfo.length > 0 && ilocalinfo[ilocalinfo.length - 1] === undefined) {
    ilocalinfo.pop();
    ilocalrefs.pop();
  }
}

function new_localvar(name, special) {
  const bl = fs.bl;
  const locallist = bl ? bl.locallist : fs.locallist;
  const id = localinfo.length;
  const obj = { name: name, xref: [nameref], decl: nameref };
  if (special || name === "_ENV") obj.is_special = true;
  localinfo.push(obj);
  trimLocalStack();
  ilocalinfo.push(id);
  ilocalrefs.push(locallist);
}

function adjustlocalvars(nvars) {
  trimLocalStack();
  const sz = ilocalinfo.length;
  const start = sz - nvars;
  for (let ii = start; ii < sz; ii++) {
    const id = ilocalinfo[ii];
    const obj = localinfo[id];
    obj.act = xref;
    ilocalinfo[ii] = undefined;
    const locallist = ilocalrefs[ii];
    ilocalrefs[ii] = undefined;
    const existing = locallist[obj.name];
    if (existing != null) {
      localinfo[existing].rem = -(id + 1);
    }
    locallist[obj.name] = id;
  }
}

function removevars() {
  const bl = fs.bl;
  const locallist = bl ? bl.locallist : fs.locallist;
  for (const k in locallist) {
    localinfo[locallist[k]].rem = xref;
  }
}

function new_localvarliteral(name, special) {
  if (name[0] === "(") return;
  new_localvar(name, special);
}

function searchvar(fss, n) {
  let bl = fss.bl;
  let locallist;
  if (bl) {
    locallist = bl.locallist;
    while (locallist) {
      if (locallist[n] != null) return locallist[n];
      bl = bl.prev;
      locallist = bl ? bl.locallist : null;
    }
  }
  locallist = fss.locallist;
  return locallist[n] != null ? locallist[n] : -1;
}

function singlevaraux(fss, n, v) {
  if (fss == null) {
    v.k = "VGLOBAL";
    return "VGLOBAL";
  }
  const s = searchvar(fss, n);
  if (s >= 0) {
    v.k = "VLOCAL";
    v.id = s;
    return "VLOCAL";
  }
  if (singlevaraux(fss.prev, n, v) === "VGLOBAL") return "VGLOBAL";
  v.k = "VUPVAL";
  return "VUPVAL";
}

function singlevar(v) {
  const name = str_checkname();
  singlevaraux(fs, name, v);
  if (v.k === "VGLOBAL") {
    let id = globallookup[name];
    if (id == null) {
      id = globalinfo.length;
      globalinfo.push({ name: name, xref: [nameref] });
      globallookup[name] = id;
    } else {
      globalinfo[id].xref.push(nameref);
    }
  } else {
    localinfo[v.id].xref.push(nameref);
  }
}

function enterblock(isbreakable) {
  const bl = {};
  bl.isbreakable = isbreakable;
  bl.prev = fs.bl;
  bl.locallist = {};
  fs.bl = bl;
}

function leaveblock() {
  removevars();
  fs.bl = fs.bl.prev;
}

function open_func() {
  let new_fs;
  if (!fs) new_fs = top_fs;
  else new_fs = {};
  new_fs.prev = fs;
  new_fs.bl = null;
  new_fs.locallist = {};
  fs = new_fs;
}

function close_func() {
  removevars();
  fs = fs.prev;
}

function field(v) {
  nextt();
  str_checkname();
  v.k = "VINDEXED";
}

function yindex() {
  nextt();
  expr({});
  checknext("]");
}

function recfield() {
  if (tok === "<name>") str_checkname();
  else yindex();
  checknext("=");
  expr({});
}

function listfield(cc) { expr(cc.v); }

function constructor(t) {
  const line = ln;
  const cc = { v: { k: "VVOID" } };
  t.k = "VRELOCABLE";
  checknext("{");
  do {
    if (tok === "}") break;
    const c = tok;
    if (c === "<name>") {
      if (lookahead() !== "=") listfield(cc); else recfield();
    } else if (c === "[") recfield();
    else listfield(cc);
  } while (testnext(",") || testnext(";"));
  check_match("}", "{", line);
}

function parlist() {
  let nparams = 0;
  if (tok !== ")") {
    do {
      const c = tok;
      if (c === "<name>") { new_localvar(str_checkname()); nparams += 1; }
      else if (c === "...") { nextt(); fs.is_vararg = true; }
      else syntaxerror("<name> or '...' expected");
    } while (!fs.is_vararg && testnext(","));
  }
  adjustlocalvars(nparams);
}

function funcargs(f) {
  const line = ln;
  const c = tok;
  if (c === "(") {
    if (line !== lastln) syntaxerror("ambiguous syntax (function call x new statement)");
    nextt();
    if (tok !== ")") explist1();
    check_match(")", "(", line);
  } else if (c === "{") {
    constructor({});
  } else if (c === "<string>") {
    nextt();
  } else {
    syntaxerror("function arguments expected");
    return;
  }
  f.k = "VCALL";
}

function prefixexp(v) {
  const c = tok;
  if (c === "(") {
    const line = ln;
    nextt();
    expr(v);
    check_match(")", "(", line);
  } else if (c === "<name>") {
    singlevar(v);
  } else {
    syntaxerror("unexpected symbol");
  }
}

function primaryexp(v) {
  prefixexp(v);
  while (true) {
    const c = tok;
    if (c === ".") field(v);
    else if (c === "[") { v.k = "VLOCAL"; yindex(); }
    else if (c === ":") { nextt(); str_checkname(); funcargs(v); }
    else if (c === "(" || c === "<string>" || c === "{") funcargs(v);
    else return;
  }
}

function simpleexp(v) {
  const c = tok;
  if (c === "<number>") v.k = "VKNUM";
  else if (c === "<string>") v.k = "VK";
  else if (c === "nil") v.k = "VNIL";
  else if (c === "true") v.k = "VTRUE";
  else if (c === "false") v.k = "VFALSE";
  else if (c === "...") {
    check_condition(fs.is_vararg === true, "cannot use '...' outside a vararg function");
    v.k = "VVARARG";
  } else if (c === "{") { constructor(v); return; }
  else if (c === "function") { nextt(); body(false, ln); return; }
  else { primaryexp(v); return; }
  nextt();
}

function subexpr(v, limit) {
  let op = tok;
  const uop = unopr[op];
  if (uop) {
    nextt();
    subexpr(v, UNARY_PRIORITY);
  } else {
    simpleexp(v);
  }
  op = tok;
  let binop = binopr_left[op];
  while (binop != null && binop > limit) {
    nextt();
    op = subexpr({}, binopr_right[op]);
    binop = binopr_left[op];
  }
  return op;
}

function assignment(v) {
  const c = v.v.k;
  check_condition(c === "VLOCAL" || c === "VUPVAL" || c === "VGLOBAL" || c === "VINDEXED", "syntax error");
  if (testnext(",")) {
    const nv = { v: {} };
    primaryexp(nv.v);
    assignment(nv);
  } else {
    checknext("=");
    explist1();
  }
}

function forbody(nvars) {
  checknext("do");
  enterblock(false);
  adjustlocalvars(nvars);
  block();
  leaveblock();
}

function fornum(varname) {
  new_localvarliteral("(for index)");
  new_localvarliteral("(for limit)");
  new_localvarliteral("(for step)");
  new_localvar(varname);
  checknext("=");
  exp1();
  checknext(",");
  exp1();
  if (testnext(",")) exp1();
  forbody(1);
}

function forlist(indexname) {
  new_localvarliteral("(for generator)");
  new_localvarliteral("(for state)");
  new_localvarliteral("(for control)");
  new_localvar(indexname);
  let nvars = 1;
  while (testnext(",")) { new_localvar(str_checkname()); nvars += 1; }
  checknext("in");
  explist1();
  forbody(nvars);
}

function funcname(v) {
  let needself = false;
  singlevar(v);
  while (tok === ".") field(v);
  if (tok === ":") { needself = true; field(v); }
  return needself;
}

function exp1() {
  expr({});
}

function explist1() {
  const e = {};
  expr(e);
  while (testnext(",")) expr(e);
}

function body(needself, line) {
  open_func();
  checknext("(");
  if (needself) { new_localvarliteral("self", true); adjustlocalvars(1); }
  parlist();
  checknext(")");
  chunk();
  check_match("end", "function", line);
  close_func();
}

function block() {
  enterblock(false);
  chunk();
  leaveblock();
}

function expr(v) {
  subexpr(v, 0);
}

function cond() { expr({}); }

function test_then_block() {
  nextt();
  cond();
  checknext("then");
  block();
}

function localfunc() {
  new_localvar(str_checkname());
  adjustlocalvars(1);
  body(false, ln);
}

function localstat() {
  let nvars = 0;
  do {
    new_localvar(str_checkname());
    nvars += 1;
  } while (testnext(","));
  if (testnext("=")) explist1();
  adjustlocalvars(nvars);
}

function for_stat() {
  const stline = line;
  enterblock(true);
  nextt();
  const varname = str_checkname();
  const c = tok;
  if (c === "=") fornum(varname);
  else if (c === "," || c === "in") forlist(varname);
  else syntaxerror("'=' or 'in' expected");
  check_match("end", "for", line);
  leaveblock();
}

function while_stat() {
  const stline = line;
  nextt();
  cond();
  enterblock(true);
  checknext("do");
  block();
  check_match("end", "while", line);
  leaveblock();
}

function repeat_stat() {
  const stline = line;
  enterblock(true);
  enterblock(false);
  nextt();
  chunk();
  check_match("until", "repeat", line);
  cond();
  leaveblock();
  leaveblock();
}

function if_stat() {
  const stline = line;
  test_then_block();
  while (tok === "elseif") test_then_block();
  if (tok === "else") { nextt(); block(); }
  check_match("end", "if", line);
}

function return_stat() {
  nextt();
  const c = tok;
  if (!block_follow[c] && c !== ";") explist1();
}

function break_stat() {
  let bl = fs.bl;
  nextt();
  while (bl && !bl.isbreakable) bl = bl.prev;
  if (!bl) syntaxerror("no loop to break");
}

function continue_stat() {
  let bl = fs.bl;
  nextt();
  while (bl && !bl.isbreakable) bl = bl.prev;
  if (!bl) syntaxerror("no loop to continue");
}

function label_stat() {
  nextt();
  str_checkname();
  checknext("::");
}

function goto_stat() {
  nextt();
  str_checkname();
}

function expr_stat() {
  const id = tpos - 1;
  const v = { v: {} };
  primaryexp(v.v);
  if (v.v.k === "VCALL") {
    statinfo[id] = "call";
  } else {
    v.prev = null;
    assignment(v);
    statinfo[id] = "assign";
  }
}

function function_stat() {
  const stline = line;
  nextt();
  const needself = funcname({});
  body(needself, line);
}

function do_stat() {
  const stline = line;
  nextt();
  block();
  check_match("end", "do", line);
}

function local_stat() {
  nextt();
  if (testnext("function")) localfunc();
  else localstat();
}

const stat_call = {
  'if': if_stat, 'while': while_stat, 'do': do_stat,
  'for': for_stat, 'repeat': repeat_stat, 'function': function_stat,
  'local': local_stat, 'return': return_stat, 'break': break_stat,
  'continue': continue_stat, '::': label_stat
};

function stat() {
  line = ln;
  const c = tok;
  const fn = stat_call[c];
  if (fn) {
    statinfo[tpos - 1] = c;
    fn();
    if (c === "return") return true;
  } else {
    expr_stat();
  }
  return false;
}

function chunk() {
  let islast = false;
  while (!islast && !block_follow[tok]) {
    islast = stat();
    testnext(";");
  }
}

function init(tokorig, seminfoorig, toklnorig) {
  tpos = 0;
  top_fs = {};
  toklist = []; seminfolist = []; toklnlist = []; xreflist = [];
  let j = 0;
  for (let i = 0; i < tokorig.length; i++) {
    let tok2 = tokorig[i];
    let yep = true;
    if (tok2 === "TK_KEYWORD" || tok2 === "TK_OP") tok2 = seminfoorig[i];
    else if (tok2 === "TK_NAME") { tok2 = "<name>"; seminfolist[j] = seminfoorig[i]; }
    else if (tok2 === "TK_NUMBER") { tok2 = "<number>"; seminfolist[j] = 0; }
    else if (tok2 === "TK_STRING" || tok2 === "TK_LSTRING") { tok2 = "<string>"; seminfolist[j] = ""; }
    else if (tok2 === "TK_EOS") { tok2 = "<eof>"; }
    else yep = false;
    if (yep) {
      toklist[j] = tok2;
      toklnlist[j] = toklnorig[i];
      xreflist[j] = i + 1;
      j++;
    }
  }
  globalinfo = [];
  globallookup = {};
  localinfo = [];
  ilocalinfo = [];
  ilocalrefs = [];
  statinfo = {};
}

function parse(tokens, seminfoArr, tokens_ln) {
  init(tokens, seminfoArr, tokens_ln);
  open_func();
  fs.is_vararg = true;
  nextt();
  chunk();
  check("<eof>");
  close_func();
  return {
    globalinfo: globalinfo,
    localinfo: localinfo,
    statinfo: statinfo,
    toklist: toklist,
    seminfolist: seminfolist,
    toklnlist: toklnlist,
    xreflist: xreflist
  };
}

M.parse = parse;

module.exports = M;