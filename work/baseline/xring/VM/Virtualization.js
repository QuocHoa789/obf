'use strict';

/**
 * Public entry: Lua source → virtualized Luau wrapper.
 * Pipeline: parse AST → compile proto → serialize blob → wrap VM (no JIT).
 */

const { parse } = require('../AST/Parser');
const { rename, shortenChunkNames, minifyLua, collapseNewlines } = require('../Factorizer/MakeUp/Renamer');
const { mixEscapeStrings } = require('../Factorizer/arith/StringEncrypt');
const { compile } = require('../Compilers/IR/Compiler');
const { internProto } = require('../Compilers/intern/InternPass');
const { superOptGuest } = require('../Compilers/pass/SuperOpt');
const { variantPass } = require('../Compilers/pass/VariantPass');
const { guestCffPass } = require('../Compilers/pass/GuestCff');
const { loadEncPass } = require('../Compilers/pass/LoadEncPass');
const { makeEncPerm } = require('../Compilers/encode/LoadEnc');
const { regionPass } = require('../Compilers/pass/RegionPass');
const { Serializer, encodeBase85, wrapBlobLiteral, mulberry32 } = require('../Compilers/encode/Serializer');
const { assemble, permuteIds } = require('./Assembler');
const { deserialize } = require('../Compilers/encode/Deserializer');
const { runVM } = require('./Runtime');
const { applyMacros, collectKeepProtos, rewriteKeepClosures, emitKeepTable, injectKeepTable } = require('../AST/Macros');
const { printAst } = require('../Factorizer/core/Printer');

function randomBias(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Per-seed type tags for the blob const pool. Must preserve the
// deserializer's branch order (see Serializer.writeConst +
// Deserializer/VM chunk27):
//   bool(0) < typeFloat < typeString, typeNil distinct, typeFloat+1 distinct
//   (typeFloat+1 is the i64 tag, decoded via the final else-branch).
function randomTypeTags(rng) {
  const typeFloat = 2 + Math.floor(rng() * 7); // 2..8
  let typeString = typeFloat + 2 + Math.floor(rng() * 10);
  if (typeString > 250) typeString = typeFloat + 2;
  let typeNil = 2 + Math.floor(rng() * 14); // 2..15
  let guard = 0;
  while (
    (typeNil === typeFloat ||
      typeNil === typeString ||
      typeNil === typeFloat + 1 ||
      typeNil === 0 ||
      typeNil < typeFloat) &&
    guard++ < 100
  ) {
    typeNil = 2 + Math.floor(rng() * 14);
  }
  return { typeFloat, typeNil, typeString };
}

function obfuscate(source, options) {
  options = options || {};
  const filename = options.filename || '=stdin';
  const seed = options.seed == null ? (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0 : options.seed >>> 0;
  const rng = mulberry32(seed);

  const ast = parse(source, filename);
  applyMacros(ast);
  rename(ast, {});
  let proto = compile(ast);
  // Sprint 1 intern v2 (Luraph): separate filler (#1) + guest, entry does
  // I[0]=guest; return I[0](I). internProto returns a NEW root (entry).
  // Disable with options.intern === false (compiler debug paths).
  let internInfo = null;
  if (options.intern !== false) {
    internInfo = internProto(proto, seed);
    proto = internInfo.root;
    if (options.microOp !== false) superOptGuest(internInfo.guest, mulberry32((seed ^ 0x5A17) >>> 0));
    if (options.guestCff !== false) guestCffPass(internInfo.guest, seed, internInfo);
    variantPass(proto, seed);
    loadEncPass(proto, seed);
    if (options.regionEnc !== false) regionPass(proto, seed, internInfo);
  }
  const keepList = collectKeepProtos(proto);
  rewriteKeepClosures(proto);
  const keepInner = emitKeepTable(keepList, printAst);

  const idMap = permuteIds(rng);
  const typeTags = randomTypeTags(rng);
  const settings = {
    seed,
    idMap,
    slotBias: randomBias(rng, 5, 40),
    constBias: randomBias(rng, 5, 40),
    protoBias: randomBias(rng, 3, 20),
    strOffset: randomBias(rng, 1, 200),
    typeFloat: options.typeFloat != null ? options.typeFloat : typeTags.typeFloat,
    typeNil: options.typeNil != null ? options.typeNil : typeTags.typeNil,
    typeString: options.typeString != null ? options.typeString : typeTags.typeString,
    regionMasterKey: internInfo && internInfo.regionMasterKey,
    dispHash: internInfo && internInfo.dispHash,
    dispHashSlot: internInfo && internInfo.reservedMap && internInfo.reservedMap.dispHash,
    encPerm: makeEncPerm(seed),
    sealBit: options.sealBit != null ? options.sealBit : 256,
    sealMul: 3 + Math.floor(rng() * 40) * 2,
    sealAdd: 1 + Math.floor(rng() * 60),
    controlFlow: options.controlFlow !== false,
    objectSplit: options.objectSplit !== false,
    cache: options.cache !== false,
    mba: options.mba !== false,
  };

  const ser = new Serializer(settings);
  const raw = ser.serialize(proto);
  if (options.junk !== false) settings.blobRaw = Buffer.from(raw);
  const b85 = encodeBase85(raw);
  const literal = wrapBlobLiteral(b85, 'XRING');
  let lua = assemble(literal, settings);
  lua = shortenChunkNames(lua);
  if (/0b[01]/.test(lua) || /0x[0-9a-fA-F]+__/.test(lua)) {
    lua = collapseNewlines(lua);
  } else {
    lua = minifyLua(lua);
  }
  lua = injectKeepTable(lua, keepInner);
  lua = mixEscapeStrings(lua, mulberry32(((seed >>> 0) ^ 0xE5CA9E5) >>> 0));
  lua = '-- this file was obfuscated using Xrings\n\n' + lua;

  return {
    lua,
    ast,
    proto,
    blob: raw,
    settings,
    keepCount: keepList.length,
    intern: internInfo,
  };
}

function obfuscateToString(source, options) {
  return obfuscate(source, options).lua;
}

function runObfuscated(source, options) {
  const r = obfuscate(source, options);
  const vmProto = deserialize(r.blob, r.settings);
  const out = runVM(vmProto, {
    ...r.settings,
    env: options && options.env,
    args: options && options.args,
  });
  return { ...out, lua: r.lua, proto: r.proto, blob: r.blob, settings: r.settings };
}

module.exports = {
  obfuscate,
  obfuscateToString,
  runObfuscated,
  randomTypeTags,
};
