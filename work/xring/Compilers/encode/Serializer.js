'use strict';

/**
 * Luraph/IronBrew-style blob serializer matching VirtualMachine deserializer
 * (chunks 26 + 27). Constants are pooled globally, then baked into operand
 * slots at readproto time.
 *
 * Jump operands are converted from the compiler's 0-based "target-1" encoding
 * to the VM's 1-based PC, then packed as K_FWD / K_BWD / K_REG.
 */

const { CANONICAL, JUMP_OPS, jumpKind } = require('../IR/Opcodes');
const { isLoadencOp, isEncodable, encodeLoadenc } = require('./LoadEnc');

const MODE = {
  CONST: 0,
  REG: 7,
  FWD: 1,
  BWD: 4,
  CLOSURE: 2,
  REL_FWD: 3,
  REL_BWD: 5,
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class ByteWriter {
  constructor() {
    this.buf = [];
  }
  bytes() {
    return Buffer.from(this.buf);
  }
  u8(n) {
    this.buf.push(n & 255);
  }
  varint(n) {
    n = n >>> 0;
    while (n >= 128) {
      this.u8((n & 127) | 128);
      n >>>= 7;
    }
    this.u8(n);
  }
  u32(n) {
    n = n >>> 0;
    this.u8(n);
    this.u8(n >>> 8);
    this.u8(n >>> 16);
    this.u8(n >>> 24);
  }
  f64(n) {
    const b = Buffer.alloc(8);
    b.writeDoubleLE(n, 0);
    for (let i = 0; i < 8; i++) this.u8(b[i]);
  }
  i64(n) {
    let lo;
    let hi;
    if (n >= 0) {
      lo = n % 4294967296;
      hi = Math.floor(n / 4294967296);
    } else {
      const two64 = 4294967296 * 4294967296;
      const u = n + two64;
      lo = u % 4294967296;
      hi = Math.floor(u / 4294967296);
    }
    this.u32(lo);
    this.u32(hi);
  }
}

class Serializer {
  constructor(opts) {
    this.opts = opts || {};
    this.rng = mulberry32(this.opts.seed == null ? 0xC0FFEE : this.opts.seed >>> 0);
    this.idMap = this.opts.idMap || null;
    this.slotBias = this.opts.slotBias != null ? this.opts.slotBias : 17;
    this.constBias = this.opts.constBias != null ? this.opts.constBias : 23;
    this.protoBias = this.opts.protoBias != null ? this.opts.protoBias : 11;
    this.strOffset = this.opts.strOffset != null ? this.opts.strOffset : 41;
    this.typeFloat = this.opts.typeFloat != null ? this.opts.typeFloat : 3;
    this.typeNil = this.opts.typeNil != null ? this.opts.typeNil : 7;
    this.typeString = this.opts.typeString != null ? this.opts.typeString : 5;
    if (this.typeFloat < 2) this.typeFloat = 3;
    this.constants = [];
    this.kmap = new Map();
    this.protos = [];
  }

  wire(opName) {
    const canon = CANONICAL[opName];
    if (canon == null) throw new Error('unknown opcode ' + opName);
    if (this.idMap && this.idMap[canon] != null) return this.idMap[canon];
    return canon;
  }

  intern(v) {
    const key = v === null || v === undefined
      ? 'nil'
      : (typeof v) + ':' + String(v);
    if (this.kmap.has(key)) return this.kmap.get(key);
    this.constants.push(v === undefined ? null : v);
    const idx = this.constants.length;
    this.kmap.set(key, idx);
    return idx;
  }

  flatten(root) {
    const list = [];
    const walk = (p) => {
      for (const c of p.protos || []) walk(c);
      list.push(p);
      p._flatIndex = list.length;
    };
    walk(root);
    this.protos = list;
    return list;
  }

  collectConstants(p) {
    for (const c of p.constants || []) this.intern(c);
    for (const c of p.protos || []) this.collectConstants(c);
  }

  collectLoadenc(p) {
    const code = p.code || [];
    for (let i = 0; i < code.length; i++) {
      const inst = code[i];
      if (!inst || !isLoadencOp(inst.op)) continue;
      const cv = p.constants[(inst.B || 0) - 1];
      if (!isEncodable(cv)) continue;
      this.intern(encodeLoadenc(cv, this.wire(inst.op), i + 1, inst.op, this.opts.encPerm));
    }
    for (const c of p.protos || []) this.collectLoadenc(c);
  }

  writeConst(w, v) {
    if (v === null || v === undefined) {
      w.u8(this.typeNil);
      return;
    }
    const t = typeof v;
    if (t === 'boolean') {
      w.u8(0);
      w.u8(v ? 1 : 0);
      return;
    }
    if (t === 'string') {
      w.u8(this.typeString);
      const buf = Buffer.from(v, 'utf8');
      w.varint(buf.length);
      for (let i = 0; i < buf.length; i++) {
        w.u8((buf[i] + this.strOffset) & 255);
      }
      return;
    }
    if (t === 'number') {
      if (Number.isInteger(v) && Math.abs(v) > 2147483647) {
        w.u8(this.typeFloat + 1);
        w.i64(v);
      } else {
        w.u8(this.typeFloat);
        w.f64(v);
      }
      return;
    }
    w.u8(this.typeNil);
  }

  packJump(compilerPc, compilerB, op) {
    // compiler stores B = target0 - 1 (host interp is 0-based).
    // VM PC is 1-based: instruction i (0-based) lives at PC i+1.
    const I = compilerPc + 1;
    const kind = jumpKind(op) || 'pre';
    if (kind === 'rel') {
      const delta = (compilerB || 0) + 1 - I;
      if (delta > 0) return { mode: MODE.REL_FWD, val: delta };
      if (delta < 0) return { mode: MODE.REL_BWD, val: -delta };
      return { mode: MODE.REG, val: 0 };
    }
    // JMP_PRE: handler PC = RegB; loop +1 → packed = dest_0based = compilerB+1
    // JMP_ABS: handler PC = RegB - 1; loop +1 → packed = dest_1based = compilerB+2
    const desired = kind === 'abs' ? (compilerB || 0) + 2 : (compilerB || 0) + 1;
    if (desired > I) return { mode: MODE.FWD, val: desired - I };
    if (desired < I) return { mode: MODE.BWD, val: I - desired };
    return { mode: MODE.REG, val: desired };
  }

  packOperand(inst, field) {
    const isK = inst[field + 'k'] || inst[field + 'K'];
    const val = inst[field];
    if (field === 'C' && inst.op === 'CLOSURE') {
      return { mode: MODE.CLOSURE, val: inst._cProtoFlat || val };
    }
    if (isK) {
      return { mode: MODE.CONST, val };
    }
    return { mode: MODE.REG, val: val || 0 };
  }

  writePacked(w, packed) {
    const v = packed.val || 0;
    w.varint(((v << 3) | (packed.mode & 7)) >>> 0);
  }

  writeProto(w, p) {
    const nSlots = p.code.length;
    w.varint(nSlots);
    for (let i = 0; i < nSlots; i++) w.varint(i * 4);
    w.varint(nSlots + this.slotBias);

    for (let i = 0; i < nSlots; i++) {
      const inst = p.code[i];
      const A = this.packOperand(inst, 'A');
      let B;
      let C;
      if (inst.op === 'CLOSURE' || inst.op === 'NATIVE_CLOSURE') {
        B = { mode: MODE.REG, val: inst.B || 0 };
        const child = p.protos[inst.C - 1];
        C = { mode: MODE.CLOSURE, val: child ? child._flatIndex : 1 };
      } else if (JUMP_OPS.has(inst.op)) {
        B = this.packJump(i, inst.B, inst.op);
        C = this.packOperand(inst, 'C');
      } else {
        B = this.packOperand(inst, 'B');
        C = this.packOperand(inst, 'C');
        if (B.mode === MODE.CONST) {
          let cv = p.constants[inst.B - 1];
          if (isLoadencOp(inst.op) && isEncodable(cv)) {
            cv = encodeLoadenc(cv, this.wire(inst.op), i + 1, inst.op, this.opts.encPerm);
          }
          B.val = this.intern(cv);
        }
        if (C.mode === MODE.CONST) {
          const cv = p.constants[inst.C - 1];
          C.val = this.intern(cv);
        }
        if (A.mode === MODE.CONST) {
          const cv = p.constants[inst.A - 1];
          A.val = this.intern(cv);
        }
      }
      this.writePacked(w, C);
      this.writePacked(w, A);
      this.writePacked(w, B);
      w.varint(this.wire(inst.op));
    }

    w.varint(p.maxstack || 8);

    const lines = p.lineinfo || [];
    w.u32(lines.length);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || 0;
      w.u32((line << 1) >>> 0);
    }

    w.varint(p.params || 0);
    w.varint(0); // nRgn
    w.varint(0); // nMap
    w.varint(0); // nOA
  }

  serialize(root) {
    this.constants = [];
    this.kmap = new Map();
    this.flatten(root);
    this.collectConstants(root);
    this.collectLoadenc(root);

    const w = new ByteWriter();
    w.varint(this.constants.length + this.constBias);
    w.u8(0);
    for (const c of this.constants) this.writeConst(w, c);

    w.varint(this.protos.length + this.protoBias);
    for (const p of this.protos) this.writeProto(w, p);

    w.varint(root._flatIndex);
    return w.bytes();
  }
}

function encodeBase85(buf) {
  let out = '';
  const len = buf.length;
  for (let i = 0; i < len; i += 4) {
    const b0 = buf[i] || 0;
    const b1 = i + 1 < len ? buf[i + 1] : 0;
    const b2 = i + 2 < len ? buf[i + 2] : 0;
    const b3 = i + 3 < len ? buf[i + 3] : 0;
    const Tuple = ((b0 * 16777216) + (b1 * 65536) + (b2 * 256) + b3) >>> 0;
    if (Tuple === 0) {
      out += 'z';
      continue;
    }
    let t = Tuple;
    const digits = [0, 0, 0, 0, 0];
    for (let k = 4; k >= 0; k--) {
      digits[k] = t % 85;
      t = Math.floor(t / 85);
    }
    for (let k = 0; k < 5; k++) out += String.fromCharCode(digits[k] + 33);
  }
  return out;
}

function decodeBase85(s) {
  s = String(s).replace(/z/g, '!!!!!');
  const out = [];
  for (let i = 0; i + 5 <= s.length; i += 5) {
    const a = s.charCodeAt(i) - 33;
    const b = s.charCodeAt(i + 1) - 33;
    const c = s.charCodeAt(i + 2) - 33;
    const d = s.charCodeAt(i + 3) - 33;
    const e = s.charCodeAt(i + 4) - 33;
    let Tuple = e + d * 85 + c * 7225 + b * 614125 + a * 52200625;
    const ba = Tuple % 256;
    Tuple = (Tuple - ba) / 256;
    const bb = Tuple % 256;
    Tuple = (Tuple - bb) / 256;
    const bc = Tuple % 256;
    Tuple = (Tuple - bc) / 256;
    const bd = Tuple % 256;
    out.push(bd, bc, bb, ba);
  }
  return Buffer.from(out);
}

function wrapBlobLiteral(b85, prefix) {
  prefix = typeof prefix === 'string' && prefix ? prefix : 'XRING';
  const body = prefix + String(b85);
  for (let n = 3; n <= 12; n++) {
    const eq = '='.repeat(n);
    const close = ']' + eq + ']';
    if (!body.includes(close) && !body.includes('[' + eq + '[')) {
      return '[' + eq + '[' + body + ']' + eq + ']';
    }
  }
  return '[===[' + body + ']===]';
}


module.exports = {
  Serializer,
  ByteWriter,
  encodeBase85,
  decodeBase85,
  wrapBlobLiteral,
  MODE,
  mulberry32,
  JUMP_OPS,
};
