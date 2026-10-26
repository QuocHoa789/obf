'use strict';

/**
 * Lua 5.1 recursive-descent parser.
 * Produces a compact AST consumed by Compilers/IR/Compiler.js.
 */

const { tokenize, SyntaxErrorLua } = require('./Syntax');

const UNARY_OPS = new Set(['not', '#', '-']);
const COMPOUND_OPS = { '+=': 1, '-=': 1, '*=': 1, '/=': 1, '%=': 1, '..=': 1 };
const PRIORITY = {
  '+': [6, 6], '-': [6, 6],
  '*': [7, 7], '/': [7, 7], '//': [7, 7], '%': [7, 7],
  '^': [10, 9],
  '..': [5, 4],
  '==': [3, 3], '~=': [3, 3], '<': [3, 3], '<=': [3, 3], '>': [3, 3], '>=': [3, 3],
  and: [2, 2],
  or: [1, 1],
};

class Parser {
  constructor(source, filename) {
    this.tokens = tokenize(source, filename);
    this.p = 0;
    this.filename = filename || '=stdin';
  }

  parse() {
    const body = this.block();
    this.expect('eof');
    return { type: 'Chunk', body, loc: this._loc(body) };
  }

  peek(off) {
    return this.tokens[Math.min(this.p + (off || 0), this.tokens.length - 1)];
  }

  at(type) {
    return this.peek().type === type;
  }

  eat(type) {
    if (this.at(type)) {
      const t = this.peek();
      this.p++;
      return t;
    }
    return null;
  }

  expect(type) {
    const t = this.eat(type);
    if (!t) {
      const cur = this.peek();
      throw new SyntaxErrorLua(`expected ${type}, got ${cur.type}`, cur.line, cur.col);
    }
    return t;
  }

  _loc(node) {
    if (node && node.loc) return node.loc;
    const t = this.peek();
    return { line: t.line, col: t.col };
  }

  block() {
    const stats = [];
    while (!this._isBlockEnd()) {
      if (this.at('return') || this.at('break') || this._atContinueStmt()) {
        stats.push(this.stat());
        this.eat(';');
        break;
      }
      const s = this.stat();
      if (s) stats.push(s);
      this.eat(';');
    }
    return stats;
  }

  _atContinueStmt() {
    const t = this.peek();
    if (t.type === 'continue') return true;
    if (t.type !== 'name' || t.value !== 'continue') return false;
    const n = this.peek(1);
    if (!n) return true;
    const ty = n.type;
    return ty !== '=' && ty !== '(' && ty !== ':' && ty !== '[' && ty !== ',' && ty !== '.';
  }

  _isBlockEnd() {
    const t = this.peek().type;
    return t === 'end' || t === 'else' || t === 'elseif' || t === 'until' || t === 'eof';
  }

  stat() {
    const t = this.peek();
    switch (t.type) {
      case 'do': return this.doStat();
      case 'while': return this.whileStat();
      case 'repeat': return this.repeatStat();
      case 'if': return this.ifStat();
      case 'for': return this.forStat();
      case 'function': return this.funcStat(false);
      case 'local': return this.localStat();
      case 'return': return this.returnStat();
      case 'break': {
        this.eat('break');
        return { type: 'BreakStatement', loc: { line: t.line, col: t.col } };
      }
      case 'continue': {
        this.eat('continue');
        return { type: 'ContinueStatement', loc: { line: t.line, col: t.col } };
      }
      case ';':
        this.eat(';');
        return { type: 'EmptyStatement', loc: { line: t.line, col: t.col } };
      default:
        if (this._atContinueStmt()) {
          const tok = this.eat('name');
          return { type: 'ContinueStatement', loc: { line: tok.line, col: tok.col } };
        }
        return this.exprStat();
    }
  }

  doStat() {
    const t = this.expect('do');
    const body = this.block();
    this.expect('end');
    return { type: 'DoStatement', body, loc: { line: t.line, col: t.col } };
  }

  whileStat() {
    const t = this.expect('while');
    const cond = this.expr();
    this.expect('do');
    const body = this.block();
    this.expect('end');
    return { type: 'WhileStatement', cond, body, loc: { line: t.line, col: t.col } };
  }

  repeatStat() {
    const t = this.expect('repeat');
    const body = this.block();
    this.expect('until');
    const cond = this.expr();
    return { type: 'RepeatStatement', body, cond, loc: { line: t.line, col: t.col } };
  }

  ifStat() {
    const t = this.expect('if');
    const clauses = [];
    const cond = this.expr();
    this.expect('then');
    clauses.push({ cond, body: this.block() });
    while (this.eat('elseif')) {
      const c = this.expr();
      this.expect('then');
      clauses.push({ cond: c, body: this.block() });
    }
    let elseBody = null;
    if (this.eat('else')) elseBody = this.block();
    this.expect('end');
    return { type: 'IfStatement', clauses, elseBody, loc: { line: t.line, col: t.col } };
  }

  forStat() {
    const t = this.expect('for');
    const n1 = this.expect('name').value;
    if (this.eat('=')) {
      const start = this.expr();
      this.expect(',');
      const stop = this.expr();
      let step = null;
      if (this.eat(',')) step = this.expr();
      this.expect('do');
      const body = this.block();
      this.expect('end');
      return {
        type: 'ForNumericStatement',
        name: n1, start, stop, step, body,
        loc: { line: t.line, col: t.col },
      };
    }
    const names = [n1];
    while (this.eat(',')) names.push(this.expect('name').value);
    this.expect('in');
    const iters = this.exprList();
    this.expect('do');
    const body = this.block();
    this.expect('end');
    return {
      type: 'ForGenericStatement',
      names, iters, body,
      loc: { line: t.line, col: t.col },
    };
  }

  funcStat(isLocal) {
    const t = this.expect('function');
    const names = [this.expect('name').value];
    let method = null;
    while (this.eat('.')) names.push(this.expect('name').value);
    if (this.eat(':')) method = this.expect('name').value;
    const fn = this.funcBody(method ? ['self'] : []);
    return {
      type: 'FunctionDeclaration',
      isLocal: !!isLocal,
      names,
      method,
      ...fn,
      loc: { line: t.line, col: t.col },
    };
  }

  localStat() {
    const t = this.expect('local');
    if (this.at('function')) {
      const fn = this.funcStat(true);
      return fn;
    }
    const names = [this.expect('name').value];
    while (this.eat(',')) names.push(this.expect('name').value);
    let init = [];
    if (this.eat('=')) init = this.exprList();
    return {
      type: 'LocalStatement',
      names, init,
      loc: { line: t.line, col: t.col },
    };
  }

  returnStat() {
    const t = this.expect('return');
    let args = [];
    if (!this._isBlockEnd() && !this.at(';')) args = this.exprList();
    return { type: 'ReturnStatement', args, loc: { line: t.line, col: t.col } };
  }

  exprStat() {
    const e = this.suffixed();
    const op = this.peek().type;
    if (COMPOUND_OPS[op]) {
      this.p++;
      const value = this.expr();
      return { type: 'CompoundAssignment', target: this._asAssignable(e), op, value, loc: e.loc };
    }
    if (this.at('=') || this.at(',')) {
      const vars = [this._asAssignable(e)];
      while (this.eat(',')) vars.push(this._asAssignable(this.suffixed()));
      this.expect('=');
      const inits = this.exprList();
      return { type: 'AssignmentStatement', vars, inits, loc: e.loc };
    }
    if (e.type !== 'CallExpression' && e.type !== 'MethodCallExpression') {
      const cur = this.peek();
      throw new SyntaxErrorLua('unexpected expression (expected call or assignment)', cur.line, cur.col);
    }
    return { type: 'CallStatement', expr: e, loc: e.loc };
  }

  _asAssignable(e) {
    if (e.type === 'Identifier' || e.type === 'MemberExpression' || e.type === 'IndexExpression') return e;
    const cur = this.peek();
    throw new SyntaxErrorLua('invalid assignment target', cur.line, cur.col);
  }

  exprList() {
    const list = [this.expr()];
    while (this.eat(',')) list.push(this.expr());
    return list;
  }

  expr() {
    return this.subexpr(0);
  }

  subexpr(limit) {
    let left;
    const t = this.peek();
    if (UNARY_OPS.has(t.type) || (t.type === '-' && true)) {
      if (t.type === 'not' || t.type === '#' || t.type === '-') {
        this.p++;
        const arg = this.subexpr(8);
        left = { type: 'UnaryExpression', op: t.type, arg, loc: { line: t.line, col: t.col } };
      } else {
        left = this.simple();
      }
    } else {
      left = this.simple();
    }
    for (;;) {
      const op = this.peek().type;
      const pri = PRIORITY[op];
      if (!pri || pri[0] <= limit) break;
      this.p++;
      const right = this.subexpr(pri[1]);
      left = { type: 'BinaryExpression', op, left, right, loc: left.loc };
    }
    return left;
  }

  simple() {
    const t = this.peek();
    switch (t.type) {
      case 'nil': this.p++; return { type: 'NilLiteral', loc: { line: t.line, col: t.col } };
      case 'true': this.p++; return { type: 'BooleanLiteral', value: true, loc: { line: t.line, col: t.col } };
      case 'false': this.p++; return { type: 'BooleanLiteral', value: false, loc: { line: t.line, col: t.col } };
      case 'number': {
        this.p++;
        return { type: 'NumericLiteral', value: t.value, raw: t.raw != null ? t.raw : String(t.value), loc: { line: t.line, col: t.col } };
      }
      case 'string': this.p++; return { type: 'StringLiteral', value: t.value, long: !!t.long, loc: { line: t.line, col: t.col } };
      case '...': this.p++; return { type: 'VarargExpression', loc: { line: t.line, col: t.col } };
      case 'function': {
        this.p++;
        const fn = this.funcBody([]);
        return { type: 'FunctionExpression', ...fn, loc: { line: t.line, col: t.col } };
      }
      case '{': return this.table();
      default:
        return this.suffixed();
    }
  }

  funcBody(extraParams) {
    this.expect('(');
    const params = extraParams.slice();
    let vararg = false;
    if (!this.at(')')) {
      if (this.eat('...')) {
        vararg = true;
      } else {
        params.push(this.expect('name').value);
        while (this.eat(',')) {
          if (this.eat('...')) {
            vararg = true;
            break;
          }
          params.push(this.expect('name').value);
        }
      }
    }
    this.expect(')');
    const body = this.block();
    this.expect('end');
    return { params, vararg, body };
  }

  suffixed() {
    let node = this.primary();
    for (;;) {
      const t = this.peek();
      if (this.eat('.')) {
        const name = this.expect('name');
        node = {
          type: 'MemberExpression',
          object: node,
          property: name.value,
          loc: node.loc,
        };
      } else if (this.eat('[')) {
        const idx = this.expr();
        this.expect(']');
        node = { type: 'IndexExpression', object: node, index: idx, loc: node.loc };
      } else if (this.eat(':')) {
        const name = this.expect('name');
        const args = this.args();
        node = {
          type: 'MethodCallExpression',
          object: node,
          method: name.value,
          args,
          loc: node.loc,
        };
      } else if (t.type === '(' || t.type === '{' || t.type === 'string') {
        const args = this.args();
        node = { type: 'CallExpression', callee: node, args, loc: node.loc };
      } else break;
    }
    return node;
  }

  primary() {
    const t = this.peek();
    if (this.eat('(')) {
      const e = this.expr();
      this.expect(')');
      return { type: 'ParenExpression', expr: e, loc: { line: t.line, col: t.col } };
    }
    if (this.at('name')) {
      const n = this.expect('name');
      return { type: 'Identifier', name: n.value, loc: { line: n.line, col: n.col } };
    }
    throw new SyntaxErrorLua(`unexpected ${t.type}`, t.line, t.col);
  }

  args() {
    if (this.at('string')) {
      const s = this.expect('string');
      return [{ type: 'StringLiteral', value: s.value, long: !!s.long, loc: { line: s.line, col: s.col } }];
    }
    if (this.at('{')) return [this.table()];
    this.expect('(');
    const list = this.at(')') ? [] : this.exprList();
    this.expect(')');
    return list;
  }

  table() {
    const t = this.expect('{');
    const fields = [];
    while (!this.at('}')) {
      if (this.eat('[')) {
        const key = this.expr();
        this.expect(']');
        this.expect('=');
        const value = this.expr();
        fields.push({ type: 'TableKey', key, value });
      } else if (this.at('name') && this.peek(1).type === '=') {
        const name = this.expect('name');
        this.expect('=');
        const value = this.expr();
        fields.push({ type: 'TableKeyString', key: name.value, value });
      } else {
        fields.push({ type: 'TableValue', value: this.expr() });
      }
      if (this.eat(',') || this.eat(';')) continue;
      break;
    }
    this.expect('}');
    return { type: 'TableConstructor', fields, loc: { line: t.line, col: t.col } };
  }
}

function parse(source, filename) {
  return new Parser(source, filename).parse();
}

module.exports = { Parser, parse };
