'use strict';

/**
 * Xrings makeup — thưa, chỉ dispatcher:
 *
 *   if A[j]>A[j] then C=d
 *   elseif v==v then REAL
 *   elseif j>=0x6_ then d=d-0b1;A[d]=k; p=T[0X1][9]((k+k+k-v-C+W),(W))
 *   else d=d+0b1 end
 *   j=T[0x1][22]((((v+C)>W+v and j or j-v)==q+v-C and C or p),(W))
 *
 * Live wrap (sound): (v>v and j-v or X) ≡ X
 * Dead soup: unique linear combo, no +a-a cancel.
 * Cap ~2 chains / file. Never wrap CFF next-state.
 */

const {
  paren, ident, bin, assign, numNode, unwrap, ifChain, idx, call, clone, SELF, ENV,
} = require('../core/Ast');

function chance(rng, p) {
  return rng() < p;
}

function wrap(node, rng, p) {
  if (!node || node.type === 'ParenExpression') return node;
  return chance(rng, p) ? paren(node) : node;
}

function pick(arr, rng) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function pickDistinct(arr, n, rng) {
  if (!arr || !arr.length) return [];
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  const out = copy.slice(0, Math.min(n, copy.length));
  while (out.length < n) out.push(copy[out.length % copy.length] || copy[0]);
  return out;
}

function num(v, rng) {
  return numNode(v, (styles) => styles[Math.floor(rng() * styles.length)], null, rng);
}

function markIdent(n, out) {
  n = unwrap(n);
  if (n && n.type === 'Identifier') {
    const name = n.name;
    if (name && name !== SELF && name !== ENV && name !== 'self' && name !== 'n') out.add(name);
  }
}

function collectNumeric(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const x of node) collectNumeric(x, out);
    return;
  }
  switch (node.type) {
    case 'FunctionExpression':
    case 'FunctionDeclaration':
      return;
    case 'BinaryExpression': {
      const arith = node.op === '+' || node.op === '-' || node.op === '*' || node.op === '/'
        || node.op === '%' || node.op === '^' || node.op === '..'
        || node.op === '<' || node.op === '>' || node.op === '<=' || node.op === '>=';
      if (arith) {
        markIdent(node.left, out);
        markIdent(node.right, out);
      }
      collectNumeric(node.left, out);
      collectNumeric(node.right, out);
      return;
    }
    case 'UnaryExpression':
      if (node.op === '-') markIdent(node.arg, out);
      collectNumeric(node.arg, out);
      return;
    case 'ForNumericStatement':
      collectNumeric(node.start, out);
      collectNumeric(node.stop, out);
      collectNumeric(node.step, out);
      return;
    default:
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'raw') continue;
        collectNumeric(node[k], out);
      }
  }
}

function bodyIsHot(body) {
  let hot = false;
  const w = (n) => {
    if (hot || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const x of n) w(x);
      return;
    }
    if (n.type === 'WhileStatement' && n.cond && n.cond.type === 'BooleanLiteral' && n.cond.value === true) {
      hot = true;
      return;
    }
    if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') return;
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'raw') continue;
      w(n[k]);
    }
  };
  w(body);
  return hot;
}

function makeCtx(fn, rng, global) {
  // ctx.pool: candidate names (used arithmetically anywhere in the body —
  // the original flow-insensitive signal). ctx.nums: ELIGIBLE names
  // (pool ∩ defined-before-use − proven-nonnum), threaded forward.
  // Guards (`v>v and j-v or X`) may only use eligible names: the original
  // pass crashed on names with no binding yet at the use point (locals used
  // in their own init, globals assigned later). ctx.bad tracks
  // proven-nonnumeric bindings.
  const pool = new Set();
  if (fn && fn.body) collectNumeric(fn.body, pool);
  for (const n of [SELF, ENV, 'self', 'n']) pool.delete(n);
  const params = (fn && fn.params) || [];
  const seed = params.filter((p) => typeof p === 'string' && pool.has(p));
  return {
    pool,
    nums: seed,
    bad: new Set(),
    rng,
    wraps: { n: 0, chains: 0 },
    inChain: false,
    hot: bodyIsHot(fn.body),
    global: global || { chains: 0 },
  };
}

// Child-block context: mutations stay local to the branch.
function subCtx(ctx, extra) {
  if (!ctx) return ctx;
  return {
    ...ctx,
    nums: extra ? ctx.nums.concat(extra) : ctx.nums.slice(),
    bad: new Set(ctx.bad || []),
  };
}

// Names that go out of scope with the block: `local`s, local functions,
// and for-loop variables. The merge must not treat them as an outer
// same-named variable staying usable.
function collectDeclaredNames(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const x of node) collectDeclaredNames(x, out);
    return;
  }
  if (node.type === 'LocalStatement') {
    for (const n of node.names || []) if (typeof n === 'string') out.add(n);
  } else if (node.type === 'FunctionDeclaration' && node.isLocal) {
    if (node.names && node.names[0]) out.add(node.names[0]);
  } else if (node.type === 'ForNumericStatement') {
    if (node.name) out.add(node.name);
  } else if (node.type === 'ForGenericStatement') {
    for (const n of node.names || []) if (typeof n === 'string') out.add(n);
  }
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'raw') continue;
    const c = node[k];
    if (c && typeof c === 'object') collectDeclaredNames(c, out);
  }
}

// Definitely-not-numeric initializer: using the bound name in a numeric
// guard would still be wrong (string/table/nil compare or arithmetic).
function isProvenNonnum(n) {
  n = unwrap(n);
  if (!n || typeof n !== 'object') return false;
  switch (n.type) {
    case 'StringLiteral':
    case 'TableConstructor':
    case 'FunctionExpression':
    case 'FunctionDeclaration':
    case 'NilLiteral':
    case 'BooleanLiteral':
      return true;
    case 'UnaryExpression':
      return n.op === 'not' || n.op === '#';
    case 'BinaryExpression': {
      const op = n.op;
      if (op === '..') return true;
      if (op === '==' || op === '~=' || op === '<' || op === '>' || op === '<=' || op === '>=') return true;
      if (op === 'and' || op === 'or') return false;
      return false;
    }
    default:
      return false;
  }
}

// Straight-line binding update. Missing init and proven-nonnumeric init
// remove the name (and mark bad). Call results are removed but NOT marked
// bad: a call can return anything (notably functions/tables, like a fresh
// VM closure), so guards must not assume numeric — yet a later numeric
// reassignment may re-admit the name. Anything else (literals, arithmetic,
// indexes, identifiers) marks it usable — but only pool members can join
// nums, so names never used numerically stay out (like the original).
function updateBinding(ctx, name, init) {
  if (!ctx || typeof name !== 'string') return;
  if (name === SELF || name === ENV || name === 'self' || name === 'n') return;
  const u = unwrap(init);
  if (!u || isProvenNonnum(u)) {
    ctx.nums = (ctx.nums || []).filter((n) => n !== name);
    if (ctx.bad) ctx.bad.add(name);
    return;
  }
  if (u.type === 'CallExpression' || u.type === 'MethodCallExpression') {
    ctx.nums = (ctx.nums || []).filter((n) => n !== name);
    return;
  }
  if (ctx.bad) ctx.bad.delete(name);
  if (ctx.pool && !ctx.pool.has(name)) {
    ctx.nums = (ctx.nums || []).filter((n) => n !== name);
    return;
  }
  if ((ctx.nums || []).indexOf(name) < 0) ctx.nums.push(name);
}

// Merge after conditionals: pre-block usability, minus names gone bad on
// any path, plus names that became usable in branches (minus branch-scoped
// declarations). Unknown values (calls, indexes) count as usable — the
// practical assumption; what crashed was names with NO binding yet, and
// those never enter nums before their first assignment.
function mergeUnion(ctx, preNums, preBad, branches) {
  if (!ctx) return;
  const bad = new Set(preBad || []);
  for (const b of branches) {
    for (const k of b.endBad || []) bad.add(k);
  }
  const live = new Set(preNums || []);
  for (const k of bad) live.delete(k);
  for (const b of branches) {
    const decl = new Set(b.decl || []);
    collectDeclaredNames(b.body, decl);
    for (const n of b.endNums || []) {
      if (!decl.has(n) && !bad.has(n)) live.add(n);
    }
  }
  ctx.nums = [...live];
  ctx.bad = bad;
}

function alreadySoup(n) {
  n = unwrap(n);
  if (!n) return false;
  if (n.type === 'BinaryExpression' && (n.op === 'and' || n.op === 'or')) return true;
  if (n.type !== 'BinaryExpression') return false;
  if (n.op !== '+' && n.op !== '-') return false;
  let terms = 0;
  const walk = (e) => {
    e = unwrap(e);
    if (!e) return;
    if (e.type === 'BinaryExpression' && (e.op === '+' || e.op === '-')) {
      walk(e.left);
      walk(e.right);
    } else terms++;
  };
  walk(n);
  return terms >= 4;
}

function isNumericPure(n, ctx) {
  n = unwrap(n);
  if (!n || !ctx) return false;
  if (n.type === 'NumericLiteral') return true;
  if (n.type === 'Identifier') return ctx.nums.indexOf(n.name) !== -1;
  if (n.type === 'UnaryExpression' && n.op === '-') return isNumericPure(n.arg, ctx);
  if (n.type === 'BinaryExpression' && (n.op === '+' || n.op === '-' || n.op === '*' || n.op === '/' || n.op === '%' || n.op === '^')) {
    return isNumericPure(n.left, ctx) && isNumericPure(n.right, ctx);
  }
  if (n.type === 'ParenExpression') return isNumericPure(n.expr, ctx);
  return false;
}

function foldTerms(terms) {
  let ast = terms[0].node;
  for (let i = 1; i < terms.length; i++) ast = bin(terms[i].op, ast, terms[i].node);
  return ast;
}

function id(name) {
  return ident(name);
}

function selfObj(node) {
  const n = unwrap(node);
  return n && n.type === 'Identifier' && n.name === SELF;
}

function hasSelfMethod(node) {
  let hit = false;
  const w = (n) => {
    if (hit || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const x of n) w(x);
      return;
    }
    if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') return;
    if (n.type === 'MethodCallExpression' && selfObj(n.object)) {
      hit = true;
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'raw') continue;
      w(n[k]);
    }
  };
  w(node);
  return hit;
}

function hasSelfMember(node) {
  let hit = false;
  const w = (n) => {
    if (hit || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const x of n) w(x);
      return;
    }
    if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') return;
    if (n.type === 'MemberExpression' && selfObj(n.object)) {
      hit = true;
      return;
    }
    for (const k of Object.keys(n)) {
      if (k === 'loc' || k === 'raw') continue;
      w(n[k]);
    }
  };
  w(node);
  return hit;
}

function isCffish(node) {
  return hasSelfMethod(node) && hasSelfMember(node);
}

function isEnvSlotCall(node) {
  if (!node || node.type !== 'CallExpression') return false;
  let c = unwrap(node.callee);
  if (!c || c.type !== 'IndexExpression') return false;
  const o = unwrap(c.object);
  if (!o || o.type !== 'IndexExpression') return false;
  const oo = unwrap(o.object);
  return oo && oo.type === 'Identifier' && (oo.name === SELF || oo.name === ENV);
}

/** Dead: random linear combo. No cancel pair +a-a. Rotate Xrings shapes. */
const SOUP_SHAPES = [
  'A+B-C-D+E-D',
  'A-B+C-D-D',
  'A+B+C-B+C',
  'A-B-C-A-C+D',
  'A+B+C+D+E+F',
  'A+A+A-B-C+D',
];

function applyShape(shape, names, rng) {
  const ids = pickDistinct(names, 6, rng);
  const map = { A: ids[0], B: ids[1], C: ids[2], D: ids[3], E: ids[4], F: ids[5] };
  const parts = shape.match(/[A-F]|[+\-]/g) || [];
  const terms = [];
  let op = '+';
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === '+' || p === '-') {
      op = p;
      continue;
    }
    terms.push({ op, node: id(map[p] || ids[0]) });
    op = '+';
  }
  return terms.length ? foldTerms(terms) : id(ids[0]);
}

function wildSoup(names, rng, ctx) {
  if (!names.length) return num(0, rng);
  let i;
  if (ctx && ctx.wraps) {
    ctx.wraps.soupI = (ctx.wraps.soupI || 0) + 1;
    i = ctx.wraps.soupI;
  } else {
    i = 1 + Math.floor(rng() * SOUP_SHAPES.length);
  }
  return applyShape(SOUP_SHAPES[(i - 1) % SOUP_SHAPES.length], names, rng);
}

/** Live: (v>v and j-v or X) ≡ X. Looks like a real compare, always yields X. */
function andorDiff(x, ctx) {
  const rng = ctx.rng;
  const names = ctx.nums;
  const [v, j] = pickDistinct(names, 2, rng);
  const alt = bin('-', id(j), id(v));
  const cond = bin('>', id(v), id(v));
  let inner = paren(bin('or', bin('and', cond, alt), x));
  if (chance(rng, 0.35) && names.length >= 4) {
    const [W, q] = pickDistinct(names, 2, rng);
    const cond2 = bin('>', paren(bin('+', id(W), id(q))), bin('+', id(W), id(q)));
    inner = paren(bin('or', bin('and', cond2, alt), inner));
  }
  return inner;
}

function maybeIdentity(x, rng, ctx, p) {
  if (!x || !ctx || ctx.nums.length < 3) return x;
  if (ctx.wraps.n > 20) return x;
  if (alreadySoup(x)) return x;
  if (x.type === 'FunctionExpression' || x.type === 'TableConstructor' || x.type === 'VarargExpression') {
    return x;
  }
  const u = unwrap(x);
  if (u && u.type === 'Identifier' && (u.name === SELF || u.name === ENV || u.name === 'self' || u.name === 'n')) {
    return x;
  }
  if (!isNumericPure(x, ctx)) return x;
  if (!chance(rng, p == null ? 0.1 : p)) return x;
  ctx.wraps.n++;
  return andorDiff(x, ctx);
}

function makeupExpr(node, rng, ctx) {
  if (!node || typeof node !== 'object') return node;
  switch (node.type) {
    case 'ParenExpression':
      node.expr = makeupExpr(node.expr, rng, ctx);
      if (node.expr && node.expr.type === 'MethodCallExpression') return node.expr;
      return node;
    case 'UnaryExpression':
      node.arg = makeupExpr(node.arg, rng, ctx);
      return wrap(node, rng, 0.25);
    case 'BinaryExpression':
      node.left = makeupExpr(node.left, rng, ctx);
      node.right = makeupExpr(node.right, rng, ctx);
      {
        let L = node.left;
        let R = node.right;
        while (L && L.type === 'ParenExpression') L = L.expr;
        while (R && R.type === 'ParenExpression') R = R.expr;
        if (node.op === '+' && L && R && L.type === 'IndexExpression' && R.type === 'IndexExpression') return node;
        if (L && (L.type === 'MethodCallExpression' || L.type === 'CallExpression')) return node;
        if (node.op === 'and' || node.op === 'or') return node;
      }
      return wrap(node, rng, 0.15);
    case 'NumericLiteral':
      return node;
    case 'MemberExpression':
      node.object = makeupExpr(node.object, rng, ctx);
      return node;
    case 'IndexExpression':
      node.object = makeupExpr(node.object, rng, ctx);
      node.index = makeupExpr(node.index, rng, ctx);
      {
        const obj = node.object;
        if (obj && obj.type === 'ParenExpression') return node;
        if (obj && obj.type === 'IndexExpression') {
          node.object = wrap(obj, rng, 0.42);
        } else if (obj && obj.type === 'MemberExpression') {
          node.object = wrap(obj, rng, obj.object && obj.object.type === 'Identifier' && obj.object.name === SELF ? 0.22 : 0.45);
        } else if (obj && obj.type === 'Identifier') {
          const envish = obj.name === ENV || obj.name === SELF || obj.name === 'n';
          node.object = wrap(obj, rng, envish ? 0.06 : 0.18);
        }
      }
      return node;
    case 'CallExpression':
      node.callee = makeupExpr(node.callee, rng, ctx);
      if (isEnvSlotCall(node) || hasSelfMethod(node) || isCffish(node)) {
        node.args = (node.args || []).map((a) => makeupExpr(a, rng, ctx));
      } else {
        node.args = (node.args || []).map((a) => maybeIdentity(makeupExpr(a, rng, ctx), rng, ctx, 0.12));
      }
      return node;
    case 'MethodCallExpression':
      node.object = makeupExpr(node.object, rng, ctx);
      node.args = (node.args || []).map((a) => makeupExpr(a, rng, ctx));
      if (node.object.type === 'Identifier' && node.object.name === SELF) {
        node.object = wrap(node.object, rng, 0.34);
      }
      return node;
    case 'FunctionExpression': {
      const inner = makeCtx(node, rng, ctx && ctx.global);
      node.body = makeupStats(node.body, rng, inner);
      return node;
    }
    case 'TableConstructor':
      for (const f of node.fields || []) {
        if (f.key && typeof f.key === 'object' && f.key.type) f.key = makeupExpr(f.key, rng, ctx);
        if (f.value) f.value = makeupExpr(f.value, rng, ctx);
      }
      return node;
    default:
      return node;
  }
}

function deadTernary(names, rng) {
  const [v, C, W, j, q, p] = pickDistinct(names, 6, rng);
  const inner = paren(bin(
    'or',
    bin('and', bin('>', paren(bin('+', id(v), id(C))), bin('+', id(W), id(v))), id(j)),
    bin('-', id(j), id(v)),
  ));
  const rhs = bin('-', bin('+', id(q), id(v)), id(C));
  return paren(bin('or', bin('and', bin('==', inner, rhs), id(C)), id(p)));
}

function deadVm(ctx, rng) {
  const names = ctx.nums;
  if (names.length < 2) return [];
  const d = pick(names, rng);
  const A = pick(names, rng);
  const k = pick(names, rng);
  const p = pick(names, rng);
  const W = pick(names, rng);
  const C = pick(names, rng);
  const soup = wildSoup(names, rng);
  const slot = [9, 14, 22, 0x29, 0x31, 0xE][Math.floor(rng() * 6)];
  const callee = idx(idx(id(SELF), num(1, rng)), num(slot, rng));
  const style = Math.floor(rng() * 6);
  switch (style) {
    case 0:
      return [
        assign(id(d), bin('-', id(d), num(1, rng))),
        assign(idx(id(A), id(d)), id(k)),
      ];
    case 1:
      return [assign(id(C), id(d))];
    case 2:
      return [assign(id(p), call(callee, [paren(soup), paren(id(W))]))];
    case 3:
      return [assign(id(p), paren(soup))];
    case 4:
      return [assign(id(d), bin('+', id(d), num(1, rng)))];
    default:
      return [assign(id(p), call(callee, [deadTernary(names, rng), paren(id(W))]))];
  }
}

/** Always false on numbers, looks like a VM compare (`j>j`). */
function alwaysFalse(ctx, rng) {
  const j = pick(ctx.nums, rng);
  return bin('>', id(j), id(j));
}

function alwaysTrue(ctx, rng) {
  const v = pick(ctx.nums, rng);
  return bin('==', id(v), id(v));
}

function deadBound(ctx, rng) {
  const j = pick(ctx.nums, rng);
  return bin('>=', id(j), num(6, rng));
}

function xringsChain(real, ctx, rng) {
  const names = ctx.nums;
  const deadSoup = () => {
    const p = pick(names, rng);
    const W = pick(names, rng);
    const slot = [9, 14, 22, 0x29, 0x31, 0xE][Math.floor(rng() * 6)];
    const callee = idx(idx(id(SELF), num(1, rng)), num(slot, rng));
    return [assign(id(p), call(callee, [paren(wildSoup(names, rng, ctx)), paren(id(W))]))];
  };
  const dead0 = deadSoup();
  const dead2 = deadVm(ctx, rng);
  const dead3 = [
    assign(id(pick(names, rng)), bin('+', id(pick(names, rng)), num(1, rng))),
  ];
  return ifChain(
    [
      { cond: alwaysFalse(ctx, rng), body: dead0 },
      { cond: alwaysTrue(ctx, rng), body: real },
      { cond: deadBound(ctx, rng), body: dead2.length ? dead2 : deadSoup() },
    ],
    dead3,
    true,
  );
}

function isSafeWrap(node) {
  if (!node || typeof node !== 'object') return false;
  if (isCffish(node) || hasSelfMethod(node)) return false;
  switch (node.type) {
    case 'AssignmentStatement':
    case 'CompoundAssignment':
    case 'CallStatement':
    case 'IfStatement':
    case 'WhileStatement':
    case 'RepeatStatement':
    case 'DoStatement':
    case 'ReturnStatement':
    case 'BreakStatement':
      return true;
    default:
      return false;
  }
}

function sameLvalue(a, b) {
  a = unwrap(a);
  b = unwrap(b);
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'Identifier') return a.name === b.name;
  if (a.type === 'MemberExpression') return sameLvalue(a.object, b.object) && a.property === b.property;
  if (a.type === 'IndexExpression') return sameLvalue(a.object, b.object) && sameLvalue(a.index, b.index);
  if (a.type === 'NumericLiteral') return a.value === b.value;
  return false;
}

const COMPOUND_OPS = { '+': '+=', '-': '-=', '*': '*=' };

function maybeCompound(node, rng) {
  if (!node.vars || node.vars.length !== 1 || !node.inits || node.inits.length !== 1) return null;
  const rhs = unwrap(node.inits[0]);
  if (!rhs || rhs.type !== 'BinaryExpression') return null;
  const op = COMPOUND_OPS[rhs.op];
  if (!op) return null;
  if (!sameLvalue(node.vars[0], rhs.left)) return null;
  const r = unwrap(rhs.right);
  const numeric = r && r.type === 'NumericLiteral';
  if (rng() >= (numeric ? 0.72 : 0.28)) return null;
  return { type: 'CompoundAssignment', target: node.vars[0], op, value: rhs.right };
}

function makeupStat(node, rng, ctx) {
  if (!node) return node;
  if (isCffish(node)) return node;
  switch (node.type) {
    case 'DoStatement': {
      // `do end` runs exactly once: straight-line, thread usability
      // through. Block-scoped declarations go out of scope after.
      if (node.cond) node.cond = makeupExpr(node.cond, rng, ctx);
      node.body = makeupStats(node.body, rng, ctx);
      const decl = new Set();
      collectDeclaredNames(node.body, decl);
      if (decl.size && ctx && ctx.nums) ctx.nums = ctx.nums.filter((n) => !decl.has(n));
      return node;
    }
    case 'WhileStatement': {
      if (node.cond) node.cond = makeupExpr(node.cond, rng, ctx);
      const preNums = ctx ? ctx.nums.slice() : [];
      const preBad = ctx && ctx.bad ? new Set(ctx.bad) : new Set();
      const inner = subCtx(ctx);
      node.body = makeupStats(node.body, rng, inner);
      // Zero or more iterations: merge pre with body-end.
      mergeUnion(ctx, preNums, preBad, [
        { body: [], endNums: preNums, endBad: preBad },
        { body: node.body, endNums: inner.nums || [], endBad: inner.bad || new Set() },
      ]);
      return node;
    }
    case 'RepeatStatement': {
      const preNums = ctx ? ctx.nums.slice() : [];
      const preBad = ctx && ctx.bad ? new Set(ctx.bad) : new Set();
      const inner = subCtx(ctx);
      node.body = makeupStats(node.body, rng, inner);
      if (node.cond) node.cond = makeupExpr(node.cond, rng, inner);
      // Body runs at least once: body-end wins (minus its block-locals).
      mergeUnion(ctx, preNums, preBad, [{ body: node.body, endNums: inner.nums || [], endBad: inner.bad || new Set() }]);
      return node;
    }
    case 'IfStatement': {
      const preNums = ctx ? ctx.nums.slice() : [];
      const preBad = ctx && ctx.bad ? new Set(ctx.bad) : new Set();
      const ends = [];
      node.clauses = (node.clauses || []).map((c) => {
        const inner = subCtx(ctx);
        const body = makeupStats(c.body, rng, inner);
        ends.push({ body, endNums: inner.nums || [], endBad: inner.bad || new Set() });
        return { cond: makeupExpr(c.cond, rng, ctx), body };
      });
      if (node.elseBody) {
        const inner = subCtx(ctx);
        node.elseBody = makeupStats(node.elseBody, rng, inner);
        ends.push({ body: node.elseBody, endNums: inner.nums || [], endBad: inner.bad || new Set() });
      } else {
        ends.push({ body: [], endNums: preNums, endBad: preBad });
      }
      mergeUnion(ctx, preNums, preBad, ends);
      return node;
    }
    case 'ForNumericStatement': {
      const boundCtx = ctx ? { nums: [], rng: ctx.rng, wraps: ctx.wraps, inChain: true, global: ctx.global } : ctx;
      node.start = makeupExpr(node.start, rng, boundCtx);
      node.stop = makeupExpr(node.stop, rng, boundCtx);
      if (node.step) node.step = makeupExpr(node.step, rng, boundCtx);
      // Loop var is numeric inside the body; the body may run zero times,
      // so merge pre with body-end.
      const preNums = ctx ? ctx.nums.slice() : [];
      const preBad = ctx && ctx.bad ? new Set(ctx.bad) : new Set();
      const inner = subCtx(ctx, node.name ? [node.name] : null);
      node.body = makeupStats(node.body, rng, inner);
      mergeUnion(ctx, preNums, preBad, [
        { body: [], endNums: preNums, endBad: preBad },
        { body: node.body, endNums: inner.nums || [], endBad: inner.bad || new Set(), decl: node.name ? [node.name] : [] },
      ]);
      return node;
    }
    case 'ForGenericStatement': {
      node.iters = (node.iters || []).map((e) => makeupExpr(e, rng, ctx));
      const preNums = ctx ? ctx.nums.slice() : [];
      const preBad = ctx && ctx.bad ? new Set(ctx.bad) : new Set();
      const inner = subCtx(ctx);
      node.body = makeupStats(node.body, rng, inner);
      mergeUnion(ctx, preNums, preBad, [
        { body: [], endNums: preNums, endBad: preBad },
        { body: node.body, endNums: inner.nums || [], endBad: inner.bad || new Set(), decl: (node.names || []).filter((n) => typeof n === 'string') },
      ]);
      return node;
    }
    case 'FunctionDeclaration': {
      // Binds a function (not numeric) in the outer scope.
      if (node.names && node.names[0]) updateBinding(ctx, node.names[0], { type: 'FunctionExpression' });
      const inner = makeCtx(node, rng, ctx && ctx.global);
      node.body = makeupStats(node.body, rng, inner);
      return node;
    }
    case 'LocalStatement': {
      node.init = (node.init || []).map((e) => {
        e = makeupExpr(e, rng, ctx);
        if (hasSelfMethod(e) || isCffish(e)) return e;
        return wrapRhs(maybeIdentity(e, rng, ctx, 0.08), rng);
      });
      // New bindings join the usable set unless the init is missing or
      // proven-nonnumeric; pool membership is required (names never used
      // numerically stay out, like the original). RHS reads outer bindings,
      // so no LHS filtering is needed.
      const names = node.names || [];
      const inits = node.init || [];
      for (let i = 0; i < names.length; i++) {
        if (typeof names[i] !== 'string') continue;
        updateBinding(ctx, names[i], i < inits.length ? inits[i] : null);
      }
      return node;
    }
    case 'AssignmentStatement': {
      const converted = maybeCompound(node, rng);
      if (converted) {
        converted.target = makeupExpr(converted.target, rng, ctx);
        converted.value = makeupExpr(converted.value, rng, ctx);
        const u = unwrap(converted.target);
        if (u && u.type === 'Identifier' && u.name) {
          updateBinding(ctx, u.name, {
            type: 'BinaryExpression',
            op: converted.op.slice(0, -1),
            left: converted.target,
            right: converted.value,
          });
        }
        return converted;
      }
      node.vars = (node.vars || []).map((e) => makeupExpr(e, rng, ctx));
      node.inits = (node.inits || []).map((e) => {
        e = makeupExpr(e, rng, ctx);
        if (hasSelfMethod(e) || isCffish(e) || isEnvSlotCall(e)) return e;
        return wrapRhs(maybeIdentity(e, rng, ctx, 0.1), rng);
      });
      // Straight-line writes update usability exactly; the RHS already saw
      // the pre-write set, which is the sound one for old-value reads.
      const vars = node.vars || [];
      const inits = node.inits || [];
      for (let i = 0; i < vars.length; i++) {
        const u = unwrap(vars[i]);
        if (!u || u.type !== 'Identifier' || !u.name) continue;
        updateBinding(ctx, u.name, i < inits.length ? inits[i] : null);
      }
      return node;
    }
    case 'CallStatement':
      node.expr = makeupExpr(node.expr, rng, ctx);
      return node;
    case 'ReturnStatement':
      node.args = (node.args || []).map((e) => maybeIdentity(makeupExpr(e, rng, ctx), rng, ctx, 0.1));
      return node;
    default:
      return node;
  }
}

function leftmost(n) {
  while (n && n.type === 'ParenExpression') n = n.expr;
  while (n && n.type === 'BinaryExpression') {
    n = n.left;
    while (n && n.type === 'ParenExpression') n = n.expr;
  }
  return n;
}

function wrapRhs(e, rng) {
  if (!e) return e;
  if (
    e.type === 'FunctionExpression' ||
    e.type === 'TableConstructor' ||
    e.type === 'ParenExpression' ||
    e.type === 'MethodCallExpression' ||
    e.type === 'CallExpression'
  ) {
    return e;
  }
  const lm = leftmost(e);
  if (lm && (lm.type === 'MethodCallExpression' || lm.type === 'CallExpression')) return e;
  if (e.type === 'BinaryExpression' || e.type === 'UnaryExpression' || e.type === 'IndexExpression') {
    return wrap(e, rng, 0.4);
  }
  return e;
}

function makeupStats(stats, rng, ctx) {
  const mapped = (stats || []).map((s) => makeupStat(s, rng, ctx));
  if (!ctx || ctx.inChain || ctx.nums.length < 4 || !ctx.hot) return mapped;
  if (ctx.global && ctx.global.chains >= 2) return mapped;
  const out = [];
  for (let i = 0; i < mapped.length; i++) {
    const s = mapped[i];
    const budget = ctx.global ? ctx.global.chains < 2 : ctx.wraps.chains < 1;
    const force = ctx.global && ctx.global.chains < 2 && isSafeWrap(s);
    const can = isSafeWrap(s) && budget && (force || chance(rng, 0.14));
    if (can) {
      const real = [s];
      while (real.length < 2 && i + 1 < mapped.length && isSafeWrap(mapped[i + 1])) {
        i++;
        real.push(mapped[i]);
      }
      ctx.wraps.chains++;
      if (ctx.global) ctx.global.chains++;
      const inner = { nums: ctx.nums, rng: ctx.rng, wraps: ctx.wraps, inChain: true, global: ctx.global };
      out.push(xringsChain(real, inner, rng));
    } else {
      out.push(s);
    }
  }
  return out;
}

function makeupChunk(chunk, rng) {
  if (!chunk || !rng) return chunk;
  const global = { chains: 0 };
  if (chunk.type === 'Chunk') {
    const ctx = { nums: [], rng, wraps: { n: 0, chains: 0 }, inChain: false, global };
    chunk.body = makeupStats(chunk.body, rng, ctx);
    return chunk;
  }
  return makeupStat(chunk, rng, { nums: [], rng, wraps: { n: 0, chains: 0 }, inChain: false, global });
}

module.exports = { makeupChunk, makeupStats, makeupExpr };
