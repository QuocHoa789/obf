'use strict';

/**
 * Split guest/filler into single-entry regions, wrap with REGION_DEC /
 * REGION_ENC. Serializer writes plaintext; deserialize XORs bodies so a
 * dump-without-step is garbage. REGION_DEC decrypts (idempotent); REGION_ENC
 * and RETURN re-encrypt.
 *
 * intern_fill: prefix (PUTI regionKey) stays plaintext. Everything after is
 * intern-keyed — C is the intern slot, key = I[slot]. Dumping C no longer
 * yields the XOR seed (the old A=255 / C=seed oracle).
 *
 * Do not cut: T* pipeline, relop EQ+JMP, CLOSURE+upvalues, FOR* protocol.
 */

const { mulberry32 } = require('../encode/Serializer');
const { isJumpOp, RETURN_VARIANTS } = require('../IR/Opcodes');

const MIN_LEN = 1;
const MAX_LEN = 16;
const PIPE = new Set([
  'TKEYI', 'TKEYR', 'TKEYK', 'TGET', 'TGETD', 'TARGI', 'TARGI2',
  'TSET', 'TSETK', 'CALL1', 'CALL2', 'CALL3',
]);
const COND = new Set(['EQ', 'LT', 'LE', 'TEST', 'TESTSET']);
const JMPS = new Set(['JMP', 'JMP_ABS', 'JMP_REL']);
const RETS = new Set(['TAILCALL', ...RETURN_VARIANTS]);

function targetOf(inst) {
  const b = inst.B == null ? 0 : inst.B;
  return b + 1;
}

function isRelopSkip(code, pc) {
  const inst = code[pc];
  if (!inst || !JMPS.has(inst.op)) return false;
  const t = targetOf(inst);
  if (t <= pc || t - pc > 4) return false;
  const dest = code[t];
  return !!(dest && dest.op === 'LOADBOOL');
}

function spanAt(code, i) {
  const inst = code[i];
  if (!inst) return 1;
  if (inst.op === 'CLOSURE' || inst.op === 'NATIVE_CLOSURE') {
    return 1 + (inst.B || 0);
  }
  if (inst.op === 'TFORLOOP') {
    if (code[i + 1] && JMPS.has(code[i + 1].op)) return 2;
    return 1;
  }
  if (inst.op === 'TLOAD') {
    let n = 1;
    while (i + n < code.length && PIPE.has(code[i + n].op)) n++;
    return n;
  }
  if (COND.has(inst.op) && code[i + 1] && JMPS.has(code[i + 1].op)) {
    let n = 2;
    while (i + n < code.length && code[i + n].op === 'LOADBOOL') n++;
    if (i + n < code.length && code[i + n].op === 'TEST') n++;
    return n;
  }
  return 1;
}

function leadersOf(code) {
  const L = new Set([0, code.length]);
  for (let i = 0; i < code.length; i++) {
    const inst = code[i];
    if (!inst) continue;
    if (isJumpOp(inst.op)) {
      if (!isRelopSkip(code, i)) {
        const t = targetOf(inst);
        if (t >= 0 && t <= code.length) L.add(t);
        L.add(i + 1);
      }
    }
    if (RETS.has(inst.op)) L.add(i + 1);
  }
  return [...L].filter((x) => x >= 0 && x <= code.length).sort((a, b) => a - b);
}

// Instructions whose next-PC depends on a *relative* skip. A region boundary
// may never fall right after one of these: REGION_ENC would be inserted as the
// skipped instruction, so PC++ would step over the wrapper and still run the
// JMP / value store it was meant to skip.
function skipsNext(inst) {
  if (!inst) return false;
  if (inst.op === 'TEST' || inst.op === 'TESTSET') return true;
  if (inst.op === 'LOADBOOL') return !!(inst.C || inst.CK);
  if (inst.op === 'TFORLOOP') return true;
  return false;
}

function pickRegions(code, from) {
  from = from || 0;
  const leaders = leadersOf(code).filter((x) => x >= from);
  if (leaders[0] !== from) leaders.unshift(from);
  const regions = [];
  for (let li = 0; li < leaders.length - 1; li++) {
    const start = leaders[li];
    const end = leaders[li + 1];
    let i = start;
    while (i < end) {
      let j = i;
      let size = 0;
      while (j < end) {
        let sp = spanAt(code, j);
        if (j + sp > end) sp = end - j;
        if (sp < 1) break;
        if (size > 0 && size + sp > MAX_LEN) break;
        size += sp;
        j += sp;
      }
      // Trim the region end back off any trailing skip-carrying instruction.
      // Only fires when the size cap happens to land there, so inputs whose
      // regions were already valid keep a byte-identical instruction stream.
      while (size > 0 && skipsNext(code[i + size - 1])) size--;
      j = i + size;
      if (size >= MIN_LEN) {
        const last = code[i + size - 1];
        const term = last && (isJumpOp(last.op) || RETS.has(last.op));
        if (!(size === 1 && term)) regions.push({ start: i, len: size });
      }
      if (j <= i) j = i + 1;
      i = j;
    }
  }
  return regions;
}

function rewriteProto(proto, rng, stats, internInfo) {
  if (!proto || proto.keepNative) return;
  for (const c of proto.protos || []) rewriteProto(c, rng, stats, internInfo);
  if (proto._kind === 'entry' || proto._kind === 'dispatch') return;

  const internSlot = internInfo && internInfo.reservedMap && internInfo.reservedMap.regionKey;
  const iRegHeld = proto._iReg;
  const internMode = internSlot != null && iRegHeld != null;
  const iReg = internMode ? iRegHeld : 255;
  const prefixEnd = proto._regionPrefixEnd || 0;

  const code = proto.code || [];
  const lines = proto.lineinfo || [];
  if (code.length < MIN_LEN) return;
  const regions = pickRegions(code, prefixEnd);
  if (regions.length === 0) {
    stats.skipped++;
    return;
  }

  const byStart = new Map();
  for (const rg of regions) {
    // intern-keyed: C is the intern slot, not the XOR seed.
    rg.seed = internMode ? internSlot : (1 + Math.floor(rng() * 104728));
    byStart.set(rg.start, rg);
  }

  const newCode = [];
  const newLines = [];
  const oldToNew = new Array(code.length + 1);
  let i = 0;
  while (i < code.length) {
    const rg = byStart.get(i);
    if (rg) {
      const line = lines[i] || 0;
      const decIdx = newCode.length;
      newCode.push({
        op: 'REGION_DEC',
        A: iReg,
        B: rg.len,
        C: rg.seed,
        loc: code[i].loc,
      });
      newLines.push(line);
      oldToNew[i] = decIdx;
      for (let k = 0; k < rg.len; k++) {
        const src = i + k;
        if (k > 0) oldToNew[src] = newCode.length;
        newCode.push(code[src]);
        newLines.push(lines[src] || 0);
      }
      newCode.push({
        op: 'REGION_ENC',
        A: iReg,
        B: rg.len,
        C: rg.seed,
        loc: code[i].loc,
      });
      newLines.push(line);
      i += rg.len;
      stats.regions++;
      stats.insts += rg.len;
      if (internMode) stats.internKeyed++;
      continue;
    }
    oldToNew[i] = newCode.length;
    newCode.push(code[i]);
    newLines.push(lines[i] || 0);
    i++;
  }
  oldToNew[code.length] = newCode.length;

  for (let oldIdx = 0; oldIdx < code.length; oldIdx++) {
    const orig = code[oldIdx];
    if (!orig || !isJumpOp(orig.op)) continue;
    const mapped = oldToNew[oldIdx];
    if (mapped == null || !newCode[mapped] || newCode[mapped].op !== orig.op) continue;
    const oldTarget = targetOf(orig);
    const clamped = Math.max(0, Math.min(oldTarget, code.length));
    newCode[mapped].B = oldToNew[clamped] - 1;
  }

  proto.code = newCode;
  proto.lineinfo = newLines;
  proto._regionEnc = true;
  proto._nRegions = regions.length;
  proto._regionIntern = !!internMode;
}

function regionPass(root, seedOrRng, internInfo) {
  const rng = typeof seedOrRng === 'function'
    ? seedOrRng
    : mulberry32(((seedOrRng == null ? 1 : seedOrRng) >>> 0) ^ 0x52474E45);
  const stats = { regions: 0, insts: 0, skipped: 0, internKeyed: 0 };
  rewriteProto(root, rng, stats, internInfo || null);
  return stats;
}

module.exports = { regionPass, pickRegions, MIN_LEN, MAX_LEN };
