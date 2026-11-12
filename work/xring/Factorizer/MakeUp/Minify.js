'use strict';

const {
  KEYWORDS,
  LUA_GLOBALS,
  ident,
  func,
  mcall,
  allocVisualName,
  SELF,
  ENV,
} = require('../core/Ast');
const { ALIAS_EXPR } = require('../MakeUp/Aliases');
const { debug } = require('../../Debug');

// Deterministic short-name alphabet for collision repair. Deliberately not
// random: the repair must not touch the RNG, otherwise every obfuscation run
// (including the ones that never collide) would shift its name stream.
const REPAIR_ALPHABET = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function attachMinify(cls) {
  const P = cls.prototype;

  P.minifyChunk = function minifyChunk(chunk) {
    // Each top-level method is an independent scope: siblings may reuse the
    // same shorts. Visual mixed-case names (not a,b,c / aa,ab) so the printed
    // file doesn't look sequentially generated.
    const table = this.methodTable(chunk);
    this._selfOut = null;
    this._keyMap = new Map();
    if (table) {
      const used = new Set();
      this._selfOut = this.allocSelfName(used);
      this.minifyKeys(table);
      // Hidden alias fields are not table keys, so minifyKeys cannot see them:
      // repair any name it handed to a method that is already taken by
      // `self.<alias> = <global>` (see fixAliasKeyCollisions).
      const aliasRenames = this.fixAliasKeyCollisions(table);
      if (aliasRenames) this.rewriteAliasProps(chunk, aliasRenames);
      this.rewriteKeyUses(chunk, this._keyMap);
      for (const f of table.fields || []) {
        if (!f || typeof f !== 'object' || !f.value) continue;
        if (f.value.type === 'FunctionExpression' || f.value.type === 'FunctionDeclaration') {
          f.value = this.minifyFn(f.value, new Map(), new Set(used));
        } else {
          f.value = this.minifyWalk(f.value, new Map(), new Set(used), false);
        }
      }
      return;
    }
    const used = new Set();
    const map = new Map();
    chunk.body = this.minifyWalk(chunk.body, map, used, false);
  };

  P.minifyKeys = function minifyKeys(table) {
    const map = new Map();
    const used = new Set();
    const forbidden = new Set(['self']);
    for (const g of LUA_GLOBALS) forbidden.add(g);

    const rng = typeof this.rng === 'function' ? this.rng : Math.random;
    const funcs = [];
    const data = [];
    for (const f of table.fields || []) {
      if (!f || typeof f.key !== 'string') continue;
      if (f.key.startsWith('__')) continue;
      const fn = f.value && (f.value.type === 'FunctionExpression' || f.value.type === 'FunctionDeclaration');
      (fn ? funcs : data).push(f);
    }
    const pin = new Set([this.entry, this.byName, this.cacheField, this.poolField].filter(Boolean));
    const assign = (list) => {
      for (const f of list) {
        if (!f || typeof f.key !== 'string' || map.has(f.key)) continue;
        map.set(f.key, allocVisualName(used, rng, forbidden));
      }
    };
    assign(funcs.concat(data).filter((f) => pin.has(f.key)));
    assign(funcs.concat(data));
    for (const f of table.fields || []) {
      if (f && typeof f.key === 'string' && map.has(f.key)) f.key = map.get(f.key);
    }
    this._keyMap = map;
  };

  /**
   * Minify owns the table-key namespace, but hidden aliases (buffer ops,
   * setmetatable, coroutine.wrap, ipairs) are never emitted as table keys:
   * they are written by `hiddenAliasClumps` as `self.<aliasField> = ...`.
   * Because minifyKeys allocates from a private `used` set it can hand a
   * method exactly the short name an alias clump already writes, and the
   * clump then overwrites that method on the method table (or the method
   * shadowed the alias) — every later call through it throws at runtime.
   *
   * Repair: rename the alias (never the method, so the method table keeps the
   * layout minify chose) to a deterministic free short name and record the
   * mapping for rewriteAliasProps. Returns null when nothing collides, which
   * is the case for every input that obfuscated correctly before, so its
   * output stays byte-identical.
   */
  P.fixAliasKeyCollisions = function fixAliasKeyCollisions(table) {
    const hidden = this.hiddenAliases || [];
    if (!hidden.length) return null;

    const taken = new Set();
    for (const g of LUA_GLOBALS) taken.add(g);
    for (const k of KEYWORDS) taken.add(k);
    for (const f of table.fields || []) {
      if (f && typeof f.key === 'string') taken.add(f.key);
    }
    const aliasNames = new Map();
    for (const k of hidden) aliasNames.set(k, this.aliasField(k));
    // Every alias field name is off-limits for the replacement, not just the
    // hidden ones: non-hidden aliases (`bnot`, `unpack`, ...) are plain table
    // fields, but they are *renamed by minifyKeys*, so a name that is free in
    // `taken` may still be the pre-minify name of a field that minify is about
    // to move aside. Reusing it would alias two different slots.
    for (const n of (this.aliasFields ? this.aliasFields.values() : [])) {
      if (typeof n === 'string') taken.add(n);
    }
    // Names already handed out by the engine's own pool (locals, helper
    // methods, mvars) are referenced as literals by the generated wrappers.
    for (const n of (this.used || [])) taken.add(n);

    const renames = new Map();
    const pickFree = () => {
      for (let i = 0; i < REPAIR_ALPHABET.length; i++) {
        const c = REPAIR_ALPHABET[i];
        if (!taken.has(c)) return c;
      }
      for (let i = 0; i < REPAIR_ALPHABET.length; i++) {
        for (let j = 0; j < REPAIR_ALPHABET.length; j++) {
          const c = REPAIR_ALPHABET[i] + REPAIR_ALPHABET[j];
          if (!taken.has(c)) return c;
        }
      }
      return null;
    };

    for (const [k, name] of aliasNames) {
      if (!taken.has(name)) continue;
      // `name` is in `taken` because it was just added for every alias, so
      // test the collision against the method keys explicitly.
      const clashes = (table.fields || []).some((f) => f && f.key === name);
      if (!clashes) continue;
      const rep = pickFree();
      if (!rep) {
        debug.warn(`minify: no free name to repair alias '${k}' (${name})`);
        continue;
      }
      taken.add(rep);
      renames.set(name, rep);
      this.aliasFields.set(k, rep);
      debug.note(`minify: alias ${k} '${name}' collided with a method key -> '${rep}'`);
    }

    return renames.size ? renames : null;
  };

  /**
   * Replace `self.<old>` / `self:old(...)` for renamed hidden aliases. Runs
   * before rewriteKeyUses so an old alias name can never be confused with a
   * freshly assigned method key that happens to share it.
   */
  P.rewriteAliasProps = function rewriteAliasProps(node, renames) {
    if (!node || typeof node !== 'object' || !renames || !renames.size) return node;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) node[i] = this.rewriteAliasProps(node[i], renames);
      return node;
    }
    if (node.type === 'MemberExpression') {
      node.object = this.rewriteAliasProps(node.object, renames);
      if (typeof node.property === 'string' && renames.has(node.property) && this.isSelfish(node.object)) {
        node.property = renames.get(node.property);
      }
      return node;
    }
    if (node.type === 'MethodCallExpression') {
      node.object = this.rewriteAliasProps(node.object, renames);
      node.args = this.rewriteAliasProps(node.args, renames);
      if (typeof node.method === 'string' && renames.has(node.method) && this.isSelfish(node.object)) {
        node.method = renames.get(node.method);
      }
      return node;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'raw' || k === 'property' || k === 'method') continue;
      const v = node[k];
      if (v && typeof v === 'object') node[k] = this.rewriteAliasProps(v, renames);
    }
    return node;
  };

  P.isSelfish = function isSelfish(node) {
    let n = node;
    while (n && n.type === 'ParenExpression') n = n.expr;
    if (!n) return false;
    if (n.type === 'TableConstructor') return true;
    if (n.type === 'Identifier') {
      return n.name === SELF || n.name === 'self' || n.name === this.selfOut();
    }
    return false;
  };

  P.rewriteKeyUses = function rewriteKeyUses(node, map) {
    if (!node || typeof node !== 'object' || !map || !map.size) return node;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) node[i] = this.rewriteKeyUses(node[i], map);
      return node;
    }
    if (node.type === 'MemberExpression') {
      node.object = this.rewriteKeyUses(node.object, map);
      if (typeof node.property === 'string' && map.has(node.property) && this.isSelfish(node.object)) {
        node.property = map.get(node.property);
      }
      return node;
    }
    if (node.type === 'MethodCallExpression') {
      node.object = this.rewriteKeyUses(node.object, map);
      node.args = this.rewriteKeyUses(node.args, map);
      if (typeof node.method === 'string' && map.has(node.method) && this.isSelfish(node.object)) {
        node.method = map.get(node.method);
      }
      return node;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'raw' || k === 'property' || k === 'method') continue;
      const v = node[k];
      if (v && typeof v === 'object') node[k] = this.rewriteKeyUses(v, map);
    }
    return node;
  };

  P.methodTable = function methodTable(chunk) {
    try {
      const ret = (chunk.body || [])[0];
      if (!ret || ret.type !== 'ReturnStatement') return null;
      let e = (ret.args || [])[0];
      if (!e) return null;
      while (e && e.type === 'ParenExpression') e = e.expr;
      if (e && e.type === 'CallExpression') e = e.callee;
      if (e && e.type === 'MethodCallExpression') e = e.object;
      while (e && e.type === 'ParenExpression') e = e.expr;
      if (e && e.type === 'TableConstructor') return e;
      return null;
    } catch {
      return null;
    }
  };

  P.allocSelfName = function allocSelfName(used) {
    const rng = typeof this.rng === 'function' ? this.rng : Math.random;
    const forbidden = new Set(['self']);
    for (const g of LUA_GLOBALS) forbidden.add(g);
    return allocVisualName(used, rng, forbidden);
  };

  P.selfOut = function selfOut() {
    return this._selfOut || SELF;
  };

  P.allocMin = function allocMin(name, map, used) {
    if (!name) return name;
    if (name === SELF || name === 'self') return map.has(SELF) ? map.get(SELF) : this.selfOut();
    if (KEYWORDS.has(name) || LUA_GLOBALS.has(name)) return name;
    if (map.has(name)) return map.get(name);
    const forbidden = new Set([this.selfOut(), 'self']);
    if (map.has(ENV)) forbidden.add(map.get(ENV));
    for (const g of LUA_GLOBALS) forbidden.add(g);
    const rng = typeof this.rng === 'function' ? this.rng : Math.random;
    const cand = allocVisualName(used, rng, forbidden);
    map.set(name, cand);
    return cand;
  };

  P.allocEnvName = function allocEnvName(used) {
    const rng = typeof this.rng === 'function' ? this.rng : Math.random;
    const forbidden = new Set([this.selfOut(), 'self']);
    for (const g of LUA_GLOBALS) forbidden.add(g);
    return allocVisualName(used, rng, forbidden);
  };

  P.minifyFn = function minifyFn(node, parentMap, parentUsed) {
    const used = new Set(parentUsed);
    const map = new Map(parentMap);
    if (!map.has(SELF)) {
      const s = this.selfOut();
      map.set(SELF, s);
      map.set('self', s);
      used.add(s);
    }
    const rawParams = node.params || [];
    if (rawParams.indexOf(ENV) >= 0) {
      map.delete(ENV);
      map.set(ENV, this.allocEnvName(used));
    }
    const params = rawParams.map((p) => {
      if (p === SELF || p === 'self') return map.get(SELF);
      if (p === ENV) return map.get(ENV) || p;
      return this.allocMin(p, map, used);
    });
    const body = this.minifyWalk(node.body, map, used, true);
    if (node.type === 'FunctionDeclaration') {
      return { ...node, params, body };
    }
    return func(params, body, node.vararg);
  };

  P.minifyWalk = function minifyWalk(node, map, used, inFn) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((n) => this.minifyWalk(n, map, used, inFn));

    switch (node.type) {
      case 'FunctionExpression':
      case 'FunctionDeclaration':
        return this.minifyFn(node, map, used);
      case 'Identifier': {
        const name = node.name;
        if (!inFn) return node;
        if (KEYWORDS.has(name) || LUA_GLOBALS.has(name)) return node;
        if (name === SELF || name === 'self') return ident(map.get(SELF) || this.selfOut());
        if (name === ENV && map.has(ENV)) return ident(map.get(ENV));
        if (name === ENV) return node;
        return ident(this.allocMin(name, map, used));
      }
      case 'LocalStatement': {
        const init = this.minifyWalk(node.init, map, used, inFn);
        const names = inFn
          ? (node.names || []).map((n) => this.allocMin(n, map, used))
          : node.names.slice();
        return { ...node, names, init };
      }
      case 'ForNumericStatement': {
        const start = this.minifyWalk(node.start, map, used, inFn);
        const stop = this.minifyWalk(node.stop, map, used, inFn);
        const step = node.step ? this.minifyWalk(node.step, map, used, inFn) : node.step;
        const innerUsed = new Set(used);
        const innerMap = new Map(map);
        const name = inFn ? this.allocMin(node.name, innerMap, innerUsed) : node.name;
        const body = this.minifyWalk(node.body, innerMap, innerUsed, inFn);
        return { ...node, name, start, stop, step, body };
      }
      case 'ForGenericStatement': {
        const iters = this.minifyWalk(node.iters, map, used, inFn);
        const innerUsed = new Set(used);
        const innerMap = new Map(map);
        const names = inFn
          ? (node.names || []).map((n) => this.allocMin(n, innerMap, innerUsed))
          : node.names.slice();
        const body = this.minifyWalk(node.body, innerMap, innerUsed, inFn);
        return { ...node, names, iters, body };
      }
      case 'IfStatement': {
        const clauses = (node.clauses || []).map((c) => {
          const innerUsed = new Set(used);
          const innerMap = new Map(map);
          return {
            cond: this.minifyWalk(c.cond, map, used, inFn),
            body: this.minifyWalk(c.body, innerMap, innerUsed, inFn),
          };
        });
        let elseBody = node.elseBody;
        if (elseBody) {
          const innerUsed = new Set(used);
          const innerMap = new Map(map);
          elseBody = this.minifyWalk(elseBody, innerMap, innerUsed, inFn);
        }
        return { type: 'IfStatement', clauses, elseBody };
      }
      case 'WhileStatement':
      case 'RepeatStatement':
      case 'DoStatement': {
        const innerUsed = new Set(used);
        const innerMap = new Map(map);
        return {
          ...node,
          cond: node.cond ? this.minifyWalk(node.cond, map, used, inFn) : node.cond,
          body: this.minifyWalk(node.body, innerMap, innerUsed, inFn),
        };
      }
      case 'MemberExpression':
        return {
          type: 'MemberExpression',
          object: this.minifyWalk(node.object, map, used, inFn),
          property: node.property,
        };
      case 'MethodCallExpression':
        return mcall(
          this.minifyWalk(node.object, map, used, inFn),
          node.method,
          this.minifyWalk(node.args || [], map, used, inFn),
        );
      case 'TableConstructor':
        return {
          type: 'TableConstructor',
          fields: (node.fields || []).map((f) => {
            if (f.type === 'TableKeyString') {
              return { ...f, value: this.minifyWalk(f.value, map, used, inFn) };
            }
            if (f.type === 'TableKey') {
              return {
                ...f,
                key: this.minifyWalk(f.key, map, used, inFn),
                value: this.minifyWalk(f.value, map, used, inFn),
              };
            }
            return { ...f, value: this.minifyWalk(f.value, map, used, inFn) };
          }),
        };
      default: {
        const out = {};
        for (const k of Object.keys(node)) {
          if (k === 'loc' || k === 'raw' || k === 'property' || k === 'method') {
            out[k] = node[k];
            continue;
          }
          const v = node[k];
          if (v && typeof v === 'object') out[k] = this.minifyWalk(v, map, used, inFn);
          else out[k] = v;
        }
        return out;
      }
    }
  };
}

module.exports = { attachMinify };
