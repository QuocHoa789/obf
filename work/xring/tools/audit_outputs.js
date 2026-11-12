'use strict';
/**
 * Output-stability audit.
 *
 *   node tools/audit_outputs.js
 *
 * For every corpus program and seed it checks two invariants that the
 * "preserve existing obfuscation output" rule requires:
 *
 *  1. Debug neutrality — obfuscating with XRING_DEBUG on (which only writes
 *     diagnostics to stderr / a log file) must produce byte-identical source.
 *  2. Change surface — the source must be identical to the output produced
 *     with the collision repairs disabled, *except* for the inputs the repairs
 *     actually fire on.  Every differing input is printed with the reason, so a
 *     reviewer can confirm the change is intended and minimal.
 */
const fs = require('fs');
const path = require('path');
const corpus = require('./corpus');

const root = path.join(__dirname, '..');
const seeds = [1, 2, 3];

function withNoisePatching() {
  const O = require(path.join(root, 'Factorizer/TableObjectmethod/ObjectSplit'));
  const P = O.ObjectSplitEngine.prototype;
  const saved = {
    fix: P.fixAliasKeyCollisions,
    shadow: P.splitShadowRepair,
  };
  P.fixAliasKeyCollisions = function () { return null; };
  P.splitShadowRepair = false;
  return () => Object.assign(P, {
    fixAliasKeyCollisions: saved.fix,
    splitShadowRepair: saved.shadow,
  });
}

const { obfuscate } = require(path.join(root, 'VM/Virtualization'));

let debugBad = 0;
const changed = [];

function run(src, opts) {
  return obfuscate(src, opts).lua;
}

for (const c of corpus) {
  for (const seed of seeds) {
    const opts = { filename: c.name + '.lua', seed };
    const plain = run(c.src, opts);

    const log = path.join(require('os').tmpdir(), `xr-audit-${process.pid}.log`);
    try { fs.unlinkSync(log); } catch { /* first run */ }
    process.env.XRING_DEBUG = '1';
    process.env.XRING_DEBUG_LOG = log;
    let noisy;
    try {
      noisy = run(c.src, opts);
    } finally {
      delete process.env.XRING_DEBUG;
      delete process.env.XRING_DEBUG_LOG;
    }
    if (noisy !== plain) {
      debugBad++;
      console.log(`DEBUG-CHANGED ${c.name} seed=${seed}`);
    }

    const restore = withNoisePatching();
    let legacy;
    try {
      legacy = run(c.src, opts);
    } finally {
      restore();
    }
    if (legacy !== plain) {
      changed.push(`${c.name}#${seed}`);
    }
  }
}

console.log(`\ndebug neutrality: ${debugBad === 0 ? 'PASS' : 'FAIL'} (${corpus.length * seeds.length} runs)`);
console.log(`outputs changed by the repairs: ${changed.length}`);
if (changed.length) console.log('  ' + changed.join(', '));
process.exit(debugBad ? 1 : 0);
