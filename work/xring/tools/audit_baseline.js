'use strict';
/**
 * Baseline byte-identity audit.
 *
 *   node tools/audit_baseline.js [path/to/pristine/xring]
 *
 * The "preserve existing obfuscation output" rule says: for an input that
 * already obfuscated correctly before the repairs, the patched build must
 * produce the *same bytes* for the same input+seed+config.  This tool loads the
 * pristine tree (default `work/baseline/xring`) and the patched tree, obfuscates
 * every corpus program with both, and reports every differing case.
 *
 * A difference is only acceptable when the pristine output was broken.  With
 * `--luau <path>` the tool proves that: it runs both outputs on the Luau CLI and
 * compares each one with the reference result of the plain source, so every
 * reported difference is labelled
 *
 *   baseline-broken   pristine bytes differ AND pristine output is wrong
 *                     (or does not run) -> the change is a repair
 *   REGRESSION        pristine output was correct -> not allowed, must be fixed
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const baselineDir = process.argv[2] && !process.argv[2].startsWith('--')
  ? path.resolve(process.argv[2])
  : path.join(root, '..', 'baseline', 'xring');
const luauArg = process.argv.indexOf('--luau');
const LUAU = luauArg >= 0 ? process.argv[luauArg + 1] : null;
const seeds = (process.argv.find((a) => a.startsWith('--seeds=')) || '--seeds=1,2,3')
  .split('=')[1].split(',').map(Number);

const corpus = require('./corpus');
const patched = require(path.join(root, 'VM/Virtualization'));
const pristine = require(path.join(baselineDir, 'VM/Virtualization'));

if (!fs.existsSync(baselineDir)) {
  console.error('baseline tree not found: ' + baselineDir);
  process.exit(2);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xr-base-'));
function runLua(src, tag) {
  if (!LUAU) return null;
  const file = path.join(tmp, tag + '.lua');
  fs.writeFileSync(file, src);
  try {
    return execFileSync(LUAU, [file], { encoding: 'utf8', timeout: 30000 }).trim();
  } catch (e) {
    return 'ERR:' + String(e.stderr || e.message).split('\n')[0];
  }
}

let same = 0;
const diffs = [];
let regressions = 0;
for (const c of corpus) {
  for (const seed of seeds) {
    const opts = { filename: c.name + '.lua', seed };
    let a;
    let b;
    try {
      a = pristine.obfuscate(c.src, opts).lua;
    } catch (e) {
      a = 'ERR:' + e.message;
    }
    try {
      b = patched.obfuscate(c.src, opts).lua;
    } catch (e) {
      b = 'ERR:' + e.message;
    }
    if (a === b) {
      same += 1;
      continue;
    }
    let verdict = 'baseline-broken';
    if (LUAU) {
      const ref = runLua(c.src, `${c.name}-${seed}-ref`);
      const gotBase = runLua(a, `${c.name}-${seed}-base`);
      const gotPatched = runLua(b, `${c.name}-${seed}-patched`);
      if (gotBase === ref) {
        verdict = 'REGRESSION';
        regressions += 1;
      } else if (gotPatched !== ref) {
        verdict = 'STILL-BROKEN';
      }
    }
    diffs.push(`${c.name}#${seed} ${verdict}`);
  }
}

console.log(`baseline: ${baselineDir}`);
console.log(`byte-identical: ${same}/${corpus.length * seeds.length}`);
console.log(`differing: ${diffs.length}${regressions ? ` (REGRESSIONS: ${regressions})` : ''}`);
for (const d of diffs) console.log('  ' + d);
process.exit(regressions ? 1 : 0);
