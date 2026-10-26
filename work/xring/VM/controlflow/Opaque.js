'use strict';

/**
 * Opaque predicates — Xrings invert-on-ident, not NUM==NUM / z[n] junk.
 *
 * CFF and for-dispatch now emit:
 *   if not(s==v) then else REAL
 *   if not(not(s~=v)) then else REAL
 *   if not(s~=v) then REAL
 *
 * This engine is kept as a no-op wrap so leftover callers don't stamp
 * `if 813==0x2e5` or `z[n]=-z[m]` onto opcode leaves.
 */

const { ident, bin, un, idx, paren, assign } = require('../../Factorizer/core/Ast');

class OpaqueEngine {
  constructor(host) {
    this.host = host;
  }

  get enabled() {
    return this.host.opaque !== false;
  }

  rand() { return this.host.rand(); }
  randInt(min, max) { return this.host.randInt(min, max); }
  chance(p) { return this.host.chance(p); }
  num(v) { return this.host.num(v); }
  pick(arr) { return arr[this.randInt(0, arr.length - 1)]; }

  get selfName() { return this.host.selfName || require('../../Factorizer/core/Ast').SELF; }
  get useSelf() { return !!this.host.useSelf; }

  zKey() {
    const key = this.num(this.randInt(1, 0x3f));
    const obj = this.chance(0.28) ? paren(ident(this.selfName)) : ident(this.selfName);
    return idx(obj, key);
  }

  lit() {
    return this.num(this.randInt(0x8, 0x3c0));
  }

  junkExpr() {
    const a = this.zKey();
    const b = this.zKey();
    switch (this.randInt(0, 3)) {
      case 0: return un('-', a);
      case 1: return bin('%', a, b);
      case 2: return bin('-', a, b);
      default: return bin('+', a, b);
    }
  }

  junkStat() {
    return assign(this.zKey(), this.junkExpr());
  }

  junkBlock() {
    return [this.junkStat()];
  }

  opaqueFalse() {
    // Unused by CFF; keep a tautology-false on nil without NUM==NUM.
    return this.useSelf ? this.zKey() : bin('==', ident('nil'), ident('nil'));
  }

  opaqueTrue() {
    return this.useSelf
      ? un('not', this.zKey())
      : bin('~=', ident('nil'), ident('nil'));
  }

  wrap(real) {
    return real || [];
  }

  decorateTree(stats) {
    return stats || [];
  }

  decorateStat(s) {
    return s;
  }

  decorateArm(body) {
    return body || [];
  }
}

module.exports = { OpaqueEngine };
