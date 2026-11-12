'use strict';

/**
 * Host-side Lua 5.1 interpreter over compiler protos.
 * Used to verify the AST compiler without a Luau runtime.
 */

class VmCrashError extends Error {
  constructor(msg) {
    super(msg == null ? 'XRN}' : String(msg));
    this.name = 'VmCrashError';
    this.xringCrash = true;
  }
}

class LuaTable {
  constructor() {
    this.arr = [];
    this.map = new Map();
    this.metatable = null;
  }
  get(k) {
    if (typeof k === 'number' && Number.isInteger(k) && k >= 1) {
      if (k < this.arr.length && this.arr[k] !== undefined) return this.arr[k];
    }
    if (this.map.has(k)) return this.map.get(k);
    return undefined;
  }
  set(k, v) {
    if (v === undefined || v === null) {
      if (typeof k === 'number' && Number.isInteger(k) && k >= 1 && k < this.arr.length) {
        this.arr[k] = undefined;
      }
      this.map.delete(k);
      return;
    }
    if (typeof k === 'number' && Number.isInteger(k) && k >= 1) {
      this.arr[k] = v;
      return;
    }
    this.map.set(k, v);
  }
  len() {
    let n = 0;
    for (let i = 1; i < this.arr.length; i++) {
      if (this.arr[i] === undefined || this.arr[i] === null) break;
      n = i;
    }
    return n;
  }
}

function luaTruthy(v) {
  return v !== undefined && v !== null && v !== false;
}

function luaEq(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  return false;
}

function luaLen(v) {
  if (typeof v === 'string') return v.length;
  if (v instanceof LuaTable) return v.len();
  if (Array.isArray(v)) return v.length;
  return 0;
}

function luaConcat(a, b) {
  const sa = a == null ? '' : String(a);
  const sb = b == null ? '' : String(b);
  return sa + sb;
}

function makeEnv(extra) {
  const env = new LuaTable();
  const printOut = extra && extra.printOut || [];
  env.set('print', function (...args) {
    printOut.push(args.map((x) => (x == null ? 'nil' : String(x))).join('\t'));
    return [];
  });
  env.set('type', function (v) {
    if (v == null) return ['nil'];
    if (typeof v === 'boolean') return ['boolean'];
    if (typeof v === 'number') return ['number'];
    if (typeof v === 'string') return ['string'];
    if (typeof v === 'function') return ['function'];
    return ['table'];
  });
  env.set('tostring', function (v) {
    if (v == null) return ['nil'];
    return [String(v)];
  });
  env.set('tonumber', function (v) {
    if (v == null) return [null];
    if (typeof v === 'number') return [v];
    const n = Number(v);
    return [Number.isFinite(n) ? n : null];
  });
  env.set('select', function (idx, ...rest) {
    if (idx === '#') return [rest.length];
    const i = Number(idx);
    return rest.slice(i - 1);
  });
  env.set('error', function (msg) {
    throw new Error(msg == null ? '' : String(msg));
  });
  env.set('assert', function (v, msg) {
    if (v === undefined || v === null || v === false) {
      throw new Error(msg == null ? 'assertion failed!' : String(msg));
    }
    return [v];
  });
  env.set('pcall', function (fn, ...args) {
    try {
      if (typeof fn !== 'function') return [false, 'attempt to call a ' + typeof fn + ' value'];
      const r = fn(...args);
      if (Array.isArray(r)) return [true].concat(r);
      if (r === undefined) return [true];
      return [true, r];
    } catch (e) {
      if (e && e.xringCrash) throw e;
      return [false, e && e.message ? e.message : String(e)];
    }
  });
  env.set('next', function (t, k) {
    if (!(t instanceof LuaTable)) return [];
    const keys = [];
    for (let i = 1; i < t.arr.length; i++) if (t.arr[i] != null) keys.push(i);
    for (const key of t.map.keys()) keys.push(key);
    if (k == null) {
      if (keys.length === 0) return [];
      return [keys[0], t.get(keys[0])];
    }
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === k) {
        if (i + 1 >= keys.length) return [];
        return [keys[i + 1], t.get(keys[i + 1])];
      }
    }
    return [];
  });
  env.set('pairs', function (t) {
    const iter = function (tbl, key) {
      return env.get('next')(tbl, key);
    };
    return [iter, t, null];
  });
  env.set('ipairs', function (t) {
    const iter = function (tbl, i) {
      i = (i || 0) + 1;
      const v = tbl.get ? tbl.get(i) : tbl[i];
      if (v == null) return [];
      return [i, v];
    };
    return [iter, t, 0];
  });
  const mathTbl = new LuaTable();
  mathTbl.set('abs', (x) => [Math.abs(Number(x))]);
  mathTbl.set('floor', (x) => [Math.floor(Number(x))]);
  mathTbl.set('ceil', (x) => [Math.ceil(Number(x))]);
  mathTbl.set('sqrt', (x) => [Math.sqrt(Number(x))]);
  mathTbl.set('min', (...xs) => [Math.min(...xs.map(Number))]);
  mathTbl.set('max', (...xs) => [Math.max(...xs.map(Number))]);
  mathTbl.set('huge', Infinity);
  mathTbl.set('pi', Math.PI);
  env.set('math', mathTbl);
  const strTbl = new LuaTable();
  strTbl.set('len', (s) => [String(s).length]);
  strTbl.set('sub', (s, i, j) => {
    s = String(s);
    i = Number(i);
    if (i < 0) i = s.length + i + 1;
    j = j == null ? s.length : Number(j);
    if (j < 0) j = s.length + j + 1;
    return [s.substring(i - 1, j)];
  });
  strTbl.set('rep', (s, n) => [String(s).repeat(Math.max(0, Number(n) || 0))]);
  strTbl.set('reverse', (s) => [String(s).split('').reverse().join('')]);
  strTbl.set('lower', (s) => [String(s).toLowerCase()]);
  strTbl.set('upper', (s) => [String(s).toUpperCase()]);
  strTbl.set('byte', (s, i, j) => {
    s = String(s);
    i = i == null ? 1 : Number(i);
    j = j == null ? i : Number(j);
    const out = [];
    for (let k = i; k <= j && k <= s.length; k++) out.push(s.charCodeAt(k - 1));
    return out;
  });
  strTbl.set('char', (...cs) => [String.fromCharCode(...cs.map(Number))]);
  env.set('string', strTbl);
  env.set('_G', env);
  if (extra && extra.env) {
    for (const [k, v] of Object.entries(extra.env)) env.set(k, v);
  }
  return { env, printOut };
}

function wrapLua(fn) {
  return fn;
}

function runProto(proto, args, env, parentUpvals, internTbl) {
  const code = proto.code;
  const F = [];
  const I = internTbl || [];
  let J, E, r, o, q;
  const nparams = proto.params || 0;
  for (let i = 0; i < nparams; i++) F[i] = args[i];
  const varargs = args.slice(nparams);
  let PC = 0;
  let Top = 0;
  const upvals = parentUpvals || [];
  const stackUpvals = [];

  const K = (inst, field) => {
    const isK = inst[field + 'k'] || inst[field + 'K'];
    const v = inst[field];
    if (isK) return proto.constants[v - 1];
    return F[v];
  };

  const closeFrom = (a) => {
    for (const uv of stackUpvals) {
      if (!uv.closed && uv.reg >= a) {
        uv.value = F[uv.reg];
        uv.closed = true;
      }
    }
  };

  const getUp = (idx) => {
    const uv = upvals[idx];
    if (!uv) return undefined;
    if (uv.closed) return uv.value;
    return uv.stack[uv.reg];
  };
  const setUp = (idx, val) => {
    const uv = upvals[idx];
    if (!uv) return;
    if (uv.closed) uv.value = val;
    else uv.stack[uv.reg] = val;
  };

  const callFn = (fn, argv) => {
    if (typeof fn === 'function') {
      const r = fn(...argv);
      if (Array.isArray(r)) return r;
      if (r === undefined) return [];
      return [r];
    }
    throw new Error('attempt to call a ' + typeof fn + ' value');
  };

  let steps = 0;
  while (PC < code.length) {
    const inst = code[PC];
    const A = inst.A || 0;
    const B = inst.B || 0;
    const C = inst.C || 0;
    steps++;
    if (process.env.XTRACE && steps <= 60 && (inst.op === 'JMP' || inst.op === 'EQ' || inst.op === 'LT' || inst.op === 'RETURN' || inst.op === 'LEN' || inst.op === 'CALL' || inst.op === 'GETGLOBAL')) {
      console.error('pc', PC, inst.op, 'B', B, 'C', C, 'S', F[14], 'mix', F[15], 'R2', typeof F[2] === 'string' ? F[2] : typeof F[2]);
    }
    if (steps > 200000) throw new Error('interp watchdog pc=' + PC + ' S=' + F[14] + ' mix=' + F[15]);
    switch (inst.op) {
      case 'MOVE':
      case 'MOVE2':
      case 'MOVE3': F[A] = F[B]; break;
      case 'LOADENC':
      case 'LOADENC2':
      case 'LOADENC3':
      case 'LOADK': F[A] = proto.constants[B - 1]; break;
      case 'LOADBOOL':
        F[A] = B !== 0;
        if (C !== 0) PC++;
        break;
      case 'LOADNIL':
        for (let i = A; i <= B; i++) F[i] = null;
        break;
      case 'GETUPVAL':
        F[A] = getUp(B);
        break;
      case 'GETGLOBAL': {
        const isK = inst.Bk || inst.BK;
        const name = isK ? proto.constants[B - 1] : F[B];
        F[A] = env.get(name);
        break;
      }
      case 'GETTABLE': {
        const t = F[B];
        const key = inst.Ck ? proto.constants[C - 1] : F[C];
        F[A] = t instanceof LuaTable ? t.get(key) : (t && t[key]);
        break;
      }
      case 'SETGLOBAL': {
        const isK = inst.Bk || inst.BK;
        const name = isK ? proto.constants[B - 1] : F[B];
        env.set(name, F[A]);
        break;
      }
      case 'SETUPVAL':
        setUp(B, F[A]);
        break;
      case 'SETTABLE': {
        const t = F[A];
        const key = inst.Bk ? proto.constants[B - 1] : F[B];
        const val = inst.Ck ? proto.constants[C - 1] : F[C];
        if (t instanceof LuaTable) t.set(key, val);
        else t[key] = val;
        break;
      }
      case 'NEWTABLE':
        F[A] = new LuaTable();
        break;
      case 'SELF': {
        const t = F[B];
        const key = inst.Ck ? proto.constants[C - 1] : F[C];
        F[A + 1] = t;
        F[A] = t instanceof LuaTable ? t.get(key) : t[key];
        break;
      }
      case 'ADD':
      case 'ADDRR':
      case 'ADDRK':
      case 'ADDKK':
        F[A] = Number(K(inst, 'B')) + Number(K(inst, 'C')); break;
      case 'SUB':
      case 'SUBRR':
      case 'SUBRK':
      case 'SUBKK':
        F[A] = Number(K(inst, 'B')) - Number(K(inst, 'C')); break;
      case 'MUL':
      case 'MULRR':
      case 'MULRK':
      case 'MULKK':
        F[A] = Number(K(inst, 'B')) * Number(K(inst, 'C')); break;
      case 'DIV':
      case 'DIVRR':
      case 'DIVRK':
      case 'DIVKK':
        F[A] = Number(K(inst, 'B')) / Number(K(inst, 'C')); break;
      case 'IDIV':
      case 'IDIVRR':
      case 'IDIVRK':
      case 'IDIVKK':
        F[A] = Math.floor(Number(K(inst, 'B')) / Number(K(inst, 'C'))); break;
      case 'MOD': F[A] = Number(K(inst, 'B')) % Number(K(inst, 'C')); break;
      case 'POW': F[A] = Math.pow(Number(K(inst, 'B')), Number(K(inst, 'C'))); break;
      case 'UNM': F[A] = -Number(F[B]); break;
      case 'NOT': F[A] = !luaTruthy(F[B]); break;
      case 'LEN': F[A] = luaLen(F[B]); break;
      case 'CONCAT': {
        let s = F[B];
        for (let i = B + 1; i <= C; i++) s = luaConcat(s, F[i]);
        F[A] = s;
        break;
      }
      case 'JMP_ABS':
      case 'JMP_REL':
      case 'JMP':
        PC = B; // IR B = target-1; packing differs only after serialize
        break;
      case 'EQ': {
        const lhs = K(inst, 'B');
        const rhs = K(inst, 'C');
        if (luaEq(lhs, rhs) !== (A !== 0)) PC++;
        break;
      }
      case 'LT': {
        const lhs = K(inst, 'B');
        const rhs = K(inst, 'C');
        if ((lhs < rhs) !== (A !== 0)) PC++;
        break;
      }
      case 'LE': {
        const lhs = K(inst, 'B');
        const rhs = K(inst, 'C');
        if ((lhs <= rhs) !== (A !== 0)) PC++;
        break;
      }
      case 'TEST':
        if ((!luaTruthy(F[A])) !== (C !== 0)) {
          /* take JMP */
        } else {
          PC++;
        }
        break;
      case 'TESTSET':
        if ((!luaTruthy(F[B])) !== (C !== 0)) {
          F[A] = F[B];
        } else {
          PC++;
        }
        break;
      case 'CALL0':
      case 'CALL0B':
      case 'CALL0R':
      case 'CALL0S':
      case 'CALL0T':
      case 'CALL0RS':
      case 'CALLA1':
      case 'CALLA1R':
      case 'CALLA1RB':
      case 'CALLA1S':
      case 'CALLA1T':
      case 'CALLA1RS':
      case 'CALLA2':
      case 'CALLA2R':
      case 'CALLA2S':
      case 'CALLA2RS':
      case 'CALLA3':
      case 'CALLA3R':
      case 'CALLA3S':
      case 'CALL': {
        if (B !== 0) Top = A + B - 1;
        const argv = [];
        if (B !== 1) {
          for (let i = A + 1; i <= Top; i++) argv.push(F[i]);
        }
        const results = callFn(F[A], argv);
        if (C !== 1) {
          let limit;
          if (C === 0) {
            limit = A + results.length - 1;
            Top = limit;
          } else {
            limit = A + C - 2;
            Top = limit + 1;
          }
          let j = 0;
          for (let i = A; i <= limit; i++) {
            F[i] = results[j++];
          }
        } else {
          Top = A - 1;
        }
        break;
      }
      case 'TAILCALL': {
        if (B !== 0) Top = A + B - 1;
        const argv = [];
        if (B !== 1) for (let i = A + 1; i <= Top; i++) argv.push(F[i]);
        return callFn(F[A], argv);
      }
      case 'RET0':
      case 'RET0B':
      case 'RET0T':
      case 'RET0X':
      case 'RET1':
      case 'RET1B':
      case 'RET1S':
      case 'RET1X':
      case 'RET2':
      case 'RET2S':
      case 'RET2X':
      case 'RET3':
      case 'RET3S':
      case 'RET3X':
      case 'RET4':
      case 'RET4S':
      case 'RET5':
      case 'RETURN': {
        closeFrom(0);
        if (B === 1) return [];
        if (B === 0) {
          const out = [];
          for (let i = A; i <= Top; i++) out.push(F[i]);
          return out;
        }
        const out = [];
        for (let i = A; i <= A + B - 2; i++) out.push(F[i]);
        return out;
      }
      case 'FORLOOP_ABS':
      case 'FORLOOP_REL':
      case 'FORLOOP': {
        const step = F[A + 2];
        const idx = F[A] + step;
        F[A] = idx;
        if ((step > 0 && idx <= F[A + 1]) || (step <= 0 && idx >= F[A + 1])) {
          F[A + 3] = idx;
          PC = B;
        }
        break;
      }
      case 'FORPREP_ABS':
      case 'FORPREP_REL':
      case 'FORPREP':
        F[A] = F[A] - F[A + 2];
        PC = B;
        break;
      case 'TFORLOOP': {
        const results = callFn(F[A], [F[A + 1], F[A + 2]]);
        const base = A + 3;
        for (let i = 0; i < C; i++) F[base + i] = results[i];
        if (F[base] != null) {
          F[A + 2] = F[base];
        } else {
          PC++;
        }
        break;
      }
      case 'SETLIST': {
        let cpage = C;
        if (cpage === 0) cpage = 1;
        const offset = (cpage - 1) * 50;
        const last = B === 0 ? Top : (A + B);
        const t = F[A];
        for (let i = A + 1; i <= last; i++) {
          t.set(offset + (i - A), F[i]);
        }
        break;
      }
      case 'CLOSE':
        closeFrom(A);
        break;
      case 'CLOSURE': {
        const child = proto.protos[C - 1];
        const nUv = B;
        const childUps = [];
        const fn = function (...fnArgs) {
          return runProto(child, fnArgs, env, childUps, I);
        };
        F[A] = fn;
        for (let i = 0; i < nUv; i++) {
          PC++;
          const mv = code[PC];
          if (mv.op === 'MOVE') {
            const obj = { stack: F, reg: mv.B, closed: false, value: undefined };
            childUps[i] = obj;
            stackUpvals.push(obj);
          } else {
            childUps[i] = upvals[mv.B];
          }
        }
        break;
      }
      case 'CRASH':
        throw new VmCrashError('XRN}');
      case 'GETI':
      case 'GETI2':
      case 'GETI3': {
        const t = F[B];
        F[A] = t instanceof LuaTable ? t.get(C) : (t && t[C]);
        break;
      }
      case 'PUTI': {
        const t = F[B];
        if (t instanceof LuaTable) t.set(C, F[A]);
        else if (t) t[C] = F[A];
        break;
      }
      case 'CALLM': {
        const objR = B % 256;
        const iR = (B - objR) / 256;
        const meth = C % 256;
        const argPack = (C - meth) / 256;
        const It = F[iR];
        const obj = F[objR];
        const key = It instanceof LuaTable ? It.get(meth) : It[meth];
        const fn = obj instanceof LuaTable ? obj.get(key) : (obj && obj[key]);
        let results;
        if (argPack < 1) results = callFn(fn, [obj]);
        else {
          const argKey = argPack - 1;
          const arg = It instanceof LuaTable ? It.get(argKey) : It[argKey];
          results = callFn(fn, [obj, arg]);
        }
        F[A] = results[0];
        Top = A;
        break;
      }
      case 'TLOAD':
        J = F[B];
        break;
      case 'TKEYI': {
        const t = F[B];
        o = t instanceof LuaTable ? t.get(C) : (t && t[C]);
        break;
      }
      case 'TGET':
        r = J instanceof LuaTable ? J.get(o) : (J && J[o]);
        break;
      case 'TARGI': {
        const t = F[B];
        E = t instanceof LuaTable ? t.get(C) : (t && t[C]);
        break;
      }
      case 'CALL2': {
        const results = callFn(r, [J, E]);
        F[A] = results[0];
        Top = A;
        break;
      }
      case 'CALL1': {
        const results = callFn(r, [J]);
        F[A] = results[0];
        Top = A;
        break;
      }
      case 'TKEYR':
        o = F[B];
        break;
      case 'TKEYK':
        o = inst.Bk || inst.BK ? proto.constants[B - 1] : F[B];
        break;
      case 'TGETD':
        F[A] = J instanceof LuaTable ? J.get(o) : (J && J[o]);
        break;
      case 'TSET':
        if (J instanceof LuaTable) J.set(o, F[B]);
        else if (J) J[o] = F[B];
        break;
      case 'TSETK': {
        const v = inst.Bk || inst.BK ? proto.constants[B - 1] : F[B];
        if (J instanceof LuaTable) J.set(o, v);
        else if (J) J[o] = v;
        break;
      }
      case 'GETFI': {
        const objR = B % 256;
        const iR = Math.floor(B / 256);
        const It = F[iR];
        const obj = F[objR];
        const key = It instanceof LuaTable ? It.get(C) : It && It[C];
        F[A] = obj instanceof LuaTable ? obj.get(key) : (obj && obj[key]);
        break;
      }
      case 'SETFI': {
        const objR = B % 256;
        const iR = Math.floor(B / 256);
        const It = F[iR];
        const obj = F[objR];
        const key = It instanceof LuaTable ? It.get(C) : It && It[C];
        if (obj instanceof LuaTable) obj.set(key, F[A]);
        else if (obj) obj[key] = F[A];
        break;
      }
      case 'GETFR': {
        const t = F[B];
        const key = F[C];
        F[A] = t instanceof LuaTable ? t.get(key) : (t && t[key]);
        break;
      }
      case 'SETFR': {
        const t = F[A];
        const key = F[B];
        if (t instanceof LuaTable) t.set(key, F[C]);
        else if (t) t[key] = F[C];
        break;
      }
      case 'GETFK': {
        const t = F[B];
        const key = proto.constants[C - 1];
        F[A] = t instanceof LuaTable ? t.get(key) : (t && t[key]);
        break;
      }
      case 'SETFK': {
        const t = F[A];
        const key = proto.constants[B - 1];
        if (t instanceof LuaTable) t.set(key, F[C]);
        else if (t) t[key] = F[C];
        break;
      }
      case 'TNEW':
        F[A] = new LuaTable();
        break;
      case 'TSETI': {
        const t = F[A];
        if (t instanceof LuaTable) t.set(B, F[C]);
        else if (t) t[B] = F[C];
        break;
      }
      case 'TFLUSH': {
        let page = C;
        if (page < 1) page = 1;
        const offset = (page - 1) * 50;
        const last = B === 0 ? Top : (A + B);
        const t = F[A];
        let i = 0;
        for (let I = A + 1; I <= last; I++) {
          i++;
          if (t instanceof LuaTable) t.set(offset + i, F[I]);
          else if (t) t[offset + i] = F[I];
        }
        break;
      }
      case 'TARGI2': {
        const t = F[B];
        q = t instanceof LuaTable ? t.get(C) : (t && t[C]);
        break;
      }
      case 'CALL3': {
        const results = callFn(r, [J, E, q]);
        F[A] = results[0];
        Top = A;
        break;
      }
      case 'REGION_DEC':
      case 'REGION_ENC':
        break;
      case 'VARARG': {
        let n = B - 1;
        if (n === -1) {
          n = varargs.length;
          Top = A + n - 1;
        }
        for (let i = 0; i < n; i++) F[A + i] = varargs[i];
        break;
      }
      default:
        throw new Error('unknown opcode ' + inst.op + ' at pc ' + PC);
    }
    PC++;
  }
  return [];
}

function interpret(proto, options) {
  options = options || {};
  const { env, printOut } = makeEnv(options);
  const internTbl = options._internTbl || [];
  const results = runProto(proto, options.args || [], env, [], internTbl);
  return { results, printOut, env, internTbl };
}

module.exports = { interpret, runProto, LuaTable, makeEnv, VmCrashError };
