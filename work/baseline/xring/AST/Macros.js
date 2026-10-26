'use strict';

/**
 * Compile-time macros for Xring.
 *
 * XRN_KEEP / XRN_NO_VIRTUALIZE / XRN_NO_VIRTUAL
 *   Unwrap to the function argument and mark the proto so CLOSURE becomes
 *   NATIVE_CLOSURE: a minified Lua function in the wrapper, not VM bytecode.
 *   Zero-upvalue functions only; captured locals fall back to the VM.
 *
 * XRN_CRASH
 *   Replaced with opcode CRASH. Poisons VM context and aborts. pcall cannot
 *   recover the interpreter.
 *
 * Canonical names use the XRN_ prefix. Bare KEEP / CRASH aliases remain.
 */

const KEEP_NAMES = new Set([
  'XRN_KEEP',
  'XRN_NO_VIRTUALIZE',
  'XRN_NO_VIRTUAL',
  'KEEP',
  'NO_VIRTUALIZE',
]);

const CRASH_NAMES = new Set([
  'XRN_CRASH',
  'CRASH',
]);

const KEEP_SENTINEL = 'XRNKEEPTABLE';

function unwrap(e) {
  while (e && e.type === 'ParenExpression') e = e.expr;
  return e;
}

function calleeName(node) {
  if (!node) return null;
  const e = unwrap(node);
  if (e.type === 'Identifier') return e.name;
  return null;
}

function isFn(node) {
  const e = unwrap(node);
  return e && (e.type === 'FunctionExpression' || e.type === 'FunctionDeclaration');
}

function transform(node) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = transform(node[i]);
    return node;
  }

  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'raw') continue;
    const v = node[k];
    if (v && typeof v === 'object') node[k] = transform(v);
  }

  if (node.type === 'CallExpression') {
    const name = calleeName(node.callee);
    if (name && KEEP_NAMES.has(name) && node.args && node.args.length >= 1 && isFn(node.args[0])) {
      const fn = unwrap(node.args[0]);
      fn.keepNative = true;
      return fn;
    }
    if (name && CRASH_NAMES.has(name) && (!node.args || node.args.length === 0)) {
      return { type: 'CrashExpression', loc: node.loc };
    }
  }

  if (node.type === 'CallStatement' && node.expr) {
    if (node.expr.type === 'FunctionExpression' && node.expr.keepNative) {
      return { type: 'EmptyStatement', loc: node.loc };
    }
    if (node.expr.type === 'CrashExpression') {
      return { type: 'CrashStatement', loc: node.loc };
    }
  }

  return node;
}

function applyMacros(ast) {
  if (!ast) return ast;
  if (ast.type === 'Chunk' && ast.body) ast.body = transform(ast.body);
  else transform(ast);
  return ast;
}

function collectKeepProtos(proto, out) {
  out = out || [];
  if (proto.keepNative && proto.keepAst && !(proto.upvalues && proto.upvalues.length)) {
    proto.keepId = out.length + 1;
    out.push(proto);
  } else {
    proto.keepId = 0;
  }
  for (const child of proto.protos || []) collectKeepProtos(child, out);
  return out;
}

function rewriteKeepClosures(proto) {
  if (!proto) return proto;
  for (const inst of proto.code || []) {
    if (inst.op === 'CLOSURE') {
      const child = proto.protos[inst.C - 1];
      if (child && child.keepId) {
        inst.op = 'NATIVE_CLOSURE';
        inst.B = child.keepId;
        inst.Bk = false;
        inst.closure = false;
      }
    }
  }
  for (const child of proto.protos || []) rewriteKeepClosures(child);
  return proto;
}

function emitKeepTable(entries, printAst) {
  if (!entries || !entries.length) return '';
  const parts = [];
  for (const p of entries) {
    let src = printAst(p.keepAst);
    src = src.replace(/;+\s*$/, '');
    parts.push('[' + p.keepId + ']=' + src);
  }
  return parts.join(',');
}

function injectKeepTable(lua, keepInner) {
  const table = '{' + (keepInner || '') + '}';
  const re = /(["'])XRNKEEPTABLE\1/g;
  if (!re.test(lua)) return lua;
  return lua.replace(/(["'])XRNKEEPTABLE\1/g, table);
}

module.exports = {
  KEEP_NAMES,
  CRASH_NAMES,
  KEEP_SENTINEL,
  applyMacros,
  collectKeepProtos,
  rewriteKeepClosures,
  emitKeepTable,
  injectKeepTable,
};
