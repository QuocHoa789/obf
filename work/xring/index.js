'use strict';

const { parse } = require('./AST/Parser');
const { compile, compileSource } = require('./Compilers/IR/Compiler');
const { internProto } = require('./Compilers/intern/InternPass');
const { superOptGuest } = require('./Compilers/pass/SuperOpt');
const { variantPass } = require('./Compilers/pass/VariantPass');
const { guestCffPass } = require('./Compilers/pass/GuestCff');
const { loadEncPass } = require('./Compilers/pass/LoadEncPass');
const { regionPass } = require('./Compilers/pass/RegionPass');
const { interpret } = require('./Compilers/IR/Interpreter');
const { obfuscate, obfuscateToString, runObfuscated } = require('./VM/Virtualization');
const { applyControlFlow, ControlFlowEngine, wrapAndSplit, ObjectSplitEngine, OpaqueEngine } = require('./Factorizer');
const { deserialize } = require('./Compilers/encode/Deserializer');
const { applyMacros, KEEP_NAMES, CRASH_NAMES } = require('./AST/Macros');
const { runVM } = require('./VM/Runtime');
const { debug } = require('./Debug');

module.exports = {
  parse,
  compile,
  compileSource,
  internProto,
  superOptGuest,
  variantPass,
  guestCffPass,
  loadEncPass,
  regionPass,
  interpret,
  obfuscate,
  obfuscateToString,
  runObfuscated,
  deserialize,
  runVM,
  applyMacros,
  KEEP_NAMES,
  CRASH_NAMES,
  applyControlFlow,
  ControlFlowEngine,
  wrapAndSplit,
  ObjectSplitEngine,
  OpaqueEngine,
  debug,
};
