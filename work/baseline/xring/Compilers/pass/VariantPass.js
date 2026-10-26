'use strict';

/**
 * After intern + superopt: rewrite CALL/RETURN/JMP/FOR/MOVE/GETI into
 * N wire variants. Each CALL/RET name has a *different* Lua calling
 * convention in Handlers.js (not a do/end clone). JMP_ABS / JMP_REL pack
 * dest differently so dest=B+1 on every jump breaks ~2/3 of CFGs.
 *
 * Generic CALL/RETURN kept ~8% (plus B=0/C=0) so a body-cluster of the
 * specialized arms still misses.
 */

const { mulberry32 } = require('../encode/Serializer');

const CALL_MAP = {
  '1:1': ['CALL0', 'CALL0B', 'CALL0S', 'CALL0T'],
  '1:2': ['CALL0R', 'CALL0RS'],
  '2:1': ['CALLA1', 'CALLA1S', 'CALLA1T'],
  '2:2': ['CALLA1R', 'CALLA1RB', 'CALLA1RS'],
  '3:1': ['CALLA2', 'CALLA2S'],
  '3:2': ['CALLA2R', 'CALLA2RS'],
  '4:1': ['CALLA3', 'CALLA3S'],
  '4:2': ['CALLA3R'],
};

const RET_MAP = {
  1: ['RET0', 'RET0B', 'RET0T', 'RET0X'],
  2: ['RET1', 'RET1B', 'RET1S', 'RET1X'],
  3: ['RET2', 'RET2S', 'RET2X'],
  4: ['RET3', 'RET3S', 'RET3X'],
  5: ['RET4', 'RET4S'],
  6: ['RET5'],
};

const MOVE_ALTS = ['MOVE2', 'MOVE3'];
const GETI_ALTS = ['GETI2', 'GETI3'];

const ARITH_ENC = {
  ADD: { RR: 'ADDRR', RK: 'ADDRK', KK: 'ADDKK' },
  SUB: { RR: 'SUBRR', RK: 'SUBRK', KK: 'SUBKK' },
  MUL: { RR: 'MULRR', RK: 'MULRK', KK: 'MULKK' },
  DIV: { RR: 'DIVRR', RK: 'DIVRK', KK: 'DIVKK' },
  IDIV: { RR: 'IDIVRR', RK: 'IDIVRK', KK: 'IDIVKK' },
};

function arithKind(inst) {
  const bk = !!(inst.Bk || inst.BK);
  const ck = !!(inst.Ck || inst.CK);
  if (bk && ck) return 'KK';
  if (!bk && ck) return 'RK';
  if (!bk && !ck) return 'RR';
  return null;
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function rewriteInst(inst, rng, stats) {
  if (!inst || !inst.op) return;
  if (inst.op === 'CALL') {
    const B = inst.B;
    const C = inst.C;
    if (B === 0 || C === 0) {
      stats.callKeep++;
      return;
    }
    if (rng() < 0.08) {
      stats.callKeep++;
      return;
    }
    const opts = CALL_MAP[B + ':' + C];
    if (!opts) {
      stats.callKeep++;
      return;
    }
    inst.op = pick(rng, opts);
    stats.callVar++;
    stats[inst.op] = (stats[inst.op] || 0) + 1;
    return;
  }
  if (inst.op === 'RETURN') {
    if (inst.B === 0) {
      stats.retKeep++;
      return;
    }
    if (rng() < 0.08) {
      stats.retKeep++;
      return;
    }
    const opts = RET_MAP[inst.B];
    if (!opts) {
      stats.retKeep++;
      return;
    }
    inst.op = pick(rng, opts);
    stats.retVar++;
    stats[inst.op] = (stats[inst.op] || 0) + 1;
    return;
  }
  if (inst.op === 'MOVE') {
    if (rng() < 0.45) {
      inst.op = pick(rng, MOVE_ALTS);
      stats.moveVar++;
    }
    return;
  }
  if (inst.op === 'GETI') {
    if (rng() < 0.45) {
      inst.op = pick(rng, GETI_ALTS);
      stats.getiVar++;
    }
    return;
  }
  const enc = ARITH_ENC[inst.op];
  if (enc) {
    if (rng() < 0.08) {
      stats.arithKeep++;
      return;
    }
    const kind = arithKind(inst);
    if (!kind || !enc[kind]) {
      stats.arithKeep++;
      return;
    }
    inst.op = enc[kind];
    stats.arithVar++;
    stats[inst.op] = (stats[inst.op] || 0) + 1;
    return;
  }
  if (inst.op === 'JMP' || inst.op === 'FORLOOP' || inst.op === 'FORPREP') {
    const r = rng();
    const base = inst.op;
    if (r < 0.33) {
      inst.op = base === 'JMP' ? 'JMP_ABS' : base + '_ABS';
      stats.jmpAbs++;
    } else if (r < 0.66) {
      inst.op = base === 'JMP' ? 'JMP_REL' : base + '_REL';
      stats.jmpRel++;
    } else {
      stats.jmpPre++;
    }
  }
}

function rewriteProto(proto, rng, stats) {
  if (!proto || proto.keepNative) return;
  const code = proto.code || [];
  for (let i = 0; i < code.length; i++) {
    const inst = code[i];
    if (inst && (inst.op === 'CLOSURE' || inst.op === 'NATIVE_CLOSURE')) {
      const nUv = inst.B || 0;
      i += nUv;
      continue;
    }
    rewriteInst(inst, rng, stats);
  }
  for (const c of proto.protos || []) rewriteProto(c, rng, stats);
}

function variantPass(root, seedOrRng) {
  const rng = typeof seedOrRng === 'function'
    ? seedOrRng
    : mulberry32(((seedOrRng == null ? 1 : seedOrRng) >>> 0) ^ 0x4E56524E);
  const stats = {
    callVar: 0,
    callKeep: 0,
    retVar: 0,
    retKeep: 0,
    jmpPre: 0,
    jmpAbs: 0,
    jmpRel: 0,
    moveVar: 0,
    getiVar: 0,
    arithVar: 0,
    arithKeep: 0,
  };
  rewriteProto(root, rng, stats);
  return stats;
}

module.exports = { variantPass };
