'use strict';

/**
 * Xrings control-flow cache: `Y={}` on the method table, then
 *   z.Y[0x89]=(V)     or  (z.Y)[460]=(e)
 * after each state transition. Optional hop:
 *   z.Y[k]=next; V=z.Y[k]
 *
 * No MBA / P pool — cache only stores the dispatcher state.
 */

const { ident, mem, idx, paren, assign, clone, un, ifStat } = require('../../Factorizer/core/Ast');

const CACHE_FIELD = 'Y';

class CfCacheEngine {
  constructor(host) {
    this.host = host;
  }

  get enabled() {
    return !!this.host.useSelf && this.host.cache !== false;
  }

  rand() { return this.host.rand(); }
  chance(p) { return this.host.chance(p); }
  num(v) { return this.host.num(v); }

  get selfName() { return this.host.selfName || require('../../Factorizer/core/Ast').SELF; }

  yObj() {
    const field = this.host.cacheField || CACHE_FIELD;
    const base = mem(ident(this.selfName), field);
    return this.chance(0.4) ? paren(base) : base;
  }

  slot() {
    return this.num(this.host.randInt(1000, 99999));
  }

  ref(key) {
    return idx(this.yObj(), key || this.slot());
  }

  /**
   * Emit stats that set `stateName` to `value` and stash it in z.Y[slot].
   */
  stash(stateName, value) {
    if (!this.enabled) return [assign(ident(stateName), value)];
    const key = this.slot();
    const rhs = this.chance(0.55) ? paren(value) : value;
    if (this.chance(0.45)) {
      return [
        ifStat(
          un('not', paren(un('not', this.ref(key)))),
          [assign(ident(stateName), this.ref(clone(key)))],
          [
            assign(ident(stateName), rhs),
            assign(this.ref(clone(key)), ident(stateName)),
          ],
        ),
      ];
    }
    if (this.chance(0.35)) {
      return [
        assign(this.ref(key), rhs),
        assign(ident(stateName), this.ref(clone(key))),
      ];
    }
    return [
      assign(ident(stateName), value),
      assign(this.ref(key), this.chance(0.5) ? paren(ident(stateName)) : ident(stateName)),
    ];
  }

  emptyTable() {
    return { type: 'TableConstructor', fields: [] };
  }
}

module.exports = { CfCacheEngine, CACHE_FIELD };
