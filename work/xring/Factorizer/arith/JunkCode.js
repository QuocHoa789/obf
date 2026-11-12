'use strict';

/**
 * JunkCode — Luraph-style smart junk for the Xring VM dispatch loop.
 *
 * Every emitted block is an opaque predicate over VM state whose outcome is
 * fixed at build time but opaque statically:
 *   if <pred-false> then <dead arm: traps, reg writes, nested junk> [else <live>] end
 *   if <pred-true>  then <live: nested junk only> [else <dead arm>] end
 *
 * SAFETY BY CONSTRUCTION: executed code only evaluates predicates and fresh
 * locals; every side effect (writes to F, regs, Opcodes, PC, Top, return,
 * error) sits in arms that provably never execute. A `return` always
 * terminates its arm (Lua requires it last in a block). No liveness analysis
 * needed, zero semantic risk.
 *
 * SMARTER THAN LURAPH:
 *  - Predicates are KEYED by decrypted blob bytes (builder-known values).
 *    Evaluating them requires the decrypted blob, i.e. the blob key —
 *    junk analysis is chained behind the blob encryption.
 *  - MBA single-byte predicates with full comparator variety, not a fixed
 *    `reg ~= 218` shape.
 *  - Return/break/error traps in dead arms (wrong-branch simplification
 *    breaks the VM), misleading fault messages.
 *  - Structure (orientation, nesting, arm order, ops, regs, constants) is
 *    re-rolled per build seed — same seed reproduces the same junk,
 *    different seeds give different junk shapes.
 *
 * Template-canonical identifiers (F, RegA/B/C, PC, Opcode, Top, Opcodes,
 * blob buffer name) are used so later rename passes stay consistent.
 */

const BUF = 'blob_chunk08';

// Seeded RNG (same seed => same junk). Set per build via emitJunk's ctx;
// defaults to Math.random so standalone callers keep polymorphic output.
let R = Math.random;
function srand(fn) { R = (typeof fn === 'function') ? fn : Math.random; }
function rnd() { return R(); }

let uid = 0;
function fresh() { uid += 1; return 'junkv' + uid + '_' + Math.floor(rnd() * 1e6); }

function ri(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

function reg() {
  // Luraph flavor: mix real Reg*[PC] with small literal indices.
  return rnd() < 0.7 ? pick(['RegA[PC]', 'RegB[PC]', 'RegC[PC]']) : String(ri(1, 60));
}

// Same-register tautologies. The `or 0` keeps evaluation total on Luau:
// Reg*[PC] can be nil on some steps and F[nil] errors (the JS harness
// silently yields undefined, hiding the crash).
//
// `x == x` is NOT a tautology: IEEE-754 says every comparison with NaN is
// false, and a payload that computes NaN (0/0, inf-inf, ...) can sit in any
// register the junk touches. A bare `x == x` guard then turned false and the
// *dead* arm -- traps, VM-state writes -- executed, corrupting or killing the
// run. Each predicate therefore spells out both halves so one of them is
// always true for every value including NaN:
//   always true : (x == x) or  (x ~= x)
//   always false: (x == x) and (x ~= x)
function regEq() {
  const g = reg();
  return `(F[${g} or 0] == F[${g} or 0]) or (F[${g} or 0] ~= F[${g} or 0])`;
}

function regNe() {
  const g = reg();
  return `(F[${g} or 0] == F[${g} or 0]) and (F[${g} or 0] ~= F[${g} or 0])`;
}

function bytePred(blob, len, wantTrue) {
  // Same blob byte, comparator chosen so the outcome is airtight.
  // NOTE: `~=` against the TRUE value is FALSE; against any other value TRUE.
  const p = ri(0, len - 1);
  const v = blob[p];
  if (wantTrue) {
    const op = pick(['==', '==', '<=', '>=', '~=']);
    if (op === '~=') return `buffer.readu8(${BUF}, ${p}) ~= ${(v + ri(1, 255)) % 256}`;
    const c = op === '==' ? v : op === '<=' ? v + ri(0, 200) : v - ri(0, Math.min(200, v));
    return `buffer.readu8(${BUF}, ${p}) ${op} ${c}`;
  }
  const op = pick(['~=', '~=', '<', '>']);
  return `buffer.readu8(${BUF}, ${p}) ${op} ${v}`;
}

function mbaPred(blob, len, wantTrue) {
  const p = ri(0, len - 1);
  const k1 = ri(1, 999) | 1, k2 = ri(0, 999), m = ri(256, 65536);
  const real = (blob[p] * k1 + k2) % m;
  const expr = `((buffer.readu8(${BUF}, ${p}) * ${k1} + ${k2}) % ${m})`;
  if (wantTrue) {
    const op = pick(['==', '==', '<=', '>=', '~=']);
    if (op === '~=') return `${expr} ~= ${(real + ri(1, m - 1)) % m}`;
    const c = op === '==' ? real : op === '<=' ? real + ri(0, 5000) : real - ri(0, Math.min(5000, real));
    return `${expr} ${op} ${c}`;
  }
  const op = pick(['~=', '~=', '<', '>']);
  return `${expr} ${op} ${real}`;
}

// Always-false / always-true predicates. Side-effect-free reads only;
// safe to execute on every VM step.
function predFalse(blob, len) {
  const r = rnd();
  if (r < 0.4) return bytePred(blob, len, false);
  if (r < 0.75) return mbaPred(blob, len, false);
  if (r < 0.88) return regNe();
  return 'false';
}

function predTrue(blob, len) {
  const r = rnd();
  if (r < 0.4) return bytePred(blob, len, true);
  if (r < 0.75) return mbaPred(blob, len, true);
  if (r < 0.88) return regEq();
  return 'true';
}

// Dead-arm payloads: NEVER execute. Traps + plausible VM-state writes +
// nested junk (safe by the same rule, recursively). A `return` always ends
// its arm — Lua requires it last in a block.
function deadStmts(blob, len, depth) {
  const out = [];
  const n = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < n; i++) {
    const r = rnd();
    let st;
    if (r < 0.2) {
      st = pick([
        `return F[${reg()}]`,
        `return Opcodes[PC]`,
        `return PC`,
        `return ${reg()}`,
      ]);
      out.push(st);
      break; // return must be last in its block
    } else if (r < 0.35) {
      st = pick([
        `error("VM integrity fault")`,
        `error("stack overflow")`,
        `error("bad argument")`,
        `break`,
      ]);
      out.push(st);
      // `break` must also end its arm: stricter parsers (5.1 grammar)
      // reject any statement after it in the same block.
      if (st === 'break') break;
    } else if (r < 0.75) {
      const a = reg(), b = reg(), c = reg();
      out.push(pick([
        `F[${a}] = -F[${b}]`,
        `F[${a}] = 110 * F[${b}]`,
        `F[${a}] = F[${b}] % F[${c}]`,
        `F[${a}] = F[${b}] + F[${c}]`,
        `Opcodes[PC] = ${b}`,
        `PC = ${c}`,
        `Top = ${a}`,
        `F[${a}] = ${ri(0, 9999)}`,
      ]));
    } else if (depth > 0) {
      out.push(junkBlock(blob, len, depth - 1));
    } else {
      out.push(`do end`);
    }
  }
  return out;
}

// Live-arm payloads: EXECUTE, so nested predicates + fresh locals only.
function liveStmts(blob, len, depth) {
  if (depth <= 0 || rnd() < 0.35) {
    if (rnd() < 0.5) return [];
    const j = fresh();
    const p = ri(0, len - 1);
    return [`do local ${j} = buffer.readu8(${BUF}, ${p}) end`];
  }
  return [junkBlock(blob, len, depth - 1)];
}

function junkBlock(blob, len, depth, forceNumeric) {
  const falsy = rnd() < 0.5;
  // forceNumeric (first block per build): top predicate must be a numeric
  // blob read so presence is textually assertable; deeper levels stay free.
  const pred = forceNumeric
    ? (rnd() < 0.5 ? bytePred(blob, len, !falsy) : mbaPred(blob, len, !falsy))
    : (falsy ? predFalse(blob, len) : predTrue(blob, len));
  // Dead side holds payloads; live side holds nested-only statements.
  const dead = deadStmts(blob, len, depth);
  const live = liveStmts(blob, len, depth);
  let s;
  if (!falsy || rnd() < 0.85) {
    // if FALSE then DEAD else LIVE end  |  if TRUE then LIVE else DEAD end
    const thenArm = falsy ? dead : live;
    const elseArm = falsy ? live : dead;
    s = `if ${pred} then`;
    for (const st of thenArm) s += `\n${st}`;
    if (elseArm.length > 0) {
      s += `\nelse`;
      for (const st of elseArm) s += `\n${st}`;
    }
    s += `\nend`;
  } else {
    // falsy only: flattened twin — `if FALSE then DEAD end` +
    // `if TRUE then LIVE end`. Both sides stay on their safe polarity.
    s = `if ${pred} then`;
    for (const st of dead) s += `\n${st}`;
    s += `\nend\nif ${predTrue(blob, len)} then`;
    for (const st of live) s += `\n${st}`;
    s += `\nend`;
  }
  // camouflage: trivially-dead twin, like Luraph's `if false then else ... end`
  if (depth > 0 && rnd() < 0.08) {
    s += `\nif false then\nelse\n${junkBlock(blob, len, 0)}\nend`;
  }
  return s;
}

function emitJunk(ctx) {
  ctx = ctx || {};
  srand(ctx.rand || ctx.rng || null);
  try {
    const blob = ctx.blob;
    if (!blob || blob.length === 0) return '';
    uid = 0;
    const n = 2 + Math.floor(rnd() * 3); // 2-4 top-level blocks
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(junkBlock(blob, blob.length, 1 + Math.floor(rnd() * 2), i === 0));
    }
    return out.join('\n');
  } finally {
    srand(null);
  }
}

module.exports = { emitJunk, srand, predTrue, predFalse, BUF };
