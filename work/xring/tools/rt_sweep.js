'use strict';
/**
 * Runtime equivalence sweep (real Lua 5.1/Luau oracle).
 *
 *   node tools/rt_sweep.js [--luau /path/to/luau] [--seeds=1,2,3] [--filter=sub]
 *
 * For every corpus program and seed:
 *   1. run the plain source on the Luau CLI  -> reference output
 *   2. obfuscate + run it on the Luau CLI    -> actual output
 *   3. compare
 *
 * Status per case:
 *   PASS      source and obfuscated output match
 *   FAIL      they differ (a real obfuscator bug)
 *   NO-ORACLE the plain source does not run on Luau either (Lua 5.1-only syntax),
 *             so there is nothing to compare against -- never counted as a pass
 *   ERROR     the obfuscated file does not run / does not load
 *
 * Exit code is non-zero when any case is FAIL or ERROR.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const luauArg = process.argv.indexOf('--luau');
const LUAU = luauArg >= 0 ? process.argv[luauArg + 1] : path.join(root, '..', '.bin', 'luau');
const seeds = (process.argv.find((a) => a.startsWith('--seeds=')) || '--seeds=1')
  .split('=')[1].split(',').map(Number);
const filter = (process.argv.find((a) => a.startsWith('--filter=')) || '').split('=')[1] || '';

const corpus = require('./corpus');
const { obfuscate } = require(path.join(root, 'VM/Virtualization'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xr-rt-'));
function runLua(src, tag) {
  const file = path.join(tmp, tag + '.lua');
  fs.writeFileSync(file, src);
  try {
    return { out: execFileSync(LUAU, [file], { encoding: 'utf8', timeout: 60000 }).trim() };
  } catch (e) {
    return { err: String(e.stderr || e.message).split('\n')[0] };
  }
}

const counts = { PASS: 0, FAIL: 0, 'NO-ORACLE': 0, ERROR: 0 };
const failures = [];
for (const c of corpus) {
  if (filter && c.name.indexOf(filter) < 0) continue;
  for (const seed of seeds) {
    const ref = runLua(c.src, `${c.name}-${seed}-ref`);
    if (ref.err) {
      counts['NO-ORACLE'] += 1;
      continue;
    }
    let lua;
    try {
      lua = obfuscate(c.src, { filename: c.name + '.lua', seed }).lua;
    } catch (e) {
      counts.ERROR += 1;
      failures.push(`${c.name}#${seed} ERROR obfuscate: ${e.message}`);
      continue;
    }
    const got = runLua(lua, `${c.name}-${seed}-obf`);
    if (got.err) {
      counts.ERROR += 1;
      failures.push(`${c.name}#${seed} ERROR run: ${got.err}`);
      continue;
    }
    if (got.out === ref.out) counts.PASS += 1;
    else {
      counts.FAIL += 1;
      failures.push(`${c.name}#${seed} FAIL ref=${JSON.stringify(ref.out)} got=${JSON.stringify(got.out)}`);
    }
  }
}

const total = counts.PASS + counts.FAIL + counts['NO-ORACLE'] + counts.ERROR;
console.log(`luau: ${LUAU}`);
console.log(`seeds: ${seeds.join(',')}  cases: ${total}`);
console.log(`PASS ${counts.PASS}  FAIL ${counts.FAIL}  ERROR ${counts.ERROR}  NO-ORACLE ${counts['NO-ORACLE']}`);
for (const f of failures) console.log('  ' + f);
process.exit(counts.FAIL || counts.ERROR ? 1 : 0);
