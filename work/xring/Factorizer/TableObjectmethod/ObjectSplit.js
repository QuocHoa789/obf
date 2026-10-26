'use strict';

/**
 * Object-table wrapper + function split (Xrings shape, VM contents only).
 *
 *   return({
 *     K=bit32.band, z=unpack or table.unpack, y=pcall, ...
 *     <entry>=function(z,l) l=z:<by>(l); for ... do z:set(i,l) end; return ... end,
 *     <by>=function(z,l) local o={l} return o end,
 *     ...split methods...
 *   }):<entry>()(...)
 *
 * Passes live in sibling files:
 *   ObjectWrap.js    entry / by / aliases / env slots
 *   FunctionSplit.js method split + leaf helpers
 *   Minify.js        ident minify (mixed-case visual names)
 *   ControlFlow.js   flatten (applied after split, skipped on tiny helpers)
 */

const { parse } = require('../../AST/Parser');
const { printAst } = require('../core/Printer');
const { ControlFlowEngine } = require('../../VM/controlflow/ControlFlow');
const { KEYWORDS, ident, func, call, mcall, mem, localStat, ret, paren, numNode, allocVisualName, unwrap, clone, collectLocalNames, tableCtor, idx, bin, SELF, ENV } = require('../core/Ast');
const { attachObjectWrap } = require('./ObjectWrap');
const { attachFunctionSplit } = require('./FunctionSplit');
const { attachMinify } = require('../MakeUp/Minify');
const { isRangeDispatchBody, astWeight } = require('../../VM/controlflow/Dispatch');
const { makeupChunk } = require('../MakeUp/Makeup');
const { MbaEngine } = require('../arith/Mba');
const { aliasExpr } = require('../MakeUp/Aliases');

class ObjectSplitEngine {
  constructor(rng) {
    this.rng = rng || Math.random;
    this.n = 0;
    this.used = new Set(KEYWORDS);
    this.methods = new Map();
    this.slots = new Map();
    this.fields = [];
    this.hx = null;
    this.hb = null;
    this.slotPool = [];
    this.nextSlot = 0;
    this.usedAliases = new Set();
    this.valueSlots = new Map();
    this.aliasSlots = new Map();
    this.aliasFields = new Map();
    this.entry = this.fresh();
    this.byName = this.fresh();
    this.cacheField = this.fresh();
    this.poolField = this.fresh();
    this.selfName = SELF;
    this.dupSelf = new Set();
  }

  rand() { return this.rng(); }
  randInt(min, max) { return min + Math.floor(this.rand() * (max - min + 1)); }
  pick(arr) { return arr[this.randInt(0, arr.length - 1)]; }
  chance(p) { return this.rand() < p; }

  fresh() {
    const forbidden = new Set([SELF, ENV, 'self', 'n']);
    return allocVisualName(this.used, this.rng, forbidden);
  }

  aliasField(key) {
    if (!this.aliasFields.has(key)) this.aliasFields.set(key, this.fresh());
    return this.aliasFields.get(key);
  }

  num(value, forceStyle) {
    return numNode(value, (styles) => this.pick(styles), forceStyle, this.rng);
  }

  transform(src, opts) {
    opts = opts || {};
    const ast = parse(String(src));
    const plan = this.analyze(ast.body);
    this.collectUsed(ast);
    this.usedAliases.add('z');
    this.usedAliases.add('iA');
    this.usedAliases.add('mS');
    this.usedAliases.add('cY');
    this.usedAliases.add('P');
    this.usedAliases.add('u4');
    for (const k of this.usedAliases) this.aliasField(k);
    this.assignSlots(plan);
    this.assignAliasSlots();

    const ctx = { bound: new Set([SELF, ENV]), scratch: null, nName: null };

    if (this.hx) {
      this.hx.fn.body = this.rewrite(this.extractNested(this.hx.fn.body, ctx), {
        bound: new Set([SELF, ENV, 'a', 'b']),
        scratch: null,
        nName: null,
      });
      this.addMethod(this.hx.name, this.hx.fn);
    }
    if (this.hb) {
      this.hb.fn.body = this.rewrite(this.extractNested(this.hb.fn.body, ctx), {
        bound: new Set([SELF, ENV, 'a', 'b']),
        scratch: null,
        nName: null,
      });
      this.addMethod(this.hb.name, this.hb.fn);
    }

    for (const fn of plan.functions) this.splitAndAdd(fn);

    this.addMethod(this.byName, func([SELF, ENV], [
      localStat(['o'], [{
        type: 'TableConstructor',
        fields: [{ type: 'TableValue', value: ident(ENV) }],
      }]),
      ret([ident('o')]),
    ]));

    this.markHiddenAliases();
    const hyBody = this.buildHy(plan);
    this.addMethod(this.entry, func([SELF], hyBody, true));

    let mba = null;
    if (opts.controlFlow !== false && opts.mba !== false) {
      this.usedAliases.add('K');
      this.usedAliases.add('nS');
      this.usedAliases.add('U');
      this.usedAliases.add('z');
      this.usedAliases.add('so');
      this.usedAliases.add('Fo');
      this.usedAliases.add('Mo');
      this.usedAliases.add('Co');
      this.usedAliases.add('bo');
      this.usedAliases.add('l');
      this.usedAliases.add('mo');
      for (const k of ['K', 'nS', 'U', 'z', 'so', 'Fo', 'Mo', 'Co', 'bo', 'l', 'mo']) this.aliasField(k);
      mba = new MbaEngine(this);
      mba.init();
    }

    this.emitUsedAliases();
    if (opts.controlFlow !== false && opts.cache !== false) {
      this.fields.push({
        key: this.cacheField,
        value: { type: 'TableConstructor', fields: [] },
      });
    }
    if (mba) {
      this.mbaHelperNames = mba.helpers.map((h) => h.name);
      this.fields.push({ key: this.poolField, value: mba.poolTable() });
      for (const h of mba.helpers) this.addMethod(h.name, h.fn);
    } else {
      this.mbaHelperNames = [];
    }
    this.fields.push({
      key: this.fresh(),
      value: { type: 'StringLiteral', value: 'Xrings' },
    });
    this.fields.push({
      key: this.fresh(),
      value: { type: 'StringLiteral', value: 'This file Was Protected By Xrings' },
    });
    this.shuffleFields();

    if (opts.controlFlow !== false) {
      const cf = new ControlFlowEngine(this.rng, {
        useSelf: true,
        selfName: SELF,
        cache: opts.cache !== false,
        cacheField: this.cacheField,
        mba,
      });
      const mbaNames = new Set(mba ? mba.helpers.map((h) => h.name) : []);
      const flattenable = [];
      for (const f of this.fields) {
        if (f.key === this.entry || f.key === this.byName) continue;
        if (mbaNames.has(f.key)) continue;
        if (!f.value || f.value.type !== 'FunctionExpression') continue;
        const body = f.value.body || [];
        const params = f.value.params || [];
        // Interpreter / opcode while-true: keep the range tree. Makeup adds soup.
        if (this.isHot(body)) continue;
        if (isRangeDispatchBody(body)) continue;
        const w = astWeight(body);
        if (body.length >= 2) flattenable.push({ f, w, params, body });
      }
      flattenable.sort((a, b) => b.w - a.w);
      const heavy = flattenable.filter((it) => it.w > 28 && it.body.length > 2);
      const pool = heavy.length >= 3 ? heavy : flattenable;
      const cap = Math.min(pool.length, this.randInt(4, 7));
      for (let i = 0; i < cap; i++) {
        const it = pool[i];
        // Method scope: state var must avoid params, every local declared or
        // read in the body, and every global it touches — otherwise
        // `local <state>` shadows a live variable (same bug class as the
        // chunk-level `h` collision in the non-split path).
        const scope = cf.scopeNames({ type: 'Chunk', body: it.body });
        for (const p of it.params || []) if (typeof p === 'string') scope.add(p);
        it.f.value.body = cf.flattenStats(it.body, 0, scope);
      }
    }

    this.applyDupSelf();

    const table = {
      type: 'TableConstructor',
      fields: this.fields.map((f) => ({ type: 'TableKeyString', key: f.key, value: f.value })),
    };
    const entryCall = call(
      mcall(paren(table), this.entry, []),
      [{ type: 'VarargExpression' }],
    );
    const chunk = { type: 'Chunk', body: [ret([entryCall])] };
    this.packIdentReturns(chunk);
    makeupChunk(chunk, this.rng);
    this.minifyChunk(chunk);
    return printAst(chunk, this.rng);
  }

  /**
   * Xrings `function(t,t,m,w,h)` without dummy `t:foo(t,l)`.
   * Only methods that never mention self in the body: second T *is* the
   * data arg (env / number). Call stays `T:foo(l, extra)`.
   */
  applyDupSelf() {
    this.dupSelf = new Set();
    const rewriteEnv = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) rewriteEnv(node[i]);
        return;
      }
      if (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
        const ps = node.params || [];
        if (ps.indexOf(ENV) >= 0) return;
      }
      if (node.type === 'Identifier' && node.name === ENV) node.name = SELF;
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
        rewriteEnv(node[k]);
      }
    };
    const selfUsed = (node) => {
      if (!node || typeof node !== 'object') return false;
      if (Array.isArray(node)) return node.some(selfUsed);
      if (node.type === 'Identifier' && node.name === SELF) return true;
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
        if (selfUsed(node[k])) return true;
      }
      return false;
    };
    for (const f of this.fields) {
      if (!f || !f.value || f.value.type !== 'FunctionExpression') continue;
      if (f.key === this.entry) continue;
      const p = f.value.params || [];
      if (p[0] !== SELF || p[1] !== ENV) continue;
      if (selfUsed(f.value.body)) continue;
      if (!this.chance(0.7)) continue;
      f.value.params = [SELF, SELF].concat(p.slice(2));
      rewriteEnv(f.value.body);
      this.dupSelf.add(f.key);
    }
  }

  identishArg(a) {
    const u = unwrap(a);
    return u && (u.type === 'Identifier' || u.type === 'VarargExpression');
  }

  /**
   * A trailing call / vararg expands to an unknown number of values, so a
   * packed return can no longer carry a static arity. Such returns are left
   * unpacked instead of being packed (see packFnReturns).
   */
  expandsArity(a) {
    const u = unwrap(a);
    return !!u && (u.type === 'CallExpression' || u.type === 'MethodCallExpression' || u.type === 'VarargExpression');
  }

  /** Plain literal arity tag stored at index 1 of a packed return table. */
  packCount(n) {
    return numNode(n, null, 'plain');
  }

  /**
   * `unpack(packed)` truncates trailing nils (`{[1,nil]}` has length 1), so the
   * packed table carries its arity at index 1 and call sites unpack the exact
   * value range: `(function(v) return self.<unp>(v, 2, v[1] + 1) end)(call)`.
   * The anonymous wrapper keeps this an expression (call sites appear in
   * arbitrary positions) without consuming an rng name, and `v` only ever
   * refers to the packed table, so it cannot shadow anything the call uses.
   */
  packedUnpack(unp, expr) {
    const v = 'q';
    const body = ret([
      call(mem(ident(SELF), unp), [
        ident(v),
        this.packCount(2),
        bin('+', idx(ident(v), this.packCount(1)), this.packCount(1)),
      ]),
    ]);
    return call(paren(func([v], [body])), [expr]);
  }

  collectStatLists(stats, out) {
    if (!Array.isArray(stats)) return;
    out.push(stats);
    for (const s of stats) {
      if (!s || typeof s !== 'object') continue;
      if (s.type === 'FunctionExpression' || s.type === 'FunctionDeclaration') continue;
      if (s.type === 'IfStatement') {
        for (const c of s.clauses || []) this.collectStatLists(c.body, out);
        if (s.elseBody) this.collectStatLists(s.elseBody, out);
      } else if (s.body) {
        this.collectStatLists(s.body, out);
      }
    }
  }

  packFnReturns(fn) {
    if (!fn || !fn.body) return false;
    const lists = [];
    this.collectStatLists(fn.body, lists);
    const hits = [];
    for (const list of lists) {
      for (let i = 0; i < list.length; i++) {
        if (list[i] && list[i].type === 'ReturnStatement') hits.push({ list, i });
      }
    }
    if (!hits.length) return false;
    const rets = hits.map((h) => h.list[h.i]);
    if (rets.some((r) => !r.args || !r.args.length)) return false;
    if (rets.some((r) => r.args.some((a) => {
      const u = unwrap(a);
      return u && (u.type === 'NumericLiteral' || u.type === 'NilLiteral');
    }))) return false;
    if (rets.some((r) => r.args.some((a) => {
      const u = unwrap(a);
      return u && (u.type === 'FunctionExpression' || u.type === 'FunctionDeclaration');
    }))) return false;
    if (rets.some((r) => r.args.length === 1 && unwrap(r.args[0]) && unwrap(r.args[0]).type === 'TableConstructor')) {
      return false;
    }
    // `return f()` / `return ...` expand to a runtime-dependent number of
    // values; packing them into a table would keep no arity, so leave the
    // function unpacked (its original multi-return semantics are exact).
    if (rets.some((r) => this.expandsArity(r.args[r.args.length - 1]))) return false;
    const allIdent = rets.every((r) => r.args.every((a) => this.identishArg(a)));
    if (!allIdent) {
      if (rets.length > 3) return false;
      if (astWeight(fn.body) > 40) return false;
      if (!this.chance(0.55)) return false;
    } else if (rets.every((r) => r.args.length === 1) && !this.chance(0.8)) {
      return false;
    }

    const used = new Set(fn.params || []);
    collectLocalNames(fn.body, used);
    const forbidden = new Set([SELF, ENV, 'self']);

    const byList = new Map();
    for (const h of hits) {
      if (!byList.has(h.list)) byList.set(h.list, []);
      byList.get(h.list).push(h.i);
    }
    for (const [list, idxs] of byList) {
      idxs.sort((a, b) => b - a);
      for (const i of idxs) {
        const r = list[i];
        const identish = r.args.every((a) => this.identishArg(a));
        const cnt = this.packCount(r.args.length);
        if (identish) {
          list[i] = ret([tableCtor([cnt].concat(r.args.map((a) => unwrap(a))))]);
        } else if (r.args.length === 1) {
          // A single call/vararg can yield MULTIPLE values: `local tmp =
          // f()` captures only the first, so pack it directly (`return
          // {f()}` preserves all). tmp-local is only safe for
          // provably single-valued expressions.
          const u = unwrap(r.args[0]);
          if (u && (u.type === 'CallExpression' || u.type === 'MethodCallExpression')) {
            // Unreachable: call/vararg tails are rejected up front because
            // their value count is only known at runtime.
            allocVisualName(used, this.rng, forbidden);
            list[i] = ret([tableCtor([cnt, r.args[0]])]);
          } else {
            const tmp = allocVisualName(used, this.rng, forbidden);
            list.splice(i, 1, localStat([tmp], [r.args[0]]), ret([tableCtor([cnt, ident(tmp)])]));
          }
        } else {
          list[i] = ret([tableCtor([cnt].concat(r.args.slice()))]);
        }
      }
    }
    return true;
  }

  rewritePackedCalls(node, packed, unp) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) node[i] = this.rewritePackedCalls(node[i], packed, unp);
      return node;
    }
    if (node.type === 'MethodCallExpression' && packed.has(node.method)) {
      node.object = this.rewritePackedCalls(node.object, packed, unp);
      node.args = (node.args || []).map((a) => this.rewritePackedCalls(a, packed, unp));
      return this.packedUnpack(unp, node);
    }
    if (node.type === 'CallExpression') {
      const cal = node.callee;
      if (
        cal &&
        cal.type === 'MemberExpression' &&
        cal.object &&
        cal.object.type === 'Identifier' &&
        cal.object.name === SELF &&
        packed.has(cal.property)
      ) {
        node.callee = this.rewritePackedCalls(cal, packed, unp);
        node.args = (node.args || []).map((a) => this.rewritePackedCalls(a, packed, unp));
        return this.packedUnpack(unp, node);
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
      const v = node[k];
      if (v && typeof v === 'object') node[k] = this.rewritePackedCalls(v, packed, unp);
    }
    return node;
  }

  collectEscapedMethods(node, out) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) this.collectEscapedMethods(n, out);
      return;
    }
    if (
      node.type === 'MemberExpression' &&
      node.object &&
      node.object.type === 'Identifier' &&
      node.object.name === SELF &&
      typeof node.property === 'string'
    ) {
      out.add(node.property);
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'raw' || k === 'method' || k === 'property') continue;
      const v = node[k];
      if (v && typeof v === 'object') this.collectEscapedMethods(v, out);
    }
  }

  packIdentReturns(chunk) {
    const table = this.methodTable(chunk);
    if (!table) return;
    const skip = new Set([this.entry, this.byName].concat(this.mbaHelperNames || []));
    const escaped = new Set();
    this.collectEscapedMethods(table, escaped);
    const packed = new Set();
    for (const f of table.fields || []) {
      if (!f || f.type !== 'TableKeyString' || !f.value) continue;
      if (f.value.type !== 'FunctionExpression' && f.value.type !== 'FunctionDeclaration') continue;
      if (skip.has(f.key) || escaped.has(f.key)) continue;
      if (this.isHot && this.isHot(f.value.body || [])) continue;
      if (this.packFnReturns(f.value)) packed.add(f.key);
    }
    if (!packed.size) return;
    const unp = this.aliasField('z');
    if (!(table.fields || []).some((f) => f && f.key === unp)) {
      table.fields.push({ type: 'TableKeyString', key: unp, value: clone(aliasExpr('z')) });
    }
    this.rewritePackedCalls(table, packed, unp);
  }
}

attachObjectWrap(ObjectSplitEngine);
attachFunctionSplit(ObjectSplitEngine);
attachMinify(ObjectSplitEngine);

function wrapAndSplit(src, rng, opts) {
  const dbg = require('../../Debug').debug;
  if (dbg.enabled) dbg.dump('pre-split', src);
  const engine = new ObjectSplitEngine(rng);
  const out = engine.transform(src, opts);
  if (dbg.enabled) dbg.dump('post-split', out);
  return out;
}

module.exports = {
  ObjectSplitEngine,
  wrapAndSplit,
};
