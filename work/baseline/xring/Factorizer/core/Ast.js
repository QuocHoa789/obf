'use strict';

const SELF = 't';
const ENV = 'l';

const KEYWORDS = new Set([
  'and', 'break', 'continue', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true',
  'until', 'while',
]);

const LUA_GLOBALS = new Set([
  'type', 'tostring', 'tonumber', 'ipairs', 'pairs', 'next', 'select', 'pcall',
  'xpcall', 'error', 'unpack', 'getfenv', 'setfenv', 'setmetatable', 'getmetatable',
  'rawget', 'rawset', 'rawequal', 'print', 'assert', 'buffer', 'string', 'table',
  'math', 'bit32', 'bit', 'coroutine', 'debug', '_G', '_VERSION', 'true', 'false',
  'nil',
]);

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

function ident(name) {
  return { type: 'Identifier', name };
}

function bool(v) {
  return { type: 'BooleanLiteral', value: !!v };
}

function niln() {
  return { type: 'NilLiteral' };
}

function bin(op, left, right) {
  return { type: 'BinaryExpression', op, left, right };
}

function un(op, arg) {
  return { type: 'UnaryExpression', op, arg };
}

function mem(object, property) {
  return { type: 'MemberExpression', object, property };
}

function idx(object, index) {
  return { type: 'IndexExpression', object, index };
}

function call(callee, args) {
  return { type: 'CallExpression', callee, args: args || [] };
}

function mcall(object, method, args) {
  return { type: 'MethodCallExpression', object, method, args: args || [] };
}

function assign(vars, inits) {
  return {
    type: 'AssignmentStatement',
    vars: Array.isArray(vars) ? vars : [vars],
    inits: Array.isArray(inits) ? inits : [inits],
  };
}

function compound(target, op, value) {
  return { type: 'CompoundAssignment', target, op, value };
}

function localStat(names, init) {
  return { type: 'LocalStatement', names, init: init || [] };
}

function ifStat(cond, body, elseBody) {
  return {
    type: 'IfStatement',
    clauses: [{ cond, body: body || [] }],
    elseBody: elseBody || null,
  };
}

function ifChain(clauses, elseBody, preferElseif) {
  return {
    type: 'IfStatement',
    clauses: clauses || [],
    elseBody: elseBody || null,
    preferElseif: !!preferElseif,
  };
}

function tableCtor(values) {
  return {
    type: 'TableConstructor',
    fields: (values || []).map((v) => ({ type: 'TableValue', value: v })),
  };
}

function ret(args) {
  return { type: 'ReturnStatement', args: args || [] };
}

function paren(expr) {
  return { type: 'ParenExpression', expr };
}

function func(params, body, vararg) {
  return { type: 'FunctionExpression', params: params || [], vararg: !!vararg, body: body || [] };
}

function callStat(expr) {
  return { type: 'CallStatement', expr };
}

function brk() {
  return { type: 'BreakStatement' };
}

function cont() {
  return { type: 'ContinueStatement' };
}

function unwrap(e) {
  while (e && e.type === 'ParenExpression') e = e.expr;
  return e;
}

function clone(node) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(clone);
  const o = {};
  for (const k of Object.keys(node)) {
    if (k === 'loc') continue;
    o[k] = clone(node[k]);
  }
  return o;
}

function isFn(e) {
  e = unwrap(e);
  return e && (e.type === 'FunctionExpression' || e.type === 'FunctionDeclaration');
}

function usesVararg(node, nested) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'VarargExpression') return true;
  if (!nested && (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration')) {
    return false;
  }
  if (Array.isArray(node)) return node.some((n) => usesVararg(n, nested));
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'raw') continue;
    if (usesVararg(node[k], nested)) return true;
  }
  return false;
}

function containsType(node, type) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === type) return true;
  if (Array.isArray(node)) return node.some((n) => containsType(n, type));
  if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') return false;
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'raw') continue;
    if (containsType(node[k], type)) return true;
  }
  return false;
}

function collectLocalNames(stats, out) {
  out = out || new Set();
  for (const s of stats || []) {
    if (!s) continue;
    if (s.type === 'LocalStatement') {
      for (const n of s.names) out.add(n);
    } else if (s.type === 'FunctionDeclaration' && s.isLocal) {
      out.add(s.names[0]);
    } else if (s.type === 'IfStatement') {
      for (const c of s.clauses) collectLocalNames(c.body, out);
      if (s.elseBody) collectLocalNames(s.elseBody, out);
    } else if (s.type === 'WhileStatement' || s.type === 'RepeatStatement' || s.type === 'DoStatement') {
      collectLocalNames(s.body, out);
    } else if (s.type === 'ForNumericStatement' || s.type === 'ForGenericStatement') {
      collectLocalNames(s.body, out);
    }
  }
  return out;
}

function walkStats(stats, fn) {
  const out = [];
  for (const s of stats || []) {
    if (!s) continue;
    if (s.type === 'IfStatement') {
      out.push({
        type: 'IfStatement',
        clauses: s.clauses.map((c) => ({ cond: c.cond, body: walkStats(c.body, fn) })),
        elseBody: s.elseBody ? walkStats(s.elseBody, fn) : s.elseBody,
      });
    } else if (s.type === 'WhileStatement' || s.type === 'RepeatStatement' || s.type === 'DoStatement') {
      out.push({ ...s, body: walkStats(s.body, fn) });
    } else if (s.type === 'ForNumericStatement') {
      out.push({ ...s, body: walkStats(s.body, fn) });
    } else if (s.type === 'ForGenericStatement') {
      out.push({ ...s, body: walkStats(s.body, fn) });
    } else {
      const r = fn(s);
      if (Array.isArray(r)) for (const x of r) out.push(x);
      else if (r) out.push(r);
    }
  }
  return out;
}

function shortName(index) {
  const alphabet = LETTERS;
  if (index < alphabet.length) return alphabet[index];
  let n = index;
  let result = '';
  do {
    result = alphabet[n % alphabet.length] + result;
    n = Math.floor(n / alphabet.length) - 1;
  } while (n >= 0);
  return result;
}

function pickChar(rng, s) {
  return s[Math.floor(rng() * s.length)];
}

/**
 * Always 1-char: A-Z / a-z / `_`. Leans lowercase (~72%), `_` ~12%.
 * `len` is ignored (kept so callers don't break); 2-char is overflow-only
 * in allocVisualName.
 */
function visualName(rng, len) {
  rng = rng || Math.random;
  if (rng() < 0.12) return '_';
  return rng() < 0.28 ? pickChar(rng, UPPER) : pickChar(rng, LOWER);
}

function allocVisualName(used, rng, forbidden) {
  rng = rng || Math.random;
  used = used || new Set();
  const free = (n) => n && !KEYWORDS.has(n) && !used.has(n) && !(forbidden && forbidden.has(n));
  for (let i = 0; i < 200; i++) {
    const n = visualName(rng, 1);
    if (free(n)) {
      used.add(n);
      return n;
    }
  }
  const alphabet = '_' + LETTERS;
  for (let i = 0; i < alphabet.length; i++) {
    const n = alphabet[i];
    if (free(n)) {
      used.add(n);
      return n;
    }
  }
  for (let i = 0; i < 400; i++) {
    const n = visualName(rng, 2);
    if (free(n)) {
      used.add(n);
      return n;
    }
  }
  let k = 0;
  let n;
  do {
    n = shortName(k++);
  } while (!free(n));
  used.add(n);
  return n;
}

function sprinkleDigits(digits, rng, kind) {
  if (!rng || !digits) return digits;
  const midP = kind === 'bin' ? 0.14 : 0.08;
  const trailP = kind === 'bin' ? 0.14 : 0.18;
  const doubleMid = kind === 'bin' ? 0.22 : 0.08;
  const doubleTrail = kind === 'bin' ? 0.18 : 0.28;
  let out = digits.charAt(0);
  let since = 1;
  for (let i = 1; i < digits.length; i++) {
    if (since >= 2 && i < digits.length - 1 && rng() < midP && out.charAt(out.length - 1) !== '_') {
      out += '_';
      if (rng() < doubleMid) out += '_';
      since = 0;
    }
    out += digits.charAt(i);
    since++;
  }
  if (rng() < trailP && out.charAt(out.length - 1) !== '_') {
    out += '_';
    if (rng() < doubleTrail) out += '_';
  }
  return out || digits;
}

function encodeNumber(value, pick, forceStyle, rng) {
  if (!Number.isFinite(value)) return String(value);
  const neg = value < 0;
  const abs = Math.abs(value);
  const isInt = Number.isInteger(abs) && abs <= 0xffffffff;
  if (!isInt) return String(value);
  if (forceStyle === 'plain') return String(value);
  const n = abs >>> 0;
  const styles = ['hexU', 'hexU', 'hexU', 'hexU', 'hex', 'hex', 'dec', 'float', 'float'];
  if (n < 0x40000) styles.push('binU', 'binU', 'binU', 'bin');
  const style = forceStyle || (pick ? pick(styles) : 'hexU');
  let s;
  switch (style) {
    case 'hex':
      s = '0x' + sprinkleDigits(n.toString(16), rng, 'hex');
      break;
    case 'hexU':
      s = '0X' + sprinkleDigits(n.toString(16).toUpperCase(), rng, 'hex');
      break;
    case 'bin':
    case 'binU':
      s = (style === 'binU' ? '0B' : '0b') + sprinkleDigits(n.toString(2), rng, 'bin');
      break;
    case 'float':
      s = String(n) + '.0';
      break;
    default:
      s = String(n);
  }
  return neg ? '-' + s : s;
}

function numNode(value, pick, forceStyle, rng) {
  return { type: 'NumericLiteral', value, raw: encodeNumber(value, pick, forceStyle, rng) };
}

module.exports = {
  KEYWORDS,
  LUA_GLOBALS,
  SELF,
  ENV,
  ident,
  bool,
  niln,
  bin,
  un,
  mem,
  idx,
  call,
  mcall,
  assign,
  compound,
  localStat,
  ifStat,
  ifChain,
  ret,
  tableCtor,
  paren,
  func,
  callStat,
  brk,
  cont,
  unwrap,
  clone,
  isFn,
  usesVararg,
  containsType,
  collectLocalNames,
  walkStats,
  shortName,
  visualName,
  allocVisualName,
  encodeNumber,
  numNode,
};
