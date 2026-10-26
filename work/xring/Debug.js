'use strict';

/**
 * Xring debug subsystem.
 *
 * Disabled by default: when disabled every entry point is a cheap no-op and
 * nothing is written anywhere, so obfuscation output, RNG consumption and
 * control flow stay byte-identical to a build without instrumentation.
 *
 * Activation (any of):
 *   XRING_DEBUG=1 node XringCLI/index.js input.lua -o out.lua
 *   node XringCLI/index.js input.lua --debug
 *   obfuscate(src, { debug: true })
 *
 * Optional:
 *   XRING_DEBUG_LOG=/path/log.txt   write diagnostics to a file instead of stderr
 *   XRING_DEBUG_DIR=/path/dir       dump per-stage Lua/AST artefacts there
 *   XRING_DEBUG_CHECKS=0            disable IR/AST validation checks
 *   XRING_MAX_STEPS=N               host interpreter instruction budget
 *
 * Guarantees:
 *   - never writes into the generated source or the normal output file;
 *   - never consumes random numbers (no rng use anywhere in this module);
 *   - never swallows exceptions: stage() rethrows the original error with
 *     extra context attached (err.xringStage) and the original stack intact.
 */

const fs = require('fs');
const path = require('path');

const TRUTHY = new Set(['1', 'true', 'yes', 'on', 'stages', 'all', 'debug']);

function envList(name) {
  const v = process.env[name];
  return v != null && TRUTHY.has(String(v).trim().toLowerCase());
}

function envInt(name) {
  const v = process.env[name];
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

class Debug {
  constructor(opts) {
    opts = opts || {};
    const envOn = envList('XRING_DEBUG');
    this.enabled = opts.debug === true || (opts.debug !== false && envOn);
    this.checks = opts.checks !== false && process.env.XRING_DEBUG_CHECKS !== '0';
    this.logPath = opts.logPath || process.env.XRING_DEBUG_LOG || null;
    this.dumpDir = opts.dumpDir || process.env.XRING_DEBUG_DIR || null;
    this.label = opts.label || 'xring';
    this.t0 = Date.now();
    this.dumpSeq = 0;
    this.budget = {
      ast: opts.astFindings || 40,
      proto: opts.protoFindings || 40,
      notes: opts.maxNotes || 400,
    };
    this.counts = Object.create(null);
    this.stack = [];
    if (this.enabled && this.dumpDir) {
      try {
        fs.mkdirSync(this.dumpDir, { recursive: true });
      } catch (e) {
        this.dumpDir = null;
        this.emit('warn', `cannot create XRING_DEBUG_DIR ${opts.dumpDir}: ${e.message}`);
      }
    }
    if (this.enabled) this.emit('debug', `debug enabled (pid ${process.pid})`);
  }

  /** Re-configure the singleton for one obfuscation run (never touches RNG). */
  configure(opts) {
    opts = opts || {};
    const envOn = envList('XRING_DEBUG');
    this.enabled = opts.debug === true || (opts.debug !== false && envOn);
    this.checks = opts.checks !== false && process.env.XRING_DEBUG_CHECKS !== '0';
    this.logPath = opts.logPath || process.env.XRING_DEBUG_LOG || null;
    this.dumpDir = opts.dumpDir || process.env.XRING_DEBUG_DIR || null;
    this.t0 = Date.now();
    this.counts = Object.create(null);
    if (this.enabled && this.dumpDir) {
      try {
        fs.mkdirSync(this.dumpDir, { recursive: true });
      } catch (e) {
        this.dumpDir = null;
        this.warn(`cannot create dump dir: ${e.message}`);
      }
    }
    return this;
  }

  elapsed() {
    return Date.now() - this.t0;
  }

  emit(level, msg) {
    if (!this.enabled) return;
    const line = `[${this.label} ${String(this.elapsed()).padStart(6)}ms] ${level.padEnd(5)} ${msg}`;
    if (this.counts[level] == null) this.counts[level] = 0;
    if (this.counts[level]++ >= this.budget.notes) return;
    if (this.logPath) {
      try {
        fs.appendFileSync(this.logPath, line + '\n');
      } catch (e) {
        process.stderr.write(`[${this.label}] debug log write failed: ${e.message}\n`);
        this.logPath = null;
      }
    } else {
      process.stderr.write(line + '\n');
    }
  }

  log(msg) {
    this.emit('debug', msg);
  }

  warn(msg) {
    this.emit('warn', msg);
  }

  /** Structured note: `k=v` pairs flattened, values truncated. */
  note(msg, data) {
    if (!this.enabled) return;
    let extra = '';
    if (data && typeof data === 'object') {
      const parts = [];
      for (const k of Object.keys(data)) {
        let v = data[k];
        if (typeof v === 'string' && v.length > 200) v = v.slice(0, 200) + '…';
        parts.push(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
      }
      if (parts.length) extra = ' ' + parts.join(' ');
    }
    this.emit('note', msg + extra);
  }

  /** Write a stage artefact (Lua source / JSON) to XRING_DEBUG_DIR. */
  dump(name, text) {
    if (!this.enabled || !this.dumpDir || text == null) return;
    const seq = String(++this.dumpSeq).padStart(2, '0');
    const safe = String(name).replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 60);
    try {
      fs.writeFileSync(path.join(this.dumpDir, `${seq}-${safe}.lua`), String(text));
    } catch (e) {
      this.warn(`dump ${name} failed: ${e.message}`);
    }
  }

  hash(text) {
    if (!this.enabled) return null;
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 16);
    } catch (e) {
      return null;
    }
  }

  /**
   * Run `fn` as a named pipeline stage.
   * Adds `err.xringStage` and an elapsed-time log line; rethrows untouched.
   */
  stage(name, fn, data) {
    if (!this.enabled) return fn();
    const t = Date.now();
    this.stack.push(name);
    this.emit('stage', `begin ${name}${data ? ' ' + JSON.stringify(data) : ''}`);
    try {
      const out = fn();
      this.emit('stage', `end   ${name} (${Date.now() - t}ms)`);
      return out;
    } catch (e) {
      this.emit('error', `FAILED ${name} after ${Date.now() - t}ms: ${e && e.name}: ${e && e.message}`);
      if (e && typeof e === 'object' && e.xringStage == null) e.xringStage = name;
      throw e;
    } finally {
      this.stack.pop();
    }
  }

  /**
   * AST structural validation (only called when enabled).
   * Reports the bug classes that used to produce invalid Lua:
   *   - statement lists nested inside statement lists (dropped by printers)
   *   - null/undefined statements
   *   - statements after `return`/`break`/`continue` in the same block
   */
  checkAst(root, label) {
    if (!this.enabled || !this.checks || !root) return { ok: true, findings: [] };
    const findings = [];
    const push = (kind, where, node) => {
      if (findings.length >= this.budget.ast) return;
      findings.push({ kind, where, type: node && node && node.type });
    };
    const EXIT = new Set(['ReturnStatement', 'BreakStatement', 'ContinueStatement']);
    const walk = (node, where) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        let seenExit = null;
        for (let i = 0; i < node.length; i++) {
          const item = node[i];
          const here = `${where}[${i}]`;
          if (item == null) {
            push('null-statement', here, item);
            continue;
          }
          if (Array.isArray(item)) {
            push('nested-statement-list', here, item[0]);
            walk(item, here);
            continue;
          }
          if (seenExit) push(`statement-after-${seenExit}`, here, item);
          walk(item, here);
          if (item.type && EXIT.has(item.type)) seenExit = item.type.toLowerCase().replace('statement', '');
        }
        return;
      }
      for (const k of Object.keys(node)) {
        if (k === 'loc' || k === 'raw') continue;
        const v = node[k];
        if (v && typeof v === 'object') walk(v, `${where}.${k}`);
      }
    };
    walk(root, label || 'ast');
    for (const f of findings) this.warn(`ast ${f.kind} at ${f.where}${f.type ? ' (' + f.type + ')' : ''}`);
    if (!findings.length) this.note(`ast ok ${label || ''}`);
    return { ok: findings.length === 0, findings };
  }

  /**
   * Proto/IR validation: opcode names, constant indexes, jump targets,
   * register operands, upvalue pseudo-instruction counts and proto indexes.
   * Returns { ok, findings }.
   */
  checkProto(proto, label) {
    if (!this.enabled || !this.checks || !proto) return { ok: true, findings: [] };
    const { CANONICAL } = require('./Compilers/IR/Opcodes');
    const findings = [];
    const push = (kind, where, detail) => {
      if (findings.length >= this.budget.proto) return;
      findings.push({ kind, where, detail });
    };
    const known = new Set(Object.keys(CANONICAL));
    const walk = (p, where) => {
      if (!p || !Array.isArray(p.code)) {
        push('bad-proto', where, String(p));
        return;
      }
      const nconst = (p.constants || []).length;
      const ncode = p.code.length;
      const stack = Math.max(p.maxstack || 0, 2);
      const uvSlots = new Set((p.upvalues || []).map((u, i) => i));
      for (let pc = 0; pc < ncode; pc++) {
        const ins = p.code[pc];
        const at = `${where}[${pc}]`;
        if (!ins || !ins.op) {
          push('missing-op', at, String(ins));
          continue;
        }
        if (!known.has(ins.op)) {
          push('unknown-op', at, ins.op);
          continue;
        }
        const A = ins.A | 0;
        const B = ins.B | 0;
        const C = ins.C | 0;
        if (A < 0 || A >= stack) push('A-out-of-range', at, `${ins.op} A=${A} maxstack=${stack}`);
        if (ins.Bk && (B < 1 || B > nconst)) push('B-const-out-of-range', at, `${ins.op} B=${B} nconst=${nconst}`);
        if (ins.Ck && (C < 1 || C > nconst)) push('C-const-out-of-range', at, `${ins.op} C=${C} nconst=${nconst}`);
        if (!ins.Bk && (B < 0 || B >= stack)) push('B-out-of-range', at, `${ins.op} B=${B} maxstack=${stack}`);
        if (!ins.Ck && (C < 0 || C >= stack)) push('C-out-of-range', at, `${ins.op} C=${C} maxstack=${stack}`);
        if (ins.op === 'JMP' || ins.op === 'FORLOOP' || ins.op === 'FORPREP') {
          const target = B + 1;
          if (target < 0 || target > ncode) push('jump-out-of-range', at, `${ins.op} target=${target} ncode=${ncode}`);
        }
        if (ins.op === 'CLOSURE') {
          const pidx = C - 1;
          if (pidx < 0 || pidx >= (p.protos || []).length) push('proto-index', at, `C=${C}`);
          const nuv = B;
          let expectPseudo = nuv;
          for (let k = 1; k <= nuv; k++) {
            const mv = p.code[pc + k];
            if (!mv || (mv.op !== 'MOVE' && mv.op !== 'GETUPVAL')) push('missing-upvalue-pseudo', `${at}+${k}`, mv && mv.op);
          }
          for (let k = 1; k <= expectPseudo && pc + k < ncode; k++) {
            const mv = p.code[pc + k];
            if (mv && mv.op === 'GETUPVAL' && !uvSlots.has(mv.B)) {
              push('upvalue-index', `${at}+${k}`, `B=${mv.B} nupvals=${uvSlots.size}`);
            }
          }
        }
        if (ins.op === 'VARARG' && ins.B !== 0 && ins.B !== 1 && A + (ins.B - 1) > stack) {
          push('vararg-overflow', at, `A=${A} B=${ins.B} maxstack=${stack}`);
        }
      }
      for (let i = 0; i < (p.protos || []).length; i++) walk(p.protos[i], `${where}/${i}`);
    };
    walk(proto, label || 'proto');
    for (const f of findings) this.warn(`ir ${f.kind} at ${f.where}: ${f.detail}`);
    if (!findings.length) this.note(`ir ok ${label || ''} code=${proto.code ? proto.code.length : 0}`);
    return { ok: findings.length === 0, findings };
  }

  /** Format an error with stage context for CLI diagnostics. */
  describeError(err) {
    const out = [];
    if (!err) return 'unknown error';
    out.push(`${err.name || 'Error'}: ${err.message}`);
    if (err.xringStage) out.push(`  stage: ${err.xringStage}`);
    if (err.loc) out.push(`  at ${err.loc.line}:${err.loc.col}`);
    if (err.stack) out.push(String(err.stack).split('\n').slice(1, 8).map((l) => '  ' + l.trim()).join('\n'));
    return out.join('\n');
  }
}

const defaultDebug = new Debug();

module.exports = { Debug, debug: defaultDebug, envInt };
