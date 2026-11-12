'use strict';

const {
  ident,
  idx,
  func,
  mcall,
  mem,
  assign,
  localStat,
  ret,
  paren,
  callStat,
  clone,
  isFn,
  unwrap,
  usesVararg,
  SELF,
  ENV,
} = require('../core/Ast');
const { GLOBAL_FUNCS, LIB_MEMBERS, ALIAS_EXPR, BUFFER_KEYS, BUFFER_PROPS, aliasExpr } = require('../MakeUp/Aliases');
const { rangeIfHighToLow, pickLoopKind, numericStateLoop } = require('../../VM/controlflow/Dispatch');

function attachObjectWrap(cls) {
  const P = cls.prototype;

  P.analyze = function analyze(body) {
    const functions = [];
    const leftover = [];
    const skip = new Set(['unpack', 'bit32']);
    let retStat = null;

    for (const s of body) {
      if (!s) continue;
      if (s.type === 'LocalStatement') {
        if (s.names.length === 1 && s.names[0] === 'h' && s.init[0] && s.init[0].type === 'TableConstructor') {
          // `h` is the VM helper table: `h.x`/`h.b` are the bit wrappers and
          // `h.rl`/`h.rr`/`h.bt` (LoadEnc vtable) are written by the
          // statements that follow. extractH turns x/b into object methods
          // (rewriteMember/rewriteCall remap `h.x`/`h.b` to them), but the h
          // table itself must still exist: h.rl/h.rr/h.bt stay ordinary
          // member accesses. Keep it as a leftover so it lands in an env slot
          // instead of leaving `h` a dangling free identifier.
          this.extractH(s.init[0]);
          leftover.push({ orig: 'h', init: s.init[0] });
          continue;
        }
        for (let i = 0; i < s.names.length; i++) {
          const name = s.names[i];
          if (skip.has(name)) continue;
          const init = s.init[i];
          const fn = init && isFn(init) ? unwrap(init) : null;
          if (fn) {
            functions.push({
              orig: name,
              params: fn.params.slice(),
              vararg: !!fn.vararg,
              body: fn.body,
            });
          } else {
            leftover.push({ orig: name, init: init || null });
          }
        }
      } else if (s.type === 'FunctionDeclaration') {
        functions.push({
          orig: s.names[0],
          params: s.params.slice(),
          vararg: !!s.vararg,
          body: s.body,
          isLocal: s.isLocal,
        });
      } else if (s.type === 'AssignmentStatement') {
        for (let i = 0; i < s.vars.length; i++) {
          const v = s.vars[i];
          const init = s.inits[i];
          if (v.type !== 'Identifier') {
            leftover.push({ orig: null, init, assignNode: { vars: [v], inits: [init] } });
            continue;
          }
          const fn = init && isFn(init) ? unwrap(init) : null;
          if (fn) {
            const existing = functions.find((f) => f.orig === v.name);
            if (existing) {
              existing.params = fn.params.slice();
              existing.vararg = !!fn.vararg;
              existing.body = fn.body;
            } else {
              functions.push({
                orig: v.name,
                params: fn.params.slice(),
                vararg: !!fn.vararg,
                body: fn.body,
              });
            }
          } else {
            leftover.push({ orig: v.name, init: init || null, assign: true });
          }
        }
      } else if (s.type === 'ReturnStatement') {
        retStat = s;
      } else {
        leftover.push({ orig: null, init: null, extra: s });
      }
    }

    return { functions, leftover, retStat };
  };

  P.extractH = function extractH(table) {
    for (const f of table.fields || []) {
      if (f.type !== 'TableKeyString' || !isFn(f.value)) continue;
      const fn = unwrap(f.value);
      if (f.key === 'x') {
        this.hx = { name: this.fresh(), fn: func([SELF, ENV, 'a', 'b'], clone(fn.body)) };
      } else if (f.key === 'b') {
        this.hb = { name: this.fresh(), fn: func([SELF, ENV, 'a', 'b'], clone(fn.body)) };
      }
    }
  };

  P.assignSlots = function assignSlots(plan) {
    const names = [];
    const seen = new Set();
    for (const L of plan.leftover) {
      if (!L.orig) continue;
      if (seen.has(L.orig)) continue;
      if (plan.functions.some((f) => f.orig === L.orig)) continue;
      seen.add(L.orig);
      names.push(L.orig);
    }
    for (const n of names) this.slots.set(n, this.allocSlot());
    for (const f of plan.functions) this.methodName(f.orig);
  };

  P.assignAliasSlots = function assignAliasSlots() {
    this.aliasSlots = this.aliasSlots || new Map();
    this.markHiddenAliases();
    for (const key of this.usedAliases) {
      // Hidden aliases (buffer ops, coroutine.wrap, ipairs, string.gsub
      // alias mS) live on the object via hiddenAliasClumps (self.<field>),
      // NOT in env slots. Allocating a slot here makes aliasRef resolve to
      // env[1][n], and the scatter/interleave then writes env[1][n] = self.
      //<field> BEFORE the clump that assigns self.<field> runs — clobbering
      // the env slot with nil. Object-key-only keeps one source of truth.
      if (this.hiddenAliases.indexOf(key) >= 0) continue;
      if (!this.aliasSlots.has(key)) this.aliasSlots.set(key, this.allocSlot());
    }
  };

  // Xrings: mix l[0x1][slot] / (l[0x1])[slot] / l[0b1][slot]
  P.envSlot = function envSlot(slot, envName) {
    const env = ident(envName || ENV);
    let inner = idx(env, this.num(1));
    if (this.chance(0.38)) inner = paren(inner);
    return idx(inner, this.num(slot));
  };

  P.aliasRef = function aliasRef(key, ctx) {
    if (this.aliasSlots && this.aliasSlots.has(key)) {
      return this.envSlot(this.aliasSlots.get(key), ctx && ctx.envName);
    }
    return mem(ident(SELF), this.aliasField(key));
  };

  P.aliasValue = function aliasValue(key) {
    return paren(mem(ident(SELF), this.aliasField(key)));
  };

  P.scratchTable = function scratchTable(params) {
    return {
      type: 'TableConstructor',
      fields: (params || []).map((p) => ({ type: 'TableValue', value: ident(p) })),
    };
  };

  P.methodName = function methodName(orig) {
    if (!this.methods.has(orig)) this.methods.set(orig, this.fresh());
    return this.methods.get(orig);
  };

  P.allocSlot = function allocSlot() {
    if (!this.slotPool.length) {
      for (let i = 2; i <= 64; i++) this.slotPool.push(i);
      for (let i = this.slotPool.length - 1; i > 0; i--) {
        const j = this.randInt(0, i);
        const t = this.slotPool[i]; this.slotPool[i] = this.slotPool[j]; this.slotPool[j] = t;
      }
    }
    if (this.nextSlot < this.slotPool.length) return this.slotPool[this.nextSlot++];
    this.nextSlot += 1;
    return 64 + this.nextSlot;
  };

  P.addMethod = function addMethod(name, fnAst) {
    this.used.add(name);
    if (fnAst && !fnAst.vararg && usesVararg(fnAst.body)) fnAst.vararg = true;
    const seen = new Set();
    fnAst.params = (fnAst.params || []).filter((p) => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
    this.fields.push({ key: name, value: fnAst });
  };

  P.methodValue = function methodValue(name, envName) {
    if (!this.valueSlots.has(name)) this.valueSlots.set(name, this.allocSlot());
    return this.envSlot(this.valueSlots.get(name), envName);
  };

  P.methodSlotRef = function methodSlotRef(methodName, envName) {
    this.methodEnvSlots = this.methodEnvSlots || new Map();
    if (!this.methodEnvSlots.has(methodName)) {
      this.methodEnvSlots.set(methodName, this.allocSlot());
    }
    return this.envSlot(this.methodEnvSlots.get(methodName), envName);
  };

  P.itemExpr = function itemExpr(item, ctx) {
    if (item.kind === 'method' || item.kind === 'methodValue') {
      // Xrings: env[1][n] = T.Ym  — not function(...)return T:Ym(env,...)
      const m = mem(ident(SELF), item.method);
      return this.chance(0.4) ? paren(m) : m;
    }
    if (item.kind === 'alias') {
      return this.aliasValue(item.alias);
    }
    return this.rewrite(clone(item.init), ctx);
  };

  P.buildHy = function buildHy(plan) {
    const envN = this.fresh('e');
    const body = [
      localStat([ENV], [{ type: 'TableConstructor', fields: [] }]),
      localStat([envN], [mcall(ident(SELF), this.byName, [ident(ENV)])]),
    ];

    // Leftover chunk statements are collected here and emitted AFTER the
    // scatter (see below). An init can read another leftover's slot (e.g.
    // `data` needs `cursor`/`blob` set, transitively through the
    // deserialize call), and the scatter runs in random order — so they
    // must not go through it. Source order is the topo-sorted chunk order,
    // like the plain wrapper.

    const directs = [];
    const seen = new Set();
    for (const L of plan.leftover) {
      if (L.extra) {
        directs.push({ kind: 'extra', node: L.extra });
        continue;
      }
      if (L.assignNode) {
        directs.push({ kind: 'assignNode', node: L.assignNode });
        continue;
      }
      if (!L.orig || this.methods.has(L.orig) || !this.slots.has(L.orig)) continue;
      const init = L.init;
      if (seen.has(L.orig) && !L.assign) continue;
      seen.add(L.orig);
      if (!L.assign && (!init || init.type === 'NilLiteral')) continue;
      directs.push({ kind: 'init', slot: this.slots.get(L.orig), init });
    }

    const valueItems = [];
    // NOTE: leftover inits are emitted directly after the scatter (see
    // below), in source order. Slots allocated from here on (group
    // emission, direct emission, retStat) are covered by the
    // missing-assignment sweep at the end of buildHy.
    for (const [orig, slot] of this.valueSlots) {
      const m = this.methods.get(orig);
      if (!m) continue;
      valueItems.push({
        orig,
        slot,
        kind: 'methodValue',
        method: m,
      });
    }
    for (const [mName, slot] of this.methodEnvSlots || []) {
      valueItems.push({
        orig: '#' + mName,
        slot,
        kind: 'method',
        method: mName,
      });
    }

    const aliasItems = [];
    for (const [key, slot] of this.aliasSlots || []) {
      aliasItems.push({
        orig: '#' + key,
        slot,
        kind: 'alias',
        alias: key,
      });
    }

    // leftover inits may call alias slots, so they run last.
    const shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = this.randInt(0, i);
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    };

    const loopFor = (g, envIdent) => {
      const start = this.randInt(0x14, 0x48);
      const step = this.randInt(0x22, 0x74);
      const hits = Math.max(g.length, 1);
      const stop = start + step * Math.max(hits - 1, 0);
      const inline = hits > 1 || this.chance(0.4);
      const envName = envIdent || 'n';

      let dispBody;
      if (inline) {
        const dispCtx = { bound: new Set([SELF, ENV, 'n']), scratch: null, nName: null, envName: 'n' };
        dispBody = rangeIfHighToLow(
          'l',
          hits,
          start,
          step,
          (gi) => [assign(this.envSlot(g[gi].slot, 'n'), this.itemExpr(g[gi], dispCtx))],
          (v) => this.num(v),
          this,
        );
      } else {
        const setterCtx = { bound: new Set([SELF, ENV]), scratch: null, nName: null };
        const setters = g.map((item) => {
          const nm = this.fresh();
          this.addMethod(nm, func([SELF, ENV], [
            assign(this.envSlot(item.slot), this.itemExpr(item, setterCtx)),
          ]));
          return nm;
        });
        dispBody = rangeIfHighToLow(
          'l',
          hits,
          start,
          step,
          (gi) => [callStat(mcall(ident(SELF), setters[gi], [ident('n')]))],
          (v) => this.num(v),
          this,
        );
      }

      const disp = this.fresh();
      this.addMethod(disp, func([SELF, ENV, 'n'], dispBody));
      const iter = this.fresh('f');
      const kind = pickLoopKind(this);
      return {
        type: '_clump',
        stats: numericStateLoop(
          iter,
          this.num(start),
          this.num(stop),
          this.num(step),
          [callStat(mcall(ident(SELF), disp, [ident(iter), ident(envName)]))],
          kind,
        ),
      };
    };

    const directClump = (items, envIdent) => {
      const ctx = { bound: new Set([SELF, ENV, envIdent]), scratch: null, nName: null, envName: envIdent };
      return items.map((item) => assign(this.envSlot(item.slot, envIdent), this.itemExpr(item, ctx)));
    };

    const packFors = (items, envIdent, nGroups) => {
      const out = [];
      if (!items.length) return out;
      const groups = Math.max(1, Math.min(nGroups, Math.floor((items.length + 1) / 2)));
      let i = 0;
      for (let g = 0; g < groups; g++) {
        const leftG = groups - g;
        const leftI = items.length - i;
        const take = Math.max(2, Math.ceil(leftI / leftG));
        const slice = items.slice(i, i + take);
        i += slice.length;
        if (!slice.length) break;
        if (slice.length === 1) out.push(directClump(slice, envIdent));
        else out.push(loopFor(slice, envIdent));
      }
      if (i < items.length) {
        const rest = items.slice(i);
        if (rest.length === 1) out.push(directClump(rest, envIdent));
        else out.push(loopFor(rest, envIdent));
      }
      return out;
    };

    const flattenMix = (mix) => {
      const out = [];
      for (const s of mix) {
        if (Array.isArray(s)) out.push.apply(out, s);
        else out.push(s);
      }
      return out;
    };

    const hostsOf = (mix) => {
      const out = [];
      for (const s of mix) {
        if (Array.isArray(s)) {
          for (const x of s) out.push(x);
        } else {
          out.push(s);
        }
      }
      return out;
    };

    // Leftover inits are already emitted directly above (source order);
    // only dependency-free method/alias refs go through the scatter.
    const allItems = shuffle(valueItems.concat(aliasItems));
    const clumps = this.hiddenAliasClumps();

    if (allItems.length <= 10) {
      const hosts = hostsOf(packFors(allItems, envN, Math.max(clumps.length, 1)));
      const mid = this.interleaveAliasClumps(clumps, hosts);
      for (const s of mid) body.push(s);
    } else {
      let nFmAlias = Math.min(clumps.length, Math.max(0, clumps.length - 4));
      // The buffer-decl clump run (clumps[0..nBuf): one `local t=buffer`
      // plus its `T.af=t.prop` uses) shares a single local. Slicing inside
      // it puts the declaration in fm and uses in entry (or vice versa),
      // leaving a dangling nil (`T.W=a.readstring` with no `local a`).
      // Keep the whole run in fm, which runs first.
      const nBuf = (this.hiddenAliases || []).filter((k) => BUFFER_KEYS.has(k)).length;
      if (nBuf > 1 && nFmAlias > 0 && nFmAlias < nBuf) nFmAlias = nBuf;
      const fmClumps = clumps.slice(0, nFmAlias);
      const entryClumps = clumps.slice(nFmAlias);
      const keep = Math.min(allItems.length, Math.max(entryClumps.length + 3, 6));
      const fmItems = allItems.slice(0, Math.max(0, allItems.length - keep));
      const entryItems = allItems.slice(allItems.length - keep);
      const fmName = this.fresh();
      const fmGroups = Math.max(4, fmClumps.length);
      const fmHosts = hostsOf(packFors(fmItems.length ? fmItems : entryItems.slice(0, 1), ENV, fmGroups));
      this.addMethod(fmName, func([SELF, ENV], this.interleaveAliasClumps(fmClumps, fmHosts)));
      body.push(callStat(mcall(ident(SELF), fmName, [ident(envN)])));
      const nFor = Math.max(entryClumps.length, 1);
      const entryHosts = hostsOf(packFors(entryItems, envN, nFor));
      const mid = this.interleaveAliasClumps(entryClumps, entryHosts);
      for (const s of mid) body.push(s);
    }

    // Leftover chunk statements, in source order. Everything they can read
    // (methods, alias slots, earlier leftovers) is assigned by now: methods
    // live on the table, scatter wrote the alias/method slots, and earlier
    // leftovers in this same block wrote their own slots.
    {
      const dctx = { bound: new Set([SELF, ENV, envN]), scratch: null, nName: null, envName: envN };
      for (const d of directs) {
        const c = { ...dctx, bound: new Set(dctx.bound) };
        if (d.kind === 'extra') body.push(this.rewrite(clone(d.node), c));
        else if (d.kind === 'assignNode') {
          body.push(this.rewrite({
            type: 'AssignmentStatement',
            vars: d.node.vars,
            inits: d.node.inits,
          }, c));
        } else {
          // Leftover slot aliased to a bare method reference (e.g.
          // `bootstrap = main_chunk24`): callers invoke the slot as a plain
          // function (`env[18](data, upvals)`), but the raw `T.f` expects
          // (SELF, ENV, ...). Bind SELF/ENV here so the slot stays plain-
          // callable, exactly like the original chunk-level function.
          const initU = unwrap(d.init);
          if (initU && initU.type === 'Identifier' && this.methods.has(initU.name)) {
            const m = this.methods.get(initU.name);
            // NOTE: mcall adds SELF implicitly: `T:m(X, ...)` ≡ m(T, X, ...).
            body.push(assign(this.envSlot(d.slot, envN), func([], [
              ret([mcall(ident(SELF), m, [ident(envN), { type: 'VarargExpression' }])]),
            ], true)));
          } else {
            body.push(assign(this.envSlot(d.slot, envN), this.rewrite(clone(d.init), c)));
          }
        }
      }
    }

    if (plan.retStat) {
      body.push(this.rewrite(clone(plan.retStat), {
        bound: new Set([SELF, ENV, envN]),
        scratch: null,
        nName: null,
        envName: envN,
      }));
    }

    // Late slots: rewrites during group/direct/retStat emission can allocate
    // methodEnvSlots/valueSlots/aliasSlots AFTER the snapshot loops ran,
    // so those slots never get an assignment. The dry-run cannot cover
    // them: rng-driven `chance()` branches diverge between passes.
    // Reading such a slot is `call nil` at runtime.
    // Emit the missing assignments right after the env setup — method refs
    // and global alias exprs are always available there.
    {
      const written = new Set();
      const asNum = (n) => {
        let u = n;
        while (u && u.type === 'ParenExpression') u = u.expr;
        return u && u.type === 'NumericLiteral' ? Number(u.value) : null;
      };
      const collectSlotWrite = (v) => {
        let u = v;
        while (u && u.type === 'ParenExpression') u = u.expr;
        if (!u || u.type !== 'IndexExpression') return;
        const slot = asNum(u.index);
        let o = u.object;
        while (o && o.type === 'ParenExpression') o = o.expr;
        if (o && o.type === 'IndexExpression' && asNum(o.index) === 1 && slot != null) {
          written.add(slot);
        }
      };
      const collectWrites = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          for (const x of node) collectWrites(x);
          return;
        }
        if (node.type === 'AssignmentStatement') {
          for (const v of node.vars || []) collectSlotWrite(v);
        }
        for (const k of Object.keys(node)) {
          if (k === 'loc' || k === 'raw') continue;
          const c = node[k];
          if (c && typeof c === 'object') collectWrites(c);
        }
      };
      for (const s of body) collectWrites(s);
      const missing = [];
      const needWrite = (slot, method) => {
        if (written.has(slot)) return;
        written.add(slot);
        missing.push(assign(
          idx(idx(ident(envN), this.num(1)), this.num(slot)),
          mem(ident(SELF), method),
        ));
      };
      for (const [mName, slot] of this.methodEnvSlots || []) needWrite(slot, mName);
      for (const [orig, slot] of this.valueSlots) {
        const m = this.methods.get(orig);
        if (!m) continue;
        needWrite(slot, m);
      }
      // Same orphan class for alias slots: an alias first referenced during
      // group/direct/retStat emission never got an aliasItems entry. Inline
      // the global expression (always available, no dependencies).
      for (const [key, slot] of this.aliasSlots || []) {
        if (written.has(slot)) continue;
        written.add(slot);
        missing.push(assign(
          idx(idx(ident(envN), this.num(1)), this.num(slot)),
          clone(aliasExpr(key)),
        ));
      }
      // body[0] = `local l`, body[1] = `local n = T:by(l)` — insert after.
      if (missing.length) body.splice(2, 0, ...missing);
    }
    return body;
  };

  P.collectUsed = function collectUsed(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const n of node) this.collectUsed(n);
      return;
    }
    if (node.type === 'Identifier' && GLOBAL_FUNCS[node.name]) {
      this.usedAliases.add(GLOBAL_FUNCS[node.name]);
    }
    if (node.type === 'MemberExpression' && node.object && node.object.type === 'Identifier') {
      const key = node.object.name + '.' + node.property;
      if (LIB_MEMBERS[key]) this.usedAliases.add(LIB_MEMBERS[key]);
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'raw') continue;
      const v = node[k];
      if (v && typeof v === 'object') this.collectUsed(v);
    }
  };

  P.emitUsedAliases = function emitUsedAliases() {
    this.markHiddenAliases();
    for (const key of this.usedAliases) {
      if (!ALIAS_EXPR[key]) continue;
      if (this.hiddenAliases.indexOf(key) >= 0) continue;
      this.fields.push({ key: this.aliasField(key), value: clone(aliasExpr(key)) });
    }
  };

  P.markHiddenAliases = function markHiddenAliases() {
    this.hiddenAliases = [];
    for (const key of this.usedAliases) {
      if (!ALIAS_EXPR[key]) continue;
      if (BUFFER_KEYS.has(key) || key === 'mS' || key === 'cY' || key === 'iA') {
        this.hiddenAliases.push(key);
      }
    }
  };

  P.hiddenAliasClumps = function hiddenAliasClumps() {
    const keys = this.hiddenAliases || [];
    if (!keys.length) return [];
    const clumps = [];
    const bufKeys = keys.filter((k) => BUFFER_KEYS.has(k));
    const other = keys.filter((k) => !BUFFER_KEYS.has(k));

    if (bufKeys.length) {
      const tName = this.fresh();
      const order = bufKeys.slice();
      for (let i = order.length - 1; i > 0; i--) {
        const j = this.randInt(0, i);
        const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
      const decl = localStat([tName], [ident('buffer')]);
      const nameFields = {};
      for (const key of order) {
        const prop = BUFFER_PROPS[key];
        if (!prop) continue;
        const nf = this.fresh();
        nameFields[key] = nf;
        this.fields.push({ key: nf, value: { type: 'StringLiteral', value: prop } });
      }
      const firstKey = order[0];
      const firstNf = nameFields[firstKey];
      const firstAssign = firstNf
        ? [assign(mem(ident(SELF), this.aliasField(firstKey)), idx(ident(tName), mem(ident(SELF), firstNf)))]
        : [];
      clumps.push([decl].concat(firstAssign));
      for (let i = 1; i < order.length; i++) {
        const key = order[i];
        const nf = nameFields[key];
        if (!nf) continue;
        clumps.push([assign(mem(ident(SELF), this.aliasField(key)), idx(ident(tName), mem(ident(SELF), nf)))]);
      }
    }

    const rest = other.slice();
    for (let i = rest.length - 1; i > 0; i--) {
      const j = this.randInt(0, i);
      const tmp = rest[i]; rest[i] = rest[j]; rest[j] = tmp;
    }
    for (const key of rest) {
      if (key === 'cY') {
        const cName = this.fresh();
        clumps.push([
          localStat([cName], [ident('coroutine')]),
          assign(mem(ident(SELF), this.aliasField('cY')), mem(ident(cName), 'wrap')),
        ]);
      } else if (key === 'iA') {
        clumps.push([
          assign(mem(ident(SELF), this.aliasField('iA')), ident('ipairs')),
        ]);
      } else {
        clumps.push([
          assign(mem(ident(SELF), this.aliasField(key)), clone(aliasExpr(key))),
        ]);
      }
    }
    return clumps;
  };

  P.interleaveAliasClumps = function interleaveAliasClumps(clumps, hosts) {
    const flattenHost = (h) => {
      if (!h) return [];
      if (Array.isArray(h)) return h;
      if (h.type === '_clump' && h.stats) return h.stats;
      return [h];
    };
    const H = (hosts || []).slice();
    const C = (clumps || []).slice();
    if (!C.length) {
      const out = [];
      for (const h of H) out.push.apply(out, flattenHost(h));
      return out;
    }
    if (!H.length) return C.reduce((a, c) => a.concat(c), []);
    const out = [];
    const n = Math.max(H.length, C.length);
    for (let i = 0; i < n; i++) {
      if (i < H.length) out.push.apply(out, flattenHost(H[i]));
      if (i < C.length) out.push.apply(out, C[i]);
    }
    return out;
  };


  P.hiddenAliasInits = function hiddenAliasInits() {
    return this.interleaveAliasClumps(this.hiddenAliasClumps(), []);
  };

  P.shuffleFields = function shuffleFields() {
    const a = this.fields;
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.randInt(0, i);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
  };
}

module.exports = { attachObjectWrap };
