'use strict';

/**
 * Control-flow flattening (Xrings shape).
 *
 *   local W=(0X4FD);
 *   repeat
 *     if W<=4144 then
 *       if W==0x4FD then REAL; W=poolMba
 *     else if not(W==0X1031) then else REAL; break end
 *     end
 *   until false
 *
 *   for O=0X76,282,0B1111000 do
 *     if O>118 then REAL; break
 *     else if not(O<0xeE) then else REAL; continue end
 *   end
 *
 * Init is a literal. Next-state is pool and/or, pool linear, or z:qJ(Z,z.P).
 * Exact arms invert with empty-then: `if not(s==v) then else REAL`.
 * Tiny / range-dispatch helpers stay unflattened (ObjectSplit decides).
 */

const { parse } = require('../../AST/Parser');
const { printAst } = require('../../Factorizer/core/Printer');
const {
  ident,
  bool,
  bin,
  un,
  paren,
  assign,
  localStat,
  ifStat,
  ifChain,
  brk,
  cont,
  numNode,
  allocVisualName,
  SELF,
  ENV,
} = require('../../Factorizer/core/Ast');
const { OpaqueEngine } = require('./Opaque');
const { CfCacheEngine } = require('./Cache');
const { isRangeDispatchBody, rangeIfHighToLow, pickLoopKind } = require('./Dispatch');

class ControlFlowEngine {
  constructor(rng, opts) {
    this.rng = rng || Math.random;
    this.n = 0;
    this.maxDepth = 3;
    opts = opts || {};
    this.useSelf = !!opts.useSelf;
    this.selfName = opts.selfName || SELF;
    this.opaque = opts.opaque !== false;
    this.cache = opts.cache !== false;
    this.mba = opts.mba || null;
    this._reserved = new Set();
    this._cfUsed = new Set();
    this.cacheField = opts.cacheField || allocVisualName(this._cfUsed, this.rng, new Set([SELF, ENV, 'self']));
    this.opaquePass = new OpaqueEngine(this);
    this.cachePass = new CfCacheEngine(this);
  }

  rand() {
    return this.rng();
  }

  randInt(min, max) {
    return min + Math.floor(this.rand() * (max - min + 1));
  }

  pick(arr) {
    return arr[this.randInt(0, arr.length - 1)];
  }

  chance(p) {
    return this.rand() < p;
  }

  fresh() {
    const forbidden = new Set(this._reserved || []);
    forbidden.add(SELF);
    forbidden.add(ENV);
    forbidden.add('self');
    return allocVisualName(this._cfUsed, this.rng, forbidden);
  }

  /**
   * Every identifier visible in a source unit: declaration names (locals,
   * params, loop vars) AND uses (upvalue reads, globals). A flattened state
   * variable must avoid all of them — otherwise a chunk-level
   * `local <state>` shadows an outer helper (e.g. the `h` xor table) or a
   * global (e.g. `string`) for every chunk flattened after it.
   */
  scopeNames(root) {
    const out = new Set();
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (node.type === 'Identifier' && typeof node.name === 'string') out.add(node.name);
      if (node.type === 'LocalStatement' && node.names) {
        for (const n of node.names) if (typeof n === 'string') out.add(n);
      }
      if ((node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') && node.params) {
        for (const p of node.params) if (typeof p === 'string') out.add(p);
      }
      if (node.type === 'FunctionDeclaration' && node.names) {
        for (const n of node.names) if (typeof n === 'string') out.add(n);
      }
      if (node.type === 'ForNumericStatement' && typeof node.name === 'string') out.add(node.name);
      if (node.type === 'ForGenericStatement' && node.names) {
        for (const n of node.names) if (typeof n === 'string') out.add(n);
      }
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'raw') continue;
        const v = node[key];
        if (v && typeof v === 'object') walk(v);
      }
    };
    try {
      walk(root);
    } catch {
      // best effort — a partial set is still safer than none
    }
    return out;
  }

  num(value, forceStyle) {
    return numNode(value, (styles) => this.pick(styles), forceStyle, this.rng);
  }

  wrapOpaque(real) {
    return real || [];
  }

  _invertExact(stateName, sVal, real) {
    const s = ident(stateName);
    const eq = bin('==', s, this.num(sVal));
    const ne = bin('~=', s, this.num(sVal));
    switch (this.randInt(0, 3)) {
      case 0:
        // if not(s==v) then else REAL
        return [ifStat(un('not', paren(eq)), [], real)];
      case 1:
        // if not(not(s~=v)) then else REAL
        return [ifStat(un('not', paren(un('not', paren(ne)))), [], real)];
      case 2:
        // if not(s~=v) then REAL
        return [ifStat(un('not', paren(ne)), real, null)];
      default:
        return real;
    }
  }

  _armBody(stats, stateName, sVal, exact) {
    const real = stats && stats.length ? stats.slice() : [];
    if (!real.length) return [];
    if (exact && stateName && sVal != null && this.chance(0.6)) {
      return this._invertExact(stateName, sVal, real);
    }
    return real;
  }

  flattenChunk(src, outer) {
    if (!src || !String(src).trim()) return src;
    try {
      const ast = parse(String(src));
      const base = new Set(outer || []);
      for (const n of this.scopeNames(ast)) base.add(n);
      this._transform(ast, 0, base);
      ast.body = this.flattenStats(ast.body, 0, base);
      return printAst(ast, this.rng);
    } catch {
      return src;
    }
  }

  flattenSource(src) {
    return this.flattenChunk(src);
  }

  _transform(node, depth, base) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) this._transform(item, depth, base);
      return;
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'raw') continue;
      const v = node[key];
      if (v && typeof v === 'object') this._transform(v, depth, base);
    }
    if ((node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') && node.body) {
      const inner = new Set(base || []);
      for (const p of node.params || []) if (typeof p === 'string') inner.add(p);
      node.body = this.flattenStats(node.body, depth, inner);
    }
  }

  flattenStats(stats, depth, reserved) {
    depth = depth || 0;
    if (!stats || !stats.length) return stats || [];
    if (depth >= this.maxDepth) return stats;

    const prev = this._reserved;
    this._reserved = new Set([...(prev || []), ...(reserved || [])]);
    this._reserved.add(SELF);
    this._reserved.add(ENV);

    const hoisted = [];
    const blocks = [];
    const seenLocal = new Set();

    const hoistName = (name) => {
      if (!seenLocal.has(name)) {
        seenLocal.add(name);
        hoisted.push(name);
        this._reserved.add(name);
      }
    };

    for (const s of stats) {
      if (s.type === 'LocalStatement') {
        for (const n of s.names) hoistName(n);
        if (s.init && s.init.length) {
          blocks.push(assign(s.names.map(ident), s.init));
        }
      } else if (s.type === 'FunctionDeclaration' && s.isLocal) {
        hoistName(s.names[0]);
        const fn = {
          type: 'FunctionExpression',
          params: s.params,
          vararg: s.vararg,
          body: s.body,
        };
        blocks.push(assign(ident(s.names[0]), fn));
      } else {
        blocks.push(s);
      }
    }

    if (!blocks.length) {
      this._reserved = prev;
      return hoisted.length ? [localStat(hoisted)] : [];
    }

    if (isRangeDispatchBody(blocks) || isRangeDispatchBody(stats)) {
      const groups = [[], blocks];
      const machine = this._pickMachine(groups);
      const out = [];
      if (hoisted.length) out.push(localStat(hoisted));
      for (const st of machine) out.push(st);
      this._reserved = prev;
      return out;
    }

    const groups = this._group(blocks);
    const machine = this._pickMachine(groups);

    const out = [];
    if (hoisted.length) out.push(localStat(hoisted));
    for (const st of machine) out.push(st);
    this._reserved = prev;
    return out;
  }

  /**
   * Wrap a whole body (e.g. range-dispatch) in a 2-state machine
   * without splitting the tree — Xrings `SS=function` shape.
   */
  wrapBody(stats, reserved) {
    const prev = this._reserved;
    this._reserved = new Set([...(prev || []), ...(reserved || [])]);
    this._reserved.add(SELF);
    this._reserved.add(ENV);
    const groups = [[], (stats || []).slice()];
    const machine = this._pickMachine(groups);
    this._reserved = prev;
    return machine;
  }

  _pickMachine(groups) {
    const kind = pickLoopKind(this);
    return kind === 'for'
      ? this._emitForDispatch(groups)
      : this._emitStateMachine(groups, kind);
  }

  _group(blocks) {
    const groups = [];
    let i = 0;
    while (i < blocks.length) {
      const size = blocks.length - i <= 2 ? 1 : this.randInt(1, 2);
      groups.push(blocks.slice(i, i + size));
      i += size;
    }
    if (groups.length === 1) groups.unshift([]);
    return groups;
  }

  _notRel(stateName, op, bound) {
    return un('not', paren(bin(op, ident(stateName), this.num(bound))));
  }

  _emitStateMachine(groups, kind) {
    const useRepeat = kind === 'repeat' || (kind == null && this.chance(0.36));
    const stateName = this.fresh();
    const states = [];
    const used = new Set();
    // Xrings: large sparse (0x4FD, 4144, 0x16A9, 0x22F2, 13188)
    const helperTargets = (this.mba && this.mba.helpers)
      ? this.mba.helpers.map((h) => h.target).filter((t) => t > 0).sort((a, b) => a - b)
      : [];
    let cursor = helperTargets.length
      ? Math.max(0x40, helperTargets[0] - this.randInt(0x30, 0x1c0))
      : this.randInt(0x280, 0xa80);
    const pending = helperTargets.slice();
    for (let i = 0; i < groups.length; i++) {
      if (i > 0 && pending.length) {
        const idx = pending.findIndex((t) => t > cursor && !used.has(t));
        if (idx >= 0) {
          const t = pending.splice(idx, 1)[0];
          states.push(t);
          used.add(t);
          cursor = t;
          continue;
        }
      }
      while (used.has(cursor)) cursor += this.randInt(0x200, 0x800);
      states.push(cursor);
      used.add(cursor);
      cursor += this.randInt(0x2c0, 0xe00);
    }

    const inner = this._stateTree(stateName, groups, states, 0, groups.length);

    const machine = [localStat([stateName], [this.num(states[0])])];
    if (useRepeat) {
      machine.push({ type: 'RepeatStatement', body: inner, cond: bool(false) });
    } else {
      machine.push({ type: 'WhileStatement', cond: bool(true), body: inner });
    }
    return machine;
  }

  _armFor(gi, groups, states, stateName) {
    const sVal = states[gi];
    const isLast = gi === groups.length - 1;
    const isFirst = gi === 0;
    const exact = !isFirst || groups.length === 1;
    const real = this._armBody(groups[gi], stateName, sVal, exact);
    let thisBody = isLast
      ? real.concat(this._trailingBreak(real))
      : real.concat(this.cachePass.stash(stateName, this._stateValue(states[gi + 1], stateName, sVal)));

    if (isFirst && groups.length > 1 && groups[gi].length && this.chance(0.7)) {
      thisBody = [ifStat(bin('==', ident(stateName), this.num(sVal)), thisBody, null)];
    }
    if (isFirst && groups.length > 1 && this.chance(0.6)) {
      const next = states[1];
      thisBody = [ifStat(this._notRel(stateName, '<', next), [], thisBody)];
    }
    return thisBody;
  }

  // Xrings: `if W<=4144 then if W==0x4FD … else if W==…`. Binary range
  // then a short exact chain — not an N-way elseif stamp.
  _stateTree(stateName, groups, states, lo, hi) {
    const n = hi - lo;
    if (n <= 0) return [];
    if (n === 1) return this._armFor(lo, groups, states, stateName);
    if (n <= 3) {
      const clauses = [];
      let elseBody = null;
      for (let gi = lo; gi < hi; gi++) {
        const body = this._armFor(gi, groups, states, stateName);
        if (gi === hi - 1 && n > 1) elseBody = body;
        else clauses.push({ cond: this._stateCond(stateName, states[gi], states, gi), body });
      }
      return [ifChain(clauses, elseBody, false)];
    }
    const mid = lo + Math.floor(n / 2);
    const pivot = states[mid - 1];
    const left = this._stateTree(stateName, groups, states, lo, mid);
    const right = this._stateTree(stateName, groups, states, mid, hi);
    let cond;
    if (this.chance(0.45)) cond = bin('<=', ident(stateName), this.num(pivot));
    else if (this.chance(0.5)) cond = this._notRel(stateName, '>', pivot);
    else cond = bin('<', ident(stateName), this.num(states[mid]));
    return [ifStat(cond, left, right)];
  }

  _stateCond(stateName, sVal, states, gi) {
    const s = ident(stateName);
    const isLast = gi === states.length - 1;
    const next = states[gi + 1];

    if (isLast) {
      if (this.chance(0.35)) return this._notRel(stateName, '<', sVal);
      if (this.chance(0.4)) return un('not', paren(bin('~=', s, this.num(sVal))));
      return bin('==', s, this.num(sVal));
    }

    // Low: range covering this state, never bare `>=` (would steal later)
    if (gi === 0) {
      if (next != null && this.chance(0.4)) return this._notRel(stateName, '>=', next);
      if (next != null && this.chance(0.55)) return bin('<=', s, this.num(next - 1));
      if (next != null) return bin('<', s, this.num(next));
      return bin('==', s, this.num(sVal));
    }

    // Middle: exact, or tautology range `>=x and <=x`
    if (this.chance(0.4)) {
      return bin('and', bin('>=', s, this.num(sVal)), bin('<=', s, this.num(sVal)));
    }
    if (next != null && this.chance(0.3)) {
      return bin('and', bin('>=', s, this.num(sVal)), bin('<', s, this.num(next)));
    }
    return bin('==', s, this.num(sVal));
  }

  _stateValue(target, stateName, fromVal) {
    if (this.mba && typeof this.mba.poolLogic === 'function' && this.chance(0.38)) {
      return this.mba.poolLogic(target);
    }
    if (this.mba && typeof this.mba.wrapState === 'function') {
      return this.mba.wrapState(target, stateName, fromVal);
    }
    if (this.mba) return this.mba.wrapValue(target, stateName);
    return this.num(target);
  }

  _trailingBreak(real) {
    const last = real[real.length - 1];
    if (last && (last.type === 'ReturnStatement' || last.type === 'BreakStatement' || last.type === 'ContinueStatement')) return [];
    return [brk()];
  }

  _trailingContinue(real) {
    const last = real[real.length - 1];
    if (last && (last.type === 'ReturnStatement' || last.type === 'BreakStatement' || last.type === 'ContinueStatement')) return [];
    return [cont()];
  }

  _emitForDispatch(groups) {
    const start = this.randInt(0x24, 0x90);
    const step = this.randInt(0x38, 0xc8);
    const hits = groups.length;
    const stop = start + step * (hits - 1);
    const iter = this.fresh();

    const body = rangeIfHighToLow(
      iter,
      hits,
      start,
      step,
      (gi) => {
        const real = this._armBody(groups[gi]);
        if (gi === hits - 1) return real.concat(this._trailingBreak(real));
        return real.concat(this._trailingContinue(real));
      },
      (v) => this.num(v),
      this,
    );

    return [
      {
        type: 'ForNumericStatement',
        name: iter,
        start: this.num(start),
        stop: this.num(stop),
        step: this.num(step),
        body,
      },
    ];
  }
}

function applyControlFlow(src, rng) {
  const engine = rng && rng.flattenChunk ? rng : new ControlFlowEngine(rng);
  return engine.flattenSource(src);
}

module.exports = {
  ControlFlowEngine,
  applyControlFlow,
};
