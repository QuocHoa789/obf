'use strict';

const { getChunks } = require('./VirtualMachine');
const { CANONICAL, JUMP_PRE, JUMP_ABS, JUMP_REL } = require('../Compilers/IR/Opcodes');
const { HANDLERS, emitDispatch } = require('./Handlers');
const { emitJunk } = require('../Factorizer/arith/JunkCode');
const { mulberry32 } = require('../Compilers/encode/Serializer');
const { ControlFlowEngine } = require('./controlflow/ControlFlow');
const { parse } = require('../AST/Parser');
const { wrapAndSplit } = require('../Factorizer/TableObjectmethod/ObjectSplit');
const { luaVtableFill, pickHFields, applyHFields } = require('../Compilers/encode/LoadEnc');

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

function permuteIds(rng) {
  // Unique wire in 0..255 per handler. Dispatch is used-ops only;
  // unused wires fall through empty else, not a dense 256-way trap table.
  const canonIds = HANDLERS.map((h) => h.canonicalId);
  const pool = [];
  for (let i = 0; i < 256; i++) pool.push(i);
  const sh = shuffle(pool, rng);
  const map = Object.create(null);
  for (let i = 0; i < canonIds.length; i++) map[canonIds[i]] = sh[i];
  return map;
}

function topoShuffle(chunks, rng) {
  const last = chunks.filter((c) => c.pinLast);
  const rest = chunks.filter((c) => !c.pinLast);

  const declToChunk = Object.create(null);
  for (const c of rest) {
    for (const d of c.declares || []) declToChunk[d] = c.id;
    for (const d of c.assigns || []) {
      if (declToChunk[d] == null) declToChunk[d] = c.id;
    }
  }

  const byId = Object.create(null);
  for (const c of rest) byId[c.id] = c;

  const preds = Object.create(null);
  const succs = Object.create(null);
  for (const c of rest) {
    preds[c.id] = new Set();
    succs[c.id] = new Set();
  }
  const addEdge = (fromId, toId) => {
    if (fromId === toId || byId[fromId] == null || byId[toId] == null) return;
    succs[fromId].add(toId);
    preds[toId].add(fromId);
  };

  for (const c of rest) {
    for (const r of c.refs || []) {
      const dep = declToChunk[r];
      if (dep != null) addEdge(dep, c.id);
    }
  }
  if (byId[25] && byId[30]) addEdge(25, 30);
  if (byId[32] && byId[24]) addEdge(32, 24);
  if (byId[32] && byId[26]) addEdge(32, 26);
  if (byId[23] && byId[24]) addEdge(23, 24);
  if (byId[8] && byId[25]) addEdge(8, 25);

  const ready = rest.filter((c) => preds[c.id].size === 0);
  const out = [];
  const seen = new Set();
  while (ready.length) {
    const pick = Math.floor(rng() * ready.length);
    const c = ready.splice(pick, 1)[0];
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    for (const s of succs[c.id]) {
      preds[s].delete(c.id);
      if (preds[s].size === 0) ready.push(byId[s]);
    }
  }
  if (out.length !== rest.length) {
    for (const c of rest) if (!seen.has(c.id)) out.push(c);
  }
  return out.concat(last);
}

function oddMul(rng) {
  let n = 3 + Math.floor(rng() * 50) * 2;
  if (n % 2 === 0) n++;
  return n;
}

function indentJunk(src, spaces) {
  const pad = ' '.repeat(spaces);
  return src.split('\n').map((ln) => (ln.trim() === '' ? '' : pad + ln)).join('\n');
}

function assemble(blobLiteral, opts) {
  opts = opts || {};
  const rng = mulberry32(opts.seed == null ? 1 : opts.seed >>> 0);
  const idMap = opts.idMap || permuteIds(rng);
  const order = shuffle(HANDLERS, rng);
  const dispatch = emitDispatch(idMap, order, 28, rng);
  // Luraph-style smart junk: opaque blob-keyed predicates interleaved after
  // the dispatch tree, executing on every VM step touching real VM state.
  // Disabled with opts.junk === false or when no blob bytes are provided.
  let vmJunk = '';
  if (opts.junk !== false && opts.blobRaw && opts.blobRaw.length > 0) {
    const junkSeed = ((opts.seed == null ? 1 : opts.seed) >>> 0) ^ 0x6A756E6B;
    vmJunk = emitJunk({ blob: opts.blobRaw, rand: mulberry32(junkSeed) });
  }
  const fullDispatch = vmJunk
    ? dispatch + '\n' + indentJunk(vmJunk, 28)
    : dispatch;

  const placeholders = {
    __BLOB__: blobLiteral,
    __OPCODE_DISPATCH__: fullDispatch,
    __MATERIALIZE_BODY__: `if type(v) == 'table' then return string.char(unpack(v)) end\n\t\t\t\treturn v`,
    __SEAL_BIT__: String(opts.sealBit != null ? opts.sealBit : 256),
    __SEAL_MUL__: String(opts.sealMul != null ? opts.sealMul : oddMul(rng)),
    __SEAL_ADD__: String(opts.sealAdd != null ? opts.sealAdd : 1 + Math.floor(rng() * 63)),
    __NOP_CHECK__: 'false',
    __SELFMOD_DECOY__: '',
    __SLOT_BIAS__: String(opts.slotBias != null ? opts.slotBias : 17),
    __CONST_BIAS__: String(opts.constBias != null ? opts.constBias : 23),
    __PROTO_BIAS__: String(opts.protoBias != null ? opts.protoBias : 11),
    __STR_OFFSET__: String(opts.strOffset != null ? opts.strOffset : 41),
    __TYPE_FLOAT__: String(opts.typeFloat != null ? opts.typeFloat : 3),
    __TYPE_NIL__: String(opts.typeNil != null ? opts.typeNil : 7),
    __TYPE_STRING__: String(opts.typeString != null ? opts.typeString : 5),
    __PROTO9_INIT__: 'nil',
    __BAKE_A__: 'constcache_chunk18_direct[RegA]',
    __BAKE_B__: 'constcache_chunk18_direct[RegB]',
    __BAKE_C__: 'constcache_chunk18_direct[RegC]',
    __CONST_SCATTER__: '',
    __JMP_IDS__: (function () {
      const names = JUMP_PRE.concat(JUMP_ABS);
      return names.map((n) => {
        const c = CANONICAL[n];
        return idMap[c] != null ? idMap[c] : c;
      }).join(', ');
    })(),
    __JMP_REL_IDS__: (function () {
      return JUMP_REL.map((n) => {
        const c = CANONICAL[n];
        return idMap[c] != null ? idMap[c] : c;
      }).join(', ');
    })(),
    __SELFMOD_SHADOW__: '',
    __MOVE_ID__: String(idMap[0] != null ? idMap[0] : 0),
    __REGION_DEC_ID__: String(idMap[CANONICAL.REGION_DEC] != null ? idMap[CANONICAL.REGION_DEC] : CANONICAL.REGION_DEC),
    __REGION_ENC_ID__: String(idMap[CANONICAL.REGION_ENC] != null ? idMap[CANONICAL.REGION_ENC] : CANONICAL.REGION_ENC),
    __REGION_MASTER__: String((opts.regionMasterKey || 0) >>> 0),
    __DISP_HASH__: String((opts.dispHash || 0) >>> 0),
    __DISP_SLOT__: String((opts.dispHashSlot != null ? opts.dispHashSlot : 0) >>> 0),
  };

  const cfEnabled = opts.controlFlow !== false;
  const splitEnabled = opts.objectSplit !== false;
  const cf = cfEnabled && !splitEnabled
    ? new ControlFlowEngine(mulberry32(((opts.seed == null ? 1 : opts.seed) >>> 0) ^ 0x4C524159))
    : null;

  const hNames = pickHFields(mulberry32(((opts.seed == null ? 1 : opts.seed) >>> 0) ^ 0x48564952));
  const replaced = getChunks().map((c) => {
    let src = c.src;
    for (const [k, v] of Object.entries(placeholders)) {
      if (k === '__BLOB__') continue;
      src = src.split(k).join(v);
    }
    return { ...c, src: applyHFields(src, hNames) };
  });

  let header = `local unpack = unpack or table.unpack
local bit32 = bit32 or bit
`;
  const hBlock = applyHFields(`local h = {
	x = function(a, b)
		return bit32.bxor(tonumber(a) or 0, tonumber(b) or 0)
	end,
	b = function(a, b)
		return bit32.band(tonumber(a) or 0, tonumber(b) or 0)
	end,
}
` + luaVtableFill(opts.encPerm), hNames);
  const nativeLine = 'local native_chunk33 = "XRNKEEPTABLE"\n';

  // Assembly-wide reserved names: all chunks share one scope, so a flattened
  // `local <state>` must avoid every identifier in the whole assembly
  // (chunk locals like `h`/`unpack`/`bit32`, plus every read). Otherwise the
  // state variable shadows a helper for all chunks assembled after it.
  let cfReserved = null;
  if (cf) {
    cfReserved = new Set();
    const scan = (src) => {
      try {
        for (const n of cf.scopeNames(parse(String(src)))) cfReserved.add(n);
      } catch {
        // best effort — unparseable fragment just contributes nothing
      }
    };
    scan(header + hBlock + nativeLine);
    for (const c of replaced) scan(c.src);
  }

  const chunks = replaced.map((c) => {
    let src = c.src;
    if (cf) src = cf.flattenChunk(src, cfReserved);
    src = src.split('__BLOB__').join(blobLiteral);
    return { ...c, src };
  });

  const shuffled = topoShuffle(chunks, rng);
  const body = shuffled.map((c) => c.src).join('\n');

  header += cf ? cf.flattenChunk(hBlock, cfReserved) : hBlock;
  header += nativeLine;

  const inner = `${header}
${body}`;
  if (splitEnabled) {
    const splitRng = mulberry32(((opts.seed == null ? 1 : opts.seed) >>> 0) ^ 0x0B7EC7AB);
    return wrapAndSplit(inner, splitRng, {
      controlFlow: cfEnabled,
      cache: opts.cache !== false,
      mba: opts.mba !== false,
    });
  }
  // Plain wrapper must self-execute like the split wrapper does: the IIFE
  // returns the bootstrap entry, which is invoked here with script args.
  return `return(function()
${inner}
end)()(...)`;
}

module.exports = {
  assemble,
  permuteIds,
  topoShuffle,
  shuffle,
};
