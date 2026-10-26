'use strict';

/**
 * Host-side interpreter for deserialized IronBrew protos.
 * Matches VirtualMachine main_chunk24 + Handlers.js semantics (1-based PC,
 * baked constants, seal unseal, CLOSURE upvalue pseudo-ops).
 */

const { LuaTable, makeEnv } = require('../Compilers/IR/Interpreter');
const { CANONICAL } = require('../Compilers/IR/Opcodes');
const { bxor, sealkey, xorRange, regionKey, mixDispHash } = require('../Compilers/encode/Deserializer');
const { decodeLoadenc } = require('../Compilers/encode/LoadEnc');
const { hashHandlerBodies } = require('../Compilers/intern/DispHash');

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

function materialize(v) {
  if (v && typeof v === 'object' && ! (v instanceof LuaTable) && Array.isArray(v)) {
    return String.fromCharCode(...v);
  }
  return v;
}

function runVM(proto, options) {
  options = options || {};
  const settings = proto._settings || {};
  const sealBit = options.sealBit != null ? options.sealBit : (settings.sealBit != null ? settings.sealBit : 256);
  const sealMul = options.sealMul != null ? options.sealMul : (settings.sealMul != null ? settings.sealMul : 3);
  const sealAdd = options.sealAdd != null ? options.sealAdd : (settings.sealAdd != null ? settings.sealAdd : 1);
  const compiledHash = (settings.dispHash || 0) >>> 0;
  const claimedHash = options.dispHash != null ? (options.dispHash >>> 0) : compiledHash;
  const liveHash = hashHandlerBodies() >>> 0;
  const hashPoison = liveHash !== compiledHash || claimedHash !== compiledHash;
  const dispExtra = compiledHash;
  const poisonedInterns = typeof WeakSet === 'function' ? new WeakSet() : null;
  const markPoisoned = (t) => { if (poisonedInterns) poisonedInterns.add(t); };
  const wasPoisoned = (t) => !!(poisonedInterns && poisonedInterns.has(t));
  const idMap = options.idMap || settings.idMap;
  const moveId = idMap && idMap[CANONICAL.MOVE] != null ? idMap[CANONICAL.MOVE] : 0;
  const rev = settings.rev || Object.create(null);
  if (!settings.rev && idMap) {
    for (const [name, canon] of Object.entries(CANONICAL)) {
      const wire = idMap[canon] != null ? idMap[canon] : canon;
      rev[wire] = name;
    }
  } else if (!settings.rev) {
    for (const [name, id] of Object.entries(CANONICAL)) rev[id] = name;
  }

  const provided = options._envPack || makeEnv(options);
  const envTable = provided.env;
  const printOut = provided.printOut;
  // Bootstrap string.char for the intern filler (zero-string blob): injected
  // as the FIRST root arg (entry params=1 consumes it, rest are script args).
  // Mirrors LVM_CHUNK_31 passing string.char first in the Lua wrapper.
  const charFunc = (...codes) => {
    if (codes.length === 0) return [''];
    return [String.fromCharCode(...codes.map((n) => Number(n) & 255))];
  };

  function envGet(k) {
    return envTable.get(k);
  }
  function envSet(k, v) {
    envTable.set(k, v);
  }

  function callJs(fn, argv) {
    if (typeof fn !== 'function') {
      throw new Error('attempt to call a ' + (fn == null ? 'nil' : typeof fn) + ' value');
    }
    const r = fn(...argv);
    if (Array.isArray(r)) return r;
    if (r === undefined) return [];
    return [r];
  }

  function execute(P, args, protoUpvalues, envObj) {
    const StackSz = P.stackSz || 8;
    const F = new Array(StackSz);
    let Top = 1;
    let PC = 1;
    let J, E, r, o, q;
    const Allupvals = [];
    const nArgs = args.length;
    const Params = P.params || 0;
    for (let I = 1; I <= Params; I++) F[I - 1] = args[I - 1];
    let nVararg = nArgs - Params;
    if (nVararg < 0) nVararg = 0;
    const Varargs = [];
    for (let I = 1; I <= nVararg; I++) Varargs[I - 1] = args[Params + I - 1];

    const Opcodes = P.opcodes;
    const RegA = P.regA;
    const RegB = P.regB;
    const RegC = P.regC;
    const BIsK = P.bIsK;
    const CIsK = P.cIsK;
    const Protos = P.protosAt;
    const OA = P.OA;
    const nSlots = P.nSlots;

    const Kb = (i) => (BIsK[i] ? materialize(RegB[i]) : F[RegB[i]]);
    const Kc = (i) => (CIsK[i] ? materialize(RegC[i]) : F[RegC[i]]);

    if (!P._rgnRc) P._rgnRc = Object.create(null);
    const held = Object.create(null);

    const releaseHeld = (stD) => {
      const hld = held[stD];
      if (!hld) return;
      P._rgnRc[stD] = (P._rgnRc[stD] || 1) - 1;
      if (P._rgnRc[stD] <= 0) {
        xorRange(P, stD, hld.ln, mixDispHash(regionKey(hld.seed, hld.decPc, hld.op, hld.ln), hld.extra));
        P._rgnRc[stD] = 0;
      }
      delete held[stD];
    };

    const scrubRegions = () => {
      for (const k of Object.keys(held)) releaseHeld(Number(k));
    };

    let steps = 0;
    const limit = options.maxSteps || 5000000;

    const unsealIfNeeded = () => {
      let raw = Opcodes[PC];
      if (raw >= sealBit) {
        const key = sealkey(PC, sealMul, sealAdd);
        Opcodes[PC] = bxor(raw - sealBit, key);
        RegA[PC] = bxor(RegA[PC], key);
        RegB[PC] = bxor(RegB[PC], key);
        RegC[PC] = bxor(RegC[PC], key);
      }
      let Opcode = Opcodes[PC];
      if (OA && OA[PC] != null) Opcode = OA[PC];
      return Opcode;
    };

    while (PC >= 1 && PC <= nSlots) {
      if (++steps > limit) throw new Error('VM watchdog: exceeded ' + limit + ' instructions');
      const Opcode = unsealIfNeeded();
      const name = rev[Opcode];
      const A = RegA[PC];
      const B = RegB[PC];
      const C = RegC[PC];
      switch (name) {
        case 'MOVE':
        case 'MOVE2':
        case 'MOVE3':
          F[A] = F[B];
          break;
        case 'LOADK':
          F[A] = materialize(B);
          break;
        case 'LOADENC':
        case 'LOADENC2':
        case 'LOADENC3':
          F[A] = decodeLoadenc(B, Opcode, PC, name, options.encPerm || settings.encPerm);
          break;
        case 'LOADBOOL':
          F[A] = B !== 0;
          if (C !== 0) PC++;
          break;
        case 'LOADNIL':
          for (let I = A; I <= B; I++) F[I] = null;
          break;
        case 'GETUPVAL': {
          const uv = protoUpvalues[B];
          if (!uv) F[A] = undefined;
          else if (uv[4]) F[A] = uv[3];
          else F[A] = uv[2][uv[1]];
          break;
        }
        case 'GETGLOBAL':
          F[A] = envGet(Kb(PC));
          break;
        case 'GETTABLE':
          {
            const t = F[B];
            const key = Kc(PC);
            F[A] = t instanceof LuaTable ? t.get(key) : (t && t[key]);
          }
          break;
        case 'SETGLOBAL':
          envSet(Kb(PC), F[A]);
          break;
        case 'SETUPVAL': {
          const uv = protoUpvalues[B];
          if (uv) {
            if (uv[4]) uv[3] = F[A];
            else uv[2][uv[1]] = F[A];
          }
          break;
        }
        case 'SETTABLE': {
          const t = F[A];
          const key = Kb(PC);
          const val = Kc(PC);
          if (t instanceof LuaTable) t.set(key, val);
          else if (t) t[key] = val;
          break;
        }
        case 'NEWTABLE':
          F[A] = new LuaTable();
          break;
        case 'SELF': {
          const Bt = F[B];
          F[A + 1] = Bt;
          const key = Kc(PC);
          F[A] = Bt instanceof LuaTable ? Bt.get(key) : (Bt && Bt[key]);
          break;
        }
        case 'ADD':
        case 'ADDRR':
        case 'ADDRK':
        case 'ADDKK':
          F[A] = Number(Kb(PC)) + Number(Kc(PC)); break;
        case 'SUB':
        case 'SUBRR':
        case 'SUBRK':
        case 'SUBKK':
          F[A] = Number(Kb(PC)) - Number(Kc(PC)); break;
        case 'MUL':
        case 'MULRR':
        case 'MULRK':
        case 'MULKK':
          F[A] = Number(Kb(PC)) * Number(Kc(PC)); break;
        case 'DIV':
        case 'DIVRR':
        case 'DIVRK':
        case 'DIVKK':
          F[A] = Number(Kb(PC)) / Number(Kc(PC)); break;
        case 'IDIV':
        case 'IDIVRR':
        case 'IDIVRK':
        case 'IDIVKK':
          F[A] = Math.floor(Number(Kb(PC)) / Number(Kc(PC))); break;
        case 'MOD': F[A] = Number(Kb(PC)) % Number(Kc(PC)); break;
        case 'POW': F[A] = Math.pow(Number(Kb(PC)), Number(Kc(PC))); break;
        case 'UNM': F[A] = -Number(F[B]); break;
        case 'NOT': F[A] = !luaTruthy(F[B]); break;
        case 'LEN': F[A] = luaLen(F[B]); break;
        case 'CONCAT': {
          let s = F[B] == null ? '' : String(F[B]);
          for (let I = B + 1; I <= C; I++) s += F[I] == null ? '' : String(F[I]);
          F[A] = s;
          break;
        }
        case 'JMP':
          PC = B;
          break;
        case 'JMP_ABS':
          PC = B - 1;
          break;
        case 'JMP_REL':
          PC = PC + B;
          break;
        case 'EQ':
          if (luaEq(Kb(PC), Kc(PC)) !== (A !== 0)) PC++;
          break;
        case 'LT':
          if ((Kb(PC) < Kc(PC)) !== (A !== 0)) PC++;
          break;
        case 'LE':
          if ((Kb(PC) <= Kc(PC)) !== (A !== 0)) PC++;
          break;
        case 'TEST':
          if (( !luaTruthy(F[A]) ) !== (C !== 0)) {
            /* take following JMP */
          } else {
            PC++;
          }
          break;
        case 'TESTSET':
          if (( !luaTruthy(F[B]) ) !== (C !== 0)) {
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
          let results;
          if (B !== 1) {
            const argv = [];
            for (let i = A + 1; i <= Top; i++) argv.push(F[i]);
            results = callJs(F[A], argv);
          } else {
            results = callJs(F[A], []);
          }
          if (C !== 1) {
            let last;
            if (C === 0) {
              last = A + results.length - 1;
              Top = last;
            } else {
              last = A + C - 2;
              Top = last + 1;
            }
            let j = 0;
            for (let I = A; I <= last; I++) F[I] = results[j++];
          } else {
            Top = A - 1;
          }
          break;
        }
        case 'TAILCALL': {
          if (B !== 0) Top = A + B - 1;
          const argv = [];
          if (B !== 1) for (let i = A + 1; i <= Top; i++) argv.push(F[i]);
          scrubRegions();
          return callJs(F[A], argv);
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
          scrubRegions();
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
        case 'FORLOOP_ABS': {
          const step = F[A + 2];
          const idx = F[A] + step;
          F[A] = idx;
          if ((step > 0 && idx <= F[A + 1]) || (step <= 0 && idx >= F[A + 1])) {
            F[A + 3] = idx;
            PC = B - 1;
          }
          break;
        }
        case 'FORLOOP_REL': {
          const step = F[A + 2];
          const idx = F[A] + step;
          F[A] = idx;
          if ((step > 0 && idx <= F[A + 1]) || (step <= 0 && idx >= F[A + 1])) {
            F[A + 3] = idx;
            PC = PC + B;
          }
          break;
        }
        case 'FORPREP':
          F[A] = F[A] - F[A + 2];
          PC = B;
          break;
        case 'FORPREP_ABS':
          F[A] = F[A] - F[A + 2];
          PC = B - 1;
          break;
        case 'FORPREP_REL':
          F[A] = F[A] - F[A + 2];
          PC = PC + B;
          break;
        case 'TFORLOOP': {
          const results = callJs(F[A], [F[A + 1], F[A + 2]]);
          const base = A + 3;
          for (let i = 0; i < C; i++) F[base + i] = results[i];
          if (F[base] != null) F[A + 2] = F[base];
          else PC++;
          break;
        }
        case 'SETLIST': {
          let Cv = C;
          if (Cv === 0) Cv = 1;
          const offset = (Cv - 1) * 50;
          const last = B === 0 ? Top : (A + B);
          const t = F[A];
          for (let I = A + 1; I <= last; I++) {
            t.set(offset + (I - A), F[I]);
          }
          break;
        }
        case 'CLOSE': {
          for (let I = 0; I < Allupvals.length; I++) {
            const uv = Allupvals[I];
            if (!uv[4] && uv[2] === F && uv[1] >= A) {
              uv[3] = uv[2][uv[1]];
              uv[4] = true;
            }
          }
          break;
        }
        case 'CLOSURE': {
          const child = Protos[PC];
          const nUv = B;
          const upvals = nUv > 0 ? [] : null;
          const fn = function (...fnArgs) {
            return execute(child, fnArgs, upvals || [], envObj);
          };
          F[A] = fn;
          if (upvals) {
            for (let I = 1; I <= nUv; I++) {
              PC++;
              unsealIfNeeded();
              const mv = Opcodes[PC];
              if (mv === moveId) {
                const obj = { 1: RegB[PC], 2: F };
                upvals[I - 1] = obj;
                Allupvals.push(obj);
              } else {
                upvals[I - 1] = protoUpvalues[RegB[PC]];
              }
            }
          }
          break;
        }
        case 'NATIVE_CLOSURE': {
          const child = Protos[PC];
          const fn = function (...fnArgs) {
            return execute(child, fnArgs, [], envObj);
          };
          F[A] = fn;
          break;
        }
        case 'CRASH':
          throw Object.assign(new Error('XRN}'), { name: 'VmCrashError', xringCrash: true });
        case 'VARARG': {
          let n = B - 1;
          if (n === -1) {
            n = nVararg;
            Top = A + n - 1;
          }
          for (let I = 0; I < n; I++) F[A + I] = Varargs[I];
          break;
        }
        case 'GETI':
        case 'GETI2':
        case 'GETI3': {
          const t = F[B];
          const key = C;
          F[A] = t instanceof LuaTable ? t.get(key) : (t && t[key]);
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
          const I = F[iR];
          const obj = F[objR];
          const key = I instanceof LuaTable ? I.get(meth) : I[meth];
          const fn = obj instanceof LuaTable ? obj.get(key) : (obj && obj[key]);
          let results;
          if (argPack < 1) results = callJs(fn, [obj]);
          else {
            const argKey = argPack - 1;
            const arg = I instanceof LuaTable ? I.get(argKey) : I[argKey];
            results = callJs(fn, [obj, arg]);
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
          const results = callJs(r, [J, E]);
          F[A] = results[0];
          Top = A;
          break;
        }
        case 'CALL1': {
          const results = callJs(r, [J]);
          F[A] = results[0];
          Top = A;
          break;
        }
        case 'TKEYR':
          o = F[B];
          break;
        case 'TKEYK':
          o = Kb(PC);
          break;
        case 'TGETD':
          F[A] = J instanceof LuaTable ? J.get(o) : (J && J[o]);
          break;
        case 'TSET':
          if (J instanceof LuaTable) J.set(o, F[B]);
          else if (J) J[o] = F[B];
          break;
        case 'TSETK': {
          const v = Kb(PC);
          if (J instanceof LuaTable) J.set(o, v);
          else if (J) J[o] = v;
          break;
        }
        case 'GETFI': {
          const objR = B % 256;
          const iR = Math.floor(B / 256);
          const I = F[iR];
          const obj = F[objR];
          const key = I instanceof LuaTable ? I.get(C) : I && I[C];
          F[A] = obj instanceof LuaTable ? obj.get(key) : (obj && obj[key]);
          break;
        }
        case 'SETFI': {
          const objR = B % 256;
          const iR = Math.floor(B / 256);
          const I = F[iR];
          const obj = F[objR];
          const key = I instanceof LuaTable ? I.get(C) : I && I[C];
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
          const key = Kc(PC);
          F[A] = t instanceof LuaTable ? t.get(key) : (t && t[key]);
          break;
        }
        case 'SETFK': {
          const t = F[A];
          const key = Kb(PC);
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
          const results = callJs(r, [J, E, q]);
          F[A] = results[0];
          Top = A;
          break;
        }
        case 'REGION_DEC': {
          const stD = PC + 1;
          const lnD = B;
          if (!held[stD] && typeof lnD === 'number' && lnD >= 1 && stD + lnD - 1 <= nSlots) {
            let seed = C;
            if (typeof A === 'number' && A < 255) {
              const It = F[A];
              if (It && hashPoison) {
                const guestFn = It instanceof LuaTable ? It.get(0) : It[0];
                if (typeof guestFn === 'function' && !wasPoisoned(It)) {
                  markPoisoned(It);
                  const cur = It instanceof LuaTable ? It.get(C) : It[C];
                  if (typeof cur === 'number') {
                    const next = (cur + 1) >>> 0;
                    if (It instanceof LuaTable) It.set(C, next);
                    else It[C] = next;
                  }
                }
              }
              const got = It instanceof LuaTable ? It.get(C) : (It && It[C]);
              if (typeof got === 'number') seed = got;
            }
            if (!P._rgnRc[stD]) xorRange(P, stD, lnD, mixDispHash(regionKey(seed, PC, Opcode, lnD), dispExtra));
            P._rgnRc[stD] = (P._rgnRc[stD] || 0) + 1;
            held[stD] = { ln: lnD, seed, decPc: PC, op: Opcode, extra: dispExtra };
          }
          break;
        }
        case 'REGION_ENC': {
          const lnD = B;
          const stD = PC - lnD;
          if (held[stD]) releaseHeld(stD);
          break;
        }
        default:
          throw new Error('VM unknown opcode wire=' + Opcode + ' name=' + name + ' pc=' + PC);
      }
      PC++;
    }
    return [];
  }

  // Entry params=1 consumes charFunc; script args flow to ... (and on to
  // guest(I, ...) via the entry TAILCALL). Non-interned protos (plain
  // compileSource without InternPass, params=0) simply see charFunc as an
  // extra leading vararg — harmless for tests that never read top-level ....
  const results = execute(proto, [charFunc, ...(options.args || [])], [], envTable);
  return { results, printOut, env: envTable };
}

module.exports = { runVM };
