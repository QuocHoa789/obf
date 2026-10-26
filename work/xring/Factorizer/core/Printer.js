'use strict';

/**
 * Lua AST → Xrings-compact source.
 *
 * Spaces only when two word-chars would glue (`0then` → `0 then`).
 * Every statement ends with `;` so you get `end;end;`, `]then`, `else if`.
 * If-spines mix ~30% `elseif` / ~70% `else if`; long spines flatten to
 * `elseif` so stacked `end`s stay at Xrings's ~7.
 */

const PREC = {
  or: 1,
  and: 2,
  '<': 3, '>': 3, '<=': 3, '>=': 3, '==': 3, '~=': 3,
  '..': 4,
  '+': 6, '-': 6,
  '*': 7, '/': 7, '//': 7, '%': 7,
  unot: 8, uhash: 8, uminus: 8,
  '^': 10,
};

const RIGHT_ASSOC = new Set(['..', '^']);

function precOf(node) {
  if (!node) return 99;
  if (node.type === 'BinaryExpression') return PREC[node.op] || 99;
  if (node.type === 'UnaryExpression') {
    if (node.op === 'not') return PREC.unot;
    if (node.op === '#') return PREC.uhash;
    return PREC.uminus;
  }
  return 99;
}

function isWordChar(c) {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
}

function needsSpace(a, b) {
  if (!a || !b) return false;
  const ac = a.charCodeAt(a.length - 1);
  const bc = b.charCodeAt(0);
  if (isWordChar(ac) && isWordChar(bc)) return true;
  if ((a.endsWith('-') && b.startsWith('-')) || (a.endsWith('+') && b.startsWith('+'))) return true;
  if (a.endsWith('.') && b.startsWith('.')) return true;
  if (a.endsWith('=') && (b.startsWith('=') || b.startsWith('~'))) return true;
  return false;
}

class Printer {
  constructor(rng) {
    this.out = '';
    this.rng = typeof rng === 'function' ? rng : null;
  }

  emit(s) {
    if (needsSpace(this.out, s)) this.out += ' ';
    this.out += s;
  }

  print(node) {
    this.out = '';
    if (!node) return '';
    if (node.type === 'Chunk') this.block(node.body);
    else if (node.type === 'FunctionExpression' || /Expression$|Literal$/.test(node.type)) this.expr(node, 0);
    else this.stat(node);
    return this.out;
  }

  block(stats) {
    for (let i = 0; i < (stats || []).length; i++) {
      const s = stats[i];
      // Defensive: a nested statement list used to be printed as `;`
      // (`else;`), which is a syntax error in Luau (empty statements were
      // removed). Flatten instead of dropping the statements.
      if (Array.isArray(s)) {
        this.block(s);
        continue;
      }
      if (!s) continue;
      const before = this.out.length;
      this.stat(s);
      // Lua/Luau grammar: `return`, `break` and `continue` must be the last
      // statement of a block. Anything generated after them is unreachable
      // dead code and would make the chunk fail to parse.
      if (s.type === 'ReturnStatement' || s.type === 'BreakStatement' || s.type === 'ContinueStatement') break;
      // Only terminate when the statement actually produced output: an empty
      // block must not emit a stray `;`.
      if (this.out.length > before && !this.out.endsWith(';')) this.emit(';');
    }
  }

  stat(node) {
    if (!node) return;
    switch (node.type) {
      case 'EmptyStatement':
        return;
      case 'DoStatement':
        this.emit('do');
        this.block(node.body);
        this.emit('end');
        return;
      case 'WhileStatement':
        this.emit('while');
        this.expr(node.cond, 0);
        this.emit('do');
        this.block(node.body);
        this.emit('end');
        return;
      case 'RepeatStatement':
        this.emit('repeat');
        this.block(node.body);
        this.emit('until');
        this.expr(node.cond, 0);
        return;
      case 'IfStatement': {
        this.printIf(node);
        return;
      }
      case 'ForNumericStatement':
        this.emit('for');
        this.emit(node.name);
        this.emit('=');
        this.expr(node.start, 0);
        this.emit(',');
        this.expr(node.stop, 0);
        if (node.step) {
          this.emit(',');
          this.expr(node.step, 0);
        }
        this.emit('do');
        this.block(node.body);
        this.emit('end');
        return;
      case 'ForGenericStatement':
        this.emit('for');
        this.emit(node.names.join(','));
        this.emit('in');
        for (let i = 0; i < node.iters.length; i++) {
          if (i) this.emit(',');
          this.expr(node.iters[i], 0);
        }
        this.emit('do');
        this.block(node.body);
        this.emit('end');
        return;
      case 'CrashStatement':
        this.emit('error("XRN}",0)');
        return;
      case 'FunctionDeclaration': {
        if (node.isLocal) this.emit('local');
        this.emit('function');
        this.emit(node.names.join('.'));
        if (node.method) {
          this.emit(':');
          this.emit(node.method);
        }
        this.emit('(');
        const params = node.method
          ? node.params.filter((p) => p !== 'self')
          : node.params.slice();
        if (node.vararg) params.push('...');
        this.emit(params.join(','));
        this.emit(')');
        this.block(node.body);
        this.emit('end');
        return;
      }
      case 'LocalStatement':
        this.emit('local');
        this.emit(node.names.join(','));
        if (node.init && node.init.length) {
          this.emit('=');
          for (let i = 0; i < node.init.length; i++) {
            if (i) this.emit(',');
            this.expr(node.init[i], 0);
          }
        }
        return;
      case 'AssignmentStatement':
        for (let i = 0; i < node.vars.length; i++) {
          if (i) this.emit(',');
          this.expr(node.vars[i], 0);
        }
        this.emit('=');
        for (let i = 0; i < node.inits.length; i++) {
          if (i) this.emit(',');
          this.expr(node.inits[i], 0);
        }
        return;
      case 'CompoundAssignment':
        this.expr(node.target, 0);
        this.emit(node.op);
        this.expr(node.value, 0);
        return;
      case 'CallStatement':
        this.expr(node.expr, 0);
        return;
      case 'ReturnStatement':
        this.emit('return');
        if (node.args && node.args.length) {
          for (let i = 0; i < node.args.length; i++) {
            if (i) this.emit(',');
            this.expr(node.args[i], 0);
          }
        }
        return;
      case 'BreakStatement':
        this.emit('break');
        return;
      case 'ContinueStatement':
        this.emit('continue');
        return;
      default:
        if (node.type) this.expr(node, 0);
    }
  }

  // Xrings: ~30% `elseif` / ~70% `else if`. Mix per junction.
  // Force elseif only when an else-if spine would push stacked `end`s past ~6
  // (their waterfall max is 7). Makeup sets preferElseif for the 3-arm snippet.
  printIf(node, nest) {
    if (!node || !(node.clauses || []).length) return;
    nest = nest || 0;
    const clauses = (node.clauses || []).slice();
    let elseBody = node.elseBody;

    if (node.preferElseif) {
      while (elseBody && elseBody.length === 1 && elseBody[0].type === 'IfStatement') {
        const inner = elseBody[0];
        if (!inner.clauses || !inner.clauses.length) break;
        for (let i = 0; i < inner.clauses.length; i++) clauses.push(inner.clauses[i]);
        elseBody = inner.elseBody;
      }
      for (let i = 0; i < clauses.length; i++) {
        this.emit(i === 0 ? 'if' : 'elseif');
        this.expr(clauses[i].cond, 0);
        this.emit('then');
        this.block(clauses[i].body);
      }
      if (elseBody && elseBody.length) {
        this.emit('else');
        this.block(elseBody);
      }
      this.emit('end');
      this.emit(';');
      return;
    }

    this.emit('if');
    this.expr(clauses[0].cond, 0);
    this.emit('then');
    this.block(clauses[0].body);

    const budget = Math.max(1, 6 - nest);
    let i = 1;
    const nestedIf = (body) => body && body.length === 1 && body[0].type === 'IfStatement';

    while (i < clauses.length || nestedIf(elseBody)) {
      if (i >= clauses.length && nestedIf(elseBody)) {
        const inner = elseBody[0];
        const rest = (inner.clauses || []).slice();
        if (!rest.length) break;
        clauses.push(rest[0]);
        if (rest.length > 1) {
          elseBody = [{ type: 'IfStatement', clauses: rest.slice(1), elseBody: inner.elseBody }];
        } else {
          elseBody = inner.elseBody;
        }
      }

      const remaining = (clauses.length - i)
        + (nestedIf(elseBody) ? 1 + this._elseIfDepth(elseBody) : 0);
      const forceElif = remaining > budget || nest >= 6;
      const useElif = forceElif || (this.rng && this.rng() < 0.30);
      if (useElif) {
        this.emit('elseif');
        this.expr(clauses[i].cond, 0);
        this.emit('then');
        this.block(clauses[i].body);
        i++;
        continue;
      }

      this.emit('else');
      this.printIf({
        type: 'IfStatement',
        clauses: clauses.slice(i),
        elseBody,
        preferElseif: false,
      }, nest + 1);
      this.emit('end');
      this.emit(';');
      return;
    }

    if (elseBody && elseBody.length) {
      this.emit('else');
      this.block(elseBody);
    }
    this.emit('end');
    this.emit(';');
  }


  _elseIfDepth(elseBody) {
    let n = 0;
    let body = elseBody;
    while (body && body.length === 1 && body[0].type === 'IfStatement') {
      n++;
      body = body[0].elseBody;
      if (n > 12) break;
    }
    return n;
  }


  expr(node, parentPrec) {
    if (!node) return;
    const wrap = (fn) => {
      const p = precOf(node);
      const need = p < parentPrec || (p === parentPrec && RIGHT_ASSOC.has(node.op) === false && parentPrec < 99);
      if (need) this.emit('(');
      fn();
      if (need) this.emit(')');
    };
    switch (node.type) {
      case 'NilLiteral':
        this.emit('nil');
        return;
      case 'BooleanLiteral':
        this.emit(node.value ? 'true' : 'false');
        return;
      case 'NumericLiteral':
        this.emit(node.raw != null ? String(node.raw) : String(node.value));
        return;
      case 'StringLiteral':
        // Long-bracket strings (notably the blob) round-trip byte-identical
        // so string encryption never applies to them.
        this.emit(node.long ? printLongString(node.value) : printString(node.value));
        return;
      case 'VarargExpression':
        this.emit('...');
        return;
      case 'Identifier':
        this.emit(node.name);
        return;
      case 'ParenExpression':
        this.emit('(');
        this.expr(node.expr, 0);
        this.emit(')');
        return;
      case 'UnaryExpression': {
        wrap(() => {
          if (node.op === '-') {
            this.emit('-');
            const arg = node.arg;
            const needParen = arg.type === 'UnaryExpression' || arg.type === 'NumericLiteral';
            if (needParen) this.emit('(');
            this.expr(arg, 0);
            if (needParen) this.emit(')');
          } else if (node.op === 'not') {
            this.emit('not');
            this.expr(node.arg, PREC.unot + 0.1);
          } else {
            this.emit(node.op);
            this.expr(node.arg, PREC.uhash + 0.1);
          }
        });
        return;
      }
      case 'BinaryExpression': {
        const p = PREC[node.op] || 9;
        wrap(() => {
          const lp = RIGHT_ASSOC.has(node.op) ? p + 0.1 : p - 0.1;
          const rp = RIGHT_ASSOC.has(node.op) ? p : p + 0.1;
          this.expr(node.left, lp);
          this.emit(node.op);
          this.expr(node.right, rp);
        });
        return;
      }
      case 'MemberExpression':
        this.expr(node.object, 99);
        this.emit('.');
        this.emit(node.property);
        return;
      case 'IndexExpression':
        this.expr(node.object, 99);
        this.emit('[');
        this.expr(node.index, 0);
        this.emit(']');
        return;
      case 'CallExpression':
        this.expr(node.callee, 99);
        this.printArgs(node.args);
        return;
      case 'MethodCallExpression':
        this.expr(node.object, 99);
        this.emit(':');
        this.emit(node.method);
        this.printArgs(node.args);
        return;
      case 'FunctionExpression':
        this.emit('function(');
        const params = node.params.slice();
        if (node.vararg) params.push('...');
        this.emit(params.join(','));
        this.emit(')');
        this.block(node.body);
        this.emit('end');
        return;
      case 'CrashExpression':
        this.emit('(error("XRN}",0))');
        return;
      case 'TableConstructor': {
        this.emit('{');
        const fields = node.fields || [];
        for (let i = 0; i < fields.length; i++) {
          if (i) this.emit(',');
          const f = fields[i];
          if (f.type === 'TableKey') {
            this.emit('[');
            this.expr(f.key, 0);
            this.emit(']=');
            this.expr(f.value, 0);
          } else if (f.type === 'TableKeyString') {
            this.emit(f.key);
            this.emit('=');
            this.expr(f.value, 0);
          } else {
            this.expr(f.value, 0);
          }
        }
        this.emit('}');
        return;
      }
      default:
        return;
    }
  }

  printArgs(args) {
    this.emit('(');
    for (let i = 0; i < (args || []).length; i++) {
      if (i) this.emit(',');
      this.expr(args[i], 0);
    }
    this.emit(')');
  }
}

function printLongString(s) {
  s = String(s);
  for (let n = 0; ; n++) {
    const eq = '='.repeat(n);
    const close = ']' + eq + ']';
    if (!s.includes(close)) {
      // Lua skips one leading newline of a long string on parse.
      const lead = s.startsWith('\n') || s.startsWith('\r') ? '\n' : '';
      return '[' + eq + '[' + lead + s + close;
    }
  }
}

function printString(s) {
  s = String(s);
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 92) out += '\\\\';
    else if (c === 34) out += '\\"';
    else if (c === 10) out += '\\n';
    else if (c === 13) out += '\\r';
    else if (c === 9) out += '\\t';
    else if (c === 0) out += '\\000';
    else if (c < 32 || c === 127) {
      const d = String(c);
      out += '\\' + '000'.slice(d.length) + d;
    } else {
      out += s.charAt(i);
    }
  }
  return out + '"';
}

function printAst(node, rng) {
  // Debug-only structural validation; no output change when disabled.
  require('../../Debug').debug.checkAst(node, 'print');
  return new Printer(rng).print(node);
}

module.exports = { Printer, printAst, printString, printLongString, needsSpace };
