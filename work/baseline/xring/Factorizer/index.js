const { ControlFlowEngine, applyControlFlow } = require('../VM/controlflow/ControlFlow');
const { OpaqueEngine } = require('../VM/controlflow/Opaque');
const { CfCacheEngine, CACHE_FIELD } = require('../VM/controlflow/Cache');
const { ObjectSplitEngine, wrapAndSplit } = require('./TableObjectmethod/ObjectSplit');
const { printAst } = require('./core/Printer');
const ast = require('./core/Ast');
const aliases = require('./MakeUp/Aliases');
const dispatch = require('../VM/controlflow/Dispatch');
const makeup = require('./MakeUp/Makeup');
const colon = require('./MakeUp/Colon');
const { MbaEngine, POOL_FIELD } = require('./arith/Mba');

module.exports = {
  ControlFlowEngine,
  applyControlFlow,
  OpaqueEngine,
  CfCacheEngine,
  CACHE_FIELD,
  ObjectSplitEngine,
  wrapAndSplit,
  printAst,
  ast,
  aliases,
  dispatch,
  makeup,
  colon,
  MbaEngine,
  POOL_FIELD,
};
