#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { obfuscate, compileSource, interpret, runObfuscated, internProto } = require('..');

function usage() {
  process.stderr.write(
    'Xring — Lua 5.1 AST compiler + interpreter VM (no JIT)\n\n' +
    'Usage:\n' +
    '  node XringCLI/index.js <input.lua> [-o out.lua] [--seed N] [--dump-proto] [--dump-intern] [--run] [--run-vm]\n\n' +
    '  --run         interpret the compiled proto in the host JS compiler-VM (debug)\n' +
    '  --run-vm      deserialize the blob and run the IronBrew VM in JS\n' +
    '  --dump-proto  print compiled instructions (pre-intern)\n' +
    '  --dump-intern print interned guest instructions (GETI + slots)\n' +
    '  --seed N      deterministic VM shuffle / bias seed\n\n' +
    'Macros (compile-time, reserved identifiers):\n' +
    '  XRN_KEEP(fn) / XRN_NO_VIRTUALIZE(fn) / XRN_NO_VIRTUAL(fn)\n' +
    '      emit fn as native Lua (zero upvalues). Aliases: KEEP, NO_VIRTUALIZE\n' +
    '  XRN_CRASH()   poison the VM and abort. Alias: CRASH\n',
  );
}

function dumpProto(p, indent) {
  const sp = '  '.repeat(indent || 0);
  process.stdout.write(
    `${sp}proto ${p._kind || p.name || '_'} params=${p.params} vararg=${p.isVararg} stack=${p.maxstack} nconst=${p.constants.length} ncode=${p.code.length}` +
      (p.keepNative ? ' keepNative' : '') +
      '\n',
  );
  p.code.forEach((ins, i) => {
    process.stdout.write(
      `${sp}  [${i}] ${ins.op} A=${ins.A} B=${ins.B}${ins.Bk ? 'K' : ''} C=${ins.C}${ins.Ck ? 'K' : ''}\n`,
    );
  });
  for (const c of p.protos) dumpProto(c, (indent || 0) + 1);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }
  let input = null;
  let output = null;
  let seed = null;
  let dump = false;
  let dumpIntern = false;
  let run = false;
  let runVm = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o') output = args[++i];
    else if (a === '--seed') seed = Number(args[++i]);
    else if (a === '--dump-proto') dump = true;
    else if (a === '--dump-intern') dumpIntern = true;
    else if (a === '--run') run = true;
    else if (a === '--run-vm') runVm = true;
    else if (a.startsWith('-')) {
      process.stderr.write('unknown flag ' + a + '\n');
      process.exit(1);
    } else input = a;
  }
  if (!input) {
    usage();
    process.exit(1);
  }
  const src = fs.readFileSync(input, 'utf8');
  const seedVal = seed == null ? 1 : seed;
  if (dumpIntern) {
    const pre = compileSource(src, path.basename(input));
    const info = internProto(pre, seedVal);
    const vals = Object.assign({}, info.valueSlotByName);
    delete vals.dispatcher;
    delete vals.regionKey;
    delete vals.dispHash;
    process.stdout.write(`-- intern values (seed ${seedVal}): ` + JSON.stringify(vals) + '\n');
    process.stdout.write(`-- intern strings (seed ${seedVal}): ` + JSON.stringify(info.stringSlotByString) + '\n');
    process.stdout.write('-- reserved: ' + JSON.stringify({
      D: info.reservedMap.dispatcher,
      K: info.reservedMap.regionKey,
      H: info.reservedMap.dispHash,
    }) + ' total=' + info.total + '\n');
    dumpProto(info.root, 0);
  }
  if (dump || run) {
    const proto = compileSource(src, path.basename(input));
    if (dump) dumpProto(proto, 0);
    if (run) {
      const r = interpret(proto);
      for (const line of r.printOut) process.stdout.write(line + '\n');
    }
  }
  if (runVm) {
    const r = runObfuscated(src, { filename: path.basename(input), seed: seedVal });
    for (const line of r.printOut) process.stdout.write(line + '\n');
    if (output) fs.writeFileSync(output, r.lua);
    return;
  }
  if ((dump || run || dumpIntern) && !output && !runVm) return;
  const result = obfuscate(src, { filename: path.basename(input), seed: seedVal });
  const lua = result.lua;
  if (output) fs.writeFileSync(output, lua);
  else process.stdout.write(lua);
}

if (require.main === module) main(process.argv);

module.exports = { main };
