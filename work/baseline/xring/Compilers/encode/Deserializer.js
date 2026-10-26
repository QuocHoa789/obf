'use strict';

/**
 * JS mirror of VirtualMachine chunks 26+27. Turns a serializer blob back into
 * the IronBrew proto tables (1-based PC, baked constants, optional seal).
 */

const { CANONICAL, JUMP_ABS, JUMP_PRE, JUMP_REL } = require('../IR/Opcodes');
const { MODE } = require('./Serializer');

class ByteReader {
  constructor(buf) {
    this.buf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    this.i = 0;
  }
  eof() {
    return this.i >= this.buf.length;
  }
  remain() {
    return this.buf.length - this.i;
  }
  u8() {
    if (this.i >= this.buf.length) throw new Error('blob EOF at byte ' + this.i);
    return this.buf[this.i++];
  }
  varint() {
    let value = 0;
    let mul = 1;
    for (;;) {
      const bv = this.u8();
      value += (bv > 127 ? bv - 128 : bv) * mul;
      mul *= 128;
      if (bv < 128) return value;
    }
  }
  u32() {
    const v = this.buf.readUInt32LE(this.i);
    this.i += 4;
    return v;
  }
  f64() {
    const v = this.buf.readDoubleLE(this.i);
    this.i += 8;
    return v;
  }
  i64() {
    const lo = this.u32();
    let hi = this.u32();
    if (hi >= 2147483648) hi -= 4294967296;
    return hi * 4294967296 + lo;
  }
}

function bxor(a, b) {
  return ((a | 0) ^ (b | 0)) >>> 0;
}
function band(a, b) {
  return ((a | 0) & (b | 0)) >>> 0;
}

function sealkey(pc, mul, add) {
  return (pc * mul + add) % 64;
}

function xorNum(v, k) {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) return v;
  let x = bxor(v, k);
  if (x >= 0x80000000) x -= 0x100000000;
  return x;
}

function regionKey(seed, pc, opcode, len) {
  let k = bxor(bxor(seed >>> 0, pc), opcode);
  if (len != null) k = bxor(k, len >>> 0);
  k = bxor(k, Math.imul(pc + 1, 16777619));
  return k >>> 0;
}

function mixDispHash(k, dispHash) {
  return bxor(k >>> 0, (dispHash || 0) >>> 0);
}

function xorRange(P, start, len, kk) {
  const nSlots = P.nSlots || 0;
  if (typeof len !== 'number' || len < 1) return;
  const last = Math.min(start + len - 1, nSlots);
  if (start < 1 || last < start) return;
  let u = 0;
  for (let j = start; j <= last; j++) {
    u++;
    const Z7 = band(bxor(kk, u), 127);
    const Zf = bxor(bxor(kk, Math.imul(u, 16777619)), j);
    P.opcodes[j] = bxor(P.opcodes[j], Z7);
    P.regA[j] = xorNum(P.regA[j], Zf);
    P.regB[j] = xorNum(P.regB[j], Zf);
    P.regC[j] = xorNum(P.regC[j], Zf);
  }
}

function regionDecWire(settings) {
  const idMap = settings && settings.idMap;
  const id = CANONICAL.REGION_DEC;
  return idMap && idMap[id] != null ? idMap[id] : id;
}

function collectRegionSites(P, settings) {
  const decWire = regionDecWire(settings);
  const sites = [];
  const nSlots = P.nSlots || 0;
  const master = settings && settings.regionMasterKey;
  for (let pc = 1; pc <= nSlots; pc++) {
    if (P.opcodes[pc] !== decWire) continue;
    const ln = P.regB[pc];
    const a = P.regA[pc];
    const c = P.regC[pc];
    if (typeof ln !== 'number' || ln < 1) continue;
    if (pc + ln > nSlots) continue;
    const internMode = typeof a === 'number' && a < 255;
    const seed = internMode && master != null ? master : c;
    if (typeof seed !== 'number') continue;
    sites.push({ pc, ln, seed, op: P.opcodes[pc], internMode: !!internMode });
  }
  return sites;
}

function encryptProtoRegions(P, settings) {
  // Snapshot DEC sites BEFORE mutating bodies. XOR can turn a later opcode
  // into REGION_DEC with a huge B (LOADENC ciphertext) → xorRange OOM.
  const sites = collectRegionSites(P, settings);
  const extra = (settings && settings.dispHash) || 0;
  for (const s of sites) {
    xorRange(P, s.pc + 1, s.ln, mixDispHash(regionKey(s.seed, s.pc, s.op, s.ln), extra));
  }
}

function markRegionPcs(opcodes, regB, nSlots, decWire, encWire) {
  const inRgn = Object.create(null);
  for (let pc = 1; pc <= nSlots; pc++) {
    if (opcodes[pc] !== decWire) continue;
    const ln = regB[pc];
    if (typeof ln !== 'number' || ln < 1) continue;
    inRgn[pc] = true;
    for (let j = pc + 1; j <= pc + ln; j++) inRgn[j] = true;
    const encPc = pc + 1 + ln;
    if (encWire != null && opcodes[encPc] === encWire) inRgn[encPc] = true;
  }
  return inRgn;
}

function reverseIdMap(idMap) {
  const rev = Object.create(null);
  if (!idMap) {
    for (const [name, id] of Object.entries(CANONICAL)) rev[id] = name;
    return rev;
  }
  for (const [name, canon] of Object.entries(CANONICAL)) {
    const wire = idMap[canon] != null ? idMap[canon] : canon;
    rev[wire] = name;
  }
  return rev;
}

function deserialize(blob, settings) {
  settings = settings || {};
  const r = new ByteReader(blob);
  const slotBias = settings.slotBias != null ? settings.slotBias : 17;
  const constBias = settings.constBias != null ? settings.constBias : 23;
  const protoBias = settings.protoBias != null ? settings.protoBias : 11;
  const strOffset = settings.strOffset != null ? settings.strOffset : 41;
  const typeFloat = settings.typeFloat != null ? settings.typeFloat : 3;
  const typeNil = settings.typeNil != null ? settings.typeNil : 7;
  const typeString = settings.typeString != null ? settings.typeString : 5;
  const sealBit = settings.sealBit != null ? settings.sealBit : 256;
  const sealMul = settings.sealMul != null ? settings.sealMul : 3;
  const sealAdd = settings.sealAdd != null ? settings.sealAdd : 1;
  const idMap = settings.idMap || null;
  const rev = reverseIdMap(idMap);

  const nConsts = r.varint() - constBias;
  const constcache = [];
  r.u8(); // constcached flag
  for (let I = 1; I <= nConsts; I++) {
    const Type = r.u8();
    if (Type === typeFloat) constcache[I] = r.f64();
    else if (Type === typeNil) constcache[I] = null;
    else if (Type < typeFloat) constcache[I] = r.u8() === 1;
    else if (Type === typeString) {
      const len = r.varint();
      const bytes = Buffer.alloc(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = (r.u8() - strOffset + 256) % 256;
      }
      constcache[I] = bytes.toString('utf8');
    } else {
      constcache[I] = r.i64();
    }
  }

  const nProtos = r.varint() - protoBias;
  const scratch = [];
  const protos = [];

  function readProto() {
    const nInsts = r.varint();
    for (let i = 0; i < nInsts; i++) r.varint();
    const nSlots = r.varint() - slotBias;

    const opcodes = [];
    const regB = [];
    const regA = [];
    const regC = [];
    const protosAt = [];
    const aIsK = [];
    const bIsK = [];
    const cIsK = [];
    const closurePCs = Object.create(null);

    for (let I = 1; I <= nSlots; I++) {
      const RawC = r.varint();
      const CMode = RawC % 8;
      const RawA = r.varint();
      const AMode = RawA % 8;
      const RawB = r.varint();
      const Instruction_Enum = r.varint();
      let A = (RawA - AMode) / 8;
      let B = (RawB - (RawB % 8)) / 8;
      let C = (RawC - CMode) / 8;
      const bMode = RawB % 8;

      opcodes[I] = Instruction_Enum;
      regA[I] = A;
      regB[I] = B;
      regC[I] = C;

      if (bMode === MODE.CONST) {
        bIsK[I] = true;
        regB[I] = constcache[B];
      } else if (bMode === MODE.REG) {
        regB[I] = B;
      } else if (bMode === MODE.FWD) {
        regB[I] = I + B;
      } else if (bMode === MODE.BWD) {
        regB[I] = I - B;
      } else if (bMode === MODE.REL_FWD) {
        regB[I] = B;
      } else if (bMode === MODE.REL_BWD) {
        regB[I] = -B;
      }

      if (CMode === MODE.CONST) {
        cIsK[I] = true;
        regC[I] = constcache[C];
      } else if (CMode === MODE.REG) {
        regC[I] = C;
      } else if (CMode === MODE.FWD) {
        regC[I] = I + C;
      } else if (CMode === MODE.BWD) {
        regC[I] = I - C;
      } else if (CMode === MODE.CLOSURE) {
        const off = scratch.length;
        scratch[off] = protosAt;
        scratch[off + 1] = I;
        scratch[off + 2] = C;
        closurePCs[I] = true;
      }

      if (AMode === MODE.CONST) {
        aIsK[I] = true;
        regA[I] = constcache[A];
      } else if (AMode === MODE.REG) {
        regA[I] = A;
      } else if (AMode === MODE.FWD) {
        regA[I] = I + A;
      } else if (AMode === MODE.BWD) {
        regA[I] = I - A;
      }
    }

    const jumpAbsWires = new Set();
    const jumpRelWires = new Set();
    const absIds = JUMP_PRE.concat(JUMP_ABS).map((n) => CANONICAL[n]);
    const relIds = JUMP_REL.map((n) => CANONICAL[n]);
    for (const id of absIds) jumpAbsWires.add(idMap && idMap[id] != null ? idMap[id] : id);
    for (const id of relIds) jumpRelWires.add(idMap && idMap[id] != null ? idMap[id] : id);
    const decWire = idMap && idMap[CANONICAL.REGION_DEC] != null ? idMap[CANONICAL.REGION_DEC] : CANONICAL.REGION_DEC;
    const encWire = idMap && idMap[CANONICAL.REGION_ENC] != null ? idMap[CANONICAL.REGION_ENC] : CANONICAL.REGION_ENC;
    const inRgn = markRegionPcs(opcodes, regB, nSlots, decWire, encWire);
    const inLoop = Object.create(null);
    for (let pc = 1; pc <= nSlots; pc++) {
      let tgt = null;
      if (jumpAbsWires.has(opcodes[pc])) tgt = regB[pc];
      else if (jumpRelWires.has(opcodes[pc])) tgt = pc + (regB[pc] || 0);
      if (typeof tgt === 'number' && tgt >= 1 && tgt < pc) {
        for (let j = tgt; j <= pc; j++) inLoop[j] = true;
      }
    }

    let sealCount = 0;
    let maxSeal = Math.floor(nSlots * 0.15);
    if (maxSeal < 1) maxSeal = 1;
    let skipNext = 0;
    for (let pc = 1; pc <= nSlots; pc++) {
      if (skipNext > 0) {
        skipNext--;
        continue;
      }
      if (inRgn[pc]) continue;
      if (inLoop[pc]) continue;
      if (closurePCs[pc]) {
        const nUv = regB[pc];
        if (typeof nUv === 'number' && nUv > 0) skipNext = nUv;
      }
      const ok = !aIsK[pc] && !bIsK[pc] && !cIsK[pc]
        && typeof regB[pc] !== 'string' && typeof regC[pc] !== 'string'
        && (typeof regB[pc] !== 'number' || regB[pc] % 1 === 0)
        && (typeof regC[pc] !== 'number' || regC[pc] % 1 === 0);
      if (ok && (pc * sealMul) % 7 < 1 && sealCount < maxSeal) {
        const key = sealkey(pc, sealMul, sealAdd);
        opcodes[pc] = bxor(opcodes[pc], key) + sealBit;
        regA[pc] = bxor(regA[pc] || 0, key);
        regB[pc] = bxor(regB[pc] || 0, key);
        regC[pc] = bxor(regC[pc] || 0, key);
        sealCount++;
      }
    }

    const stackSz = r.varint();
    const lineMap = [];
    const nLines = r.u32();
    let I = 1;
    for (let Line = 1; Line <= nLines; Line++) {
      const a = r.u32();
      const b = Math.floor(a / 2);
      if (a % 2 === 0) {
        lineMap[I] = b;
      } else {
        I = r.u32();
        const line_number = r.u32();
        for (let i = b; i <= I; i++) lineMap[i] = line_number;
      }
      I = I + 1;
    }
    const params = r.varint();

    const nRgn = r.varint();
    let regions = null;
    if (nRgn > 0) {
      regions = [];
      for (let i = 0; i < nRgn; i++) {
        regions.push([r.varint(), r.varint(), r.varint()]);
      }
      for (const rg of regions) {
        let u = 0;
        for (let j = rg[0]; j <= rg[0] + rg[1] - 1; j++) {
          u++;
          const Z = band(bxor(rg[2], u), 127);
          opcodes[j] = bxor(opcodes[j], Z);
          if (!aIsK[j]) regA[j] = bxor(regA[j], Z);
          if (!bIsK[j]) regB[j] = bxor(regB[j], Z);
          if (!cIsK[j]) regC[j] = bxor(regC[j], Z);
        }
      }
    }

    const nMap = r.varint();
    let mapAt = null;
    if (nMap > 0) {
      mapAt = [];
      for (let i = 1; i <= nMap; i++) mapAt[i] = r.varint();
    }
    const nOA = r.varint();
    let OA = null;
    if (nOA > 0) {
      OA = [];
      for (let i = 0; i < nOA; i++) {
        const pc = r.varint();
        OA[pc] = r.varint();
      }
    }

    const proto = {
      nSlots,
      params,
      stackSz,
      opcodes,
      regA,
      regB,
      regC,
      protosAt,
      aIsK,
      bIsK,
      cIsK,
      lineMap,
      regions,
      mapAt,
      OA,
    };
    encryptProtoRegions(proto, settings);
    return proto;
  }

  for (let I = 1; I <= nProtos; I++) protos[I] = readProto();

  for (let I = 0; I < scratch.length; I += 3) {
    const arr = scratch[I];
    const pc = scratch[I + 1];
    const idx = scratch[I + 2];
    arr[pc] = protos[idx];
  }

  const rootIdx = r.varint();
  const root = protos[rootIdx];
  if (!root) throw new Error('deserialize: bad root index ' + rootIdx);

  root._settings = {
    idMap, rev, sealBit, sealMul, sealAdd,
    dispHash: settings.dispHash || 0,
    regionMasterKey: settings.regionMasterKey,
    encPerm: settings.encPerm,
  };
  return root;
}

module.exports = {
  deserialize,
  ByteReader,
  reverseIdMap,
  bxor,
  band,
  sealkey,
  xorNum,
  regionKey,
  mixDispHash,
  xorRange,
  encryptProtoRegions,
  collectRegionSites,
  markRegionPcs,
  regionDecWire,
};
