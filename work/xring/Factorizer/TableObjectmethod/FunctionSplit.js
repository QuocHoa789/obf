'use strict';

const {
  KEYWORDS,
  LUA_GLOBALS,
  ident,
  bin,
  idx,
  call,
  mcall,
  mem,
  assign,
  localStat,
  ifStat,
  ret,
  func,
  callStat,
  unwrap,
  clone,
  usesVararg,
  containsType,
  collectLocalNames,
  walkStats,
  allocVisualName,
  paren,
  un,
  brk,
  cont,
  niln,
  SELF,
  ENV,
  bool,
} = require('../core/Ast');
const { GLOBAL_FUNCS, LIB_MEMBERS, ALIAS_EXPR } = require('../MakeUp/Aliases');
const { debug } = require('../../Debug');
const { isRangeIfTree, walkRangeLeaves, rangeIfHighToLow, pickLoopKind, advanceIter, numericStateLoop } = require('../../VM/controlflow/Dispatch');

/**
 * Names that a *nested* function declares for itself: its parameters and every
 * local in its body (recursively, including deeper nested functions).
 *
 * extractNested never pulls a vararg closure out into its own method, so its
 * body is printed inline in the enclosing dispatcher. Those declarations are
 * therefore in the same printed chunk as the dispatcher's own parameters, and
 * plain Lua scoping lets the innermost one win: if a nested `local` reuses the
 * scatter/env parameter name, every later `T[slot]` read in that block indexes
 * a number instead of the scatter table. Collecting the names up front lets
 * addForDispatchSplit see the collision *before* it emits anything.
 */
// Deterministic short names for the shadow repair above. Fixed order, no rng:
// the repair must not move the name stream of any other obfuscation.
const REPAIR_ALPHABET = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function pickRepairName(forbidden, alsoUsed) {
  const taken = (n) => forbidden.has(n) || KEYWORDS.has(n) || LUA_GLOBALS.has(n)
    || (alsoUsed && alsoUsed.has(n));
  for (const c of REPAIR_ALPHABET) {
    if (!taken(c)) return c;
  }
  for (const a of REPAIR_ALPHABET) {
    for (const b of REPAIR_ALPHABET) {
      if (!taken(a + b)) return a + b;
    }
  }
  return null;
}

function collectAllNames(node, out) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const n of node) collectAllNames(n, out);
    return out;
  }
  if (node.type === 'Identifier' && typeof node.name === 'string') out.add(node.name);
  if (node.type === 'LocalStatement') for (const n of node.names || []) if (typeof n === 'string') out.add(n);
  if (node.type === 'ForNumericStatement' && typeof node.name === 'string') out.add(node.name);
  if (node.type === 'ForGenericStatement') for (const n of node.names || []) if (typeof n === 'string') out.add(n);
  if (node.params) for (const p of node.params) if (typeof p === 'string') out.add(p);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
    const v = node[k];
    if (v && typeof v === 'object') collectAllNames(v, out);
  }
  return out;
}

function withRename(map, from, to) {
  const next = new Map(map || []);
  next.set(from, to);
  return next;
}

function collectNestedFnNames(node, out) {
  out = out || new Set();
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const n of node) collectNestedFnNames(n, out);
    return out;
  }
  if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
    for (const p of node.params || []) out.add(p);
    for (const n of collectLocalNames(node.body)) out.add(n);
    for (const n of node.names || []) out.add(n);
  }
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'raw') continue;
    const v = node[k];
    if (v && typeof v === 'object') collectNestedFnNames(v, out);
  }
  return out;
}

function attachFunctionSplit(cls) {
  const P = cls.prototype;

  P.splitAndAdd = function splitAndAdd(fn) {
    const name = this.methodName(fn.orig);
    const rawParams = fn.params.slice();
    const paramMap = {};
    const params = rawParams.map((p) => {
      if (p === SELF || p === ENV) {
        const np = this.fresh('p');
        paramMap[p] = np;
        return np;
      }
      return p;
    });

    let body = clone(fn.body);
    body = this.renameIdents(body, paramMap);
    const baseBound = new Set([SELF, ENV].concat(params));
    const maybeHot = this.isHot(fn.body);
    body = this.extractNested(body, { bound: baseBound, hot: maybeHot });

    const innerLocals = [...collectLocalNames(body)].filter((n) => n !== SELF && n !== ENV);
    // hoistBody strips every top-level `local`, and the branches below
    // re-declare the stripped names (inline `localStat`, or scratch slots in
    // addForDispatchSplit). So for the whole rewrite those names are in
    // scope as LOCALS — not as chunk-level methods / env slots they may
    // shadow. Resolving them to `this.methods` is what silently drops the
    // captured arguments: a nested function hoisted by extractNested gets a
    // wrapper closure forwarding params+captured, but a call that resolves
    // to the raw method passes the source args only (`xor_rgn` → `hX` with
    // 3 of its 6 params) → nil.
    const scopeBound = new Set(baseBound);
    for (const n of innerLocals) scopeBound.add(n);
    const stats = this.hoistBody(body);
    let rewritten = this.rewrite(stats, { bound: new Set(scopeBound), scratch: null, nName: null, hot: maybeHot });
    const fullParams = [SELF, ENV].concat(params);
    const vararg = fn.vararg || usesVararg(rewritten);
    const hot = maybeHot || this.isHot(rewritten);
    if (!hot) {
      rewritten = this.liftAll(rewritten, { bound: new Set(fullParams) });
      rewritten = this.splitBranches(rewritten, { bound: new Set(fullParams) });
    }

    if (hot || rewritten.length <= 1) {
      let outBody = rewritten;
      if (innerLocals.length) outBody = [localStat(innerLocals.filter((n) => !baseBound.has(n)))].concat(rewritten);
      this.addMethod(name, func(fullParams, this.flattenTrivialReturn(outBody), vararg));
      return;
    }

    const groups = this.groupStats(rewritten);
    const earlyRet = groups.slice(0, -1).some((g) => g.some((s) => containsType(s, 'ReturnStatement')));
    if (earlyRet || groups.length <= 1 || vararg) {
      let outBody = rewritten;
      const hoist = innerLocals.filter((n) => !baseBound.has(n));
      if (hoist.length) outBody = [localStat(hoist)].concat(rewritten);
      this.addMethod(name, func(fullParams, this.flattenTrivialReturn(outBody), vararg));
      return;
    }

    this.addForDispatchSplit(name, params, innerLocals, groups, vararg);
  };

  P.mixNumericFors = function mixNumericFors(stats) {
    if (!stats) return stats;
    if (!Array.isArray(stats)) return this.mixNumericForStat(stats);
    const out = [];
    for (const s of stats) {
      const r = this.mixNumericForStat(s);
      if (Array.isArray(r)) out.push.apply(out, r);
      else if (r) out.push(r);
    }
    return out;
  };

  P.mixNumericForStat = function mixNumericForStat(s) {
    if (!s || typeof s !== 'object') return s;
    if (s.type === 'ForNumericStatement') {
      const body = this.mixNumericFors(s.body || []);
      const kind = pickLoopKind(this);
      if (kind === 'for') {
        return {
          type: 'ForNumericStatement',
          name: s.name,
          start: s.start,
          stop: s.stop,
          step: s.step,
          body,
        };
      }
      return this.numericForAsStateLoop(s, body, kind);
    }
    if (s.type === 'IfStatement') {
      return {
        type: 'IfStatement',
        clauses: (s.clauses || []).map((c) => ({
          cond: c.cond,
          body: this.mixNumericFors(c.body),
        })),
        elseBody: s.elseBody ? this.mixNumericFors(s.elseBody) : s.elseBody,
        preferElseif: s.preferElseif,
      };
    }
    if (s.type === 'WhileStatement' || s.type === 'RepeatStatement' || s.type === 'DoStatement') {
      return { ...s, body: this.mixNumericFors(s.body) };
    }
    if (s.type === 'FunctionExpression' || s.type === 'FunctionDeclaration') {
      return { ...s, body: this.mixNumericFors(s.body) };
    }
    return s;
  };

  /**
   * Names the body may write (assignments and fresh `local`s), used to decide
   * whether a loop bound can be re-read safely. Nested functions are skipped:
   * they run later (or never), so they cannot affect this loop's bounds.
   */
  P.collectWrittenNames = function collectWrittenNames(body, out) {
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) {
        for (const x of n) walk(x);
        return;
      }
      if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') return;
      if (n.type === 'LocalStatement') {
        for (const nm of n.names || []) if (typeof nm === 'string') out.add(nm);
      } else if (n.type === 'ForNumericStatement') {
        if (n.name) out.add(n.name);
      } else if (n.type === 'ForGenericStatement') {
        for (const nm of n.names || []) if (typeof nm === 'string') out.add(nm);
      } else if (n.type === 'AssignmentStatement') {
        // Both spellings of the target list appear in the AST.
        const targets = n.targets || n.vars || [];
        for (const v of targets) {
          const u = unwrap(v);
          if (u && u.type === 'Identifier') out.add(u.name);
        }
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
        walk(n[k]);
      }
    };
    walk(body);
    return out;
  };

  /**
   * True when evaluating `expr` twice is indistinguishable from evaluating it
   * once — literals, and names the body never writes. Calls, indexes, varargs
   * and table allocations are treated as unstable (`nextint()` in a loop limit
   * *does* consume blob bytes; see numericForAsStateLoop).
   */
  P.exprEvaluatesOnce = function exprEvaluatesOnce(expr, written) {
    const e = unwrap(expr);
    if (!e || typeof e !== 'object') return true;
    switch (e.type) {
      case 'NumericLiteral':
      case 'StringLiteral':
      case 'BooleanLiteral':
      case 'NilLiteral':
        return true;
      case 'Identifier':
        return !written.has(e.name);
      case 'UnaryExpression':
        return this.exprEvaluatesOnce(e.arg, written);
      case 'BinaryExpression':
        return this.exprEvaluatesOnce(e.left, written) && this.exprEvaluatesOnce(e.right, written);
      default:
        return false;
    }
  };

  /**
   * A generated function-scope local (the `env` table accessed as
   * `env[1][slot]`) can end up with the same spelling as a loop variable that
   * the source already declares: ObjectSplit's `fresh()` only avoids keywords
   * and table-method names, not identifiers in the chunk it rewrites. A
   * numeric `for` re-declares its variable from the body on, so the loop body's
   * `env[1][slot]` reads would index the loop counter instead of the env table
   * (`attempt to index number with number`). Repair the loop variable instead:
   * the collision is rare, so every other obfuscation keeps its exact rng
   * stream and byte-identical output. Deterministic, RNG-free.
   */
  /**
   * True when a loop variable would hide the enclosing function's env table.
   * `envName` is only set for scopes that already read locals through slots;
   * a plain (pre-split) scope has no env table to shadow.
   */
  P.loopShadowsEnv = function loopShadowsEnv(name, ctx, body) {
    if (!ctx || typeof name !== 'string') return false;
    // Two generated tables can live in the same scope: the env table
    // (`envName`, read as env[1][slot]) and the extracted method's scratch
    // table (`nName`, read as n[slot]). A loop variable spelled like either
    // shadows it for the whole body, so its slot reads index a number.
    // Only repair when the body really reads that table: a harmless shadow
    // must keep its exact output (and its exact rng stream).
    const hitsEnv = !!ctx.envName && name === ctx.envName;
    const hitsN = !!ctx.nName && name === ctx.nName;
    if (!hitsEnv && !hitsN) return false;
    const used = this.loopBodyTables(body, ctx);
    return (hitsEnv && used.env) || (hitsN && used.n);
  };

  /** Which generated tables (`env`/`n`) the loop body resolves names through. */
  P.loopBodyTables = function loopBodyTables(body, ctx) {
    const used = { env: false, n: false };
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) {
        for (const x of n) walk(x);
        return;
      }
      if (n.type === 'Identifier') {
        const name = n.name;
        if (!ctx.bound.has(name)) {
          if (ctx.scratch && ctx.scratch.has(name)) used.n = true;
          else if (this.methods.has(name) || this.slots.has(name) || GLOBAL_FUNCS[name]) used.env = true;
        }
        return;
      }
      if (n.type === 'MemberExpression' && n.object && n.object.type === 'Identifier') {
        const key = n.object.name + '.' + n.property;
        if (LIB_MEMBERS[key]) used.env = true;
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
        const v = n[k];
        if (v && typeof v === 'object') walk(v);
      }
    };
    walk(body);
    return used;
  };

  P.repairLoopName = function repairLoopName(name, ctx, node) {
    const taken = new Set(ctx.bound || []);
    taken.add(name);
    if (ctx.envName) taken.add(ctx.envName);
    if (ctx.nName) taken.add(ctx.nName);
    for (const n of this.used) taken.add(n);
    // Everything the loop itself mentions must stay untouched: the body's
    // other identifiers are still source bindings/globals.
    collectAllNames(node, taken);
    return pickRepairName(taken, this.used) || name;
  };

  /** Deterministic, RNG-free local name for a hoisted loop bound. */
  P.pickHoistName = function pickHoistName(base, body) {
    const taken = new Set();
    const walk = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) {
        for (const x of n) walk(x);
        return;
      }
      if (n.type === 'Identifier' && typeof n.name === 'string') taken.add(n.name);
      if (n.type === 'LocalStatement') {
        for (const nm of n.names || []) if (typeof nm === 'string') taken.add(nm);
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
        walk(n[k]);
      }
    };
    walk(body);
    const stem = String(base || 'i') + '_b';
    let cand = stem;
    let n = 1;
    while (taken.has(cand) || KEYWORDS.has(cand)) {
      n += 1;
      cand = stem + n;
    }
    return cand;
  };

  P.numericForAsStateLoop = function numericForAsStateLoop(s, body, kind) {
    const name = s.name;
    // A numeric `for` evaluates start, limit and step exactly once, before the
    // first iteration. The state-loop rewrite below keeps the comparison and
    // the increment inside the loop, so a limit like `nextint()` would be
    // re-evaluated every iteration: the VM deserializer re-read the blob,
    // lost its byte-cursor sync and every following proto decoded to garbage.
    // Hoist unstable bounds into plain locals evaluated once, in Lua's order
    // (start, limit, step).
    const written = this.collectWrittenNames(body, new Set([name]));
    const hoists = [];
    let stop = s.stop;
    if (!this.exprEvaluatesOnce(stop, written)) {
      const hn = this.pickHoistName(name, body);
      hoists.push(localStat([hn], [stop]));
      stop = ident(hn);
    }
    let step = s.step || { type: 'NumericLiteral', value: 1, raw: '1' };
    if (!this.exprEvaluatesOnce(step, written)) {
      const hn = this.pickHoistName(name, body);
      hoists.push(localStat([hn], [step]));
      step = ident(hn);
    }
    const uStep = unwrap(step);
    let over;
    if (uStep && uStep.type === 'NumericLiteral') {
      over = uStep.value < 0
        ? bin('<', ident(name), stop)
        : bin('>', ident(name), stop);
    } else {
      over = bin(
        'or',
        bin('and', bin('>=', step, { type: 'NumericLiteral', value: 0, raw: '0' }), bin('>', ident(name), stop)),
        bin('and', bin('<', step, { type: 'NumericLiteral', value: 0, raw: '0' }), bin('<', ident(name), stop)),
      );
    }
    const inc = assign([ident(name)], [bin('+', ident(name), step)]);
    const loopBody = [
      ifStat(over, [brk()], (body || []).concat([inc, cont()])),
    ];
    const loop = kind === 'repeat'
      ? { type: 'RepeatStatement', body: loopBody, cond: bool(false) }
      : { type: 'WhileStatement', cond: bool(true), body: loopBody };
    return {
      type: 'DoStatement',
      body: [localStat([name], [s.start])].concat(hoists, [loop]),
    };
  };

  P.freshSentinel = function freshSentinel(used) {
    used = used || new Set();
    let v;
    do {
      if (this.chance(0.3)) v = this.randInt(0xa0, 0x2fff);
      else if (this.chance(0.55)) v = this.randInt(0x3000, 0xffff);
      else v = this.randInt(0x10000, 0x6ffff);
    } while (used.has(v));
    used.add(v);
    return v;
  };

  P.sentinelGate = function sentinelGate(status, magBreak, magContinue, onContinue) {
    const st = ident(status);
    const br = this.num(magBreak);
    const ct = this.num(magContinue);
    const extra = onContinue || [];
    const contArm = extra.concat([cont()]);
    if (this.chance(0.4)) {
      // NOTE: `contArm` is already a statement list. Wrapping it in another
      // array produced a nested list that the printer silently dropped
      // (and emitted a stray `;`), losing `extra`/`continue`.
      return [ifStat(bin('==', st, br), [brk()], contArm)];
    }
    if (this.chance(0.5)) {
      return [
        ifStat(un('not', paren(bin('==', st, br))), [], [brk()]),
        ifStat(un('not', paren(bin('~=', st, ct))), extra.concat([cont()]), extra.length ? extra.concat([cont()]) : null),
      ];
    }
    return [
      ifStat(bin('==', st, br), [brk()], null),
      ifStat(bin('~=', st, ct), extra.length ? extra : [], extra.length ? extra.concat([cont()]) : [cont()]),
    ];
  };

  P.addForDispatchSplit = function addForDispatchSplit(name, params, innerLocals, groups, vararg) {
    const hoist = innerLocals.filter((n) => n !== SELF && n !== ENV && params.indexOf(n) < 0);
    const nForbidden = new Set([SELF, ENV, 'n'].concat(params).concat(hoist));
    let nName = this.pickScratch(nForbidden);
    // A vararg closure inside `groups` stays inline (extractNested never
    // extracts one), so its own locals share this printed scope. If one of
    // them is called like the scatter table, Lua scoping lets the inner
    // declaration win and every later `T[slot]` read in that block indexes a
    // plain number. Repair only when the clash is real, and pick the
    // replacement without touching the rng: obfuscations that never collide
    // keep their name stream byte for byte.
    const nestedNames = collectNestedFnNames(groups);
    if (this.splitShadowRepair !== false && nestedNames.has(nName)) {
      const before = nName;
      for (const n of nestedNames) nForbidden.add(n);
      nName = pickRepairName(nForbidden, this.used);
      debug.note(`split: scatter name '${before}' shadowed by an inline closure local -> '${nName}'`);
    }
    const scratch = new Map();
    let si = 1;
    for (const p of params) scratch.set(p, si++);
    for (const h of hoist) {
      if (!scratch.has(h)) scratch.set(h, si++);
    }
    const fragCtx = { bound: new Set([SELF, ENV, nName]), scratch, nName };

    const last = groups[groups.length - 1];
    const lastReturns = last.some((s) => s.type === 'ReturnStatement');
    const work = lastReturns ? groups.slice(0, -1) : groups;

    if (!work.length) {
      const g2 = last.map((st) => this.rewrite(clone(st), fragCtx));
      this.addMethod(name, func([SELF, ENV].concat(params), [
        localStat([nName], [this.scratchTable(params)]),
        ...g2,
      ], vararg));
      return;
    }

    const start = this.randInt(0x12, 0x48);
    const step = this.randInt(0x1c, 0x6e);
    const hits = work.length;
    const stop = start + step * Math.max(hits - 1, 0);
    const disp = this.fresh();
    const usedMag = new Set();
    const magContinue = this.freshSentinel(usedMag);
    const magBreak = this.freshSentinel(usedMag);

    const body = rangeIfHighToLow(
      'n',
      hits,
      start,
      step,
      (gi) => {
        let st = work[gi].map((s) => this.rewrite(clone(s), fragCtx));
        st = this.liftAll(st, { bound: new Set([SELF, ENV, 'n', nName]) });
        st = this.mixNumericFors(st);
        const magic = gi === hits - 1 ? magBreak : magContinue;
        // Never emit a statement after `return`/`break`/`continue`.
        const lastSt = st[st.length - 1];
        if (lastSt && (lastSt.type === 'ReturnStatement' || lastSt.type === 'BreakStatement' || lastSt.type === 'ContinueStatement')) {
          return st;
        }
        return st.concat([ret([this.num(magic), ident(nName)])]);
      },
      (v) => this.num(v),
      this,
    );
    body.push(ret([niln(), ident(nName)]));

    this.addMethod(disp, func([SELF, ENV, 'n', nName], body));

    this.used.add(nName);
    const iter = this.fresh('f');
    const status = this.fresh('s');
    const kind = pickLoopKind(this);
    const onCont = kind === 'for' ? [] : [advanceIter(iter, this.num(step))];
    const loopBody = [
      assign([ident(status), ident(nName)], [mcall(ident(SELF), disp, [ident(ENV), ident(iter), ident(nName)])]),
    ].concat(this.sentinelGate(status, magBreak, magContinue, onCont));
    const dispatch = [
      localStat([nName], [this.scratchTable(params)]),
      localStat([status]),
    ].concat(numericStateLoop(
      iter,
      this.num(start),
      this.num(stop),
      this.num(step),
      loopBody,
      kind,
      { noTail: kind !== 'for' },
    ));

    if (lastReturns) {
      const lastName = this.fresh();
      let g2 = last.map((st) => this.rewrite(clone(st), fragCtx));
      g2 = this.liftAll(g2, { bound: new Set([SELF, ENV, nName]) });
      g2 = this.splitBranches(g2, { bound: new Set([SELF, ENV, nName]) });
      g2 = this.mixNumericFors(g2);
      this.addMethod(lastName, func([SELF, ENV, nName], g2, vararg));
      dispatch.push(ret([mcall(ident(SELF), lastName, [ident(ENV), ident(nName)])]));
    }

    this.addMethod(name, func([SELF, ENV].concat(params), dispatch, vararg));
  };

  P.isHot = function isHot(stats) {
    const walk = (n, allowAnon) => {
      if (!n || typeof n !== 'object') return false;
      if (Array.isArray(n)) return n.some((x) => walk(x, allowAnon));
      if (n.type === 'WhileStatement' && n.cond && n.cond.type === 'BooleanLiteral' && n.cond.value === true) {
        return true;
      }
      if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') {
        return allowAnon ? walk(n.body, false) : false;
      }
      if (n.type === 'CallExpression' || n.type === 'MethodCallExpression') {
        if (walk(n.callee || n.object, allowAnon)) return true;
        return walk(n.args, false);
      }
      if (n.type === 'CallStatement') return walk(n.expr, allowAnon);
      if (n.type === 'LocalStatement') return walk(n.init, false);
      if (n.type === 'AssignmentStatement') return walk(n.inits, false);
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw') continue;
        if (walk(n[k], allowAnon)) return true;
      }
      return false;
    };
    return walk(stats, false);
  };

  P.shouldKeepWhole = function shouldKeepWhole(stats) {
    return this.isHot(stats);
  };

  P._fnSize = function _fnSize(node) {
    if (!node || typeof node !== 'object') return 0;
    if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
      return (node.body || []).length;
    }
    if (Array.isArray(node)) return node.reduce((a, b) => a + this._fnSize(b), 0);
    let n = 0;
    for (const k of Object.keys(node)) {
      if (k === 'loc') continue;
      n += this._fnSize(node[k]);
    }
    return n;
  };

  P.hoistBody = function hoistBody(body) {
    const stats = [];
    for (const s of body || []) {
      if (s.type === 'LocalStatement') {
        if (s.init && s.init.length) stats.push(assign(s.names.map(ident), s.init));
      } else if (s.type === 'FunctionDeclaration' && s.isLocal) {
        stats.push(assign(ident(s.names[0]), {
          type: 'FunctionExpression',
          params: s.params,
          vararg: s.vararg,
          body: s.body,
        }));
      } else {
        stats.push(s);
      }
    }
    return stats;
  };

  // Names whose `local` hoistBody strips at the top level of body. Callers
  // that keep the hoisted body inline MUST re-declare these first —
  // otherwise the bare assigns leak to globals/upvalues and re-entrant
  // invocations (nested VM Loops) clobber each other.
  P.topHoistedNames = function topHoistedNames(body, params) {
    const out = [];
    const seen = new Set((params || []).concat([SELF, ENV]));
    for (const s of body || []) {
      if (s.type === 'LocalStatement') {
        for (const n of s.names || []) {
          if (typeof n === 'string' && !seen.has(n)) { seen.add(n); out.push(n); }
        }
      } else if (s.type === 'FunctionDeclaration' && s.isLocal && s.names[0] && !seen.has(s.names[0])) {
        seen.add(s.names[0]);
        out.push(s.names[0]);
      }
    }
    return out;
  };

  P.groupStats = function groupStats(stats) {
    const groups = [];
    let i = 0;
    const isCtrl = (s) => s && (
      s.type === 'ReturnStatement' || s.type === 'WhileStatement' || s.type === 'RepeatStatement'
      || s.type === 'ForNumericStatement' || s.type === 'ForGenericStatement' || s.type === 'IfStatement'
    );
    while (i < stats.length) {
      const s = stats[i];
      if (isCtrl(s)) {
        groups.push([s]);
        i += 1;
        continue;
      }
      const size = this.randInt(2, 4);
      const chunk = [];
      while (chunk.length < size && i < stats.length && !isCtrl(stats[i])) {
        chunk.push(stats[i]);
        i += 1;
      }
      if (chunk.length) groups.push(chunk);
    }
    if (!groups.length) groups.push([]);
    return groups;
  };

  P.pickScratch = function pickScratch(bound) {
    const forbidden = new Set(bound);
    forbidden.add(SELF);
    forbidden.add(ENV);
    forbidden.add('self');
    const used = new Set();
    return allocVisualName(used, this.rng, forbidden);
  };

  P.renameIdents = function renameIdents(node, map) {
    if (!map || !Object.keys(map).length) return node;
    const walk = (n, bound) => {
      if (!n || typeof n !== 'object') return n;
      if (Array.isArray(n)) return n.map((x) => walk(x, bound));
      if (n.type === 'Identifier') {
        if (!bound.has(n.name) && map[n.name]) return ident(map[n.name]);
        return n;
      }
      if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') {
        const b = new Set(bound);
        for (const p of n.params || []) b.add(p);
        collectLocalNames(n.body).forEach((x) => b.add(x));
        return { ...n, body: walk(n.body, b) };
      }
      if (n.type === 'ForNumericStatement') {
        const b = new Set(bound);
        b.add(n.name);
        return { ...n, start: walk(n.start, b), stop: walk(n.stop, b), step: n.step ? walk(n.step, b) : n.step, body: walk(n.body, b) };
      }
      if (n.type === 'ForGenericStatement') {
        const b = new Set(bound);
        for (const x of n.names) b.add(x);
        return { ...n, iters: walk(n.iters, b), body: walk(n.body, b) };
      }
      const o = {};
      for (const k of Object.keys(n)) o[k] = walk(n[k], bound);
      return o;
    };
    return walk(node, new Set());
  };

  P.extractNested = function extractNested(stats, ctx) {
    const maybe = (e, origName) => {
      const u = unwrap(e);
      if (!u || (u.type !== 'FunctionExpression' && u.type !== 'FunctionDeclaration')) return e;
      const hot = this.isHot(u.body || []) || (ctx && ctx.hot);
      const params = (u.params || []).map((p) => (p === SELF || p === ENV ? this.fresh() : p));
      const paramMap = {};
      (u.params || []).forEach((p, i) => {
        if (p !== params[i]) paramMap[p] = params[i];
      });
      // Vararg nested functions stay inline — no function(...)return T:foo(env,...) trampoline.
      // hoistBody strips their top-level `local`s: re-declare them so the
      // closure keeps its own locals instead of leaking to globals.
      if (u.vararg || usesVararg(u.body || [])) {
        let body = this.renameIdents(clone(u.body), paramMap);
        const bound = new Set([SELF, ENV].concat(params));
        collectLocalNames(body).forEach((n) => bound.add(n));
        const hoisted = this.topHoistedNames(body, params);
        body = this.rewrite(this.hoistBody(body), { bound, scratch: null, nName: null, hot: true });
        if (hoisted.length) body = [localStat(hoisted)].concat(body);
        return func(params, body, true);
      }
      const nm = this.fresh();
      if (origName) this.methods.set(origName, nm);
      let body = this.renameIdents(clone(u.body), paramMap);
      const bound = new Set([SELF, ENV].concat(params));
      if (!hot) {
        body = this.extractNested(body, { bound });
      } else {
        body = this.extractNested(body, { bound, hot: true });
      }
      body = this.rewrite(this.hoistBody(body), { bound, scratch: null, nName: null, hot });
      if (!hot) {
        body = this.liftAll(body, { bound });
        body = this.splitBranches(body, { bound });
      }
      const hoistNames = new Set(
        [...collectLocalNames(u.body)].filter((n) => !bound.has(n) && n !== SELF && n !== ENV),
      );
      const innerScope = new Set([...bound, ...hoistNames]);
      collectLocalNames(body).forEach((n) => innerScope.add(n));
      const capturedSet = new Set(
        this.freeNames(body, innerScope).filter((n) => n !== SELF && n !== ENV),
      );
      const captured = [...capturedSet];
      const hoist = [...hoistNames].filter((n) => !capturedSet.has(n));
      if (hoist.length) body = [localStat(hoist)].concat(body);
      body = this.flattenTrivialReturn(body);
      const nmVararg = !!(u.vararg || usesVararg(body));
      this.addMethod(nm, func([SELF, ENV].concat(params, captured), body, nmVararg));
      const fwd = params.map(ident).concat(captured.map(ident));
      if (u.vararg && nmVararg) fwd.push({ type: 'VarargExpression' });
      if ((hot || this.chance(0.7)) && typeof this.methodSlotRef === 'function') {
        return func(params, [
          ret([this.slotCall(nm, fwd, { envName: ENV })]),
        ], u.vararg);
      }
      return func(params, [
        ret([mcall(ident(SELF), nm, [ident(ENV)].concat(fwd))]),
      ], u.vararg);
    };

    const walkExpr = (e) => {
      if (!e || typeof e !== 'object') return e;
      if (Array.isArray(e)) return e.map(walkExpr);
      const u = unwrap(e);
      if (u && (u.type === 'FunctionExpression' || u.type === 'FunctionDeclaration')) {
        if (ctx && ctx.hot) {
          const params = (u.params || []).slice();
          const bound = new Set([SELF, ENV].concat(params));
          collectLocalNames(u.body).forEach((n) => bound.add(n));
          const hoisted = this.topHoistedNames(clone(u.body), params);
          let hotBody = this.rewrite(this.hoistBody(clone(u.body)), { bound, scratch: null, nName: null, hot: true });
          if (hoisted.length) hotBody = [localStat(hoisted)].concat(hotBody);
          return func(params, hotBody, u.vararg);
        }
        return maybe(e);
      }
      if (e.type === 'CallExpression') {
        return call(walkExpr(e.callee), (e.args || []).map(walkExpr));
      }
      if (e.type === 'MethodCallExpression') {
        return mcall(walkExpr(e.object), e.method, (e.args || []).map(walkExpr));
      }
      if (e.type === 'ParenExpression') return { type: 'ParenExpression', expr: walkExpr(e.expr) };
      if (e.type === 'TableConstructor') {
        return {
          type: 'TableConstructor',
          fields: (e.fields || []).map((f) => {
            if (f.type === 'TableKeyString' && String(f.key).startsWith('__')) return f;
            if (f.type === 'TableKey') return { ...f, key: walkExpr(f.key), value: walkExpr(f.value) };
            return { ...f, value: walkExpr(f.value) };
          }),
        };
      }
      return e;
    };

    return walkStats(stats, (s) => {
      if (s.type === 'LocalStatement' && s.init && s.init.length) {
        return {
          ...s,
          init: s.init.map((e, i) => {
            const u = unwrap(e);
            if (u && (u.type === 'FunctionExpression' || u.type === 'FunctionDeclaration')) {
              if (ctx && ctx.hot) return walkExpr(e);
              return maybe(e, s.names[i]);
            }
            return walkExpr(e);
          }),
        };
      }
      if (s.type === 'AssignmentStatement') {
        return { ...s, inits: (s.inits || []).map(walkExpr) };
      }
      if (s.type === 'FunctionDeclaration') {
        if (ctx && ctx.hot) {
          const bound = new Set([SELF, ENV].concat(s.params || []));
          const hoisted = this.topHoistedNames(clone(s.body), s.params || []);
          let hotBody = this.rewrite(this.hoistBody(clone(s.body)), { bound, scratch: null, nName: null, hot: true });
          if (hoisted.length) hotBody = [localStat(hoisted)].concat(hotBody);
          return { ...s, body: hotBody };
        }
        const wrapped = maybe({
          type: 'FunctionExpression',
          params: s.params,
          vararg: s.vararg,
          body: s.body,
        }, s.names && s.names[0]);
        if (s.isLocal) return localStat(s.names.slice(), [wrapped]);
        return assign(ident(s.names[0]), wrapped);
      }
      if (s.type === 'ReturnStatement' && s.args && s.args.length) {
        return { ...s, args: s.args.map(walkExpr) };
      }
      if (s.type === 'CallStatement') {
        return { ...s, expr: walkExpr(s.expr) };
      }
      return s;
    });
  };

  P.flattenTrivialReturn = function flattenTrivialReturn(body) {
    body = this.mixNumericFors(body || []);
    if (!body || !body.length) return body || [];
    const last = body[body.length - 1];
    if (!last || last.type !== 'ReturnStatement' || !last.args || last.args.length !== 1) return body;
    const retArg = unwrap(last.args[0]);
    if (!retArg || retArg.type !== 'Identifier') return body;
    const prev = body[body.length - 2];
    if (!prev) return body;
    if (prev.type === 'LocalStatement' && prev.names && prev.names.length === 1 && prev.names[0] === retArg.name && prev.init && prev.init[0]) {
      return body.slice(0, -2).concat([ret([prev.init[0]])]);
    }
    if (prev.type === 'AssignmentStatement' && prev.vars && prev.vars.length === 1 && prev.inits && prev.inits[0]) {
      const v = unwrap(prev.vars[0]);
      if (v && v.type === 'Identifier' && v.name === retArg.name) {
        return body.slice(0, -2).concat([ret([prev.inits[0]])]);
      }
    }
    return body;
  };

  P.slotCall = function slotCall(methodName, args, ctx) {
    if (typeof this.methodSlotRef !== 'function') return null;
    const envName = (ctx && ctx.envName) || ENV;
    const pass = [ident(SELF), ident(envName)].concat(args || []);
    return call(this.methodSlotRef(methodName, envName), pass);
  };

  P.rewriteMethodCall = function rewriteMethodCall(node, ctx) {
    const obj = this.rewrite(node.object, ctx);
    const args = this.rewrite(node.args || [], ctx);
    const u = unwrap(obj);
    const selfish = u && u.type === 'Identifier' && u.name === SELF;
    if (selfish && typeof this.methodSlotRef === 'function' && (ctx.hot || this.chance(0.62))) {
      let pass = args;
      const envId = (ctx && ctx.envName) || ENV;
      if (pass[0] && unwrap(pass[0]).type === 'Identifier' && unwrap(pass[0]).name === envId) {
        pass = pass.slice(1);
      }
      const slotted = this.slotCall(node.method, pass, ctx);
      if (slotted) return slotted;
    }
    return { type: 'MethodCallExpression', object: obj, method: node.method, args };
  };

  P.rewrite = function rewrite(node, ctx) {
    if (Array.isArray(node)) return node.map((n) => this.rewrite(n, ctx));
    if (!node || typeof node !== 'object') return node;
    if (!node.type) return node;

    if (node.type === 'CallExpression') return this.rewriteCall(node, ctx);
    if (node.type === 'MethodCallExpression') return this.rewriteMethodCall(node, ctx);
    if (node.type === 'Identifier') return this.rewriteIdent(node, ctx);
    if (node.type === 'MemberExpression') return this.rewriteMember(node, ctx);
    if (node.type === 'LocalStatement') return this.rewriteLocal(node, ctx);
    if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
      return this.rewriteFun(node, ctx);
    }
    if (node.type === 'IfStatement') {
      return {
        type: 'IfStatement',
        clauses: (node.clauses || []).map((c) => ({
          cond: this.rewrite(c.cond, ctx),
          body: this.rewrite(c.body, ctx),
        })),
        elseBody: node.elseBody ? this.rewrite(node.elseBody, ctx) : node.elseBody,
      };
    }
    if (node.type === 'ForNumericStatement') {
      const shadow = this.loopShadowsEnv(node.name, ctx, node.body);
      const name = shadow ? this.repairLoopName(node.name, ctx, node.body) : node.name;
      const bound = new Set(ctx.bound);
      bound.add(name);
      const inner = { ...ctx, bound };
      if (shadow) inner.varRename = withRename(ctx.varRename, node.name, name);
      return {
        type: 'ForNumericStatement',
        name,
        start: this.rewrite(node.start, inner),
        stop: this.rewrite(node.stop, inner),
        step: node.step ? this.rewrite(node.step, inner) : node.step,
        body: this.rewrite(node.body, inner),
      };
    }
    if (node.type === 'ForGenericStatement') {
      const renames = new Map();
      const names = (node.names || []).map((n) => {
        if (!this.loopShadowsEnv(n, ctx, node.body)) return n;
        const fixed = this.repairLoopName(n, ctx, node.body);
        renames.set(n, fixed);
        return fixed;
      });
      const bound = new Set(ctx.bound);
      for (const n of names) bound.add(n);
      const inner = { ...ctx, bound };
      if (renames.size) {
        let map = ctx.varRename;
        for (const [from, to] of renames) map = withRename(map, from, to);
        inner.varRename = map;
      }
      return {
        type: 'ForGenericStatement',
        names,
        iters: this.rewrite(node.iters, inner),
        body: this.rewrite(node.body, inner),
      };
    }

    const out = {};
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v && typeof v !== 'object') out[k] = v;
      else if (v && typeof v === 'object') out[k] = this.rewrite(v, ctx);
      else out[k] = v;
    }
    return out;
  };

  P.rewriteFun = function rewriteFun(node, ctx) {
    const bound = new Set(ctx.bound);
    for (const p of node.params || []) bound.add(p);
    collectLocalNames(node.body).forEach((n) => bound.add(n));
    const inner = { ...ctx, bound, hot: ctx.hot || this.isHot(node.body) };
    const body = this.rewrite(node.body, inner);
    if (node.type === 'FunctionDeclaration') {
      return {
        type: 'FunctionDeclaration',
        isLocal: node.isLocal,
        names: node.names.slice(),
        method: node.method,
        params: node.params.slice(),
        vararg: node.vararg,
        body,
      };
    }
    return func(node.params.slice(), body, node.vararg);
  };

  P.rewriteLocal = function rewriteLocal(node, ctx) {
    const names = node.names || [];
    const inits = (node.init || []).map((v) => this.rewrite(v, ctx));
    if (!ctx.scratch || !ctx.nName) return { ...node, init: inits };
    const keepNames = [];
    const keepInits = [];
    const scrVars = [];
    const scrInits = [];
    names.forEach((nm, i) => {
      if (!ctx.bound.has(nm) && ctx.scratch.has(nm)) {
        scrVars.push(idx(ident(ctx.nName), this.num(ctx.scratch.get(nm))));
        scrInits.push(inits[i] || { type: 'NilLiteral' });
      } else {
        keepNames.push(nm);
        if (inits[i]) keepInits.push(inits[i]);
      }
    });
    if (!scrVars.length) return { ...node, init: inits };
    if (keepNames.length) return { ...node, init: inits };
    return assign(scrVars, scrInits);
  };

  P.rewriteIdent = function rewriteIdent(node, ctx) {
    const name = node.name;
    if (ctx.bound.has(name)) {
      if (ctx.varRename && ctx.varRename.has(name)) return ident(ctx.varRename.get(name));
      return ident(name);
    }
    if (ctx.scratch && ctx.scratch.has(name)) {
      return idx(ident(ctx.nName), this.num(ctx.scratch.get(name)));
    }
    if (this.methods.has(name)) {
      return this.methodValue(name, ctx.envName);
    }
    if (this.slots.has(name)) {
      return this.envSlot(this.slots.get(name), ctx.envName);
    }
    if (GLOBAL_FUNCS[name]) {
      return this.aliasRef(GLOBAL_FUNCS[name], ctx);
    }
    return ident(name);
  };

  P.rewriteMember = function rewriteMember(node, ctx) {
    const obj = unwrap(node.object);
    if (obj && obj.type === 'Identifier') {
      const key = obj.name + '.' + node.property;
      if (LIB_MEMBERS[key]) return this.aliasRef(LIB_MEMBERS[key], ctx);
      if (obj.name === 'h' && (node.property === 'x' || node.property === 'b')) {
        const m = node.property === 'x' ? (this.hx && this.hx.name) : (this.hb && this.hb.name);
        if (m) return mem(ident(SELF), m);
      }
    }
    return {
      type: 'MemberExpression',
      object: this.rewrite(node.object, ctx),
      property: node.property,
    };
  };

  P.rewriteCall = function rewriteCall(node, ctx) {
    const args = this.rewrite(node.args || [], ctx);
    const callee = node.callee;
    const env = ident(ctx.envName || ENV);
    if (callee && callee.type === 'Identifier') {
      if (ctx.hot && this.methods.has(callee.name) && typeof this.methodSlotRef === 'function') {
        return this.slotCall(this.methods.get(callee.name), args, ctx);
      }
      if (ctx.bound.has(callee.name) || (ctx.scratch && ctx.scratch.has(callee.name))) {
        return call(this.rewriteIdent(callee, ctx), args);
      }
      if (this.methods.has(callee.name)) {
        const m = this.methods.get(callee.name);
        if ((ctx.hot || this.chance(0.7)) && typeof this.methodSlotRef === 'function') {
          return this.slotCall(m, args, ctx);
        }
        return mcall(ident(SELF), m, [env].concat(args));
      }
      if (this.slots.has(callee.name)) {
        return call(this.envSlot(this.slots.get(callee.name), ctx.envName), args);
      }
      if (GLOBAL_FUNCS[callee.name]) {
        return call(this.aliasRef(GLOBAL_FUNCS[callee.name], ctx), args);
      }
    }
    if (callee && callee.type === 'MemberExpression' && callee.object && callee.object.type === 'Identifier') {
      if (callee.object.name === 'h' && (callee.property === 'x' || callee.property === 'b')) {
        const m = callee.property === 'x' ? (this.hx && this.hx.name) : (this.hb && this.hb.name);
        if (m) {
          if ((ctx.hot || this.chance(0.7)) && typeof this.methodSlotRef === 'function') {
            return this.slotCall(m, args, ctx);
          }
          return mcall(ident(SELF), m, [env].concat(args));
        }
      }
      const key = callee.object.name + '.' + callee.property;
      if (key === 'math.floor' && args.length === 1) {
        const x = args[0];
        const dup = this.isAtomic(x) ? x : clone(x);
        return paren(bin('-', x, bin('%', dup, this.num(1))));
      }
      if (LIB_MEMBERS[key]) {
        return call(this.aliasRef(LIB_MEMBERS[key], ctx), args);
      }
    }
    return call(this.rewrite(callee, ctx), args);
  };

  P.isAtomic = function isAtomic(e) {
    e = unwrap(e);
    if (!e || typeof e !== 'object') return false;
    switch (e.type) {
      case 'Identifier':
      case 'NumericLiteral':
      case 'BooleanLiteral':
      case 'NilLiteral':
      case 'StringLiteral':
      case 'VarargExpression':
        return true;
      case 'IndexExpression':
        return this.isAtomic(e.object) && this.isAtomic(e.index);
      case 'MemberExpression':
        return this.isAtomic(e.object);
      case 'ParenExpression':
        return this.isAtomic(e.expr);
      default:
        return false;
    }
  };

  P.freeNames = function freeNames(node, bound) {
    const free = new Set();
    const walk = (n, b) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) {
        for (const x of n) walk(x, b);
        return;
      }
      if (n.type === 'Identifier') {
        const name = n.name;
        if (!b.has(name) && !KEYWORDS.has(name) && !LUA_GLOBALS.has(name) && !ALIAS_EXPR[name]) {
          free.add(name);
        }
        return;
      }
      if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') {
        const nb = new Set(b);
        for (const p of n.params || []) nb.add(p);
        collectLocalNames(n.body).forEach((x) => nb.add(x));
        walk(n.body, nb);
        return;
      }
      if (n.type === 'ForNumericStatement') {
        walk(n.start, b);
        walk(n.stop, b);
        if (n.step) walk(n.step, b);
        const nb = new Set(b);
        nb.add(n.name);
        walk(n.body, nb);
        return;
      }
      if (n.type === 'ForGenericStatement') {
        walk(n.iters, b);
        const nb = new Set(b);
        for (const x of n.names) nb.add(x);
        walk(n.body, nb);
        return;
      }
      if (n.type === 'LocalStatement') {
        walk(n.init, b);
        return;
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw') continue;
        if (k === 'property' && n.type === 'MemberExpression') continue;
        if (k === 'method' && n.type === 'MethodCallExpression') continue;
        walk(n[k], b);
      }
    };
    walk(node, new Set(bound || []));
    collectLocalNames(Array.isArray(node) ? node : []).forEach((x) => free.delete(x));
    free.delete(SELF);
    free.delete(ENV);
    return [...free];
  };

  P.liftAll = function liftAll(node, ctx) {
    if (Array.isArray(node)) return node.map((n) => this.liftAll(n, ctx));
    if (!node || typeof node !== 'object' || !node.type) return node;

    if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
      const bound = new Set(ctx.bound);
      for (const p of node.params || []) bound.add(p);
      collectLocalNames(node.body).forEach((n) => bound.add(n));
      const body = this.liftAll(node.body, { bound });
      return node.type === 'FunctionDeclaration'
        ? { ...node, body }
        : func(node.params.slice(), body, node.vararg);
    }
    if (node.type === 'IfStatement') {
      return {
        type: 'IfStatement',
        clauses: (node.clauses || []).map((c) => ({
          cond: this.liftExpr(c.cond, ctx, 'cond'),
          body: this.liftAll(c.body, ctx),
        })),
        elseBody: node.elseBody ? this.liftAll(node.elseBody, ctx) : node.elseBody,
      };
    }
    if (node.type === 'ForNumericStatement') {
      const bound = new Set(ctx.bound);
      bound.add(node.name);
      const inner = { bound };
      return {
        type: 'ForNumericStatement',
        name: node.name,
        start: this.liftExpr(node.start, ctx, 'val'),
        stop: this.liftExpr(node.stop, ctx, 'val'),
        step: node.step ? this.liftExpr(node.step, ctx, 'val') : node.step,
        body: this.liftAll(node.body, inner),
      };
    }
    if (node.type === 'ForGenericStatement') {
      const bound = new Set(ctx.bound);
      for (const n of node.names) bound.add(n);
      return {
        type: 'ForGenericStatement',
        names: node.names.slice(),
        iters: this.liftAll(node.iters, ctx),
        body: this.liftAll(node.body, { bound }),
      };
    }
    if (node.type === 'WhileStatement' || node.type === 'RepeatStatement' || node.type === 'DoStatement') {
      return { ...node, cond: node.cond ? this.liftExpr(node.cond, ctx, 'cond') : node.cond, body: this.liftAll(node.body, ctx) };
    }
    if (node.type === 'ReturnStatement') {
      return { ...node, args: (node.args || []).map((a) => this.liftExpr(a, ctx, 'val')) };
    }
    if (node.type === 'AssignmentStatement') {
      return {
        ...node,
        vars: (node.vars || []).map((v) => this.liftAll(v, ctx)),
        inits: (node.inits || []).map((v) => this.liftExpr(v, ctx, 'val')),
      };
    }
    if (node.type === 'LocalStatement') {
      return { ...node, init: (node.init || []).map((v) => this.liftExpr(v, ctx, 'val')) };
    }
    if (node.type === 'CallStatement') {
      return { ...node, expr: this.liftExpr(node.expr, ctx, 'val') };
    }

    const out = {};
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (v && typeof v === 'object') out[k] = this.liftAll(v, ctx);
      else out[k] = v;
    }
    return out;
  };

  P.liftExpr = function liftExpr(node, ctx, role) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((n) => this.liftExpr(n, ctx, role));

    if (node.type === 'BinaryExpression') {
      const left = this.liftExpr(node.left, ctx, 'val');
      const right = this.liftExpr(node.right, ctx, 'val');
      return { type: 'BinaryExpression', op: node.op, left, right };
    }
    if (node.type === 'UnaryExpression') {
      const arg = this.liftExpr(node.arg, ctx, 'val');
      return { type: 'UnaryExpression', op: node.op, arg };
    }
    if (node.type === 'ParenExpression') {
      return { type: 'ParenExpression', expr: this.liftExpr(node.expr, ctx, role) };
    }
    if (node.type === 'CallExpression') {
      return call(this.liftExpr(node.callee, ctx, 'val'), (node.args || []).map((a) => this.liftExpr(a, ctx, 'val')));
    }
    if (node.type === 'MethodCallExpression') {
      return mcall(this.liftExpr(node.object, ctx, 'val'), node.method, (node.args || []).map((a) => this.liftExpr(a, ctx, 'val')));
    }
    if (node.type === 'IndexExpression') {
      return idx(this.liftExpr(node.object, ctx, 'val'), this.liftExpr(node.index, ctx, 'val'));
    }
    if (node.type === 'MemberExpression') {
      return { type: 'MemberExpression', object: this.liftExpr(node.object, ctx, 'val'), property: node.property };
    }
    if (node.type === 'TableConstructor') {
      return {
        type: 'TableConstructor',
        fields: (node.fields || []).map((f) => {
          if (f.type === 'TableValue') return { ...f, value: this.liftExpr(f.value, ctx, 'val') };
          if (f.type === 'TableKey') {
            return { ...f, key: this.liftExpr(f.key, ctx, 'val'), value: this.liftExpr(f.value, ctx, 'val') };
          }
          if (f.type === 'TableKeyString') return { ...f, value: this.liftExpr(f.value, ctx, 'val') };
          return f;
        }),
      };
    }
    if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
      return this.liftAll(node, ctx);
    }
    return node;
  };

  P.liftBinop = function liftBinop(node) {
    const nm = this.fresh();
    const right = unwrap(node.right);
    const left = unwrap(node.left);
    if (right && right.type === 'NumericLiteral') {
      this.addMethod(nm, func([SELF, ENV], [
        ret([bin(node.op, ident(ENV), node.right)]),
      ]));
      return mcall(ident(SELF), nm, [node.left]);
    }
    if (left && left.type === 'NumericLiteral') {
      this.addMethod(nm, func([SELF, ENV], [
        ret([bin(node.op, node.left, ident(ENV))]),
      ]));
      return mcall(ident(SELF), nm, [node.right]);
    }
    this.addMethod(nm, func([SELF, ENV, 'n'], [
      ret([bin(node.op, ident(ENV), ident('n'))]),
    ]));
    return mcall(ident(SELF), nm, [node.left, node.right]);
  };

  P.liftUnary = function liftUnary(node) {
    const nm = this.fresh();
    this.addMethod(nm, func([SELF, ENV], [
      ret([{ type: 'UnaryExpression', op: node.op, arg: ident(ENV) }]),
    ]));
    return mcall(ident(SELF), nm, [node.arg]);
  };

  P.splitBranches = function splitBranches(stats, ctx) {
    if (!stats || !stats.length) return stats;
    const out = [];
    for (const s of stats) {
      if (!s) continue;
      if (s.type === 'IfStatement') {
        out.push(this.splitIf(s, ctx));
      } else if (s.type === 'ForNumericStatement') {
        const bound = new Set(ctx.bound);
        bound.add(s.name);
        let body = this.splitBranches(s.body, { bound });
        // Loop bodies that assign outer locals (e.g. `u = u + 1` counter in
        // xor_rgn / Rgns decode) must stay inline: extractBodyMethod passes
        // numbers by value, so the increment is lost and decryption corrupts
        // (u stays 1, wrong Z7/Zf). Same guard as splitIf branches.
        if (body.length > 1 && !this.bodyAssignsIdent(body)) body = this.extractBodyMethod(body, { bound });
        out.push({ ...s, body });
      } else if (s.type === 'ForGenericStatement') {
        const bound = new Set(ctx.bound);
        for (const n of s.names) bound.add(n);
        let body = this.splitBranches(s.body, { bound });
        if (body.length > 1 && !this.bodyAssignsIdent(body)) body = this.extractBodyMethod(body, { bound });
        out.push({ ...s, body });
      } else if (s.type === 'WhileStatement' || s.type === 'RepeatStatement' || s.type === 'DoStatement') {
        let body = this.splitBranches(s.body, ctx);
        if (s.type === 'DoStatement' && body.length > 1 && !this.bodyAssignsIdent(body)) body = this.extractBodyMethod(body, ctx);
        out.push({ ...s, body });
      } else {
        out.push(s);
      }
    }
    return out;
  };

  P.splitDispatchLeaves = function splitDispatchLeaves(stats, ctx) {
    if (!stats || !stats.length) return stats;
    return stats.map((s) => this.splitDispatchStat(s, ctx));
  };

  P.splitDispatchStat = function splitDispatchStat(s, ctx) {
    if (!s || typeof s !== 'object') return s;
    if (s.type === 'IfStatement') {
      if (isRangeIfTree(s)) {
        return walkRangeLeaves(s, (body) => this.extractBodyMethod(body, ctx));
      }
      return {
        type: 'IfStatement',
        clauses: (s.clauses || []).map((c) => ({
          cond: c.cond,
          body: this.splitDispatchLeaves(c.body, ctx),
        })),
        elseBody: s.elseBody ? this.splitDispatchLeaves(s.elseBody, ctx) : s.elseBody,
      };
    }
    if (s.type === 'WhileStatement' || s.type === 'RepeatStatement' || s.type === 'DoStatement') {
      return { ...s, body: this.splitDispatchLeaves(s.body, ctx) };
    }
    if (s.type === 'ForNumericStatement') {
      const bound = new Set(ctx.bound);
      bound.add(s.name);
      return { ...s, body: this.splitDispatchLeaves(s.body, { bound }) };
    }
    if (s.type === 'ForGenericStatement') {
      const bound = new Set(ctx.bound);
      for (const n of s.names) bound.add(n);
      return { ...s, body: this.splitDispatchLeaves(s.body, { bound }) };
    }
    return s;
  };

  P.splitIf = function splitIf(node, ctx) {
    if (isRangeIfTree(node)) {
      return walkRangeLeaves(node, (body) => this.extractBodyMethod(body, ctx));
    }
    const clauses = (node.clauses || []).map((c) => {
      let body = this.splitBranches(c.body, ctx);
      if (body.length && !this.bodyAssignsIdent(body)) {
        if (body.length > 1) {
          body = this.extractBodyMethod(body, ctx);
        }
      }
      return { cond: c.cond, body };
    });
    let elseBody = node.elseBody ? this.splitBranches(node.elseBody, ctx) : node.elseBody;
    if (elseBody && elseBody.length && !this.bodyAssignsIdent(elseBody)) {
      if (elseBody.length > 1) {
        elseBody = this.extractBodyMethod(elseBody, ctx);
      }
    }
    return { type: 'IfStatement', clauses, elseBody };
  };

  P.bodyAssignsIdent = function bodyAssignsIdent(body) {
    let found = false;
    const walk = (n) => {
      if (!n || typeof n !== 'object' || found) return;
      if (Array.isArray(n)) {
        for (const x of n) walk(x);
        return;
      }
      if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') return;
      if (n.type === 'AssignmentStatement') {
        for (const v of n.vars || []) {
          const u = unwrap(v);
          if (u && u.type === 'Identifier') {
            found = true;
            return;
          }
        }
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw') continue;
        walk(n[k]);
      }
    };
    walk(body);
    return found;
  };

  P.bodyUsesEnv = function bodyUsesEnv(node) {
    const walk = (n, shadowed) => {
      if (!n || typeof n !== 'object') return false;
      if (Array.isArray(n)) return n.some((x) => walk(x, shadowed));
      if (n.type === 'Identifier') return n.name === ENV && !shadowed;
      if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') {
        const innerShadow = shadowed || (n.params || []).indexOf(ENV) >= 0;
        return walk(n.body, innerShadow);
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
        if (walk(n[k], shadowed)) return true;
      }
      return false;
    };
    return walk(node, false);
  };

  P.hasBareBreak = function hasBareBreak(node) {
    return this.hasBareExit(node, true);
  };

  P.hasBareExit = function hasBareExit(node, breaksOnly) {
    let found = false;
    const walk = (n, depth) => {
      if (!n || found || typeof n !== 'object') return;
      if (Array.isArray(n)) {
        for (const x of n) walk(x, depth);
        return;
      }
      if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration') return;
      if (n.type === 'ReturnStatement') {
        if (!breaksOnly) found = true;
        return;
      }
      if (n.type === 'BreakStatement' || n.type === 'ContinueStatement') {
        if (depth === 0) found = true;
        return;
      }
      if (n.type === 'WhileStatement' || n.type === 'RepeatStatement') {
        if (n.cond) walk(n.cond, depth);
        walk(n.body, depth + 1);
        return;
      }
      if (n.type === 'DoStatement') {
        walk(n.body, depth);
        return;
      }
      if (n.type === 'ForNumericStatement') {
        walk(n.start, depth);
        walk(n.stop, depth);
        if (n.step) walk(n.step, depth);
        walk(n.body, depth + 1);
        return;
      }
      if (n.type === 'ForGenericStatement') {
        walk(n.iters, depth);
        walk(n.body, depth + 1);
        return;
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw') continue;
        walk(n[k], depth);
      }
    };
    walk(node, 0);
    return found;
  };

  P.extractBodyMethod = function extractBodyMethod(body, ctx) {
    if (!body || !body.length) return body || [];
    if (body.length === 1 && body[0].type === 'CallStatement') return body;
    if (this.hasBareExit(body)) return body;
    const free = this.freeNames(body, new Set([SELF]));
    const usesEnv = this.bodyUsesEnv(body);
    const extra = free.filter((p) => p !== SELF && p !== ENV);
    const params = usesEnv ? [SELF, ENV].concat(extra) : [SELF].concat(extra);
    const seen = new Set();
    const uniq = params.filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
    const nm = this.fresh();
    this.addMethod(nm, func(uniq, this.flattenTrivialReturn(body), usesVararg(body)));
    const args = usesEnv ? [ident(ENV)].concat(extra.map(ident)) : extra.map(ident);
    let callE;
    if (usesEnv && typeof this.methodSlotRef === 'function' && this.chance(0.7)) {
      callE = this.slotCall(nm, extra.map(ident), ctx);
    } else {
      callE = mcall(ident(SELF), nm, args);
    }
    if (body.some((s) => containsType(s, 'ReturnStatement'))) return [ret([callE])];
    return [callStat(callE)];
  };
}

module.exports = { attachFunctionSplit };
