'use strict';

/**
 * Xrings CF state encoding:
 *
 *   local W=(0X4FD);                          -- init is a literal
 *   W=-0X1666B7E9+((T.ym[a]==T.ym[b] and T.ym[c] or T.ym[d])~=T.ym[e] and T.ym[f] or T.ym[g]);
 *   Z=(-0xF6CEA40B+(T.ym[a]+T.ym[b]-Z+T.ym[c]-T.ym[d]+T.ym[d]));
 *   Z=T:qJ(Z,T.ym,Z,h);
 *
 * qJ is:
 *   w=(C+(T-m[a]+m[b]+m[c]-m[d]+m[c])); return w
 * C sits at the call site so the helper can include the live state `l`.
 */

const { ident, mem, idx, call, mcall, bin, paren, func, ret, SELF, ENV } = require('../core/Ast');

const POOL_FIELD = 'P';
const MBA_BAND = 'K';
const MBA_BXOR = 'nS';

function u32(n) {
  return n >>> 0;
}
function clz32(n) {
  n = n >>> 0;
  return n === 0 ? 32 : Math.clz32(n);
}
function ctz32(n) {
  n = n >>> 0;
  if (n === 0) return 32;
  return 31 - Math.clz32(n & -n);
}
function rotl(n, d) {
  n = n >>> 0;
  d &= 31;
  if (d === 0) return n;
  return ((n << d) | (n >>> (32 - d))) >>> 0;
}
function rotr(n, d) {
  n = n >>> 0;
  d &= 31;
  if (d === 0) return n;
  return ((n >>> d) | (n << (32 - d))) >>> 0;
}

function chain(start, parts) {
  let ast = start;
  for (let i = 0; i < parts.length; i++) ast = bin(parts[i][0], ast, parts[i][1]);
  return ast;
}

class MbaEngine {
  constructor(host) {
    this.host = host;
    this.pool = [];
    this.helpers = [];
  }

  rand() { return this.host.rand(); }
  chance(p) { return this.host.chance(p); }
  randInt(min, max) { return min + Math.floor(this.rand() * (max - min + 1)); }
  pick(arr) { return arr[this.randInt(0, arr.length - 1)]; }

  num(value) {
    return this.host.num(value);
  }

  init() {
    const n = 9;
    this.pool = [];
    for (let i = 0; i < n; i++) {
      this.pool.push(u32(this.randInt(0x1000000, 0x7fffffff)));
    }
    this.helpers = [];
    const used = new Set();
    const bitCount = this.randInt(3, 4);
    for (let i = 0; i < bitCount; i++) {
      let target = this.randInt(0x3c0, 0x2c00);
      while (used.has(target)) target += this.randInt(0x280, 0x900);
      used.add(target);
      const offset = this.chance(0.7) ? this.randInt(0x20, 0x180) : 0;
      const name = this.host.fresh();
      const mode = this.chance(0.55) ? 'z' : 'n';
      this.helpers.push({
        name,
        target,
        offset,
        kind: 'bit',
        fn: this.makeHelper(target - offset, mode),
      });
    }
    const arithCount = this.randInt(3, 4);
    for (let i = 0; i < arithCount; i++) {
      let target = this.randInt(0x3c0, 0x2c00);
      while (used.has(target)) target += this.randInt(0x280, 0x900);
      used.add(target);
      const name = this.host.fresh();
      const a = this.idxOf();
      const b = this.idxOf();
      const c = this.idxOf();
      const d = this.idxOf();
      this.helpers.push({
        name,
        target,
        offset: 0,
        kind: 'arith',
        idx: { a, b, c, d },
        fn: this.makeArithHelper(a, b, c, d),
      });
    }
  }

  poolTable() {
    return {
      type: 'TableConstructor',
      fields: this.pool.map((v) => ({ type: 'TableValue', value: this.num(v) })),
    };
  }

  idxOf() {
    return this.randInt(1, this.pool.length);
  }

  at(i) {
    return this.pool[i - 1];
  }

  poolName() {
    return this.host.poolField || POOL_FIELD;
  }

  bandName() {
    return (this.host.aliasField && this.host.aliasField('K')) || MBA_BAND;
  }

  bxorName() {
    const key = this.chance(0.5) ? 'nS' : 'U';
    return (this.host.aliasField && this.host.aliasField(key)) || key;
  }

  opName(key) {
    return (this.host.aliasField && this.host.aliasField(key)) || key;
  }

  // Xrings: z.P[0X9] / n[0X9]  — never (z.P)[i]
  pref(i, mode) {
    const key = this.num(i);
    if (mode === 'n') return idx(ident('n'), key);
    return idx(mem(ident(SELF), this.poolName()), key);
  }

  zop(op, args) {
    return call(
      mem(ident(SELF), op),
      args.map((a) => (a && a.type === 'ParenExpression' ? a : paren(a))),
    );
  }

  opaque(mode) {
    const a = this.idxOf();
    const b = this.idxOf();
    const c = this.idxOf();
    const d = this.idxOf();
    const val = this.at(a) < this.at(b) ? this.at(c) : this.at(d);
    const ast = bin(
      'or',
      bin('and', bin('<', this.pref(a, mode), this.pref(b, mode)), this.pref(c, mode)),
      this.pref(d, mode),
    );
    return { ast: paren(ast), val: u32(val) };
  }

  // 3-deep: so(bo(Mo(P[i], k))) / Fo(bo(bxor(P[i], P[j]))) — known at gen time
  nestedBits(mode) {
    const i = this.idxOf();
    let ast = this.pref(i, mode);
    let val = u32(this.at(i));

    const rot = this.randInt(1, 31);
    if (this.chance(0.5)) {
      ast = this.zop(this.opName('Mo'), [ast, this.num(rot)]);
      val = rotl(val, rot);
    } else if (this.chance(0.5)) {
      ast = this.zop(this.opName('Co'), [ast, this.num(rot)]);
      val = rotr(val, rot);
    } else {
      const j = this.idxOf();
      ast = this.zop(this.bxorName(), [ast, this.pref(j, mode)]);
      val = u32(val ^ this.at(j));
    }

    ast = this.zop(this.opName('bo'), [ast]);
    val = (~val) >>> 0;

    if (this.chance(0.5)) {
      ast = this.zop(this.opName('so'), [ast]);
      val = clz32(val);
    } else {
      ast = this.zop(this.opName('Fo'), [ast]);
      val = ctz32(val);
    }
    return { ast, val };
  }

  encode(target, mode) {
    mode = mode || 'z';
    const a = this.idxOf();
    const b = this.idxOf();
    const c = this.idxOf();
    const d = this.idxOf();
    const ast = chain(this.pref(a, mode), [
      ['+', this.pref(b, mode)],
      ['-', this.pref(c, mode)],
      ['+', this.pref(d, mode)],
      ['-', this.pref(c, mode)],
      ['+', this.pref(c, mode)],
    ]);
    const val = u32(this.at(a) + this.at(b) - this.at(c) + this.at(d) - this.at(c) + this.at(c));
    const C = target - val;
    return paren(bin('+', this.num(C), paren(ast)));
  }

  makeHelper(inner, mode) {
    mode = mode || 'n';
    const bits = this.nestedBits(mode);
    const ast = paren(bin('+', this.num(inner - bits.val), bits.ast));
    return func([SELF, ENV, 'n'], [ret([ast])]);
  }

  /**
   * Xrings qJ: w=(l-n[a]+n[b]+n[c]-n[d]+n[c]); return w
   * C is applied at the call site so `l` is the live dispatcher state.
   */
  makeArithHelper(a, b, c, d) {
    const ast = chain(ident(ENV), [
      ['-', this.pref(a, 'n')],
      ['+', this.pref(b, 'n')],
      ['+', this.pref(c, 'n')],
      ['-', this.pref(d, 'n')],
      ['+', this.pref(c, 'n')],
    ]);
    return func([SELF, ENV, 'n'], [
      ret([paren(ast)]),
    ]);
  }

  arithInner(fromVal, idx) {
    return fromVal - this.at(idx.a) + this.at(idx.b) + this.at(idx.c) - this.at(idx.d) + this.at(idx.c);
  }

  helperFor(target) {
    return this.helpers.find((h) => h.target === target);
  }

  arithHelpers() {
    return this.helpers.filter((h) => h.kind === 'arith');
  }

  /**
   * Lua `A and B or C` with numeric pool slots (all truthy):
   *   (P[a]==P[b] and P[c] or P[d]) ~= P[e] and P[f] or P[g]
   */
  poolLogic(target) {
    const a = this.idxOf();
    const b = this.idxOf();
    const c = this.idxOf();
    const d = this.idxOf();
    const e = this.idxOf();
    const f = this.idxOf();
    const g = this.idxOf();
    const t1 = this.at(a) === this.at(b) ? this.at(c) : this.at(d);
    const t2 = t1 !== this.at(e) ? this.at(f) : this.at(g);
    const inner = bin(
      'or',
      bin(
        'and',
        bin(
          '~=',
          paren(bin(
            'or',
            bin('and', bin('==', this.pref(a, 'z'), this.pref(b, 'z')), this.pref(c, 'z')),
            this.pref(d, 'z'),
          )),
          this.pref(e, 'z'),
        ),
        this.pref(f, 'z'),
      ),
      this.pref(g, 'z'),
    );
    return paren(bin('+', this.num(target - t2), paren(inner)));
  }

  /**
   * C + (P[a]+P[b]-state+P[c]-P[d]+P[d])  ≡  target  given known fromVal.
   */
  poolLinear(target, stateName, fromVal) {
    const a = this.idxOf();
    const b = this.idxOf();
    const c = this.idxOf();
    const d = this.idxOf();
    const innerVal = this.at(a) + this.at(b) - fromVal + this.at(c);
    const C = target - innerVal;
    const st = ident(stateName);
    const body = chain(this.pref(a, 'z'), [
      ['+', this.pref(b, 'z')],
      ['-', st],
      ['+', this.pref(c, 'z')],
      ['-', this.pref(d, 'z')],
      ['+', this.pref(d, 'z')],
    ]);
    return paren(bin('+', this.num(C), paren(body)));
  }

  wrapState(target, stateName, fromVal) {
    const h = this.helperFor(target);
    if (h && stateName) {
      if (h.kind === 'arith' && fromVal != null && h.idx) {
        const C = target - this.arithInner(fromVal, h.idx);
        const callNode = mcall(
          ident(SELF),
          h.name,
          [ident(stateName), mem(ident(SELF), this.poolName()), ident(stateName)],
        );
        return paren(bin('+', this.num(C), callNode));
      }
      if (h.kind === 'bit') {
        const dummy = this.chance(0.4) ? this.num(0) : ident(stateName);
        const callNode = mcall(ident(SELF), h.name, [dummy, mem(ident(SELF), this.poolName())]);
        if (h.offset) return bin('+', this.num(h.offset), callNode);
        return callNode;
      }
    }
    if (stateName && fromVal != null && this.chance(0.35)) {
      const bits = this.nestedBits('z');
      return paren(bin('+', this.num(target - bits.val), bits.ast));
    }
    if (stateName && fromVal != null && this.chance(0.5)) {
      return this.poolLinear(target, stateName, fromVal);
    }
    return this.poolLogic(target);
  }

  wrapValue(target, stateName) {
    return this.wrapState(target, stateName, null);
  }
}

module.exports = { MbaEngine, POOL_FIELD, MBA_BAND, MBA_BXOR };
