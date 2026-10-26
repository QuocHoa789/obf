'use strict';

/**
 * Lua 5.1 AST → proto compiler.
 * Emits 0-based registers, Lua 5.1 instruction semantics, upvalues, constants.
 * Jump operands are stored as absolute target-1 so the VM's trailing PC=PC+1
 * lands on the intended instruction (matching IronBrew2 handlers).
 */

const { CANONICAL, BINOPS } = require('./Opcodes');

const RK_REG = 0;
const RK_K = 1;

class CompileError extends Error {
  constructor(msg, loc) {
    super(loc ? `${msg} at ${loc.line}:${loc.col}` : msg);
    this.name = 'LuaCompileError';
    this.loc = loc;
  }
}

function kKey(v) {
  if (v === null || v === undefined) return 'nil';
  const t = typeof v;
  if (t === 'number') return 'n:' + v;
  if (t === 'boolean') return 'b:' + v;
  if (t === 'string') return 's:' + v;
  return 'x:' + String(v);
}

class FuncState {
  constructor(parent, name) {
    this.parent = parent || null;
    this.name = name || 'main';
    this.params = [];
    this.isVararg = parent === null ? true : false;
    this.locals = [];       // {name, reg, startpc, endpc, active}
    this.upvalues = [];     // {name, instack, idx}
    this.constants = [];    // values, 1-based in stream
    this.kmap = new Map();
    this.code = [];         // {op, A, B, C, Bk, Ck, Ak, loc}
    this.protos = [];
    this.lineinfo = [];
    this.maxstack = 2;
    this.freereg = 0;
    this.nactvar = 0;
    this.breaks = [];       // list of pending break jump pcs per loop
    this.pc = 0;
  }

  emit(inst) {
    inst.A = inst.A || 0;
    inst.B = inst.B || 0;
    inst.C = inst.C || 0;
    inst.Bk = !!inst.Bk;
    inst.Ck = !!inst.Ck;
    inst.Ak = !!inst.Ak;
    this.code.push(inst);
    this.lineinfo.push(inst.loc && inst.loc.line ? inst.loc.line : 0);
    this.pc = this.code.length;
    return this.pc - 1;
  }

  here() {
    return this.code.length;
  }

  patch(pc, target) {
    // store target-1 so VM PC=RegB then PC=PC+1 hits `target`
    this.code[pc].B = target - 1;
  }

  jmp(target, loc) {
    const pc = this.emit({ op: 'JMP', A: 0, B: 0, loc });
    if (target != null) this.patch(pc, target);
    return pc;
  }

  reserveregs(n) {
    this.freereg += n;
    if (this.freereg > this.maxstack) this.maxstack = this.freereg;
  }

  allocreg() {
    const r = this.freereg;
    this.reserveregs(1);
    return r;
  }

  freeregs(to) {
    if (to < this.nactvar) to = this.nactvar;
    this.freereg = to;
  }

  constIndex(v) {
    const key = kKey(v);
    if (this.kmap.has(key)) return this.kmap.get(key);
    this.constants.push(v);
    const idx = this.constants.length; // 1-based
    this.kmap.set(key, idx);
    return idx;
  }

  findLocal(name) {
    for (let i = this.locals.length - 1; i >= 0; i--) {
      const l = this.locals[i];
      if (l.active && l.name === name) return l;
    }
    return null;
  }

  searchVar(name) {
    const loc = this.findLocal(name);
    if (loc) return { kind: 'local', info: loc.reg };
    const uv = this.upvalues.findIndex((u) => u.name === name);
    if (uv >= 0) return { kind: 'upval', info: uv };
    if (this.parent) {
      const outer = this.parent.searchVar(name);
      if (outer.kind === 'local') {
        const idx = this.upvalues.length;
        this.upvalues.push({ name, instack: 1, idx: outer.info });
        return { kind: 'upval', info: idx };
      }
      if (outer.kind === 'upval') {
        const idx = this.upvalues.length;
        this.upvalues.push({ name, instack: 0, idx: outer.info });
        return { kind: 'upval', info: idx };
      }
    }
    return { kind: 'global', info: name };
  }

  enterblock() {
    return this.locals.length;
  }

  leaveblock(mark, closeFrom) {
    for (let i = this.locals.length - 1; i >= mark; i--) {
      this.locals[i].active = false;
      this.locals[i].endpc = this.here();
    }
    let top = 0;
    for (const l of this.locals) {
      if (l.active) top = Math.max(top, l.reg + 1);
    }
    this.nactvar = top;
    this.freereg = top;
    if (closeFrom != null && closeFrom < this.maxstack) {
      // CLOSE is emitted by the caller when upvalues exist
    }
  }

  newLocal(name) {
    const reg = this.nactvar;
    if (this.freereg < this.nactvar + 1) this.reserveregs(this.nactvar + 1 - this.freereg);
    this.locals.push({
      name,
      reg,
      startpc: this.here(),
      endpc: -1,
      active: true,
    });
    this.nactvar++;
    this.freereg = this.nactvar;
    if (this.freereg > this.maxstack) this.maxstack = this.freereg;
    return reg;
  }

  toProto() {
    return {
      name: this.name,
      params: this.params.length,
      isVararg: this.isVararg,
      maxstack: Math.max(this.maxstack, this.nactvar, 2),
      locals: this.locals.map((l) => ({ name: l.name, reg: l.reg, startpc: l.startpc, endpc: l.endpc })),
      upvalues: this.upvalues.slice(),
      constants: this.constants.slice(),
      code: this.code.slice(),
      protos: this.protos.slice(),
      lineinfo: this.lineinfo.slice(),
    };
  }
}

class Compiler {
  constructor() {
    this.fs = null;
  }

  compile(ast) {
    const fs = new FuncState(null, 'main');
    fs.isVararg = true;
    this.fs = fs;
    this.block(ast.body);
    this.emitReturn(0, 1, ast.loc); // RETURN 0,1 (no values) if fall-off
    return fs.toProto();
  }

  block(stats) {
    const mark = this.fs.enterblock();
    const nact = this.fs.nactvar;
    for (const s of stats) this.stat(s);
    const needClose = this._hasUpvalFrom(nact);
    if (needClose) {
      this.fs.emit({ op: 'CLOSE', A: nact, loc: null });
    }
    this.fs.leaveblock(mark);
  }

  _hasUpvalFrom(reg) {
    // conservative: if any nested proto captures a local >= reg
    for (const p of this.fs.protos) {
      for (const uv of p.upvalues) {
        if (uv.instack && uv.idx >= reg) return true;
      }
    }
    return false;
  }

  stat(s) {
    if (!s) return;
    switch (s.type) {
      case 'EmptyStatement': return;
      case 'DoStatement': return this.block(s.body);
      case 'LocalStatement': return this.localStat(s);
      case 'AssignmentStatement': return this.assignStat(s);
      case 'CompoundAssignment': return this.compoundStat(s);
      case 'CallStatement': return this.callStat(s);
      case 'ReturnStatement': return this.returnStat(s);
      case 'BreakStatement': return this.breakStat(s);
      case 'IfStatement': return this.ifStat(s);
      case 'WhileStatement': return this.whileStat(s);
      case 'RepeatStatement': return this.repeatStat(s);
      case 'ForNumericStatement': return this.forNum(s);
      case 'ForGenericStatement': return this.forGen(s);
      case 'FunctionDeclaration': return this.funcDecl(s);
      case 'CrashStatement':
        this.fs.emit({ op: 'CRASH', A: 0, B: 0, C: 0, loc: s.loc });
        return;
      default:
        throw new CompileError('unsupported statement ' + s.type, s.loc);
    }
  }

  localStat(s) {
    const nvars = s.names.length;
    const extra = this.fs.freereg;
    this.explist(s.init, nvars, extra);
    for (const name of s.names) this.fs.newLocal(name);
  }

  assignStat(s) {
    const nvars = s.vars.length;
    const saved = this.fs.freereg;
    const base = saved;
    this.explist(s.inits, nvars, base);
    for (let i = nvars - 1; i >= 0; i--) {
      this.storevar(s.vars[i], base + i);
    }
    this.fs.freeregs(saved);
  }

  compoundStat(s) {
    const op = String(s.op || '').slice(0, -1);
    this.assignStat({
      vars: [s.target],
      inits: [{ type: 'BinaryExpression', op, left: s.target, right: s.value, loc: s.loc }],
      loc: s.loc,
    });
  }

  storevar(v, srcReg) {
    if (v.type === 'Identifier') {
      const info = this.fs.searchVar(v.name);
      if (info.kind === 'local') {
        if (srcReg !== info.info) {
          this.fs.emit({ op: 'MOVE', A: info.info, B: srcReg, loc: v.loc });
        }
      } else if (info.kind === 'upval') {
        this.fs.emit({ op: 'SETUPVAL', A: srcReg, B: info.info, loc: v.loc });
      } else {
        const k = this.fs.constIndex(v.name);
        this.fs.emit({ op: 'SETGLOBAL', A: srcReg, B: k, Bk: true, loc: v.loc });
      }
      return;
    }
    if (v.type === 'MemberExpression' || v.type === 'IndexExpression') {
      const saved = this.fs.freereg;
      const t = this.expToReg(v.object, null, 1);
      let key;
      let ck;
      if (v.type === 'MemberExpression') {
        key = this.fs.constIndex(v.property);
        ck = true;
      } else if (this._isConst(v.index)) {
        key = this.fs.constIndex(this._constVal(v.index));
        ck = true;
      } else {
        key = this.expToReg(v.index, null, 1);
        ck = false;
      }
      this.fs.emit({
        op: 'SETTABLE',
        A: t,
        B: key, Bk: ck,
        C: srcReg, Ck: false,
        loc: v.loc,
      });
      this.fs.freeregs(saved);
      return;
    }
    throw new CompileError('invalid assignment target', v.loc);
  }

  callStat(s) {
    const saved = this.fs.freereg;
    this.expToReg(s.expr, null, 0); // 0 results (C=1)
    this.fs.freeregs(saved);
  }

  returnStat(s) {
    const n = s.args.length;
    if (n === 0) {
      this.emitReturn(0, 1, s.loc);
      return;
    }
    const saved = this.fs.freereg;
    const base = saved;
    const last = s.args[n - 1];
    const lastIsOpenCall = last && (
      last.type === 'CallExpression' || last.type === 'MethodCallExpression'
    );
    // Lua 5.1: `return f(...)` (single open call, no parens) is a tail call.
    if (n === 1 && lastIsOpenCall) {
      this.call(last, base, -1, last.type === 'MethodCallExpression');
      const inst = this.fs.code[this.fs.code.length - 1];
      if (inst && inst.op === 'CALL') inst.op = 'TAILCALL';
      this.fs.freeregs(saved);
      return;
    }
    for (let i = 0; i < n; i++) {
      const want = i === n - 1 ? -1 : 1;
      this.expToReg(s.args[i], base + i, want);
    }
    const open = last && (lastIsOpenCall || last.type === 'VarargExpression');
    if (open) this.emitReturn(base, 0, s.loc);
    else this.emitReturn(base, n + 1, s.loc);
    this.fs.freeregs(saved);
  }

  emitReturn(a, b, loc) {
    this.fs.emit({ op: 'RETURN', A: a, B: b, loc });
  }

  breakStat(s) {
    if (this.fs.breaks.length === 0) throw new CompileError('break outside loop', s.loc);
    const pc = this.fs.jmp(null, s.loc);
    this.fs.breaks[this.fs.breaks.length - 1].push(pc);
  }

  ifStat(s) {
    const endJumps = [];
    for (let i = 0; i < s.clauses.length; i++) {
      const cl = s.clauses[i];
      const { fj } = this.condJump(cl.cond, false);
      this.block(cl.body);
      if (i < s.clauses.length - 1 || s.elseBody) {
        endJumps.push(this.fs.jmp(null, cl.cond.loc));
      }
      this.fs.patch(fj, this.fs.here());
    }
    if (s.elseBody) this.block(s.elseBody);
    const end = this.fs.here();
    for (const j of endJumps) this.fs.patch(j, end);
  }

  whileStat(s) {
    const start = this.fs.here();
    this.fs.breaks.push([]);
    const { fj } = this.condJump(s.cond, false);
    this.block(s.body);
    this.fs.jmp(start, s.loc);
    this.fs.patch(fj, this.fs.here());
    const end = this.fs.here();
    for (const b of this.fs.breaks.pop()) this.fs.patch(b, end);
  }

  repeatStat(s) {
    // Lua 5.1: until-condition sees locals declared in the repeat body.
    const start = this.fs.here();
    this.fs.breaks.push([]);
    const mark = this.fs.enterblock();
    const nact = this.fs.nactvar;
    for (const st of s.body) this.stat(st);
    const { fj } = this.condJump(s.cond, false);
    this.fs.patch(fj, start);
    if (this._hasUpvalFrom(nact)) {
      this.fs.emit({ op: 'CLOSE', A: nact, loc: s.loc });
    }
    this.fs.leaveblock(mark);
    const end = this.fs.here();
    for (const b of this.fs.breaks.pop()) this.fs.patch(b, end);
  }

  condJump(cond, jumpIfTrue) {
    // TEST + JMP. Returns {tj, fj} one of which is the JMP pc.
    const saved = this.fs.freereg;
    const r = this.expToReg(cond, null, 1);
    // TEST A C: if (not R(A)) == C then skip next
    // We emit TEST then JMP(target).
    // jumpIfTrue=false → skip JMP when cond is true? 
    // Lua TEST: if (not R(A)) ~= (C~=0) then fall into JMP else skip JMP
    // Handler: if (not F[A]) ~= (C ~= 0) then else PC=PC+1 end
    // C=0: skip JMP when R(A) is truthy  → JMP taken when falsy  (jump if false)
    // C=1: skip JMP when R(A) is falsy   → JMP taken when truthy (jump if true)
    const c = jumpIfTrue ? 1 : 0;
    this.fs.emit({ op: 'TEST', A: r, C: c, loc: cond.loc });
    const jmp = this.fs.jmp(null, cond.loc);
    this.fs.freeregs(saved);
    if (jumpIfTrue) return { tj: jmp, fj: null };
    return { tj: null, fj: jmp };
  }

  forNum(s) {
    const mark = this.fs.enterblock();
    this.fs.breaks.push([]);
    const saved = this.fs.freereg;
    // FORPREP uses A, A+1, A+2 internal, A+3 is the visible index
    const base = this.fs.freereg;
    this.resTo(s.start, base);
    this.resTo(s.stop, base + 1);
    if (s.step) this.resTo(s.step, base + 2);
    else {
      this.fs.freereg = Math.max(this.fs.freereg, base + 3);
      this.fs.emit({ op: 'LOADK', A: base + 2, B: this.fs.constIndex(1), Bk: true, loc: s.loc });
    }
    this.fs.newLocal('($f0)');
    this.fs.newLocal('($f1)');
    this.fs.newLocal('($f2)');
    this.fs.newLocal(s.name);
    const prep = this.fs.emit({ op: 'FORPREP', A: base, B: 0, loc: s.loc });
    const bodyStart = this.fs.here();
    this.block(s.body);
    // `block` only closes body locals; the loop variable itself lives at
    // base+3 and is still open, so a closure built in the body would capture
    // the register by reference and every such closure would read the *last*
    // value the loop reached. Real Lua closes the loop-body upvalues at the
    // end of every iteration, which is what makes
    //   for i=1,3 do f[i]=function() return i end end  -- 1,2,3
    // work. Emit CLOSE base before jumping back, but only when a nested proto
    // actually captures one of these registers, so programs that never do keep
    // their exact instruction stream.
    if (this._hasUpvalFrom(base)) {
      this.fs.emit({ op: 'CLOSE', A: base, loc: null });
    }
    const loop = this.fs.emit({ op: 'FORLOOP', A: base, B: 0, loc: s.loc });
    this.fs.patch(prep, loop);
    this.fs.patch(loop, bodyStart);
    const end = this.fs.here();
    for (const b of this.fs.breaks.pop()) this.fs.patch(b, end);
    this.fs.leaveblock(mark);
    this.fs.freeregs(saved);
  }

  resTo(exp, reg) {
    while (this.fs.freereg < reg) this.fs.allocreg();
    this.expToReg(exp, reg, 1);
    this.fs.freereg = Math.max(this.fs.freereg, reg + 1);
  }

  forGen(s) {
    const mark = this.fs.enterblock();
    this.fs.breaks.push([]);
    const saved = this.fs.freereg;
    const base = this.fs.freereg;
    // generator, state, control at base, base+1, base+2
    this.explist(s.iters, 3, base);
    this.fs.newLocal('($g)');
    this.fs.newLocal('($s)');
    this.fs.newLocal('($c)');
    for (const name of s.names) this.fs.newLocal(name);
    // emit JMP to TFORLOOP, body, JMP back is TFORLOOP skip
    const prep = this.fs.jmp(null, s.loc);
    const bodyStart = this.fs.here();
    this.block(s.body);
    if (this._hasUpvalFrom(base)) {
      this.fs.emit({ op: 'CLOSE', A: base, loc: null });
    }
    this.fs.patch(prep, this.fs.here());
    this.fs.emit({
      op: 'TFORLOOP',
      A: base,
      C: s.names.length,
      loc: s.loc,
    });
    this.fs.jmp(bodyStart, s.loc);
    const end = this.fs.here();
    for (const b of this.fs.breaks.pop()) this.fs.patch(b, end);
    this.fs.leaveblock(mark);
    this.fs.freeregs(saved);
  }

  funcDecl(s) {
    if (s.isLocal) {
      // `local function f` ≡ `local f; f = function ... end` so f is in scope
      // inside its own body (recursion).
      const r = this.fs.newLocal(s.names[0]);
      const proto = this.compileFunction(s, s.names[0]);
      this.emitClosure(r, proto, s.loc);
      return;
    }
    const proto = this.compileFunction(s, s.names.join('.') + (s.method ? ':' + s.method : ''));
    // function a.b.c:d()  → get a, index b, index c, set d
    const saved = this.fs.freereg;
    const dest = this.fs.allocreg();
    this.emitClosure(dest, proto, s.loc);
    if (s.names.length === 1 && !s.method) {
      const info = this.fs.searchVar(s.names[0]);
      if (info.kind === 'local') {
        if (dest !== info.info) this.fs.emit({ op: 'MOVE', A: info.info, B: dest, loc: s.loc });
      } else if (info.kind === 'upval') {
        this.fs.emit({ op: 'SETUPVAL', A: dest, B: info.info, loc: s.loc });
      } else {
        this.fs.emit({ op: 'SETGLOBAL', A: dest, B: this.fs.constIndex(s.names[0]), Bk: true, loc: s.loc });
      }
    } else {
      const names = s.names.slice();
      const last = s.method || names.pop();
      let obj = this.nameToReg(names[0], s.loc);
      for (let i = 1; i < names.length; i++) {
        const tmp = this.fs.allocreg();
        this.fs.emit({
          op: 'GETTABLE',
          A: tmp, B: obj,
          C: this.fs.constIndex(names[i]), Ck: true,
          loc: s.loc,
        });
        obj = tmp;
      }
      this.fs.emit({
        op: 'SETTABLE',
        A: obj,
        B: this.fs.constIndex(last), Bk: true,
        C: dest, Ck: false,
        loc: s.loc,
      });
    }
    this.fs.freeregs(saved);
  }

  nameToReg(name, loc) {
    const info = this.fs.searchVar(name);
    if (info.kind === 'local') return info.info;
    const r = this.fs.allocreg();
    if (info.kind === 'upval') {
      this.fs.emit({ op: 'GETUPVAL', A: r, B: info.info, loc });
    } else {
      this.fs.emit({ op: 'GETGLOBAL', A: r, B: this.fs.constIndex(name), Bk: true, loc });
    }
    return r;
  }

  compileFunction(node, name) {
    const child = new FuncState(this.fs, name);
    child.params = node.params.slice();
    child.isVararg = !!node.vararg;
    const prev = this.fs;
    this.fs = child;
    for (const p of child.params) child.newLocal(p);
    this.block(node.body);
    this.emitReturn(0, 1, node.loc);
    this.fs = prev;
    const proto = child.toProto();
    if (node.keepNative) {
      proto.keepNative = true;
      proto.keepAst = node;
    }
    prev.protos.push(proto);
    return proto;
  }

  emitClosure(dest, proto, loc) {
    const pidx = this.fs.protos.indexOf(proto);
    const nUv = proto.upvalues.length;
    this.fs.emit({
      op: 'CLOSURE',
      A: dest,
      B: nUv,
      C: pidx + 1, // 1-based proto index into this func's proto list
      Ck: false,
      closure: true,
      loc,
    });
    for (const uv of proto.upvalues) {
      if (uv.instack) {
        this.fs.emit({ op: 'MOVE', A: 0, B: uv.idx, loc, upvalPseudo: true });
      } else {
        this.fs.emit({ op: 'GETUPVAL', A: 0, B: uv.idx, loc, upvalPseudo: true });
      }
    }
  }

  explist(list, nwant, base) {
    const n = list.length;
    this.fs.freereg = Math.max(this.fs.freereg, base);
    if (n === 0) {
      for (let i = 0; i < nwant; i++) {
        this.fs.emit({ op: 'LOADNIL', A: base + i, B: base + i, loc: null });
      }
      this.fs.freereg = Math.max(this.fs.freereg, base + nwant);
      return;
    }
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const want = last ? nwant - i : 1;
      this.expToReg(list[i], base + i, want);
    }
    if (n < nwant) {
      const open = list[n - 1] && (
        list[n - 1].type === 'CallExpression' ||
        list[n - 1].type === 'MethodCallExpression' ||
        list[n - 1].type === 'VarargExpression'
      );
      if (!open) {
        this.fs.emit({ op: 'LOADNIL', A: base + n, B: base + nwant - 1, loc: null });
      }
    }
    this.fs.freereg = Math.max(this.fs.freereg, base + nwant);
  }

  /**
   * Compile expression into `dest` (or a fresh reg if dest is null).
   * nresults: 1 = single, 0 = call-as-statement, -1 = all (open).
   * Returns the register holding the value (for nresults==1).
   */
  expToReg(exp, dest, nresults) {
    if (nresults == null) nresults = 1;
    switch (exp.type) {
      case 'NilLiteral':
        return this.loadnil(dest, exp.loc);
      case 'BooleanLiteral':
        return this.loadbool(dest, exp.value, false, exp.loc);
      case 'NumericLiteral':
      case 'StringLiteral':
        return this.loadk(dest, exp.type === 'NumericLiteral' ? exp.value : exp.value, exp.loc);
      case 'VarargExpression':
        return this.vararg(dest, nresults, exp.loc);
      case 'Identifier':
        return this.varToReg(exp, dest);
      case 'ParenExpression':
        return this.expToReg(exp.expr, dest, 1);
      case 'UnaryExpression':
        return this.unary(exp, dest);
      case 'BinaryExpression':
        return this.binary(exp, dest);
      case 'TableConstructor':
        return this.table(exp, dest);
      case 'FunctionExpression': {
        const r = dest != null ? dest : this.fs.allocreg();
        if (this.fs.freereg <= r) {
          this.fs.freereg = r + 1;
          if (this.fs.freereg > this.fs.maxstack) this.fs.maxstack = this.fs.freereg;
        }
        const proto = this.compileFunction(exp, exp.loc && ('@' + exp.loc.line));
        this.emitClosure(r, proto, exp.loc);
        return r;
      }
      case 'MemberExpression':
      case 'IndexExpression':
        return this.indexToReg(exp, dest);
      case 'CallExpression':
        return this.call(exp, dest, nresults, false);
      case 'MethodCallExpression':
        return this.call(exp, dest, nresults, true);
      case 'CrashExpression': {
        this.fs.emit({ op: 'CRASH', A: 0, B: 0, C: 0, loc: exp.loc });
        const r = this.ensureDest(dest);
        this.fs.emit({ op: 'LOADNIL', A: r, B: r, loc: exp.loc });
        return r;
      }
      default:
        throw new CompileError('unsupported expression ' + exp.type, exp.loc);
    }
  }

  ensureDest(dest) {
    if (dest != null) {
      if (this.fs.freereg <= dest) {
        this.fs.freereg = dest + 1;
        if (this.fs.freereg > this.fs.maxstack) this.fs.maxstack = this.fs.freereg;
      }
      return dest;
    }
    return this.fs.allocreg();
  }

  loadnil(dest, loc) {
    const r = this.ensureDest(dest);
    this.fs.emit({ op: 'LOADNIL', A: r, B: r, loc });
    return r;
  }

  loadbool(dest, v, skip, loc) {
    const r = this.ensureDest(dest);
    this.fs.emit({ op: 'LOADBOOL', A: r, B: v ? 1 : 0, C: skip ? 1 : 0, loc });
    return r;
  }

  loadk(dest, v, loc) {
    const r = this.ensureDest(dest);
    this.fs.emit({ op: 'LOADK', A: r, B: this.fs.constIndex(v), Bk: true, loc });
    return r;
  }

  vararg(dest, nresults, loc) {
    const r = this.ensureDest(dest);
    // B = nresults+1, 0 means all
    let b;
    if (nresults < 0) b = 0;
    else if (nresults === 0) b = 1;
    else b = nresults + 1;
    this.fs.emit({ op: 'VARARG', A: r, B: b, loc });
    if (nresults > 1) {
      this.fs.freereg = Math.max(this.fs.freereg, r + nresults);
      if (this.fs.freereg > this.fs.maxstack) this.fs.maxstack = this.fs.freereg;
    }
    return r;
  }

  varToReg(exp, dest) {
    const info = this.fs.searchVar(exp.name);
    if (info.kind === 'local') {
      if (dest == null || dest === info.info) return info.info;
      this.ensureDest(dest);
      this.fs.emit({ op: 'MOVE', A: dest, B: info.info, loc: exp.loc });
      return dest;
    }
    const r = this.ensureDest(dest);
    if (info.kind === 'upval') {
      this.fs.emit({ op: 'GETUPVAL', A: r, B: info.info, loc: exp.loc });
    } else {
      this.fs.emit({ op: 'GETGLOBAL', A: r, B: this.fs.constIndex(exp.name), Bk: true, loc: exp.loc });
    }
    return r;
  }

  indexToReg(exp, dest) {
    const r = this.ensureDest(dest);
    const saved = this.fs.freereg;
    // Put the table in `r` when we can so `t.k(...)` leaves r+1 free for args.
    const t = this.expToReg(exp.object, r, 1);
    if (exp.type === 'MemberExpression') {
      this.fs.emit({
        op: 'GETTABLE',
        A: r, B: t,
        C: this.fs.constIndex(exp.property), Ck: true,
        loc: exp.loc,
      });
    } else if (this._isConst(exp.index)) {
      this.fs.emit({
        op: 'GETTABLE',
        A: r, B: t,
        C: this.fs.constIndex(this._constVal(exp.index)), Ck: true,
        loc: exp.loc,
      });
    } else {
      const k = this.expToReg(exp.index, null, 1);
      this.fs.emit({ op: 'GETTABLE', A: r, B: t, C: k, Ck: false, loc: exp.loc });
    }
    this.fs.freereg = Math.max(saved, r + 1);
    if (this.fs.freereg > this.fs.maxstack) this.fs.maxstack = this.fs.freereg;
    return r;
  }

  unary(exp, dest) {
    const saved = this.fs.freereg;
    const r = this.ensureDest(dest);
    const b = this.expToReg(exp.arg, null, 1);
    const op = exp.op === '-' ? 'UNM' : exp.op === 'not' ? 'NOT' : 'LEN';
    this.fs.emit({ op, A: r, B: b, loc: exp.loc });
    return r;
  }

  binary(exp, dest) {
    if (exp.op === 'and' || exp.op === 'or') return this.shortCircuit(exp, dest);
    if (exp.op === '==' || exp.op === '~=' || exp.op === '<' || exp.op === '<=' ||
        exp.op === '>' || exp.op === '>=') {
      return this.relop(exp, dest);
    }
    if (exp.op === '..') return this.concat(exp, dest);
    const r = this.ensureDest(dest);
    const { b, bk } = this.expRK(exp.left);
    const { b: c, bk: ck } = this.expRK(exp.right);
    const op = BINOPS[exp.op];
    this.fs.emit({ op, A: r, B: b, Bk: bk, C: c, Ck: ck, loc: exp.loc });
    return r;
  }

  concat(exp, dest) {
    // flatten a .. b .. c
    const parts = [];
    const walk = (e) => {
      if (e.type === 'BinaryExpression' && e.op === '..') {
        walk(e.left);
        walk(e.right);
      } else parts.push(e);
    };
    walk(exp);
    const r = this.ensureDest(dest);
    const base = this.fs.freereg;
    for (let i = 0; i < parts.length; i++) this.expToReg(parts[i], base + i, 1);
    this.fs.emit({ op: 'CONCAT', A: r, B: base, C: base + parts.length - 1, loc: exp.loc });
    this.fs.freereg = Math.max(this.fs.freereg, base + parts.length);
    return r;
  }

  relop(exp, dest) {
    const r = this.ensureDest(dest);
    let left = exp.left;
    let right = exp.right;
    let op = exp.op;
    if (op === '>' || op === '>=') {
      const tmp = left; left = right; right = tmp;
      op = op === '>' ? '<' : '<=';
    }
    const { b, bk } = this.expRK(left);
    const { b: c, bk: ck } = this.expRK(right);
    const name = op === '==' || op === '~=' ? 'EQ' : op === '<' ? 'LT' : 'LE';
    const aflag = op === '~=' ? 0 : 1;
    // EQ A B C followed by JMP. If (B==C) ~= (A~=0) then skip JMP.
    // We want dest = comparison result.
    // Typical: EQ, JMP+1, LOADBOOL dest 0 skip, LOADBOOL dest 1
    this.fs.emit({ op: name, A: aflag, B: b, Bk: bk, C: c, Ck: ck, loc: exp.loc });
    const j = this.fs.jmp(null, exp.loc);
    this.fs.emit({ op: 'LOADBOOL', A: r, B: 0, C: 1, loc: exp.loc });
    this.fs.patch(j, this.fs.here());
    this.fs.emit({ op: 'LOADBOOL', A: r, B: 1, C: 0, loc: exp.loc });
    return r;
  }

  shortCircuit(exp, dest) {
    const r = this.ensureDest(dest);
    this.expToReg(exp.left, r, 1);
    if (exp.op === 'and') {
      // if left is falsy skip right
      this.fs.emit({ op: 'TEST', A: r, C: 0, loc: exp.loc });
      const j = this.fs.jmp(null, exp.loc);
      this.expToReg(exp.right, r, 1);
      this.fs.patch(j, this.fs.here());
    } else {
      this.fs.emit({ op: 'TEST', A: r, C: 1, loc: exp.loc });
      const j = this.fs.jmp(null, exp.loc);
      this.expToReg(exp.right, r, 1);
      this.fs.patch(j, this.fs.here());
    }
    return r;
  }

  _isConst(e) {
    return e && (
      e.type === 'NilLiteral' || e.type === 'BooleanLiteral' ||
      e.type === 'NumericLiteral' || e.type === 'StringLiteral'
    );
  }

  _constVal(e) {
    if (e.type === 'NilLiteral') return null;
    if (e.type === 'BooleanLiteral') return e.value;
    return e.value;
  }

  expRK(exp) {
    if (this._isConst(exp)) {
      return { b: this.fs.constIndex(this._constVal(exp)), bk: true };
    }
    return { b: this.expToReg(exp, null, 1), bk: false };
  }

  table(exp, dest) {
    const r = this.ensureDest(dest);
    this.fs.emit({ op: 'NEWTABLE', A: r, B: 0, C: 0, loc: exp.loc });
    let arr = [];
    const flush = () => {
      if (arr.length === 0) return;
      const n = arr.length;
      const firstIndex = arr[0].index;
      const open = arr[n - 1].open;
      // SETLIST stores F[A+1..A+B] into t[(C-1)*50+1 .. (C-1)*50+B], so it can
      // only write a run that *starts on a 50-element page boundary*. A table
      // constructor interrupted by a hash field (`{1, 2, x = 3, "s"}`) resumes
      // the list in the middle of a page; encoding that as SETLIST would store
      // the tail at t[1..] and drop it. Emit one SETTABLE per element instead.
      if ((firstIndex - 1) % 50 !== 0) {
        for (const e of arr) {
          const k = this.fs.constIndex(e.index);
          this.fs.emit({
            op: 'SETTABLE',
            A: r,
            B: k,
            Bk: true,
            C: e.reg,
            Ck: false,
            loc: exp.loc,
          });
        }
        arr = [];
        return;
      }
      const b = open ? 0 : n;
      const page = Math.floor((firstIndex - 1) / 50) + 1;
      this.fs.emit({ op: 'SETLIST', A: r, B: b, C: page, loc: exp.loc });
      arr = [];
    };
    let listIndex = 0;
    for (const f of exp.fields) {
      if (f.type === 'TableValue') {
        listIndex++;
        // Keep every element of the current page in its own slot of the window
        // A+1..A+50 (SETLIST reads exactly that window); a hash field flushed
        // in between may have left the cursor above the slot for this element.
        const want = r + 1 + ((listIndex - 1) % 50);
        if (this.fs.freereg > want) this.fs.freereg = want;
        while (this.fs.freereg < want) this.fs.allocreg();
        const vreg = want;
        this.fs.freereg = want + 1;
        if (this.fs.freereg > this.fs.maxstack) this.fs.maxstack = this.fs.freereg;
        const open = (
          f.value.type === 'CallExpression' ||
          f.value.type === 'MethodCallExpression' ||
          f.value.type === 'VarargExpression'
        );
        this.expToReg(f.value, vreg, open && listIndex ? -1 : 1);
        arr.push({ reg: vreg, index: listIndex, open });
        if (arr.length === 50) flush();
      } else {
        flush();
        const saved = this.fs.freereg;
        let key, bk;
        if (f.type === 'TableKeyString') {
          key = this.fs.constIndex(f.key);
          bk = true;
        } else if (this._isConst(f.key)) {
          key = this.fs.constIndex(this._constVal(f.key));
          bk = true;
        } else {
          key = this.expToReg(f.key, null, 1);
          bk = false;
        }
        const { b: val, bk: ck } = this.expRK(f.value);
        this.fs.emit({
          op: 'SETTABLE', A: r,
          B: key, Bk: bk,
          C: val, Ck: ck,
          loc: exp.loc,
        });
        this.fs.freeregs(saved);
      }
    }
    flush();
    this.fs.freereg = r + 1;
    return r;
  }

  call(exp, dest, nresults, isMethod) {
    let base = dest != null ? dest : this.fs.freereg;
    this.ensureDest(base);
    // The VM reads arguments from A+1..A+B-1, so the argument window must start
    // immediately above the callee slot. An enclosing expression can leave
    // `freereg` above that window (e.g. the stale temporaries of the left side
    // of `and`/`or`); placing the arguments at `freereg` there would pass the
    // wrong registers. Run the call in a scratch window above the live slots
    // and copy the results back down into `dest`.
    let scratch = -1;
    if (dest != null && this.fs.freereg > base + (isMethod ? 2 : 1)) {
      scratch = this.fs.freereg;
      base = scratch;
      this.ensureDest(base);
    }
    if (isMethod) {
      const obj = this.expToReg(exp.object, base, 1);
      if (obj !== base) this.fs.emit({ op: 'MOVE', A: base, B: obj, loc: exp.loc });
      this.fs.emit({
        op: 'SELF',
        A: base,
        B: base,
        C: this.fs.constIndex(exp.method),
        Ck: true,
        loc: exp.loc,
      });
      this.fs.freereg = Math.max(this.fs.freereg, base + 2);
    } else {
      this.expToReg(exp.callee, base, 1);
      this.fs.freereg = Math.max(this.fs.freereg, base + 1);
    }
    const args = exp.args;
    const argBase = this.fs.freereg;
    for (let i = 0; i < args.length; i++) {
      const last = i === args.length - 1;
      const open = last && (
        args[i].type === 'CallExpression' ||
        args[i].type === 'MethodCallExpression' ||
        args[i].type === 'VarargExpression'
      );
      this.expToReg(args[i], argBase + i, open ? -1 : 1);
    }
    const lastOpen = args.length > 0 && (
      args[args.length - 1].type === 'CallExpression' ||
      args[args.length - 1].type === 'MethodCallExpression' ||
      args[args.length - 1].type === 'VarargExpression'
    );
    // B = nargs+1, 0 = vararg
    let b;
    if (lastOpen) b = 0;
    else b = (isMethod ? args.length + 1 : args.length) + 1;
    let c;
    if (nresults < 0) c = 0;
    else c = nresults + 1;
    this.fs.emit({ op: 'CALL', A: base, B: b, C: c, loc: exp.loc });
    if (nresults > 1) {
      this.fs.freereg = Math.max(this.fs.freereg, base + nresults);
      if (this.fs.freereg > this.fs.maxstack) this.fs.maxstack = this.fs.freereg;
    } else if (nresults === 1) {
      this.fs.freereg = base + 1;
    } else if (nresults === 0) {
      this.fs.freereg = base;
    } else {
      this.fs.freereg = base + 1;
    }
    if (scratch >= 0) {
      const nres = nresults === 0 ? 0 : (nresults > 0 ? nresults : 1);
      for (let i = 0; i < nres; i++) {
        this.fs.emit({ op: 'MOVE', A: dest + i, B: base + i, loc: exp.loc });
      }
      this.fs.freereg = Math.max(scratch, dest + nres);
      if (this.fs.freereg > this.fs.maxstack) this.fs.maxstack = this.fs.freereg;
      return dest;
    }
    return base;
  }
}

function compile(ast) {
  const { applyMacros } = require('../../AST/Macros');
  applyMacros(ast);
  return new Compiler().compile(ast);
}

function compileSource(source, filename) {
  const { parse } = require('../../AST/Parser');
  return compile(parse(source, filename));
}

module.exports = { Compiler, compile, compileSource, CompileError, FuncState };
