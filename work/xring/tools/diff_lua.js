'use strict';
/**
 * End-to-end differential harness (Luau runtime required).
 *
 * For every corpus program it compares four independent executions:
 *   oracle : real Lua interpreter (fengari, optional)  -> reference output
 *   host   : Xring's IR compiler + host interpreter    (`--run`)
 *   vm     : Xring blob -> JS VM                        (`--run-vm`)
 *   lua    : generated obfuscated source run on Luau    (the actual deliverable)
 *
 * Usage:
 *   node tools/diff_lua.js [--filter substr] [--seeds 1,2] [--luau /path/to/luau]
 *                          [--skip-host] [--skip-vm] [--jobs N]
 *
 * Environment:
 *   XRING_LUAU  path to the Luau CLI (default: /tmp/luau-0.744/luau)
 *
 * Exit code 1 if any comparison fails.  BLOCKED/TIMEOUT are never counted as
 * passes; they are reported separately.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const { parse } = require(path.join(root, 'AST/Parser'));
const { compile } = require(path.join(root, 'Compilers/IR/Compiler'));
const { interpret } = require(path.join(root, 'Compilers/IR/Interpreter'));
const { obfuscate, runObfuscated } = require(path.join(root, 'VM/Virtualization'));
const corpus = require('./corpus');
const { runLua, available: oracleAvailable } = require('./luaoracle');

const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const filter = arg('--filter', null);
const seeds = String(arg('--seeds', '1')).split(',').map(Number);
const luau = process.env.XRING_LUAU || arg('--luau', '/tmp/luau-0.744/luau');
const skipHost = argv.includes('--skip-host');
const skipVm = argv.includes('--skip-vm');
const timeoutMs = Number(arg('--timeout', '20000'));

if (!fs.existsSync(luau)) {
  console.error(`BLOCKED: Luau CLI not found at ${luau} (set XRING_LUAU)`);
  process.exit(2);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xring-diff-'));

function runLuauFile(file) {
  const r = spawnSync(luau, [file], { encoding: 'utf8', timeout: timeoutMs });
  if (r.error && r.error.code === 'ETIMEDOUT') return { status: 'TIMEOUT' };
  if (r.status !== 0) {
    return { status: 'ERROR', error: (r.stderr || '').split('\n').slice(0, 3).join(' | ').trim() };
  }
  const out = (r.stdout || '').replace(/\n$/, '');
  return { status: 'OK', printOut: out === '' ? [] : out.split('\n') };
}

function runCase(c, seed) {
  const res = { name: c.name, seed, oracle: null, host: null, vm: null, lua: null };
  if (oracleAvailable()) {
    const o = runLua(c.src);
    res.oracle = o.ok ? { status: 'OK', printOut: o.printOut } : { status: 'ERROR', error: o.error };
  } else {
    res.oracle = { status: 'BLOCKED' };
  }
  if (!skipHost) {
    try {
      const proto = compile(parse(c.src, c.name + '.lua'));
      res.host = { status: 'OK', printOut: interpret(proto).printOut };
    } catch (e) {
      res.host = { status: 'ERROR', error: e.message };
    }
  }
  let luaSrc = null;
  try {
    const r = obfuscate(c.src, { filename: c.name + '.lua', seed });
    luaSrc = r.lua;
    res.lua = null;
  } catch (e) {
    res.lua = { status: 'ERROR', error: 'obfuscate: ' + e.message };
  }
  if (!res.lua) {
    const file = path.join(tmpDir, `case-${c.name}-${seed}.lua`);
    fs.writeFileSync(file, luaSrc);
    res.lua = runLuauFile(file);
  }
  if (!skipVm) {
    try {
      const r = runObfuscated(c.src, { filename: c.name + '.lua', seed });
      res.vm = { status: 'OK', printOut: r.printOut };
    } catch (e) {
      res.vm = { status: 'ERROR', error: e.message };
    }
  }
  return res;
}

function cmp(a, b) {
  return a.status === b.status && JSON.stringify(a.printOut) === JSON.stringify(b.printOut);
}

const results = [];
let pass = 0;
let fail = 0;
let blocked = 0;
let timeout = 0;
const failNames = [];

for (const c of corpus) {
  if (filter && !c.name.includes(filter)) continue;
  for (const seed of seeds) {
    const r = runCase(c, seed);
    results.push(r);
    const ref = r.oracle.status === 'OK' ? r.oracle : (r.oracle.status === 'BLOCKED' ? null : null);
    const checks = [];
    // Reference: the real runtime.  If the oracle cannot parse the program
    // (Luau-only syntax) fall back to the host interpreter as reference.
    const base = ref || (r.host && r.host.status === 'OK' ? r.host : null);
    if (!base) {
      blocked++;
      console.log(`BLOCKED ${c.name} seed=${seed} (no reference output)`);
      continue;
    }
    if (r.lua.status === 'TIMEOUT') { timeout++; checks.push('lua=TIMEOUT'); }
    else if (r.lua.status !== 'OK' || !cmp(r.lua, base)) checks.push('lua');
    // Only judge the host runner against a real runtime reference; when the
    // oracle is unavailable the host *is* the reference (see `base`).
    if (ref && r.host && !cmp(r.host, ref)) checks.push('host');
    if (r.vm && (!r.host || !cmp(r.vm, r.host))) checks.push('vm');
    if (checks.length === 0) {
      pass++;
    } else {
      fail++;
      failNames.push(`${c.name}#${seed}`);
      console.log(`FAIL ${c.name} seed=${seed} [${checks.join(',')}]`);
      console.log(`  src    : ${c.src.slice(0, 160)}`);
      console.log(`  ref    : ${JSON.stringify(base.printOut || base.error)}`);
      for (const k of ['host', 'vm', 'lua']) {
        if (!r[k] || k === 'host' && !ref) continue;
        console.log(`  ${k.padEnd(6)} : ${JSON.stringify(r[k].printOut || r[k].error || r[k].status)}`);
      }
    }
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log(`\n${pass} pass, ${fail} fail, ${blocked} blocked, ${timeout} timeout`);
if (fail) {
  console.log('failing:', failNames.join(', '));
  process.exitCode = 1;
}
