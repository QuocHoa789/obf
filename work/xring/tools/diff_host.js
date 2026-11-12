'use strict';
/**
 * Differential test: host IR compiler+interpreter (Compilers/IR) versus a real
 * Lua runtime oracle (fengari).  Any mismatch is a compiler/interpreter bug.
 *
 *   node tools/diff_host.js [--filter substr] [--verbose]
 */
const { parse } = require('../AST/Parser');
const { compile } = require('../Compilers/IR/Compiler');
const { interpret } = require('../Compilers/IR/Interpreter');
const { runLua } = require('./luaoracle');
const corpus = require('./corpus');

const argv = process.argv.slice(2);
const filter = argv.includes('--filter') ? argv[argv.indexOf('--filter') + 1] : null;
const verbose = argv.includes('--verbose');

let pass = 0, fail = 0, blocked = 0;
const failures = [];

for (const c of corpus) {
  if (filter && !c.name.includes(filter)) continue;
  const oracle = runLua(c.src);
  if (oracle.blocked) { blocked++; continue; }
  let host;
  try {
    const proto = compile(parse(c.src, c.name + '.lua'));
    host = { ok: true, printOut: interpret(proto).printOut };
  } catch (e) {
    host = { ok: false, error: e.message };
  }
  const okOracle = oracle.ok;
  const okHost = host.ok;
  let same;
  if (!okOracle && !okHost) same = true; // both reject: compare loosely
  else if (okOracle !== okHost) same = false;
  else same = JSON.stringify(oracle.printOut) === JSON.stringify(host.printOut);
  if (same) {
    pass++;
    if (verbose) console.log('PASS', c.name);
  } else {
    fail++;
    failures.push(c.name);
    console.log('FAIL', c.name);
    console.log('  src    :', JSON.stringify(c.src));
    console.log('  oracle :', okOracle ? JSON.stringify(oracle.printOut) : 'ERROR ' + oracle.error);
    console.log('  host   :', okHost ? JSON.stringify(host.printOut) : 'ERROR ' + host.error);
  }
}
console.log(`\n${pass} pass, ${fail} fail, ${blocked} blocked`);
if (fail) { console.log('failing:', failures.join(', ')); process.exitCode = 1; }
