'use strict';

/**
 * After intern: rewrite interned method calls AND remaining GETTABLE /
 * SETTABLE so guest is not a stable Lua 5.1 sequence.
 *
 * Method (interned :name):
 *   ~8% classic SELF+CALL (not GETTABLE)
 *   ~44% CALLM (0–1 intern arg)
 *   rest TLOAD/TKEYI/TGET[/TARGI[/TARGI2]]/CALL1|CALL2|CALL3
 *
 * Field get/set — 0% classic GETTABLE/SETTABLE:
 *   interned key  GETFI / SETFI  |  TLOAD+TKEYI+TGETD/TSET
 *   register key  GETFR / SETFR  |  TLOAD+TKEYR+TGETD/TSET
 *   const key     GETFK / SETFK  |  TLOAD+TKEYK+TGETD/TSET
 *
 * Table ctor — 0% NEWTABLE/SETLIST:
 *   NEWTABLE → TNEW
 *   SETLIST  → TFLUSH  or  unroll TSETI (small B)
 *
 * Hidden scratch J,o,r,E,q lives outside the Lua stack.
 */

const { mulberry32 } = require('../encode/Serializer');
const { isJumpOp } = require('../IR/Opcodes');

function isGetI(inst) {
  return inst && inst.op === 'GETI' && !inst.Bk && !inst.BK && !inst.Ck && !inst.CK;
}

function packPair(lo, hi) {
  return (lo & 255) + (hi & 255) * 256;
}

function canPack(a, b) {
  return typeof a === 'number' && typeof b === 'number' && a >= 0 && b >= 0 && a <= 255 && b <= 255;
}

function destWritten(inst) {
  if (!inst || typeof inst.A !== 'number') return false;
  const op = inst.op;
  if (op === 'JMP' || op === 'JMP_ABS' || op === 'JMP_REL') return false;
  if (op === 'EQ' || op === 'LT' || op === 'LE' || op === 'TEST') return false;
  if (op === 'SETTABLE' || op === 'SETGLOBAL' || op === 'SETUPVAL' || op === 'PUTI') return false;
  if (op === 'SETFI' || op === 'SETFR' || op === 'SETFK' || op === 'TSET' || op === 'TSETK' || op === 'TSETI' || op === 'TFLUSH') return false;
  if (op === 'TLOAD' || op === 'TKEYI' || op === 'TKEYR' || op === 'TKEYK' || op === 'TARGI' || op === 'TARGI2') return false;
  return true;
}

function readsReg(inst, reg) {
  if (!inst || typeof reg !== 'number') return false;
  if (!inst.Bk && !inst.BK && inst.B === reg) {
    if (inst.op !== 'JMP' && inst.op !== 'LOADK' && inst.op !== 'LOADENC' && inst.op !== 'LOADENC2' && inst.op !== 'LOADENC3') {
      return true;
    }
  }
  if (!inst.Ck && !inst.CK && inst.C === reg) return true;
  return false;
}

function regLiveAfter(code, idx, reg) {
  for (let i = idx + 1; i < code.length; i++) {
    const ins = code[i];
    if (readsReg(ins, reg)) return true;
    if (destWritten(ins) && ins.A === reg) return false;
  }
  return false;
}

function matchMethod(code, selfIdx) {
  const self = code[selfIdx];
  if (!self || self.op !== 'SELF') return null;
  if (self.Ck || self.CK) return null;
  const tmp = self.C;
  const base = self.A;
  const objReg = self.B;
  let methIdx = -1;
  for (let j = selfIdx - 1; j >= Math.max(0, selfIdx - 6); j--) {
    const g = code[j];
    if (isGetI(g) && g.A === tmp) {
      methIdx = j;
      break;
    }
    if (g && typeof g.A === 'number' && g.A === tmp && g.op !== 'SELF') break;
  }
  if (methIdx < 0) return null;
  const methGet = code[methIdx];
  const iReg = methGet.B;
  const methSlot = methGet.C;
  if (typeof iReg !== 'number' || typeof methSlot !== 'number') return null;
  if (iReg > 255 || objReg > 255 || methSlot > 255) return null;

  const argSlots = [];
  let k = selfIdx + 1;
  let expectDest = base + 2;
  while (
    k < code.length &&
    isGetI(code[k]) &&
    code[k].A === expectDest &&
    code[k].B === iReg &&
    typeof code[k].C === 'number' &&
    code[k].C <= 255
  ) {
    argSlots.push(code[k].C);
    expectDest++;
    k++;
  }
  if (k >= code.length || code[k].op !== 'CALL') return null;
  const call = code[k];
  if (call.A !== base) return null;
  if (call.B === 0 || (call.C !== 1 && call.C !== 2)) return null;
  if (argSlots.length > 2) return null;
  if (call.B !== argSlots.length + 2) return null;
  return {
    type: 'method',
    start: methIdx,
    end: k,
    methIdx,
    selfIdx,
    callIdx: k,
    base,
    objReg,
    iReg,
    methSlot,
    argSlots,
    loc: self.loc || call.loc,
  };
}

function emitCallm(m) {
  if (m.argSlots.length > 1) return null;
  const arg = m.argSlots.length === 1 ? m.argSlots[0] : null;
  const C = arg == null ? m.methSlot : packPair(m.methSlot, arg + 1);
  return {
    op: 'CALLM',
    A: m.base,
    B: packPair(m.objReg, m.iReg),
    C,
    Bk: false,
    Ck: false,
    loc: m.loc,
  };
}

function emitMethodPipeline(m) {
  const seq = [
    { op: 'TLOAD', A: 0, B: m.objReg, C: 0, loc: m.loc },
    { op: 'TKEYI', A: 0, B: m.iReg, C: m.methSlot, loc: m.loc },
    { op: 'TGET', A: 0, B: 0, C: 0, loc: m.loc },
  ];
  if (m.argSlots.length === 2) {
    seq.push({ op: 'TARGI', A: 0, B: m.iReg, C: m.argSlots[0], loc: m.loc });
    seq.push({ op: 'TARGI2', A: 0, B: m.iReg, C: m.argSlots[1], loc: m.loc });
    seq.push({ op: 'CALL3', A: m.base, B: 0, C: 0, loc: m.loc });
  } else if (m.argSlots.length === 1) {
    seq.push({ op: 'TARGI', A: 0, B: m.iReg, C: m.argSlots[0], loc: m.loc });
    seq.push({ op: 'CALL2', A: m.base, B: 0, C: 0, loc: m.loc });
  } else if (m.argSlots.length === 0) {
    seq.push({ op: 'CALL1', A: m.base, B: 0, C: 0, loc: m.loc });
  } else {
    return null;
  }
  return seq;
}

function covered(ranges, i) {
  for (const [s, e] of ranges) {
    if (i >= s && i <= e) return true;
  }
  return false;
}

function matchGet(code, i) {
  const inst = code[i];
  if (!inst || inst.op !== 'GETTABLE') return null;
  const dest = inst.A;
  const obj = inst.B;
  const loc = inst.loc;
  if (inst.Ck || inst.CK) {
    return { type: 'get', start: i, end: i, dest, obj, keyMode: 'k', keyK: inst.C, loc };
  }
  const prev = i > 0 ? code[i - 1] : null;
  if (
    isGetI(prev) &&
    prev.A === inst.C &&
    canPack(obj, prev.B) &&
    prev.C <= 255 &&
    !regLiveAfter(code, i, inst.C)
  ) {
    return {
      type: 'get',
      start: i - 1,
      end: i,
      dest,
      obj,
      keyMode: 'i',
      iReg: prev.B,
      slot: prev.C,
      loc,
    };
  }
  return { type: 'get', start: i, end: i, dest, obj, keyMode: 'r', keyReg: inst.C, loc };
}

function matchSet(code, i) {
  const inst = code[i];
  if (!inst || inst.op !== 'SETTABLE') return null;
  const obj = inst.A;
  const loc = inst.loc;
  const valK = !!(inst.Ck || inst.CK);
  const val = inst.C;
  if (inst.Bk || inst.BK) {
    return {
      type: 'set',
      start: i,
      end: i,
      obj,
      keyMode: 'k',
      keyK: inst.B,
      valK,
      val,
      loc,
    };
  }
  const prev = i > 0 ? code[i - 1] : null;
  if (
    isGetI(prev) &&
    prev.A === inst.B &&
    canPack(obj, prev.B) &&
    prev.C <= 255 &&
    !regLiveAfter(code, i, inst.B)
  ) {
    return {
      type: 'set',
      start: i - 1,
      end: i,
      obj,
      keyMode: 'i',
      iReg: prev.B,
      slot: prev.C,
      valK,
      val,
      loc,
    };
  }
  return {
    type: 'set',
    start: i,
    end: i,
    obj,
    keyMode: 'r',
    keyReg: inst.B,
    valK,
    val,
    loc,
  };
}

function emitGetPipe(m) {
  const loc = m.loc;
  const seq = [{ op: 'TLOAD', A: 0, B: m.obj, C: 0, loc }];
  if (m.keyMode === 'i') seq.push({ op: 'TKEYI', A: 0, B: m.iReg, C: m.slot, loc });
  else if (m.keyMode === 'r') seq.push({ op: 'TKEYR', A: 0, B: m.keyReg, C: 0, loc });
  else seq.push({ op: 'TKEYK', A: 0, B: m.keyK, C: 0, Bk: true, loc });
  seq.push({ op: 'TGETD', A: m.dest, B: 0, C: 0, loc });
  return seq;
}

function emitSetPipe(m) {
  const loc = m.loc;
  const seq = [{ op: 'TLOAD', A: 0, B: m.obj, C: 0, loc }];
  if (m.keyMode === 'i') seq.push({ op: 'TKEYI', A: 0, B: m.iReg, C: m.slot, loc });
  else if (m.keyMode === 'r') seq.push({ op: 'TKEYR', A: 0, B: m.keyReg, C: 0, loc });
  else seq.push({ op: 'TKEYK', A: 0, B: m.keyK, C: 0, Bk: true, loc });
  if (m.valK) seq.push({ op: 'TSETK', A: 0, B: m.val, C: 0, Bk: true, loc });
  else seq.push({ op: 'TSET', A: 0, B: m.val, C: 0, loc });
  return seq;
}

function emitGet(m, kind) {
  const loc = m.loc;
  if (kind === 'super') {
    if (m.keyMode === 'i') {
      return [{ op: 'GETFI', A: m.dest, B: packPair(m.obj, m.iReg), C: m.slot, loc }];
    }
    if (m.keyMode === 'r') {
      return [{ op: 'GETFR', A: m.dest, B: m.obj, C: m.keyReg, loc }];
    }
    if (m.keyMode === 'k') {
      return [{ op: 'GETFK', A: m.dest, B: m.obj, C: m.keyK, Ck: true, loc }];
    }
    return emitGetPipe(m);
  }
  return emitGetPipe(m);
}

function emitSet(m, kind) {
  const loc = m.loc;
  if (kind === 'super') {
    if (m.valK) return emitSetPipe(m);
    if (m.keyMode === 'i') {
      return [{ op: 'SETFI', A: m.val, B: packPair(m.obj, m.iReg), C: m.slot, loc }];
    }
    if (m.keyMode === 'r') {
      return [{ op: 'SETFR', A: m.obj, B: m.keyReg, C: m.val, loc }];
    }
    if (m.keyMode === 'k') {
      return [{ op: 'SETFK', A: m.obj, B: m.keyK, C: m.val, Bk: true, loc }];
    }
    return emitSetPipe(m);
  }
  return emitSetPipe(m);
}

function rollKind(rng, m) {
  const r = rng();
  if (m.type === 'method') {
    if (m.argSlots.length > 1) return r < 0.08 ? 'classic' : 'pipe';
    if (r < 0.08) return 'classic';
    if (r < 0.52) return 'callm';
    return 'pipe';
  }
  if (m.type === 'newtable') return 'tnew';
  if (m.type === 'setlist') {
    if (m.n > 0 && m.n <= 8 && (m.page || 1) >= 1 && r < 0.75) return 'unroll';
    return 'tflush';
  }
  if (r < 0.50) return 'super';
  return 'pipe';
}

function emitChosen(ch) {
  const { m, kind } = ch;
  if (kind === 'classic') return null;
  if (m.type === 'method') {
    if (kind === 'callm') {
      const one = emitCallm(m);
      return one ? [one] : emitMethodPipeline(m);
    }
    return emitMethodPipeline(m);
  }
  if (m.type === 'get') return emitGet(m, kind);
  if (m.type === 'set') return emitSet(m, kind);
  if (m.type === 'newtable') {
    return [{ op: 'TNEW', A: m.dest, B: 0, C: 0, loc: m.loc }];
  }
  if (m.type === 'setlist') {
    if (kind === 'unroll' && m.n > 0 && m.n <= 8) {
      const seq = [];
      const page = m.page || 1;
      const off = (page - 1) * 50;
      for (let i = 1; i <= m.n; i++) {
        seq.push({ op: 'TSETI', A: m.dest, B: off + i, C: m.dest + i, loc: m.loc });
      }
      return seq;
    }
    return [{ op: 'TFLUSH', A: m.dest, B: m.n, C: m.page || 1, loc: m.loc }];
  }
  return null;
}

function rewriteProto(proto, rng, stats) {
  if (!proto || proto.keepNative) return;
  if (proto._kind === 'fill' || proto._kind === 'dispatch') return;
  const code = proto.code || [];
  const lines = proto.lineinfo || [];
  const methodRanges = [];
  const matches = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i].op !== 'SELF') continue;
    const m = matchMethod(code, i);
    if (m) {
      matches.push(m);
      methodRanges.push([m.start, m.end]);
    }
  }
  for (let i = 0; i < code.length; i++) {
    if (covered(methodRanges, i)) continue;
    if (code[i].op === 'GETTABLE') {
      const m = matchGet(code, i);
      if (m) matches.push(m);
    } else if (code[i].op === 'SETTABLE') {
      const m = matchSet(code, i);
      if (m) matches.push(m);
    } else if (code[i].op === 'NEWTABLE') {
      matches.push({ type: 'newtable', start: i, end: i, dest: code[i].A, loc: code[i].loc });
    } else if (code[i].op === 'SETLIST') {
      matches.push({
        type: 'setlist',
        start: i,
        end: i,
        dest: code[i].A,
        n: code[i].B,
        page: code[i].C || 1,
        loc: code[i].loc,
      });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  if (matches.length === 0) {
    for (const c of proto.protos || []) rewriteProto(c, rng, stats);
    return;
  }

  const chosen = [];
  for (const m of matches) {
    const kind = rollKind(rng, m);
    chosen.push({ m, kind });
    const key = m.type + '_' + kind;
    stats[key] = (stats[key] || 0) + 1;
    if (m.type === 'method') stats[kind] = (stats[kind] || 0) + 1;
  }

  const newCode = [];
  const newLines = [];
  const oldToNew = new Array(code.length + 1);
  let mi = 0;
  let i = 0;
  while (i < code.length) {
    oldToNew[i] = newCode.length;
    const ch = chosen[mi];
    if (ch && i === ch.m.start && ch.kind !== 'classic') {
      let seq = emitChosen(ch);
      if ((!seq || !seq.length) && ch.m.type !== 'method') {
        if (ch.m.type === 'get') seq = emitGetPipe(ch.m);
        else if (ch.m.type === 'set') seq = emitSetPipe(ch.m);
        else if (ch.m.type === 'newtable') seq = [{ op: 'TNEW', A: ch.m.dest, B: 0, C: 0, loc: ch.m.loc }];
        else if (ch.m.type === 'setlist') seq = [{ op: 'TFLUSH', A: ch.m.dest, B: ch.m.n, C: ch.m.page || 1, loc: ch.m.loc }];
      }
      const line = lines[ch.m.end] || lines[ch.m.start] || 0;
      if (seq && seq.length) {
        for (const inst of seq) {
          newCode.push(inst);
          newLines.push(line);
        }
        const skipUntil = ch.m.end;
        for (let s = i + 1; s <= skipUntil; s++) oldToNew[s] = newCode.length - 1;
        i = skipUntil + 1;
        mi++;
        continue;
      }
      ch.kind = 'classic';
    }
    if (ch && i === ch.m.start && ch.kind === 'classic') mi++;
    newCode.push(code[i]);
    newLines.push(lines[i] || 0);
    i++;
  }
  oldToNew[code.length] = newCode.length;

  for (let oldIdx = 0; oldIdx < code.length; oldIdx++) {
    const orig = code[oldIdx];
    if (!isJumpOp(orig.op)) continue;
    const mapped = oldToNew[oldIdx];
    if (mapped == null || !newCode[mapped] || newCode[mapped].op !== orig.op) continue;
    const oldTarget = (orig.B || 0) + 1;
    const clamped = Math.max(0, Math.min(oldTarget, code.length));
    newCode[mapped].B = oldToNew[clamped] - 1;
  }

  proto.code = newCode;
  proto.lineinfo = newLines;
  for (const c of proto.protos || []) rewriteProto(c, rng, stats);
}

function superOptGuest(guest, seedOrRng) {
  const rng = typeof seedOrRng === 'function'
    ? seedOrRng
    : mulberry32((seedOrRng == null ? 1 : seedOrRng) >>> 0);
  const stats = { classic: 0, callm: 0, pipe: 0 };
  rewriteProto(guest, rng, stats);
  return stats;
}

module.exports = { superOptGuest, packPair };
