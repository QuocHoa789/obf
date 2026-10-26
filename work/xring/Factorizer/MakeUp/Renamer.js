'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Scope-aware Lua local renamer.
 *
 * Only lexical locals are renamed:
 *   - local declarations
 *   - function parameters
 *   - numeric/generic for variables
 *   - local function declarations
 *
 * Globals are intentionally left alone. Static table/member keys are renamed
 * through one shared key map so `obj.longKey`, `obj["longKey"]`, and
 * `{ longKey = value }` continue to refer to the same key.
 */

const BINDING = Symbol('xringBinding');
const BINDINGS = Symbol('xringBindings');
const PARAM_BINDINGS = Symbol('xringParamBindings');

const LUA_KEYWORDS = new Set([
  'and', 'break', 'continue', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then', 'true',
  'until', 'while',
]);

class Scope {
  constructor(parent) {
    this.parent = parent || null;
    this.bindings = new Map();
  }

  define(name) {
    const binding = {
      original: name,
      newName: null,
      scope: this,
    };
    const sameName = this.bindings.get(name);
    if (sameName) sameName.push(binding);
    else this.bindings.set(name, [binding]);
    return binding;
  }

  resolve(name) {
    for (let scope = this; scope; scope = scope.parent) {
      const bindings = scope.bindings.get(name);
      if (bindings && bindings.length) return bindings[bindings.length - 1];
    }
    return null;
  }
}

function attach(node, key, value) {
  Object.defineProperty(node, key, {
    configurable: true,
    enumerable: false,
    value,
    writable: true,
  });
}

function reserveGlobal(state, name) {
  if (name) state.globals.add(name);
}

function isReservedKey(name) {
  // Lua metamethods / language contracts must never be renamed:
  // __index, __newindex, __call, __concat, __add, __mode, ...
  // Renaming them breaks setmetatable / VM wrapper behavior.
  return typeof name === 'string' && name.startsWith('__');
}

function reserveKey(state, name, safe) {
  if (!name) return;
  if (isReservedKey(name)) {
    // Still record it so generated candidates never collide with it,
    // and force it into the unsafe set so it is never renamed.
    state.keys.add(name);
    state.unsafeKeys.add(name);
    return;
  }
  state.keys.add(name);
  if (safe === false) state.unsafeKeys.add(name);
}

function defineKey(state, name, safe) {
  if (!name) return;
  if (isReservedKey(name)) {
    state.keys.add(name);
    state.unsafeKeys.add(name);
    return;
  }
  state.keys.add(name);
  // A field whose name also appears as a *string value* somewhere in the
  // chunk can be reached dynamically (`inv[id]`, `f(t, "id")`), and that
  // access cannot be rewritten — renaming the field would split the table in
  // two. Stay conservative and keep the original name.
  if (safe === false || (state.stringValues && state.stringValues.has(name))) {
    state.unsafeKeys.add(name);
  } else {
    state.definedKeys.add(name);
  }
}

/**
 * Collect every string literal used as a *value* (not as a static key):
 * `t["k"]`, `{ ["k"] = v }` and `obj["k"] = v` keep their literal in key
 * position, so they stay eligible for key renaming (they are rewritten in
 * rewriteExpression/rewriteStatement). Any other literal may flow into an
 * index expression at runtime and therefore blocks the rename.
 */
function collectValueStrings(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectValueStrings(child, out);
    return;
  }
  if (node.type === 'StringLiteral') {
    out.add(node.value);
    return;
  }
  if (node.type === 'IndexExpression') {
    collectValueStrings(node.object, out);
    return;
  }
  if (node.type === 'TableConstructor') {
    for (const field of node.fields || []) {
      if (field.type === 'TableKey') collectValueStrings(field.value, out);
      else if (field.type === 'TableKeyString') collectValueStrings(field.value, out);
      else collectValueStrings(field.value, out);
    }
    return;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'property' || key === 'method') continue;
    const child = node[key];
    if (child && typeof child === 'object') collectValueStrings(child, out);
  }
}

/**
 * `pairs` / `next` hand the *real* key strings to the script, so renaming a
 * table key stays observable even when every static access was rewritten:
 * `local t = {a = 1}; for k, v in pairs(t) do print(k, v) end` printed `b 1`
 * once `a` was renamed. Key renaming is therefore skipped for chunks that can
 * observe keys:
 *   - `next(...)` called anywhere (the returned key can be stored/printed);
 *   - `pairs(t)` in iterator position when the loop's key variable is used;
 *   - `pairs` referenced anywhere else (as a value, passed around, re-bound).
 * Chunks that iterate while ignoring the key (`for _, v in pairs(t)`) keep the
 * rename, so their output stays byte-identical.
 */
function keysEscapeOf(node) {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(keysEscapeOf);
  if (node.type === 'ForGenericStatement') {
    const iter = (node.iters || [])[0];
    const keyVar = (node.names || [])[0];
    const iterCall =
      iter &&
      iter.type === 'CallExpression' &&
      iter.callee &&
      iter.callee.type === 'Identifier' &&
      iter.callee.name === 'pairs';
    if (iterCall) {
      if (keyVar && usesIdentifier(node.body, keyVar)) return true;
      // Key variable never read: the table's keys stay private for this loop,
      // but the body can still observe them (`next(t)` inside it) and the
      // iterated expression is a plain value.
      if (keysEscapeOf(node.body)) return true;
      return (iter.args || []).some(keysEscapeOf);
    }
  }
  if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier') {
    if (node.callee.name === 'next' || node.callee.name === 'pairs') return true;
  }
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'raw' || key === 'property' || key === 'method') continue;
    const child = node[key];
    if (child && typeof child === 'object' && keysEscapeOf(child)) return true;
  }
  return false;
}

function usesIdentifier(node, name) {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some((n) => usesIdentifier(n, name));
  if (node.type === 'Identifier' && node.name === name) return true;
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'raw' || key === 'property' || key === 'method') continue;
    const child = node[key];
    if (child && typeof child === 'object' && usesIdentifier(child, name)) return true;
  }
  return false;
}

function isPreservedLocal(name, options) {
  if (!name) return false;
  const preserve = options && options.preserve;
  const preserveChunks = !options || options.preserveChunkNames !== false;
  // Obfuscator-generated wrapper locals (extract_chunk12, main_chunk24,
  // sealkey_chunk32, ...). Renaming them is semantically safe but it
  // destroys the declaration-anchor convention and makes re-obfuscating
  // an already obfuscated file noisy. Keep them stable by default.
  if (preserveChunks && /_chunk\d+$/.test(name)) return true;
  if (!preserve) return false;
  const list = Array.isArray(preserve) ? preserve : [preserve];
  for (const pattern of list) {
    if (typeof pattern === 'string') {
      if (name === pattern) return true;
    } else if (pattern instanceof RegExp) {
      // Reset lastIndex for global regexps so repeated tests are stable.
      pattern.lastIndex = 0;
      if (pattern.test(name)) return true;
    }
  }
  return false;
}

function rootIdentifier(node) {
  let current = node;
  while (current) {
    if (current.type === 'ParenExpression') current = current.expr;
    else if (current.type === 'MemberExpression' || current.type === 'IndexExpression') {
      current = current.object;
    } else {
      break;
    }
  }
  return current && current.type === 'Identifier' ? current : null;
}

function hasLocalRoot(node, scope) {
  const root = rootIdentifier(node);
  return !!(root && scope.resolve(root.name));
}

function recordIdentifier(node, scope, state) {
  const binding = scope.resolve(node.name);
  if (binding) attach(node, BINDING, binding);
  else reserveGlobal(state, node.name);
}

function analyzeBlock(stats, scope, state) {
  for (const stat of stats || []) analyzeStatement(stat, scope, state);
}

function analyzeFunction(node, parentScope, state) {
  const functionScope = new Scope(parentScope);
  const params = [];
  for (const name of node.params || []) params.push(functionScope.define(name));
  attach(node, PARAM_BINDINGS, params);
  analyzeBlock(node.body, functionScope, state);
}

function analyzeExpression(node, scope, state) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier':
      recordIdentifier(node, scope, state);
      return;
    case 'ParenExpression':
      return analyzeExpression(node.expr, scope, state);
    case 'UnaryExpression':
      return analyzeExpression(node.arg, scope, state);
    case 'BinaryExpression':
      analyzeExpression(node.left, scope, state);
      analyzeExpression(node.right, scope, state);
      return;
    case 'MemberExpression':
      reserveKey(state, node.property, hasLocalRoot(node.object, scope));
      return analyzeExpression(node.object, scope, state);
    case 'IndexExpression':
      analyzeExpression(node.object, scope, state);
      if (node.index && node.index.type === 'StringLiteral') {
        reserveKey(state, node.index.value, hasLocalRoot(node.object, scope));
      }
      return analyzeExpression(node.index, scope, state);
    case 'CallExpression':
      analyzeExpression(node.callee, scope, state);
      for (const arg of node.args || []) analyzeExpression(arg, scope, state);
      return;
    case 'MethodCallExpression':
      reserveKey(state, node.method, hasLocalRoot(node.object, scope));
      analyzeExpression(node.object, scope, state);
      for (const arg of node.args || []) analyzeExpression(arg, scope, state);
      return;
    case 'FunctionExpression':
      return analyzeFunction(node, scope, state);
    case 'TableConstructor':
      for (const field of node.fields || []) {
        if (field.type === 'TableKey') {
          // `{ ["key"] = v }` defines a static key on a fresh table.
          if (field.key && field.key.type === 'StringLiteral') defineKey(state, field.key.value, true);
          analyzeExpression(field.key, scope, state);
          analyzeExpression(field.value, scope, state);
        } else {
          // `{ key = v }` defines a static key on a fresh table.
          if (field.type === 'TableKeyString') defineKey(state, field.key, true);
          analyzeExpression(field.value, scope, state);
        }
      }
      return;
    default:
      return;
  }
}

function analyzeBlockScope(stats, parentScope, state) {
  const scope = new Scope(parentScope);
  analyzeBlock(stats, scope, state);
  return scope;
}

function analyzeStatement(node, scope, state) {
  if (!node) return;
  switch (node.type) {
    case 'EmptyStatement':
    case 'BreakStatement':
    case 'ContinueStatement':
      return;
    case 'DoStatement':
      return analyzeBlockScope(node.body, scope, state);
    case 'LocalStatement': {
      // Lua initializers see the previous binding, not the new local.
      for (const init of node.init || []) analyzeExpression(init, scope, state);
      const bindings = (node.names || []).map((name) => scope.define(name));
      attach(node, BINDINGS, bindings);
      return;
    }
    case 'AssignmentStatement':
      // `obj.key = v` / `obj["key"] = v` on a local object *defines* the
      // key. Record it as a definition before the generic use-analysis
      // below so pure uses (e.g. `local s = string; s.sub(...)`) never
      // become rename candidates on their own.
      for (const variable of node.vars || []) {
        if (variable.type === 'MemberExpression' && variable.property) {
          defineKey(state, variable.property, hasLocalRoot(variable.object, scope));
        } else if (
          variable.type === 'IndexExpression' &&
          variable.index && variable.index.type === 'StringLiteral'
        ) {
          defineKey(state, variable.index.value, hasLocalRoot(variable.object, scope));
        }
      }
      for (const variable of node.vars || []) analyzeExpression(variable, scope, state);
      for (const init of node.inits || []) analyzeExpression(init, scope, state);
      return;
    case 'CompoundAssignment':
      analyzeExpression(node.target, scope, state);
      analyzeExpression(node.value, scope, state);
      return;
    case 'CallStatement':
      return analyzeExpression(node.expr, scope, state);
    case 'ReturnStatement':
      for (const arg of node.args || []) analyzeExpression(arg, scope, state);
      return;
    case 'IfStatement':
      for (const clause of node.clauses || []) {
        analyzeExpression(clause.cond, scope, state);
        analyzeBlockScope(clause.body, scope, state);
      }
      if (node.elseBody) analyzeBlockScope(node.elseBody, scope, state);
      return;
    case 'WhileStatement':
      analyzeExpression(node.cond, scope, state);
      return analyzeBlockScope(node.body, scope, state);
    case 'RepeatStatement': {
      // Lua repeat-until conditions can see locals declared in the body.
      const repeatScope = new Scope(scope);
      analyzeBlock(node.body, repeatScope, state);
      analyzeExpression(node.cond, repeatScope, state);
      return;
    }
    case 'ForNumericStatement': {
      analyzeExpression(node.start, scope, state);
      analyzeExpression(node.stop, scope, state);
      analyzeExpression(node.step, scope, state);
      const loopScope = new Scope(scope);
      attach(node, BINDINGS, [loopScope.define(node.name)]);
      analyzeBlock(node.body, loopScope, state);
      return;
    }
    case 'ForGenericStatement': {
      for (const iter of node.iters || []) analyzeExpression(iter, scope, state);
      const loopScope = new Scope(scope);
      attach(node, BINDINGS, (node.names || []).map((name) => loopScope.define(name)));
      analyzeBlock(node.body, loopScope, state);
      return;
    }
    case 'FunctionDeclaration': {
      const safeObject = !!scope.resolve(node.names[0]);
      // `function obj.key()` / `function obj:method()` defines the key on
      // a local object. A use alone must not make the key eligible.
      for (const name of node.names.slice(1)) defineKey(state, name, safeObject);
      if (node.method) defineKey(state, node.method, safeObject);
      let functionParent = scope;
      if (node.isLocal) {
        // `local function f()` binds f before its body for recursion.
        const binding = scope.define(node.names[0]);
        attach(node, BINDINGS, [binding]);
      } else {
        // For `function obj.f()`, only obj can be a lexical variable.
        const root = scope.resolve(node.names[0]);
        if (root) attach(node, BINDINGS, [root]);
        else reserveGlobal(state, node.names[0]);
      }
      analyzeFunction(node, functionParent, state);
      if (node.method) {
        // `function o:m()` carries an implicit leading `self` with no source
        // spelling. Pin its name so print/parse round-trips stay stable.
        const params = node[PARAM_BINDINGS];
        if (params && params[0]) params[0].keepName = true;
      }
      return;
    }
    default:
      return;
  }
}

function collectBindings(ast) {
  const state = {
    bindings: [],
    globals: new Set(),
    keys: new Set(),
    definedKeys: new Set(),
    unsafeKeys: new Set(),
    stringValues: new Set(),
    keysEscape: false,
  };
  collectValueStrings(ast.body, state.stringValues);
  state.keysEscape = keysEscapeOf(ast.body);
  const root = new Scope(null);
  analyzeBlock(ast.body, root, state);

  // Bindings are reachable from the AST metadata. Walk the tree once to
  // collect them without making the metadata enumerable in the public AST.
  const seen = new Set();
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    if (value.original && value.scope && !seen.has(value)) {
      seen.add(value);
      state.bindings.push(value);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (key === BINDING || key === BINDINGS || key === PARAM_BINDINGS) {
        const child = value[key];
        if (Array.isArray(child)) child.forEach(collect);
        else collect(child);
      } else if (typeof key === 'string' && key !== 'loc') {
        const child = value[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) child.forEach(collect);
          else collect(child);
        }
      }
    }
  };
  collect(ast);
  return state;
}

function nameForIndex(index) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < alphabet.length) return alphabet[index];
  let n = index - alphabet.length;
  let result = '';
  do {
    result = alphabet[n % alphabet.length] + result;
    n = Math.floor(n / alphabet.length) - 1;
  } while (n >= 0);
  return result;
}

function isWordChar(ch) {
  return !!ch && /[A-Za-z0-9_]/.test(ch);
}

function longBracketStart(source, offset) {
  if (source[offset] !== '[') return null;
  let i = offset + 1;
  while (source[i] === '=') i++;
  if (source[i] !== '[') return null;
  return {
    close: ']' + '='.repeat(i - offset - 1) + ']',
    contentStart: i + 1,
  };
}

function quotedEnd(source, offset) {
  const quote = source[offset];
  let i = offset + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i++;
  }
  throw new SyntaxError('unterminated Lua string while minifying');
}

function tokenNeedsSpace(previous, next) {
  if (!previous || !next) return false;
  const a = previous[previous.length - 1];
  const b = next[0];
  if (isWordChar(a) && isWordChar(b)) return true;
  if ((a === '-' && b === '-') || (a === '+' && b === '+')) return true;
  if (a === '.' && b === '.') return true;
  if (/[0-9]/.test(a) && b === '.') return true;
  return false;
}

/**
 * Minify Lua source with LuaSrcDiet (bundled under ./luasrcdiet) when a Lua
 * 5.1+ interpreter is available, otherwise fall back to a JS tokenizer.
 *
 * The generated wrapper uses a single-line long string for its serialized
 * blob. LuaSrcDiet keeps long strings byte-identical; the JS fallback
 * rejects a multiline long string because newlines are part of its value.
 */
const { execFileSync } = require('child_process');

const DIET_DIR = path.join(__dirname, '..', '..', 'minify');

const WINDOWS_LUA_CANDIDATES = [
  'C:\\Program Files (x86)\\Lua\\5.1\\lua.exe',
  'C:\\Program Files\\Lua\\5.1\\lua.exe',
  'C:\\Lua\\lua.exe',
];

function findLua() {
  const bundled = path.join(__dirname, 'lua.exe');
  if (process.platform === 'win32' && fs.existsSync(bundled)) return bundled;
  for (const name of ['lua', 'lua5.1', 'lua5.3', 'lua5.4', 'luajit']) {
    try {
      const probe = process.platform === 'win32' ? 'where' : 'which';
      const line = execFileSync(probe, [name], { encoding: 'utf8' }).trim().split('\n')[0].trim();
      if (line) return line;
    } catch {}
  }
  const fallbacks = process.platform === 'win32'
    ? WINDOWS_LUA_CANDIDATES
    : ['/usr/bin/lua', '/usr/local/bin/lua'];
  for (const p of fallbacks) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function collapseNewlines(code) {
  let result = '';
  let i = 0;
  const len = code.length;
  const isAlphaNum = (c) => (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95;
  while (i < len) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      result += ch;
      i++;
      while (i < len && code[i] !== ch) {
        if (code[i] === '\\') { result += code[i]; i++; }
        if (i < len) { result += code[i]; i++; }
      }
      if (i < len) { result += code[i]; i++; }
    } else if (ch === '[') {
      // Long-bracket strings of any level (e.g. the blob) pass through
      // byte-identical: collapsing newlines or stripping `--` inside them
      // would corrupt the content.
      const long = longBracketStart(code, i);
      if (long) {
        const close = code.indexOf(long.close, long.contentStart);
        const end = close < 0 ? len : close + long.close.length;
        result += code.slice(i, end);
        i = end;
      } else {
        result += ch;
        i++;
      }
    } else if (ch === '-' && code[i + 1] === '-') {
      const long = longBracketStart(code, i + 2);
      if (long) {
        const close = code.indexOf(long.close, long.contentStart);
        const end = close < 0 ? len : close + long.close.length;
        result += code.slice(i, end);
        i = end;
      } else {
        let j = i + 2;
        while (j < len && code[j] !== '\n') j++;
        i = j;
      }
    } else if (ch === '\n' || ch === '\r') {
      i++;
      const prev = result.length > 0 ? result.charCodeAt(result.length - 1) : 0;
      const next = i < len ? code.charCodeAt(i) : 0;
      if (prev && next && isAlphaNum(prev) && isAlphaNum(next)) {
        result += ' ';
      }
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}

function minifyLua(source) {
  if (typeof source !== 'string') throw new TypeError('minifyLua expects a string');
  try {
    const diet = require('../../minify/init.js');
    return collapseNewlines(diet.optimize(diet.MAXIMUM_OPTS, source));
  } catch {}
  const luaPath = findLua();
  const dietPath = path.join(DIET_DIR, 'luasrcdiet.lua');
  if (luaPath && fs.existsSync(dietPath)) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xring-diet-'));
    try {
      const tIn = path.join(tmpDir, 'diet_in.lua');
      const tOut = path.join(tmpDir, 'diet_out.lua');
      fs.writeFileSync(tIn, source, 'latin1');
      execFileSync(luaPath, [dietPath, path.resolve(tIn), '-o', path.resolve(tOut), '--maximum'], {
        cwd: path.dirname(dietPath),
        stdio: 'pipe',
        timeout: 30000,
      });
      if (fs.existsSync(tOut)) return collapseNewlines(fs.readFileSync(tOut, 'latin1'));
    } catch {
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }
  return tokenMinifyLua(source);
}

function tokenMinifyLua(source) {
  let out = '';
  let previous = '';
  let pendingSpace = false;
  let i = 0;

  const append = (token) => {
    if (pendingSpace && tokenNeedsSpace(previous, token)) out += ' ';
    out += token;
    previous = token;
    pendingSpace = false;
  };

  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      pendingSpace = true;
      i++;
      continue;
    }

    if (ch === '-' && source[i + 1] === '-') {
      const long = longBracketStart(source, i + 2);
      if (long) {
        const close = source.indexOf(long.close, long.contentStart);
        if (close < 0) throw new SyntaxError('unterminated Lua long comment while minifying');
        i = close + long.close.length;
      } else {
        i += 2;
        while (i < source.length && source[i] !== '\n' && source[i] !== '\r') i++;
      }
      pendingSpace = true;
      continue;
    }

    if (ch === '\'' || ch === '"') {
      const end = quotedEnd(source, i);
      append(source.slice(i, end));
      i = end;
      continue;
    }

    const long = longBracketStart(source, i);
    if (long) {
      const close = source.indexOf(long.close, long.contentStart);
      if (close < 0) throw new SyntaxError('unterminated Lua long string while minifying');
      const token = source.slice(i, close + long.close.length);
      if (/[\r\n]/.test(token)) {
        throw new SyntaxError('cannot minify a multiline Lua long string to one line');
      }
      append(token);
      i = close + long.close.length;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let end = i + 1;
      while (/[A-Za-z0-9_]/.test(source[end] || '')) end++;
      append(source.slice(i, end));
      i = end;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] || ''))) {
      const match = source.slice(i).match(
        /^(?:0[xX][0-9A-Fa-f]+(?:\.[0-9A-Fa-f]*)?|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+))(?:[eE][+-]?[0-9]+)?/,
      );
      if (!match) throw new SyntaxError(`invalid Lua number near offset ${i}`);
      append(match[0]);
      i += match[0].length;
      continue;
    }

    const operator = ['...', '==', '~=', '<=', '>=', '..', '//', '<<', '>>']
      .find((candidate) => source.startsWith(candidate, i));
    if (operator) {
      append(operator);
      i += operator.length;
      continue;
    }

    append(ch);
    i++;
  }

  return out;
}

const CHUNK_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*_chunk\d+[A-Za-z0-9_]*$/;
const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/g;

/**
 * Shorten machine-generated wrapper identifiers (`*_chunkNN`) in Lua source.
 *
 * Only identifiers in *code* regions are touched — string literals (including
 * the base85 blob long-string, which can contain letter sequences), short/long
 * comments are left byte-identical. Generated short names avoid every other
 * identifier already present in the code plus Lua keywords, so the result
 * stays syntactically and semantically identical, just smaller.
 */
function shortenChunkNames(source) {
  if (typeof source !== 'string') throw new TypeError('shortenChunkNames expects a string');
  // Split into code / protected (string or comment) segments.
  const segments = [];
  let buf = '';
  let i = 0;
  const flush = () => {
    if (buf) {
      segments.push({ code: true, text: buf });
      buf = '';
    }
  };
  while (i < source.length) {
    const ch = source[i];
    if (ch === '-' && source[i + 1] === '-') {
      const long = longBracketStart(source, i + 2);
      let end;
      if (long) {
        const close = source.indexOf(long.close, long.contentStart);
        if (close < 0) throw new SyntaxError('unterminated Lua long comment');
        end = close + long.close.length;
      } else {
        end = i + 2;
        while (end < source.length && source[end] !== '\n' && source[end] !== '\r') end++;
      }
      flush();
      segments.push({ code: false, text: source.slice(i, end) });
      i = end;
      continue;
    }
    if (ch === '\'' || ch === '"') {
      const end = quotedEnd(source, i);
      flush();
      segments.push({ code: false, text: source.slice(i, end) });
      i = end;
      continue;
    }
    const long = longBracketStart(source, i);
    if (long) {
      const close = source.indexOf(long.close, long.contentStart);
      if (close < 0) throw new SyntaxError('unterminated Lua long string');
      const end = close + long.close.length;
      flush();
      segments.push({ code: false, text: source.slice(i, end) });
      i = end;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();

  // Collect every identifier in code (collision set) + chunk names in order.
  const used = new Set();
  const order = [];
  const seen = new Set();
  for (const seg of segments) {
    if (!seg.code) continue;
    IDENT_RE.lastIndex = 0;
    let m;
    while ((m = IDENT_RE.exec(seg.text)) !== null) {
      used.add(m[0]);
      if (CHUNK_NAME_RE.test(m[0]) && !seen.has(m[0])) {
        seen.add(m[0]);
        order.push(m[0]);
      }
    }
  }
  if (!order.length) return source;

  for (const keyword of LUA_KEYWORDS) used.add(keyword);
  const map = new Map();
  let index = 0;
  for (const original of order) {
    used.delete(original);
    let candidate;
    do {
      candidate = nameForIndex(index++);
    } while (used.has(candidate));
    map.set(original, candidate);
    used.add(candidate);
  }

  for (const seg of segments) {
    if (!seg.code) continue;
    seg.text = seg.text.replace(IDENT_RE, (name) => (map.has(name) ? map.get(name) : name));
  }
  return segments.map((seg) => seg.text).join('');
}

function assignNames(state, options) {
  const used = new Set(state.globals);
  for (const keyword of LUA_KEYWORDS) used.add(keyword);
  // Reserve preserved wrapper names up-front so generated short names
  // never collide with them.
  for (const binding of state.bindings) {
    if (isPreservedLocal(binding.original, options)) used.add(binding.original);
    if (binding.keepName) used.add(binding.original);
  }
  let index = 0;
  for (const binding of state.bindings) {
    if (isPreservedLocal(binding.original, options)) {
      binding.newName = binding.original;
      continue;
    }
    // The implicit `self` of `function o:m()` must keep its name: it has no
    // source spelling, so the printer drops it and re-emits the `:` form.
    if (binding.keepName) {
      binding.newName = binding.original;
      continue;
    }
    let candidate;
    do {
      candidate = nameForIndex(index++);
    } while (used.has(candidate));
    binding.newName = candidate;
    used.add(candidate);
  }
}

function assignKeyNames(state) {
  // A chunk that can read key strings back (`pairs`/`next`) must keep them.
  if (state.keysEscape) {
    state.keyMap = new Map();
    return;
  }
  const used = new Set(state.keys);
  const keyMap = new Map();
  let index = 0;
  // Only rename keys that are *defined* on a local object
  // (`{ key = v }`, `{ ["key"] = v }`, `obj.key = v`,
  // `function obj.key()`). A bare use such as `local s = string;
  // s.sub(...)` must never make `sub` eligible — otherwise stdlib /
  // already-obfuscated code (`buffer.fromstring`, `string.gsub`,
  // `bit32.bxor`, ...) gets renamed and breaks at runtime.
  for (const original of state.definedKeys) {
    if (state.unsafeKeys.has(original)) continue;
    if (isReservedKey(original)) continue;
    let candidate;
    do {
      candidate = nameForIndex(index++);
    } while (used.has(candidate) || LUA_KEYWORDS.has(candidate));
    keyMap.set(original, candidate);
    used.add(candidate);
  }
  state.keyMap = keyMap;
}

function keyName(keyMap, name) {
  return keyMap && keyMap.has(name) ? keyMap.get(name) : name;
}

function rewriteBlock(stats, keyMap) {
  for (const stat of stats || []) rewriteStatement(stat, keyMap);
}

function rewriteFunction(node, keyMap) {
  const params = node[PARAM_BINDINGS] || [];
  node.params = node.params.map((name, index) => params[index] ? params[index].newName : name);
  rewriteBlock(node.body, keyMap);
}

function rewriteExpression(node, keyMap) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier':
      if (node[BINDING]) node.name = node[BINDING].newName;
      return;
    case 'ParenExpression':
      return rewriteExpression(node.expr, keyMap);
    case 'UnaryExpression':
      return rewriteExpression(node.arg, keyMap);
    case 'BinaryExpression':
      rewriteExpression(node.left, keyMap);
      rewriteExpression(node.right, keyMap);
      return;
    case 'MemberExpression':
      node.property = keyName(keyMap, node.property);
      return rewriteExpression(node.object, keyMap);
    case 'IndexExpression':
      rewriteExpression(node.object, keyMap);
      if (node.index && node.index.type === 'StringLiteral') {
        node.index.value = keyName(keyMap, node.index.value);
      }
      return rewriteExpression(node.index, keyMap);
    case 'CallExpression':
      rewriteExpression(node.callee, keyMap);
      for (const arg of node.args || []) rewriteExpression(arg, keyMap);
      return;
    case 'MethodCallExpression':
      node.method = keyName(keyMap, node.method);
      rewriteExpression(node.object, keyMap);
      for (const arg of node.args || []) rewriteExpression(arg, keyMap);
      return;
    case 'FunctionExpression':
      return rewriteFunction(node, keyMap);
    case 'TableConstructor':
      for (const field of node.fields || []) {
        if (field.type === 'TableKey') {
          if (field.key && field.key.type === 'StringLiteral') {
            field.key.value = keyName(keyMap, field.key.value);
          }
          rewriteExpression(field.key, keyMap);
        } else if (field.type === 'TableKeyString') {
          field.key = keyName(keyMap, field.key);
        }
        rewriteExpression(field.value, keyMap);
      }
      return;
    default:
      return;
  }
}

function rewriteStatement(node, keyMap) {
  if (!node) return;
  switch (node.type) {
    case 'DoStatement':
    case 'WhileStatement':
      if (node.cond) rewriteExpression(node.cond, keyMap);
      return rewriteBlock(node.body, keyMap);
    case 'LocalStatement': {
      for (const init of node.init || []) rewriteExpression(init, keyMap);
      const bindings = node[BINDINGS] || [];
      node.names = node.names.map((name, index) => bindings[index] ? bindings[index].newName : name);
      return;
    }
    case 'AssignmentStatement':
      for (const variable of node.vars || []) rewriteExpression(variable, keyMap);
      for (const init of node.inits || []) rewriteExpression(init, keyMap);
      return;
    case 'CompoundAssignment':
      rewriteExpression(node.target, keyMap);
      rewriteExpression(node.value, keyMap);
      return;
    case 'CallStatement':
      return rewriteExpression(node.expr, keyMap);
    case 'ReturnStatement':
      for (const arg of node.args || []) rewriteExpression(arg, keyMap);
      return;
    case 'IfStatement':
      for (const clause of node.clauses || []) {
        rewriteExpression(clause.cond, keyMap);
        rewriteBlock(clause.body, keyMap);
      }
      return rewriteBlock(node.elseBody, keyMap);
    case 'RepeatStatement':
      rewriteBlock(node.body, keyMap);
      return rewriteExpression(node.cond, keyMap);
    case 'ForNumericStatement': {
      rewriteExpression(node.start, keyMap);
      rewriteExpression(node.stop, keyMap);
      rewriteExpression(node.step, keyMap);
      const binding = (node[BINDINGS] || [])[0];
      if (binding) node.name = binding.newName;
      return rewriteBlock(node.body, keyMap);
    }
    case 'ForGenericStatement': {
      for (const iter of node.iters || []) rewriteExpression(iter, keyMap);
      const bindings = node[BINDINGS] || [];
      node.names = node.names.map((name, index) => bindings[index] ? bindings[index].newName : name);
      return rewriteBlock(node.body, keyMap);
    }
    case 'FunctionDeclaration': {
      const bindings = node[BINDINGS] || [];
      if (node.isLocal && bindings[0]) node.names[0] = bindings[0].newName;
      else if (!node.isLocal && bindings[0]) node.names[0] = bindings[0].newName;
      for (let i = 1; i < node.names.length; i++) {
        node.names[i] = keyName(keyMap, node.names[i]);
      }
      if (node.method) node.method = keyName(keyMap, node.method);
      return rewriteFunction(node, keyMap);
    }
    default:
      return;
  }
}

/**
 * Rename an already parsed AST in place and return it.
 *
 * `options.enabled === false` is useful for debugging or comparing the
 * generated wrapper with the original symbol names.
 *
 * Key renaming is intentionally conservative: only keys *defined* on a
 * local object are renamed. Pure uses via a local alias
 * (`local s = string; s.sub(...)`) do NOT make the key eligible, so
 * stdlib / Luau APIs and already-obfuscated wrappers
 * (`buffer.fromstring`, `string.gsub`, `bit32.bxor`, `__index`, ...) keep
 * working. Locals matching `/_chunk\d+$/` (VM wrapper anchors) are
 * preserved by default; pass `preserve: [...]` (strings / RegExps) to
 * keep additional names, or `preserveChunkNames: false` to rename them.
 */
function rename(ast, options) {
  if (!ast || ast.type !== 'Chunk') throw new TypeError('rename expects a parsed Lua Chunk');
  if (options && options.enabled === false) return ast;
  const state = collectBindings(ast);
  assignNames(state, options);
  if (!options || options.renameKeys !== false) assignKeyNames(state);
  rewriteBlock(ast.body, state.keyMap);
  return ast;
}

module.exports = {
  minifyLua,
  rename,
  shortenChunkNames,
  collapseNewlines,
};