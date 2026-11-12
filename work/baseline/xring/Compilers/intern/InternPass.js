'use strict';

/**
 * Intern table pass (Luraph-style).
 *
 * - GETI A B C: F[A] = F[B][C]      (B = Ireg, C = slot)
 * - PUTI A B C: F[B][C] = F[A]
 * - entry (params=1: charFunc): I={} -> filler(I, char) -> I[0]=guest
 *   -> guest(I, ...)
 * - filler (params=2: I, charFunc): 0 string consts. Names decoded via
 *   charFunc. CFF state is a magic token (not 0..n-1). Each byte is
 *   streamed from a 32-bit mix seeded by I[regionKey]; mix is PUTI'd
 *   into a hidden slot so block N needs block N-1. CFF blocks write
 *   2–3 slots and GETI+LEN a prior intern string into the mix; dummy
 *   states advance S without a user PUTI. Reconstructing I from CFG
 *   without executing fails.

 * - Guest: allowlisted stdlib GETGLOBAL -> value slot (snapshot). User
 *   globals stay live GETGLOBAL of an interned name (SETGLOBAL visible).
 */

const { mulberry32 } = require('../encode/Serializer');
const { isJumpOp } = require('../IR/Opcodes');
const { hashHandlerBodies } = require('./DispHash');

const RESERVED = ['dispatcher', 'regionKey', 'dispHash'];

// Snapshot these GETGLOBALs into I[slot] = env[name] at fill time.
// Everything else stays a live GETGLOBAL of an interned name string so
// `foo="bar"; print(foo)` and `function add()...` keep working.
const VALUE_INTERN = new Set([
  'print', 'warn', 'error', 'assert', 'type', 'typeof', 'tostring', 'tonumber',
  'select', 'unpack', 'pairs', 'ipairs', 'next', 'pcall', 'xpcall',
  'getfenv', 'setfenv', 'getmetatable', 'setmetatable',
  'rawget', 'rawset', 'rawequal', 'rawlen',
  'loadstring', 'load', 'loadfile', 'dofile', 'require',
  'collectgarbage', 'gcinfo', 'newproxy',
  'game', 'workspace', 'Workspace', 'script', 'plugin', 'shared', '_G', '_ENV',
  'math', 'string', 'table', 'bit32', 'bit', 'coroutine', 'os', 'debug', 'io', 'utf8', 'buffer', 'vector',
  'task', 'tick', 'wait', 'spawn', 'delay', 'time',
  'Instance', 'Vector3', 'Vector2', 'Vector2int16', 'Vector3int16',
  'CFrame', 'UDim', 'UDim2', 'Color3', 'BrickColor', 'Enum', 'Ray', 'Region3',
  'NumberSequence', 'ColorSequence', 'NumberRange', 'Rect', 'Faces', 'Axes',
  'TweenInfo', 'Random', 'DateTime',
  'HttpService', 'RunService', 'Players', 'ReplicatedStorage', 'ReplicatedFirst',
  'ServerStorage', 'ServerScriptService', 'StarterGui', 'StarterPack', 'StarterPlayer',
  'Lighting', 'SoundService', 'Chat', 'UserInputService', 'TweenService',
  'iscclosure', 'islclosure', 'newcclosure', 'checkcaller', 'clonefunction',
  'hookfunction', 'hookmetamethod', 'getrawmetatable', 'setrawmetatable',
  'getgenv', 'getrenv', 'getnamecallmethod', 'identifyexecutor',
  'dispatcher',
]);

const MAG_PRIME = 104729;
const MIX_MOD = 2147483647; // 2^31-1, fits u32 operand + LOADENC

const MIX_MUL = 33;
const MIX_SLOT_MUL = 31;


function mod(a, m) {
  return ((a % m) + m) % m;
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function constIsString(proto, idx) {
  if (idx == null || idx < 1) return false;
  const v = proto.constants[idx - 1];
  return typeof v === 'string';
}

function collectRoles(root) {
  const valueNames = new Set();
  const stringNeeds = new Set();
  const walk = (p) => {
    if (p.keepNative) return;
    for (const inst of p.code || []) {
      const isBK = !!(inst.Bk || inst.BK);
      const isCK = !!(inst.Ck || inst.CK);
      if (inst.op === 'GETGLOBAL' && isBK && constIsString(p, inst.B)) {
        const name = p.constants[inst.B - 1];
        if (VALUE_INTERN.has(name)) valueNames.add(name);
        else stringNeeds.add(name);
        continue;
      }
      if (inst.op === 'SETGLOBAL' && isBK && constIsString(p, inst.B)) {
        stringNeeds.add(p.constants[inst.B - 1]);
        continue;
      }
      if (inst.op === 'LOADK' && isBK && constIsString(p, inst.B)) {
        stringNeeds.add(p.constants[inst.B - 1]);
        continue;
      }
      if (isBK && constIsString(p, inst.B)) stringNeeds.add(p.constants[inst.B - 1]);
      if (isCK && constIsString(p, inst.C)) stringNeeds.add(p.constants[inst.C - 1]);
    }
    for (const c of p.protos || []) walk(c);
  };
  walk(root);
  return { valueNames, stringNeeds };
}

// Shift user regs +1 in the ORIGINAL root so R0 is free for the I param.
// Only true register operands move; flags/counts/targets/proto indices/
// upvalue indices stay. CLOSURE upvalue pseudos (upvalPseudo) handled:
// MOVE pseudo B (parent reg) shifts, GETUPVAL pseudo B (parent uv idx) not.
function shiftRootForIParam(root) {
  const shiftA = (op) => op !== 'JMP' && op !== 'EQ' && op !== 'LT' && op !== 'LE';
  const shiftB = (inst) => {
    if (inst.upvalPseudo) return inst.op === 'MOVE';
    switch (inst.op) {
      case 'MOVE':
      case 'LOADNIL':
      case 'GETTABLE':
      case 'SELF':
      case 'UNM':
      case 'NOT':
      case 'LEN':
      case 'CONCAT':
      case 'TESTSET':
        return true;
      case 'ADD':
      case 'SUB':
      case 'MUL':
      case 'DIV':
      case 'IDIV':
      case 'MOD':
      case 'POW':
        return !(inst.Bk || inst.BK);
      case 'EQ':
      case 'LT':
      case 'LE':
        return !(inst.Bk || inst.BK);
      case 'SETTABLE':
        return !(inst.Bk || inst.BK);
      case 'TEST':
      case 'CALL':
      case 'TAILCALL':
      case 'RETURN':
      case 'VARARG':
      case 'CLOSE':
        return inst.op === 'TEST' || inst.op === 'CLOSE';
      default:
        return false;
    }
  };
  const shiftC = (inst) => {
    switch (inst.op) {
      case 'GETTABLE':
      case 'SELF':
        return !(inst.Ck || inst.CK);
      case 'CONCAT':
        return true;
      case 'ADD':
      case 'SUB':
      case 'MUL':
      case 'DIV':
      case 'IDIV':
      case 'MOD':
      case 'POW':
      case 'SETTABLE':
        return !(inst.Ck || inst.CK);
      case 'EQ':
      case 'LT':
      case 'LE':
        return !(inst.Ck || inst.CK);
      default:
        return false;
    }
  };

  for (const inst of root.code || []) {
    if (inst.upvalPseudo) {
      if (inst.op === 'MOVE' && typeof inst.B === 'number') inst.B += 1;
      continue;
    }
    if (shiftA(inst.op) && typeof inst.A === 'number') inst.A += 1;
    if (shiftB(inst) && typeof inst.B === 'number') inst.B += 1;
    if (shiftC(inst) && typeof inst.C === 'number') inst.C += 1;
  }
  for (const l of root.locals || []) {
    if (typeof l.reg === 'number') l.reg += 1;
  }
  for (const child of root.protos || []) {
    for (const uv of child.upvalues || []) {
      if (uv.instack && typeof uv.idx === 'number') uv.idx += 1;
    }
  }
  root.params = (root.params || 0) + 1;
  root.maxstack = (root.maxstack || 2) + 1;
}

function allocTemps(proto) {
  let maxR = Math.max((proto.maxstack || 2) - 1, 0);
  for (const inst of proto.code || []) {
    const A = inst.A || 0;
    if (A > maxR) maxR = A;
    if (inst.op === 'SELF' && A + 1 > maxR) maxR = A + 1;
    const isBK = !!(inst.Bk || inst.BK);
    const isCK = !!(inst.Ck || inst.CK);
    if (!isBK && typeof inst.B === 'number' && inst.B > maxR) maxR = inst.B;
    if (!isCK && typeof inst.C === 'number' && inst.C > maxR) maxR = inst.C;
  }
  const base = Math.max(maxR + 1, proto.maxstack || 0);
  return { T1: base, T2: base + 1 };
}

function rewriteGuestProto(proto, valueMap, stringMap, iReg) {
  const code = proto.code || [];
  const lines = proto.lineinfo || [];
  const newCode = [];
  const newLines = [];
  const oldToNew = new Array(code.length + 1);
  let usesTemp = false;
  const { T1, T2 } = allocTemps(proto);
  const push = (inst, line) => {
    newCode.push(inst);
    newLines.push(line || 0);
  };

  for (let idx = 0; idx < code.length; idx++) {
    oldToNew[idx] = newCode.length;
    const inst = code[idx];
    const line = lines[idx] || 0;
    const op = inst.op;
    const A = inst.A || 0;
    const B = inst.B || 0;
    const C = inst.C || 0;
    const isBK = !!(inst.Bk || inst.BK);
    const isCK = !!(inst.Ck || inst.CK);

    if (op === 'LOADK' && isBK && constIsString(proto, B)) {
      const slot = stringMap[proto.constants[B - 1]];
      if (slot == null) {
        push({ ...inst }, line);
        continue;
      }
      push({ op: 'GETI', A, B: iReg, C: slot, Bk: false, Ck: false, loc: inst.loc }, line);
      continue;
    }
    if (op === 'GETGLOBAL' && isBK && constIsString(proto, B)) {
      const name = proto.constants[B - 1];
      const vslot = valueMap[name];
      if (vslot != null) {
        push({ op: 'GETI', A, B: iReg, C: vslot, Bk: false, Ck: false, loc: inst.loc }, line);
        continue;
      }
      const sslot = stringMap[name];
      if (sslot == null) {
        push({ ...inst }, line);
        continue;
      }
      push({ op: 'GETI', A, B: iReg, C: sslot, Bk: false, Ck: false, loc: inst.loc }, line);
      push({ op: 'GETGLOBAL', A, B: A, C: 0, Bk: false, Ck: false, loc: inst.loc }, line);
      continue;
    }

    let needB = false;
    let needC = false;
    let slotB = null;
    let slotC = null;
    if (isBK && constIsString(proto, B)) {
      const s = stringMap[proto.constants[B - 1]];
      if (s != null) {
        needB = true;
        slotB = s;
      }
    }
    if (isCK && constIsString(proto, C)) {
      const s = stringMap[proto.constants[C - 1]];
      if (s != null) {
        needC = true;
        slotC = s;
      }
    }
    if (!needB && !needC) {
      push({ ...inst }, line);
      continue;
    }
    usesTemp = true;
    if (needB && !needC) {
      push({ op: 'GETI', A: T1, B: iReg, C: slotB, Bk: false, Ck: false, loc: inst.loc }, line);
      const cp = { ...inst, B: T1, Bk: false };
      delete cp.BK;
      push(cp, line);
      continue;
    }
    if (!needB && needC) {
      push({ op: 'GETI', A: T1, B: iReg, C: slotC, Bk: false, Ck: false, loc: inst.loc }, line);
      const cp = { ...inst, C: T1, Ck: false };
      delete cp.CK;
      push(cp, line);
      continue;
    }
    push({ op: 'GETI', A: T1, B: iReg, C: slotB, Bk: false, Ck: false, loc: inst.loc }, line);
    push({ op: 'GETI', A: T2, B: iReg, C: slotC, Bk: false, Ck: false, loc: inst.loc }, line);
    const cp = { ...inst, B: T1, C: T2, Bk: false, Ck: false };
    delete cp.BK;
    delete cp.CK;
    push(cp, line);
  }
  oldToNew[code.length] = newCode.length;

  for (let oldIdx = 0; oldIdx < code.length; oldIdx++) {
    const orig = code[oldIdx];
    if (!isJumpOp(orig.op)) continue;
    const newIdx = oldToNew[oldIdx];
    const oldTarget = (orig.B || 0) + 1;
    const clamped = Math.max(0, Math.min(oldTarget, code.length));
    newCode[newIdx].B = oldToNew[clamped] - 1;
  }

  proto.code = newCode;
  proto.lineinfo = newLines;
  if (usesTemp) proto.maxstack = Math.max(proto.maxstack || 0, T1 + 2);
  return { usesTemp };
}

function toBytes(s) {
  return [...Buffer.from(String(s), 'utf8')];
}

function makeDecoyProto() {
  return {
    name: '',
    _kind: 'decoy',
    params: 0,
    isVararg: false,
    maxstack: 2,
    locals: [],
    upvalues: [],
    constants: [],
    code: [{ op: 'RETURN', A: 0, B: 1, loc: null }],
    protos: [],
    lineinfo: [0],
  };
}

function internProto(root, seed) {
  const rng = mulberry32((seed == null ? 1 : seed) >>> 0);
  const { valueNames, stringNeeds } = collectRoles(root);

  const masterKey = 0x20000 + Math.floor(rng() * 0x3fff0000);
  const dispHash = hashHandlerBodies();
  const valueList = [...new Set([...valueNames, ...RESERVED])].sort();
  const stringList = [...stringNeeds].sort();
  const total = 1 + valueList.length + stringList.length;
  const avail = [];
  for (let s = 1; s < total; s++) avail.push(s);
  shuffleInPlace(avail, rng);
  const valueSlotByName = Object.create(null);
  const stringSlotByString = Object.create(null);
  const reservedMap = Object.create(null);
  for (let i = 0; i < valueList.length; i++) {
    valueSlotByName[valueList[i]] = avail[i];
    if (RESERVED.includes(valueList[i])) reservedMap[valueList[i]] = avail[i];
  }
  for (let i = 0; i < stringList.length; i++) {
    stringSlotByString[stringList[i]] = avail[valueList.length + i];
  }
  const slotByString = stringSlotByString;

  shiftRootForIParam(root);
  const guest = root;
  guest.name = '';
  guest._kind = 'guest';

  const iRegOf = new Map();
  iRegOf.set(guest, 0);
  guest._iReg = 0;
  const usesIntern = (p) => {
    for (const inst of p.code || []) {
      const isBK = !!(inst.Bk || inst.BK);
      const isCK = !!(inst.Ck || inst.CK);
      if ((inst.op === 'LOADK' || inst.op === 'GETGLOBAL' || inst.op === 'SETGLOBAL') && isBK && constIsString(p, inst.B)) return true;
      if (isBK && constIsString(p, inst.B)) return true;
      if (isCK && constIsString(p, inst.C)) return true;
    }
    return false;
  };
  const needsI = (p) => {
    if (p.keepNative) return false;
    if (usesIntern(p)) return true;
    for (const c of p.protos || []) if (needsI(c)) return true;
    return false;
  };
  const provisionI = (parent) => {
    for (const child of parent.protos || []) {
      if (child.keepNative) {
        iRegOf.set(child, null);
        continue;
      }
      // Always thread I (Luraph: nested guest sees intern). Tiny nested
      // still skip CFF; they just capture $I so a later flatten can call
      // I[dispatcher] instead of falling back to on-guest MBA.
      if (parent !== guest && iRegOf.get(parent) == null) {
        throw new Error('intern: parent of ' + child.name + ' holds no I');
      }
      const holder = parent === guest ? 0 : iRegOf.get(parent);
      let uvIdx = (child.upvalues || []).findIndex((u) => u.name === '$I');
      if (uvIdx < 0) {
        child.upvalues = child.upvalues || [];
        child.upvalues.push({ name: '$I', instack: 1, idx: holder });
        uvIdx = child.upvalues.length - 1;
        const sites = [];
        for (let i = 0; i < parent.code.length; i++) {
          const inst = parent.code[i];
          if (inst.op === 'CLOSURE' && (parent.protos || [])[inst.C - 1] === child) sites.push(i);
        }
        for (let s = sites.length - 1; s >= 0; s--) {
          const i = sites[s];
          parent.code[i].B = (parent.code[i].B || 0) + 1;
          const mv = { op: 'MOVE', A: 0, B: holder, loc: parent.code[i].loc, upvalPseudo: true };
          parent.code.splice(i + 1 + uvIdx, 0, mv);
          parent.lineinfo.splice(i + 1 + uvIdx, 0, parent.lineinfo[i] || 0);
          const at = i + 1 + uvIdx;
          for (const j of parent.code) {
            if (!isJumpOp(j.op)) continue;
            const tgt = (j.B || 0) + 1;
            if (tgt > at) j.B += 1;
          }
        }
      }
      if (iRegOf.get(child) == null) {
        const { T1 } = allocTemps(child);
        const rI = T1;
        child.code.unshift({ op: 'GETUPVAL', A: rI, B: uvIdx, loc: null });
        child.lineinfo.unshift(0);
        for (const j of child.code) {
          if (!isJumpOp(j.op)) continue;
          j.B += 1;
        }
        child.maxstack = Math.max(child.maxstack || 0, rI + 1);
        iRegOf.set(child, rI);
        child._iReg = rI;
        child._regionPrefixEnd = 1;
      }
      provisionI(child);
    }
  };
  provisionI(guest);

  const walkGuest = (p) => {
    if (p.keepNative) return;
    const iReg = iRegOf.get(p);
    if (iReg != null) {
      p._iReg = iReg;
      rewriteGuestProto(p, valueSlotByName, stringSlotByString, iReg);
    }
    for (const c of p.protos || []) walkGuest(c);
  };
  walkGuest(guest);
  const stripWalk = (p) => {
    if (p.keepNative) return;
    const referenced = new Set();
    for (const inst of p.code || []) {
      if ((inst.Bk || inst.BK) && typeof inst.B === 'number') referenced.add(inst.B);
      if ((inst.Ck || inst.CK) && typeof inst.C === 'number') referenced.add(inst.C);
    }
    const oldConsts = p.constants || [];
    const kept = [];
    const remap = Object.create(null);
    for (let i = 0; i < oldConsts.length; i++) {
      const v = oldConsts[i];
      const oldIdx = i + 1;
      if (typeof v === 'string' && !referenced.has(oldIdx)) continue;
      remap[oldIdx] = kept.length + 1;
      kept.push(v);
    }
    for (const inst of p.code || []) {
      if ((inst.Bk || inst.BK) && typeof inst.B === 'number' && remap[inst.B] != null) inst.B = remap[inst.B];
      if ((inst.Ck || inst.CK) && typeof inst.C === 'number' && remap[inst.C] != null) inst.C = remap[inst.C];
    }
    p.constants = kept;
    for (const c of p.protos || []) stripWalk(c);
  };
  stripWalk(guest);

  const fillerConsts = [];
  const fillerKmap = new Map();
  const cKey = (v) => (v === null || v === undefined ? 'nil' : typeof v + ':' + String(v));
  const addConst = (v) => {
    const k = cKey(v);
    if (fillerKmap.has(k)) return fillerKmap.get(k);
    fillerConsts.push(v === undefined ? null : v);
    const idx = fillerConsts.length;
    fillerKmap.set(k, idx);
    return idx;
  };

  const FI = 0;
  const FC = 1;
  const FB = 2;
  const longest = stringList.reduce((m, s) => Math.max(m, toBytes(s).length), 0);
  const allNames = [...new Set([...valueList, ...stringList])].sort();
  const longestName = allNames.reduce((m, s) => Math.max(m, toBytes(s).length), 0);
  const Lmax = Math.max(longest, longestName);
  const RK = 3 + Lmax;
  const Rstate = RK + 1;
  const Rmix = RK + 2;
  const R_one = Rmix + 1;
  const R_256 = Rmix + 2;
  const R_prime = Rmix + 3;
  const R_33 = Rmix + 4;
  const R_31 = Rmix + 5;
  const R_2_32 = Rmix + 6;
  const R_rk = Rmix + 7;
  const R_Q = Rmix + 8;
  const R_imm = Rmix + 9;
  const R_tmp = Rmix + 10;
  const mixSlot = total;

  const decoys = [];
  const nDecoy = stringList.length === 0
    ? 0
    : Math.min(3, Math.max(1, Math.ceil(stringList.length * 0.5)));
  for (let i = 0; i < nDecoy; i++) decoys.push(makeDecoyProto());
  const collideKeys = stringList.slice();
  shuffleInPlace(collideKeys, rng);
  const collideSet = new Set(collideKeys.slice(0, nDecoy));
  const collisions = [];

  const puts = [];
  for (const name of valueList) {
    if (name === 'dispatcher') puts.push({ kind: 'closure', key: name, slot: valueSlotByName[name] });
    else if (name === 'regionKey' || name === 'dispHash') continue; // plaintext prefix, not CFF
    else puts.push({ kind: 'value', key: name, slot: valueSlotByName[name] });
  }
  let decoyN = 0;
  for (const s of stringList) {
    const put = { kind: 'string', key: s, slot: stringSlotByString[s] };
    if (collideSet.has(s) && decoys.length > 0) {
      put.decoyIdx = 2 + (decoyN % decoys.length);
      collisions.push({ slot: put.slot, string: s, decoyIdx: put.decoyIdx });
      decoyN++;
    }
    puts.push(put);
  }
  shuffleInPlace(puts, rng);

  const n = puts.length;
  const k256 = addConst(256);
  const k1 = addConst(1);
  const kPrime = addConst(MAG_PRIME);
  const k33 = addConst(MIX_MUL);
  const k31 = addConst(MIX_SLOT_MUL);
  const k232 = addConst(MIX_MOD);

  const order = shuffleInPlace(puts.map((_, i) => i), rng);

  const chunks = [];
  for (let i = 0; i < order.length; ) {
    const put = puts[order[i]];
    if (put.kind === 'closure') {
      chunks.push({ puts: [put], dummy: false });
      i++;
      continue;
    }
    const want = 2 + (rng() < 0.55 ? 1 : 0);
    const group = [put];
    i++;
    while (group.length < want && i < order.length) {
      const nxt = puts[order[i]];
      if (nxt.kind === 'closure') break;
      group.push(nxt);
      i++;
    }
    chunks.push({ puts: group, dummy: false });
  }
  if (chunks.length >= 2) {
    let afterString = -1;
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].puts.some((p) => p.kind === 'string')) {
        afterString = i;
        break;
      }
    }
    const lo = afterString >= 0 ? afterString + 1 : 1;
    const at = lo + Math.floor(rng() * Math.max(1, chunks.length - lo + 1));
    chunks.splice(Math.min(at, chunks.length), 0, { puts: [], dummy: true });
  } else if (puts.length >= 2) {
    chunks.push({ puts: [], dummy: true });
  }

  let Q = 0;
  let magic0 = 0;
  let magicDone = 0;
  let coupled = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    Q = 3 + 2 * Math.floor(rng() * 24);
    magic0 = 2000 + Math.floor(rng() * (MAG_PRIME - 4000));
    if (magic0 <= puts.length + 32) continue;
    let mix = mod(masterKey, MIX_MOD);
    let s = magic0;
    const used = new Set([magic0]);
    let lastStringSlot = null;
    let lastStringLen = 0;
    let good = true;
    for (const chunk of chunks) {
      chunk.magic = s;
      chunk.lastStringSlot = lastStringSlot;
      chunk.lastStringLen = lastStringLen;
      for (const put of chunk.puts) {
        const bytes = put.kind === 'closure' || put.kind === 'number' ? [] : toBytes(put.key);
        put.enc = [];
        let running = mix;
        for (let bi = 0; bi < bytes.length; bi++) {
          running = mod(running * MIX_MUL + s + bi, MIX_MOD);
          const ki = running % 256;
          put.enc.push((bytes[bi] + ki) % 256);
        }
        mix = mod(running * MIX_SLOT_MUL + put.slot, MIX_MOD);
        if (bytes.length > 0) {
          mix = mod(mix + bytes.length, MIX_MOD);
          if (put.kind === 'string') {
            lastStringSlot = put.slot;
            lastStringLen = bytes.length;
          }
        }
        put.mixAfter = mix;
      }
      if (chunk.dummy && lastStringSlot != null) {
        mix = mod(mix + lastStringLen, MIX_MOD);
      }
      s = mod(s * Q + mix, MAG_PRIME);
      if (s <= puts.length + 32 || used.has(s)) {
        good = false;
        break;
      }
      used.add(s);
      chunk.nextMagic = s;
    }
    if (!good) continue;
    magicDone = s;
    coupled = true;
    break;
  }
  if (!coupled) throw new Error('intern: mix-coupled magics exhausted');

  const kQ = addConst(Q);
  const kMagic0 = addConst(magic0);
  const kMagicDone = addConst(magicDone);
  for (const chunk of chunks) chunk.kMagic = addConst(chunk.magic);
  for (const put of puts) {
    put.kSlot = addConst(put.slot);
    if (put.kind === 'number') put.kNum = addConst(put.key);
  }

  const emitStreamByte = (i, enc, out) => {
    const kEnc = addConst(enc);
    const Ri = 3 + i;
    const ki = addConst(i);
    out.push({ op: 'LOADK', A: RK, B: k33, C: 0, Bk: true, loc: null });
    out.push({ op: 'MUL', A: RK, B: Rmix, C: RK, loc: null });
    out.push({ op: 'ADD', A: RK, B: RK, C: Rstate, loc: null });
    out.push({ op: 'LOADK', A: R_imm, B: ki, C: 0, Bk: true, loc: null });
    out.push({ op: 'ADD', A: RK, B: RK, C: R_imm, loc: null });
    out.push({ op: 'MOD', A: Rmix, B: RK, C: R_2_32, loc: null });
    out.push({ op: 'MOD', A: RK, B: Rmix, C: R_256, loc: null });
    out.push({ op: 'LOADK', A: Ri, B: kEnc, C: 0, Bk: true, loc: null });
    out.push({ op: 'SUB', A: Ri, B: Ri, C: RK, loc: null });
    out.push({ op: 'ADD', A: Ri, B: Ri, C: R_256, loc: null });
    out.push({ op: 'MOD', A: Ri, B: Ri, C: R_256, loc: null });
  };

  const emitMixSlot = (put, out) => {
    out.push({ op: 'LOADK', A: R_imm, B: put.kSlot, C: 0, Bk: true, loc: null });
    out.push({ op: 'LOADK', A: RK, B: k31, C: 0, Bk: true, loc: null });
    out.push({ op: 'MUL', A: RK, B: Rmix, C: RK, loc: null });
    out.push({ op: 'ADD', A: RK, B: RK, C: R_imm, loc: null });
    out.push({ op: 'MOD', A: Rmix, B: RK, C: R_2_32, loc: null });
    out.push({ op: 'PUTI', A: Rmix, B: FI, C: mixSlot, Bk: false, Ck: false, loc: null });
  };

  const emitLenMix = (src, out) => {
    out.push({ op: 'LEN', A: R_tmp, B: src, loc: null });
    out.push({ op: 'ADD', A: Rmix, B: Rmix, C: R_tmp, loc: null });
    out.push({ op: 'MOD', A: Rmix, B: Rmix, C: R_2_32, loc: null });
  };

  const emitAdvanceS = (out) => {
    out.push({ op: 'MUL', A: RK, B: Rstate, C: R_Q, loc: null });
    out.push({ op: 'ADD', A: RK, B: RK, C: Rmix, loc: null });
    out.push({ op: 'MOD', A: Rstate, B: RK, C: R_prime, loc: null });
  };

  const emitDecodeIntoR2 = (put, out) => {
    out.push({ op: 'MOVE', A: FB, B: FC, C: 0, loc: null });
    for (let i = 0; i < put.enc.length; i++) emitStreamByte(i, put.enc[i], out);
    emitMixSlot(put, out);
    if (put.enc.length > 0) {
      out.push({ op: 'CALL', A: FB, B: put.enc.length + 1, C: 2, loc: null });
      emitLenMix(FB, out);
    }
  };

  const emitOnePut = (put, seq) => {
    if (put.kind === 'closure') {
      seq.push({ op: 'CLOSURE', A: FB, B: 0, C: 1, loc: null });
      seq.push({ op: 'PUTI', A: FB, B: FI, C: put.slot, Bk: false, Ck: false, loc: null });
      emitMixSlot(put, seq);
      return;
    }
    if (put.kind === 'number') {
      seq.push({ op: 'LOADK', A: FB, B: put.kNum, C: 0, Bk: true, loc: null });
      seq.push({ op: 'PUTI', A: FB, B: FI, C: put.slot, Bk: false, Ck: false, loc: null });
      emitMixSlot(put, seq);
      return;
    }
    if (put.decoyIdx) {
      seq.push({ op: 'CLOSURE', A: FB, B: 0, C: put.decoyIdx, loc: null });
      seq.push({ op: 'PUTI', A: FB, B: FI, C: put.slot, Bk: false, Ck: false, loc: null });
    }
    emitDecodeIntoR2(put, seq);
    if (put.kind === 'value') {
      seq.push({ op: 'GETGLOBAL', A: FB, B: FB, C: 0, Bk: false, Ck: false, loc: null });
    }
    seq.push({ op: 'PUTI', A: FB, B: FI, C: put.slot, Bk: false, Ck: false, loc: null });
  };

  const blocks = chunks.map((chunk) => {
    const seq = [];
    if (chunk.dummy) {
      // Live Rmix already matches sim (emitLenMix after last PUTI). Reloading
      // mixSlot would undo that LEN and desync S' → CFF spin.
      if (chunk.lastStringSlot != null) {
        seq.push({
          op: 'GETI', A: R_tmp, B: FI, C: chunk.lastStringSlot,
          Bk: false, Ck: false, loc: null,
        });
        emitLenMix(R_tmp, seq);
      }
      emitAdvanceS(seq);
      return seq;
    }
    for (const put of chunk.puts) emitOnePut(put, seq);
    emitAdvanceS(seq);
    return seq;
  });

  const fillerCode = [];
  const fillerLines = [];
  const emitF = (inst) => {
    fillerCode.push(inst);
    fillerLines.push(0);
  };
  const patchSpots = [];
  const labels = Object.create(null);
  const mark = (name) => {
    labels[name] = fillerCode.length;
  };
  const jmpTo = (name) => {
    patchSpots.push({ pos: fillerCode.length, getTarget: () => labels[name] });
    emitF({ op: 'JMP', A: 0, B: 0, loc: null });
  };

  emitF({ op: 'LOADK', A: FB, B: addConst(masterKey), C: 0, Bk: true, loc: null });
  emitF({ op: 'PUTI', A: FB, B: FI, C: reservedMap.regionKey, Bk: false, Ck: false, loc: null });
  emitF({ op: 'LOADK', A: FB, B: addConst(dispHash), C: 0, Bk: true, loc: null });
  emitF({ op: 'PUTI', A: FB, B: FI, C: reservedMap.dispHash, Bk: false, Ck: false, loc: null });
  const regionPrefixEnd = fillerCode.length;
  emitF({ op: 'LOADK', A: R_one, B: k1, C: 0, Bk: true, loc: null });
  emitF({ op: 'LOADK', A: R_256, B: k256, C: 0, Bk: true, loc: null });
  emitF({ op: 'LOADK', A: R_prime, B: kPrime, C: 0, Bk: true, loc: null });
  emitF({ op: 'LOADK', A: R_33, B: k33, C: 0, Bk: true, loc: null });
  emitF({ op: 'LOADK', A: R_31, B: k31, C: 0, Bk: true, loc: null });
  emitF({ op: 'LOADK', A: R_2_32, B: k232, C: 0, Bk: true, loc: null });
  emitF({ op: 'LOADK', A: R_Q, B: kQ, C: 0, Bk: true, loc: null });
  emitF({ op: 'GETI', A: R_rk, B: FI, C: reservedMap.regionKey, Bk: false, Ck: false, loc: null });
  emitF({ op: 'MOVE', A: Rmix, B: R_rk, C: 0, loc: null });
  emitF({ op: 'LOADK', A: Rstate, B: kMagic0, C: 0, Bk: true, loc: null });

  mark('dispatch');
  const dispNodes = chunks
    .map((c, i) => ({ magic: c.magic, k: c.kMagic, label: 'block' + i }))
    .concat([{ magic: magicDone, k: kMagicDone, label: 'done' }])
    .sort((a, b) => a.magic - b.magic);
  const walkFillerDisp = (arr) => {
    if (arr.length === 0) {
      jmpTo('dispatch');
      return;
    }
    if (arr.length === 1) {
      emitF({ op: 'LOADK', A: RK, B: arr[0].k, C: 0, Bk: true, loc: null });
      emitF({ op: 'EQ', A: 1, B: Rstate, C: RK, loc: null });
      jmpTo(arr[0].label);
      jmpTo('dispatch');
      return;
    }
    const mid = Math.floor(arr.length / 2);
    emitF({ op: 'LOADK', A: RK, B: arr[mid].k, C: 0, Bk: true, loc: null });
    emitF({ op: 'LT', A: 1, B: Rstate, C: RK, loc: null });
    const jmpPos = fillerCode.length;
    emitF({ op: 'JMP', A: 0, B: 0, loc: null });
    walkFillerDisp(arr.slice(mid));
    fillerCode[jmpPos].B = fillerCode.length - 1;
    walkFillerDisp(arr.slice(0, mid));
  };
  walkFillerDisp(dispNodes);
  blocks.forEach((seq, bi) => {
    mark('block' + bi);
    for (const inst of seq) emitF(inst);
    jmpTo('dispatch');
  });
  mark('done');
  emitF({ op: 'RETURN', A: 0, B: 1, C: 0, loc: null });

  for (const { pos, getTarget } of patchSpots) {
    fillerCode[pos].B = getTarget() - 1;
  }

  const dispatcherProto = {
    name: '',
    _kind: 'dispatch',
    params: 3,
    isVararg: false,
    maxstack: 4,
    locals: [],
    upvalues: [],
    constants: [],
    code: [{ op: 'RETURN', A: 1, B: 2, loc: null }],
    protos: [],
    lineinfo: [0],
  };

  const filler = {
    name: '',
    _kind: 'fill',
    params: 2,
    isVararg: false,
    maxstack: R_tmp + 1,
    locals: [],
    upvalues: [],
    constants: fillerConsts,
    code: fillerCode,
    protos: [dispatcherProto].concat(decoys),
    lineinfo: fillerLines,
    magics: chunks.map((c) => c.magic),
    magicDone,
    mixSlot,
    _coupled: true,
    _binDispatch: true,
    _multiPut: true,
    _chunkSizes: chunks.map((c) => c.puts.length),
    _iReg: 0,
    _regionPrefixEnd: regionPrefixEnd,
  };

  const E_C = 0;
  const E_I = 1;
  const E_F = 2;
  const E_A0 = 3;
  const E_A1 = 4;
  const entry = {
    name: '',
    _kind: 'entry',
    params: 1,
    isVararg: true,
    maxstack: 8,
    locals: [],
    upvalues: [],
    constants: [],
    code: [
      { op: 'NEWTABLE', A: E_I, B: 0, C: 0, loc: null },
      { op: 'CLOSURE', A: E_F, B: 0, C: 1, loc: null },
      { op: 'MOVE', A: E_A0, B: E_I, C: 0, loc: null },
      { op: 'MOVE', A: E_A1, B: E_C, C: 0, loc: null },
      { op: 'CALL', A: E_F, B: 3, C: 1, loc: null },
      { op: 'CLOSURE', A: E_F, B: 0, C: 2, loc: null },
      { op: 'PUTI', A: E_F, B: E_I, C: 0, loc: null },
      { op: 'MOVE', A: E_A0, B: E_I, C: 0, loc: null },
      { op: 'VARARG', A: E_A1, B: 0, C: 0, loc: null },
      { op: 'TAILCALL', A: E_F, B: 0, C: 0, loc: null },
    ],
    protos: [filler, guest],
    lineinfo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };

  return {
    root: entry,
    guest,
    filler,
    valueSlotByName,
    stringSlotByString,
    slotByString,
    reservedMap,
    dispatcherProto,
    regionMasterKey: masterKey,
    dispHash,
    mixSlot,
    total,
    valueList,
    stringList,
    collisions,
    decoys,
  };
}

module.exports = { internProto, collectRoles, RESERVED, VALUE_INTERN, MAG_PRIME, MIX_MOD };
