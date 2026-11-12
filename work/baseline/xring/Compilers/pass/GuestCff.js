'use strict';

/**
 * Guest-proto control-flow flattening (Luraph-style).
 *
 * Numeric for: FORPREP/FORLOOP lower to SUB/ADD/LT/LE + CFF
 * transitions so a flattened guest has 0 FORPREP (Luraph for-as-state).
 * Tiny helpers skip CFF and keep the Lua 5.1 protocol.
 *
 *
 * Transitions call I[dispatcher](I, S, port). Dest is an intern token
 * (I[slot] = next magic) — no affine MBA on guest or dispatcher.
 *
 * Generic for: only the TFORLOOP+JMP pair is glued (protocol). The body
 * and the exit fallthrough are separate CFF blocks — if/break inside
 * `for i,v in ipairs` flatten. The continue JMP after TFORLOOP stays a
 * raw jump (remapped onto the body's S-sync); converting it to
 * emitTransition would skip TFORLOOP's "PC++ on nil" exit.
 */

const { mulberry32 } = require('../encode/Serializer');
const { isJumpOp, RETURN_VARIANTS } = require('../IR/Opcodes');
const { MAG_PRIME } = require('../intern/InternPass');

const COND = new Set(['EQ', 'LT', 'LE', 'TEST', 'TESTSET']);
const JMP_OPS = new Set(['JMP', 'JMP_ABS', 'JMP_REL']);
const RET_OPS = new Set(['TAILCALL', ...RETURN_VARIANTS]);
const FORPREP_OPS = new Set(['FORPREP', 'FORPREP_ABS', 'FORPREP_REL']);
const FORLOOP_OPS = new Set(['FORLOOP', 'FORLOOP_ABS', 'FORLOOP_REL']);
const TPIPE = new Set([
  'TKEYI', 'TKEYR', 'TKEYK', 'TGET', 'TGETD', 'TARGI', 'TARGI2',
  'TSET', 'TSETK', 'CALL1', 'CALL2', 'CALL3',
]);

// Luraph leaves 1-line helpers as CFG. Tiny if/print is not worth CFF.
const MIN_CFF_INST = 18;
const MIN_CFF_BLOCKS = 5;

function kKey(v) {
  if (v === null || v === undefined) return 'nil';
  const t = typeof v;
  if (t === 'number') return 'n:' + v;
  if (t === 'boolean') return 'b:' + v;
  if (t === 'string') return 's:' + v;
  return 'x:' + String(v);
}

function addConst(proto, v) {
  proto.constants = proto.constants || [];
  proto._kmap = proto._kmap || new Map();
  const key = kKey(v);
  if (proto._kmap.has(key)) return proto._kmap.get(key);
  for (let i = 0; i < proto.constants.length; i++) {
    if (kKey(proto.constants[i]) === key) {
      proto._kmap.set(key, i + 1);
      return i + 1;
    }
  }
  proto.constants.push(v);
  const idx = proto.constants.length;
  proto._kmap.set(key, idx);
  return idx;
}

function targetOf(inst) {
  return (inst.B || 0) + 1;
}

function isRelopSkip(code, pc) {
  const inst = code[pc];
  if (!inst || !JMP_OPS.has(inst.op)) return false;
  const t = targetOf(inst);
  if (t <= pc || t - pc > 4) return false;
  const dest = code[t];
  return !!(dest && dest.op === 'LOADBOOL');
}

function isTforContJmp(code, pc) {
  if (pc < 1) return false;
  const inst = code[pc];
  const prev = code[pc - 1];
  return !!(inst && JMP_OPS.has(inst.op) && prev && prev.op === 'TFORLOOP');
}

function leadersOf(code) {
  const L = new Set([0, code.length]);
  for (let i = 0; i < code.length; i++) {
    const inst = code[i];
    if (!inst) continue;
    if (inst.op === 'TFORLOOP') {
      L.add(i);
      const nxt = code[i + 1];
      if (nxt && JMP_OPS.has(nxt.op)) L.add(i + 2);
    }
    if (isJumpOp(inst.op)) {
      if (!isRelopSkip(code, i) && !isTforContJmp(code, i)) {
        const t = targetOf(inst);
        if (t >= 0 && t <= code.length) L.add(t);
      }
      if (isTforContJmp(code, i)) {
        const t = targetOf(inst);
        if (t >= 0 && t <= code.length) L.add(t);
      }
      if (!JMP_OPS.has(inst.op)) L.add(i + 1);
    } else if (COND.has(inst.op)) {
      const next = code[i + 1];
      if (!(next && JMP_OPS.has(next.op) && isRelopSkip(code, i + 1))) {
        if (i + 2 <= code.length) L.add(i + 2);
      }
    }
    if (RET_OPS.has(inst.op) && i + 1 < code.length) L.add(i + 1);
  }
  return [...L].sort((a, b) => a - b);
}

function unionOverlap(merged, ps, pe) {
  let us = ps;
  let ue = pe;
  const kept = [];
  for (const [s, e] of merged) {
    if (e > ps && s < pe) {
      us = Math.min(us, s);
      ue = Math.max(ue, e);
    } else kept.push([s, e]);
  }
  kept.push([us, ue]);
  kept.sort((a, b) => a[0] - b[0]);
  return kept;
}

function buildBlocks(code) {
  const ls = leadersOf(code);
  const ranges = [];
  for (let i = 0; i < ls.length - 1; i++) {
    const s = ls[i];
    const e = ls[i + 1];
    if (s < code.length && e > s) ranges.push([s, e]);
  }
  let merged = ranges;
  for (let i = 0; i < code.length; i++) {
    const op = code[i] && code[i].op;
    if (op === 'TFORLOOP') {
      // Glue only the protocol pair, not the generic-for body.
      const hi = i + 1 < code.length && JMP_OPS.has(code[i + 1].op) ? i + 2 : i + 1;
      merged = unionOverlap(merged, i, hi);
    } else if (op === 'TLOAD') {
      let hi = i + 1;
      while (hi < code.length && TPIPE.has(code[hi].op)) hi++;
      if (hi > i + 1) merged = unionOverlap(merged, i, hi);
    }
  }
  const glued = [];
  for (const r of merged) {
    if (glued.length && r[0] > 0 && code[r[0] - 1] && code[r[0] - 1].op === 'LOADBOOL' && code[r[0] - 1].C) {
      glued[glued.length - 1][1] = r[1];
    } else glued.push(r.slice());
  }
  return glued.map((r, id) => ({ id, start: r[0], end: r[1] }));
}

function blockAt(blocks, pc, nCode) {
  if (pc >= nCode) return null;
  for (const b of blocks) {
    if (pc >= b.start && pc < b.end) return b;
  }
  return null;
}

function pickMagics(n, rng, used) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let t = 0; t < 80; t++) {
      m = 2000 + Math.floor(rng() * (MAG_PRIME - 4000));
      if (m > n + 64 && !used.has(m)) break;
    }
    if (used.has(m)) m = 3000 + i * 97 + Math.floor(rng() * 50);
    while (used.has(m)) m += 97;
    used.add(m);
    out.push(m);
  }
  return out;
}

function addConstDisp(proto, v) {
  proto.constants = proto.constants || [];
  proto._kmap = proto._kmap || new Map();
  const key = kKey(v);
  if (proto._kmap.has(key)) return proto._kmap.get(key);
  proto.constants.push(v);
  const idx = proto.constants.length;
  proto._kmap.set(key, idx);
  return idx;
}

function injectDispTokens(internInfo, edges) {
  const filler = internInfo && internInfo.filler;
  if (!filler || !filler.code || !edges.length) return [];
  const uniq = [];
  const seen = new Set();
  for (const e of edges) {
    const k = e.from + ':' + e.port + ':' + e.to;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(e);
  }
  const addK = (v) => {
    filler.constants = filler.constants || [];
    for (let i = 0; i < filler.constants.length; i++) {
      if (filler.constants[i] === v) return i + 1;
    }
    filler.constants.push(v);
    return filler.constants.length;
  };
  const FI = 0;
  const tmp = filler.maxstack || 8;
  filler.maxstack = tmp + 1;
  let retIdx = filler.code.length - 1;
  while (retIdx > 0 && filler.code[retIdx].op !== 'RETURN') retIdx -= 1;
  let slot = internInfo.total || 0;
  const toks = [];
  const inject = [];
  const injectLines = [];
  for (const e of uniq) {
    slot += 1;
    const k = addK(e.to);
    inject.push({ op: 'LOADK', A: tmp, B: k, C: 0, Bk: true, loc: null });
    inject.push({ op: 'PUTI', A: tmp, B: FI, C: slot, loc: null });
    injectLines.push(0, 0);
    toks.push({ from: e.from, port: e.port, to: e.to, slot });
  }
  internInfo.total = slot;
  internInfo.dispToks = toks;
  filler.code.splice(retIdx, 0, ...inject);
  if (Array.isArray(filler.lineinfo)) filler.lineinfo.splice(retIdx, 0, ...injectLines);
  filler._dispToks = toks.length;
  return toks;
}

function fillDispatcher(proto, edges, rng, toks) {
  if (!proto || !edges.length) return;
  const uniq = [];
  const seen = new Set();
  for (const e of edges) {
    const k = e.from + ':' + e.port + ':' + e.to;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(e);
  }
  const tokOf = new Map();
  for (const t of toks || []) tokOf.set(t.from + ':' + t.port + ':' + t.to, t.slot);

  const byFrom = new Map();
  for (const e of uniq) {
    if (!byFrom.has(e.from)) byFrom.set(e.from, []);
    byFrom.get(e.from).push(e);
  }
  const fromList = [...byFrom.keys()].sort((a, b) => a - b);

  proto.constants = [];
  proto._kmap = new Map();
  const R_I = 0;
  const R_S = 1;
  const R_P = 2;
  const R_T = 3;
  const code = [];
  const lines = [];
  const emit = (inst) => {
    code.push(inst);
    lines.push(0);
    return code.length - 1;
  };
  const patches = [];
  const labels = Object.create(null);

  const treeFrom = (froms) => {
    if (froms.length === 0) {
      emit({ op: 'RETURN', A: R_S, B: 2, loc: null });
      return;
    }
    if (froms.length === 1) {
      const from = froms[0];
      const kFrom = addConstDisp(proto, from);
      emit({ op: 'LOADK', A: R_T, B: kFrom, C: 0, Bk: true, loc: null });
      emit({ op: 'EQ', A: 1, B: R_S, C: R_T, loc: null });
      patches.push({ pos: emit({ op: 'JMP', A: 0, B: 0, loc: null }), label: 'F' + from });
      emit({ op: 'RETURN', A: R_S, B: 2, loc: null });
      return;
    }
    const mid = Math.floor(froms.length / 2);
    const pivot = froms[mid];
    const kP = addConstDisp(proto, pivot);
    emit({ op: 'LOADK', A: R_T, B: kP, C: 0, Bk: true, loc: null });
    emit({ op: 'LT', A: 1, B: R_S, C: R_T, loc: null });
    const jmpLeft = emit({ op: 'JMP', A: 0, B: 0, loc: null });
    treeFrom(froms.slice(mid));
    code[jmpLeft].B = code.length - 1;
    treeFrom(froms.slice(0, mid));
  };
  treeFrom(fromList);

  for (const from of fromList) {
    labels['F' + from] = code.length;
    const elist = byFrom.get(from);
    for (const e of elist) {
      const kPort = addConstDisp(proto, e.port);
      emit({ op: 'LOADK', A: R_T, B: kPort, C: 0, Bk: true, loc: null });
      emit({ op: 'EQ', A: 1, B: R_P, C: R_T, loc: null });
      patches.push({ pos: emit({ op: 'JMP', A: 0, B: 0, loc: null }), label: 'T' + e.from + '_' + e.port + '_' + e.to });
    }
    emit({ op: 'RETURN', A: R_S, B: 2, loc: null });
  }

  for (const e of uniq) {
    labels['T' + e.from + '_' + e.port + '_' + e.to] = code.length;
    const slot = tokOf.get(e.from + ':' + e.port + ':' + e.to);
    if (slot != null) {
      // Dest token lives in intern: I[slot] = destMagic. No affine dest.
      emit({ op: 'GETI', A: R_S, B: R_I, C: slot, loc: null });
      emit({ op: 'RETURN', A: R_S, B: 2, loc: null });
    } else {
      // Tests / no intern: LOADK dest (LoadEncPass encodes later). Never MBA.
      const kTo = addConstDisp(proto, e.to);
      emit({ op: 'LOADK', A: R_S, B: kTo, C: 0, Bk: true, loc: null });
      emit({ op: 'RETURN', A: R_S, B: 2, loc: null });
    }
  }

  for (const p of patches) {
    code[p.pos].B = labels[p.label] - 1;
  }
  proto.code = code;
  proto.lineinfo = lines;
  proto.maxstack = 4;
  proto.params = 3;
  proto._dispatcher = true;
  proto._nEdges = uniq.length;
  proto._binDispatch = true;
  proto._tokLookup = true;
}

function stripPrefix(code, lines, prefixLen) {
  if (!prefixLen) return { code, lines };
  const rest = [];
  const restL = [];
  for (let i = prefixLen; i < code.length; i++) {
    const inst = { ...code[i] };
    if (isJumpOp(inst.op)) inst.B = (inst.B || 0) - prefixLen;
    rest.push(inst);
    restL.push(lines[i] || 0);
  }
  return { code: rest, lines: restL };
}

function flattenProto(proto, ctx, stats) {
  if (!proto || proto.keepNative) return;
  if (proto._kind === 'fill' || proto._kind === 'dispatch' || proto._kind === 'entry') return;

  const rng = ctx.rng;
  const fullCode = proto.code || [];
  const fullLines = proto.lineinfo || [];
  const prefixLen = proto._regionPrefixEnd || 0;
  if (fullCode.length < 4) {
    stats.skipTiny++;
    for (const c of proto.protos || []) flattenProto(c, ctx, stats);
    return;
  }

  const hasFor = fullCode.some((inst) => {
    const op = inst && inst.op;
    return FORPREP_OPS.has(op) || FORLOOP_OPS.has(op) || op === 'TFORLOOP';
  });
  const hasGeneric = fullCode.some((inst) => inst && inst.op === 'TFORLOOP');

  const stripped = stripPrefix(fullCode, fullLines, prefixLen);
  const code = stripped.code;
  const lines = stripped.lines;
  if (code.length < 4) {
    stats.skipTiny++;
    for (const c of proto.protos || []) flattenProto(c, ctx, stats);
    return;
  }

  const blocks = buildBlocks(code);
  if (blocks.length < 3) {
    stats.skipFew++;
    for (const c of proto.protos || []) flattenProto(c, ctx, stats);
    return;
  }
  if (code.length < MIN_CFF_INST && blocks.length < MIN_CFF_BLOCKS) {
    stats.skipSmall++;
    for (const c of proto.protos || []) flattenProto(c, ctx, stats);
    return;
  }
  if (hasFor) stats.forSplit++;
  if (hasGeneric) stats.genericSplit++;

  const magics = pickMagics(blocks.length, rng, ctx.usedMag);
  for (let i = 0; i < blocks.length; i++) blocks[i].magic = magics[i];

  const iReg = proto._iReg;
  const useDisp = ctx.dispSlot != null && iReg != null && ctx.dispatcher;
  if (!useDisp) {
    stats.skipNoDisp++;
    for (const c of proto.protos || []) flattenProto(c, ctx, stats);
    return;
  }

  const Rstate = proto.maxstack || 2;
  const Rt = Rstate + 1;
  proto.maxstack = Rt + 4;
  const useFakeFor = blocks.length >= 4;

  const newCode = [];
  const newLines = [];
  const emit = (inst, line) => {
    newCode.push(inst);
    newLines.push(line || 0);
    return newCode.length - 1;
  };

  for (let i = 0; i < prefixLen; i++) {
    emit({ ...fullCode[i] }, fullLines[i] || 0);
  }

  const kEntry = addConst(proto, blocks[0].magic);
  emit({ op: 'LOADK', A: Rstate, B: kEntry, C: 0, Bk: true, loc: null }, 0);

  if (useFakeFor) {
    proto._fakeFor = true;
    stats.fakeFor++;
  }

  const dispatchPc = newCode.length;
  const dispatchJumps = [];
  const sortedNodes = blocks.map((b) => ({ id: b.id, magic: b.magic }))
    .sort((a, b) => a.magic - b.magic);
  const walkDisp = (arr) => {
    if (arr.length === 0) {
      emit({ op: 'JMP', A: 0, B: dispatchPc - 1, loc: null }, 0);
      return;
    }
    if (arr.length === 1) {
      const n = arr[0];
      const kMag = addConst(proto, n.magic);
      emit({ op: 'LOADK', A: Rt, B: kMag, C: 0, Bk: true, loc: null }, 0);
      emit({ op: 'EQ', A: 1, B: Rstate, C: Rt, loc: null }, 0);
      const jmpIdx = emit({ op: 'JMP', A: 0, B: 0, loc: null, _to: 'body', _bid: n.id }, 0);
      dispatchJumps.push({ jmpIdx, blockId: n.id });
      emit({ op: 'JMP', A: 0, B: dispatchPc - 1, loc: null }, 0);
      return;
    }
    const mid = Math.floor(arr.length / 2);
    const pivot = arr[mid].magic;
    const kP = addConst(proto, pivot);
    emit({ op: 'LOADK', A: Rt, B: kP, C: 0, Bk: true, loc: null }, 0);
    emit({ op: 'LT', A: 1, B: Rstate, C: Rt, loc: null }, 0);
    const jmpLeft = emit({ op: 'JMP', A: 0, B: 0, loc: null }, 0);
    walkDisp(arr.slice(mid));
    newCode[jmpLeft].B = newCode.length - 1;
    walkDisp(arr.slice(0, mid));
  };
  walkDisp(sortedNodes);

  const bodyStart = new Array(blocks.length);
  const oldToNew = new Map();
  const oldTarget = new Map();

  const emitTransition = (fromBlock, toBlock, line, port) => {
    if (!toBlock) {
      emit({ op: 'RETURN', A: 0, B: 1, C: 0, loc: null }, line);
      return;
    }
    ctx.edges.push({ from: fromBlock.magic, port: port || 0, to: toBlock.magic });
    const Rfn = Rt;
    emit({ op: 'GETI', A: Rfn, B: iReg, C: ctx.dispSlot, loc: null }, line);
    emit({ op: 'MOVE', A: Rfn + 1, B: iReg, C: 0, loc: null }, line);
    emit({ op: 'MOVE', A: Rfn + 2, B: Rstate, C: 0, loc: null }, line);
    const kPort = addConst(proto, port || 0);
    emit({ op: 'LOADK', A: Rfn + 3, B: kPort, C: 0, Bk: true, loc: null }, line);
    emit({ op: 'CALL', A: Rfn, B: 4, C: 2, loc: null }, line);
    emit({ op: 'MOVE', A: Rstate, B: Rfn, C: 0, loc: null }, line);
    emit({ op: 'JMP', A: 0, B: dispatchPc - 1, loc: null }, line);
  };

  const inBlock = (blk, pc) => {
    const t = blockAt(blocks, pc, code.length);
    return t && blk && t.id === blk.id;
  };

  for (const block of blocks) {
    bodyStart[block.id] = newCode.length;
    const kHere = addConst(proto, block.magic);
    emit({ op: 'LOADK', A: Rstate, B: kHere, C: 0, Bk: true, loc: null }, 0);
    const mapOld = (oldI, newI) => {
      oldToNew.set(oldI, newI);
      oldTarget.set(oldI, oldI === block.start ? bodyStart[block.id] : newI);
    };
    let fallThrough = true;
    for (let i = block.start; i < block.end; i++) {
      const inst = code[i];
      const next = i + 1 < block.end ? code[i + 1] : null;
      if (COND.has(inst.op) && next && JMP_OPS.has(next.op) && !isRelopSkip(code, i + 1)) {
        const takenPc = targetOf(next);
        const fallPc = i + 2;
        if (inBlock(block, takenPc) && inBlock(block, fallPc)) {
          const np = emit({ ...inst }, lines[i] || 0);
          mapOld(i, np);
          continue;
        }
        const takenBlk = blockAt(blocks, takenPc, code.length);
        const fallBlk = blockAt(blocks, fallPc, code.length);
        const line = lines[i] || 0;
        const np = emit({ ...inst }, line);
        mapOld(i, np);
        const jmpIdx = emit({ op: 'JMP', A: 0, B: 0, loc: inst.loc }, line);
        emitTransition(block, fallBlk, line, 0);
        newCode[jmpIdx].B = newCode.length - 1;
        emitTransition(block, takenBlk, line, 1);
        i++;
        fallThrough = false;
        continue;
      }
      if (isTforContJmp(code, i)) {
        const np = emit({ ...inst }, lines[i] || 0);
        mapOld(i, np);
        continue;
      }
      if (JMP_OPS.has(inst.op) && !isRelopSkip(code, i)) {
        const tPc = targetOf(inst);
        if (inBlock(block, tPc)) {
          const np = emit({ ...inst }, lines[i] || 0);
          mapOld(i, np);
          continue;
        }
        const tBlk = blockAt(blocks, tPc, code.length);
        mapOld(i, newCode.length);
        emitTransition(block, tBlk, lines[i] || 0, 0);
        if (i + 1 >= block.end) fallThrough = false;
        continue;
      }
      if (FORPREP_OPS.has(inst.op)) {
        const A = inst.A;
        const line = lines[i] || 0;
        const np = emit({ op: 'SUB', A, B: A, C: A + 2, loc: inst.loc }, line);
        mapOld(i, np);
        const loopBlk = blockAt(blocks, targetOf(inst), code.length);
        emitTransition(block, loopBlk, line, 0);
        fallThrough = false;
        proto._loweredFor = (proto._loweredFor || 0) + 1;
        stats.loweredFor = (stats.loweredFor || 0) + 1;
        continue;
      }
      if (FORLOOP_OPS.has(inst.op)) {
        const A = inst.A;
        const line = lines[i] || 0;
        const bodyBlk = blockAt(blocks, targetOf(inst), code.length);
        const exitBlk = blockAt(blocks, i + 1, code.length);
        const k0 = addConst(proto, 0);
        emit({ op: 'ADD', A, B: A, C: A + 2, loc: inst.loc }, line);
        mapOld(i, newCode.length - 1);
        // step > 0 ? idx <= limit : idx >= limit
        emit({ op: 'LT', A: 1, B: k0, C: A + 2, Bk: true, loc: inst.loc }, line);
        const jPos = emit({ op: 'JMP', A: 0, B: 0, loc: inst.loc }, line);
        emit({ op: 'LE', A: 1, B: A + 1, C: A, loc: inst.loc }, line);
        const jContN = emit({ op: 'JMP', A: 0, B: 0, loc: inst.loc }, line);
        emitTransition(block, exitBlk, line, 0);
        newCode[jPos].B = newCode.length - 1;
        emit({ op: 'LE', A: 1, B: A, C: A + 1, loc: inst.loc }, line);
        const jContP = emit({ op: 'JMP', A: 0, B: 0, loc: inst.loc }, line);
        emitTransition(block, exitBlk, line, 0);
        const contPc = newCode.length;
        newCode[jContN].B = contPc - 1;
        newCode[jContP].B = contPc - 1;
        emit({ op: 'MOVE', A: A + 3, B: A, C: 0, loc: inst.loc }, line);
        emitTransition(block, bodyBlk, line, 1);
        fallThrough = false;
        proto._loweredFor = (proto._loweredFor || 0) + 1;
        stats.loweredFor = (stats.loweredFor || 0) + 1;
        continue;
      }
      const np = emit({ ...inst }, lines[i] || 0);
      mapOld(i, np);
      if (RET_OPS.has(inst.op) && i + 1 >= block.end) fallThrough = false;
    }
    if (fallThrough) {
      const fallBlk = blockAt(blocks, block.end, code.length);
      emitTransition(block, fallBlk, 0, 0);
    }
  }

  for (const [oldPc, newPc] of oldToNew) {
    const orig = code[oldPc];
    if (!orig || !isJumpOp(orig.op)) continue;
    const t = targetOf(orig);
    if (!oldTarget.has(t) && t !== code.length) continue;
    const dest = oldTarget.has(t) ? oldTarget.get(t) : newCode.length;
    if (newCode[newPc] && isJumpOp(newCode[newPc].op)) newCode[newPc].B = dest - 1;
  }

  for (const { jmpIdx, blockId } of dispatchJumps) {
    newCode[jmpIdx].B = bodyStart[blockId] - 1;
    delete newCode[jmpIdx]._to;
    delete newCode[jmpIdx]._bid;
  }

  proto.code = newCode;
  proto.lineinfo = newLines;
  proto._guestCff = true;
  proto._cffBlocks = blocks.length;
  proto._cffDisp = !!useDisp;
  stats.flattened++;
  stats.blocks += blocks.length;
  if (useDisp) stats.disp++;

  for (const c of proto.protos || []) flattenProto(c, ctx, stats);
}

function guestCffPass(guest, seedOrRng, internInfo) {
  const rng = typeof seedOrRng === 'function'
    ? seedOrRng
    : mulberry32(((seedOrRng == null ? 1 : seedOrRng) >>> 0) ^ 0xCFF111);
  const stats = {
    flattened: 0, skipTiny: 0, skipFew: 0, skipSmall: 0, skipFor: 0,
    skipNoDisp: 0, forSuper: 0, forSplit: 0, genericSplit: 0, blocks: 0, disp: 0, fakeFor: 0, loweredFor: 0,
  };
  const ctx = {
    rng,
    usedMag: new Set(),
    edges: [],
    dispSlot: internInfo && internInfo.reservedMap && internInfo.reservedMap.dispatcher,
    dispatcher: internInfo && internInfo.dispatcherProto,
  };
  flattenProto(guest, ctx, stats);
  if (ctx.dispatcher && ctx.edges.length) {
    const toks = injectDispTokens(internInfo, ctx.edges);
    fillDispatcher(ctx.dispatcher, ctx.edges, rng, toks);
  }
  stats.edges = ctx.edges.length;
  return stats;
}

module.exports = { guestCffPass, buildBlocks, MAG_PRIME, MIN_CFF_INST, MIN_CFF_BLOCKS };
