'use strict';

const { ident, bin, mem, paren } = require('../core/Ast');

const GLOBAL_FUNCS = {
  pcall: 'y',
  select: 'gS',
  getfenv: 'az',
  setfenv: 'tS',
  error: 'Ez',
  unpack: 'z',
  type: 'pY',
  tostring: 'oS',
  tonumber: 'nY',
  setmetatable: 'mS',
  ipairs: 'iA',
};

const LIB_MEMBERS = {
  'bit32.band': 'K',
  'bit32.bxor': 'nS',
  'bit32.bnot': 'bo',
  'bit32.countlz': 'so',
  'bit32.countrz': 'Fo',
  'bit32.lrotate': 'Mo',
  'bit32.rrotate': 'Co',
  'bit32.lshift': 'l',
  'string.char': 'PS',
  'string.byte': 'LS',
  'string.gsub': 'vS',
  'string.sub': 'aY',
  'string.match': 'qS',
  'table.unpack': 'z',
  'table.move': 'P',
  'table.create': 'u4',
  'buffer.readu8': 'bS',
  'buffer.readu32': 'iS',
  'buffer.readf64': 'fS',
  'buffer.readstring': 'kS',
  'buffer.fromstring': 'cS',
  'buffer.create': 'dY',
  'buffer.writeu8': 'wS',
  'buffer.tostring': 'hS',
  'coroutine.wrap': 'cY',
};

const BUFFER_KEYS = new Set(['bS', 'iS', 'fS', 'kS', 'cS', 'dY', 'wS', 'hS']);

const BUFFER_PROPS = {
  bS: 'readu8',
  iS: 'readu32',
  fS: 'readf64',
  kS: 'readstring',
  cS: 'fromstring',
  dY: 'create',
  wS: 'writeu8',
  hS: 'tostring',
};

function bit32Expr() {
  return paren(bin('or', ident('bit32'), ident('bit')));
}

const ALIAS_EXPR = {
  z: () => bin('or', ident('unpack'), mem(ident('table'), 'unpack')),
  y: () => ident('pcall'),
  gS: () => ident('select'),
  az: () => ident('getfenv'),
  tS: () => ident('setfenv'),
  Ez: () => ident('error'),
  pY: () => ident('type'),
  oS: () => ident('tostring'),
  nY: () => ident('tonumber'),
  mS: () => ident('setmetatable'),
  iA: () => ident('ipairs'),
  K: () => mem(bit32Expr(), 'band'),
  nS: () => mem(bit32Expr(), 'bxor'),
  U: () => mem(bit32Expr(), 'bxor'),
  bo: () => mem(bit32Expr(), 'bnot'),
  so: () => mem(bit32Expr(), 'countlz'),
  Fo: () => mem(bit32Expr(), 'countrz'),
  Mo: () => mem(bit32Expr(), 'lrotate'),
  Co: () => mem(bit32Expr(), 'rrotate'),
  l: () => mem(bit32Expr(), 'lshift'),
  mo: () => mem(bit32Expr(), 'lshift'),
  PS: () => mem(ident('string'), 'char'),
  LS: () => mem(ident('string'), 'byte'),
  vS: () => mem(ident('string'), 'gsub'),
  aY: () => mem(ident('string'), 'sub'),
  qS: () => mem(ident('string'), 'match'),
  P: () => mem(ident('table'), 'move'),
  u4: () => mem(ident('table'), 'create'),
  bS: () => mem(ident('buffer'), 'readu8'),
  iS: () => mem(ident('buffer'), 'readu32'),
  fS: () => mem(ident('buffer'), 'readf64'),
  kS: () => mem(ident('buffer'), 'readstring'),
  cS: () => mem(ident('buffer'), 'fromstring'),
  dY: () => mem(ident('buffer'), 'create'),
  wS: () => mem(ident('buffer'), 'writeu8'),
  hS: () => mem(ident('buffer'), 'tostring'),
  cY: () => mem(ident('coroutine'), 'wrap'),
};

function aliasExpr(key) {
  const fn = ALIAS_EXPR[key];
  return fn ? fn() : ident(key);
}

module.exports = {
  GLOBAL_FUNCS,
  LIB_MEMBERS,
  ALIAS_EXPR,
  BUFFER_KEYS,
  BUFFER_PROPS,
  aliasExpr,
  bit32Expr,
};
