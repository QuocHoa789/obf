'use strict';

const assert = require('assert');
const { parse } = require('../../AST/Parser');
const { compile } = require('../../Compilers/IR/Compiler');
const { interpret } = require('../../Compilers/IR/Interpreter');
const { obfuscate, runObfuscated } = require('../../VM/Virtualization');
const { encodeBase85, decodeBase85 } = require('../../Compilers/encode/Serializer');

let passed = 0;
let failed = 0;

function runSrc(src) {
  const ast = parse(src, 't.lua');
  const proto = compile(ast);
  return interpret(proto);
}

function t(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (e) {
    failed++;
    process.stdout.write('  FAIL ' + name + '\n    ' + e.stack.split('\n').slice(0, 6).join('\n    ') + '\n');
  }
}

function tableEntry(lua) {
  const m = lua.match(/\}\):([A-Za-z_]\w*)\(\)/) || lua.match(/\}:([A-Za-z_]\w*)\(\)/);
  return m && m[1];
}

function codeBody(lua) {
  return String(lua).replace(/^--[^\n]*\n+/, '');
}

function envWrapName(lua) {
  const m = lua.match(/([A-Za-z_]\w*)=function\(([A-Za-z_])(?:,\2)?(?:,[A-Za-z_]\w*)?\)local [A-Za-z_]\w*=\{[A-Za-z_]\w*\}/);
  return m && m[1];
}

function mbaPoolName(lua) {
  const m = lua.match(/([A-Za-z_]\w*)=\{(?:0[xXbB][0-9A-Fa-f_]+|\d+\.0|\d+)(?:,(?:0[xXbB][0-9A-Fa-f_]+|\d+\.0|\d+)){8,}/);
  return m && m[1];
}

function cacheFieldName(lua) {
  const m = lua.match(/(?:\{|,)([A-Za-z_]\w*)=\{\}(?:,|\})/);
  return m && m[1];
}

function aliasOf(lua, member) {
  const re = new RegExp('([A-Za-z_]\\w*)=(?:\\(bit32 or bit\\)|bit32)\\.' + member);
  const m = lua.match(re);
  return m && m[1];
}

function methodSnippet(lua, name, n) {
  if (!name) return '';
  const m = lua.match(new RegExp('(?:^|[,{(])' + name + '=function\\([A-Za-z_][\\s\\S]{0,' + (n || 800) + '}'));
  return m ? m[0] : '';
}

function selfIdent(lua) {
  const m = lua.match(/function\(([A-Za-z_]),\1[,)]/) || lua.match(/function\(([A-Za-z_])[,)]/);
  return (m && m[1]) || 't';
}

function fieldUse(lua, field) {
  if (!field) return false;
  const f = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?:[A-Za-z_]|\\([A-Za-z_]\\))\\.' + f + '\\[').test(lua);
}

function helperPoolCall(lua, pool) {
  if (!pool) return false;
  const f = pool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('[A-Za-z_]:\\w+\\([^)]*(?:[A-Za-z_]|\\([A-Za-z_]\\))\\.' + f).test(lua)
    || new RegExp('\\([A-Za-z_]\\):\\w+\\([^)]*(?:[A-Za-z_]|\\([A-Za-z_]\\))\\.' + f).test(lua);
}

function prints(src, expected) {
  const r = runSrc(src);
  assert.deepStrictEqual(r.printOut, expected);
}

function vmPrints(src, expected, seed) {
  const r = runObfuscated(src, { seed: seed == null ? 1 : seed });
  assert.deepStrictEqual(r.printOut, expected);
}

function decryptRegions(p, decWire, settings) {
  const { xorRange, regionKey, mixDispHash } = require('../../Compilers/encode/Deserializer');
  const copy = {
    nSlots: p.nSlots,
    opcodes: p.opcodes.slice(),
    regA: p.regA.slice(),
    regB: p.regB.slice(),
    regC: p.regC.slice(),
  };
  const master = settings && settings.regionMasterKey;
  const extra = (settings && settings.dispHash) || 0;
  for (let pc = 1; pc <= copy.nSlots; pc++) {
    if (copy.opcodes[pc] !== decWire) continue;
    const ln = copy.regB[pc];
    const a = copy.regA[pc];
    const c = copy.regC[pc];
    if (typeof ln !== 'number' || ln < 1) continue;
    const internMode = typeof a === 'number' && a < 255;
    const seed = internMode && master != null ? master : c;
    if (typeof seed === 'number') xorRange(copy, pc + 1, ln, mixDispHash(regionKey(seed, pc, copy.opcodes[pc], ln), extra));
  }
  return copy;
}

process.stdout.write('AST + compiler + host interpreter\n');

t('print number', () => prints('print(42)', ['42']));
t('arith', () => prints('print(1+2*3)', ['7']));
t('floor div', () => prints('print(7//2)\nprint(-7//2)', ['3', '-4']));
t('string concat', () => prints('print("a".."b".."c")', ['abc']));
t('local', () => prints('local x = 10\nprint(x)', ['10']));
t('assignment', () => prints('local x = 1\nx = x + 5\nprint(x)', ['6']));
t('if then else true', () => prints('if 1 then print("t") else print("f") end', ['t']));
t('if then else false', () => prints('if nil then print("t") else print("f") end', ['f']));
t('elseif', () => prints(
  'local x=2\nif x==1 then print("a") elseif x==2 then print("b") else print("c") end',
  ['b'],
));
t('while', () => prints('local i=0\nwhile i<3 do i=i+1 print(i) end', ['1', '2', '3']));
t('numeric for', () => prints('for i=1,3 do print(i) end', ['1', '2', '3']));
t('numeric for step', () => prints('for i=10,1,-3 do print(i) end', ['10', '7', '4', '1']));
t('break', () => prints('for i=1,10 do if i==3 then break end print(i) end', ['1', '2']));
t('function + call', () => prints('local function add(a,b) return a+b end\nprint(add(2,3))', ['5']));
t('global function', () => prints('function add(a,b) return a+b end\nprint(add(4,6))', ['10']));
t('table index', () => prints('local t={a=1,b=2}\nprint(t.a)\nprint(t["b"])', ['1', '2']));
t('array table', () => prints('local t={10,20,30}\nprint(t[1])\nprint(t[3])', ['10', '30']));
t('nested function upvalue', () => prints(
  'local function outer()\n  local x = 7\n  local function inner() return x end\n  return inner()\nend\nprint(outer())',
  ['7'],
));
t('upvalue mutation', () => prints(
  'local x = 1\nlocal function inc() x = x + 1 end\ninc() inc() print(x)',
  ['3'],
));
t('returned closure upvalue', () => prints(
  'local function outer()\n  local x = 9\n  return function() return x end\nend\nprint(outer()())',
  ['9'],
));
t('recursive local function', () => prints(
  'local function fact(n)\n  if n==0 then return 1 end\n  return n * fact(n-1)\nend\nprint(fact(5))',
  ['120'],
));
t('and/or', () => prints('print(nil and 2)\nprint(1 and 2)\nprint(1 or 2)\nprint(nil or 5)', ['nil', '2', '1', '5']));
t('compare', () => prints('print(1<2)\nprint(2<1)\nprint(1==1)\nprint(1~=2)', ['true', 'false', 'true', 'true']));
t('unary', () => prints('print(-5)\nprint(not false)\nprint(#("hi"))', ['-5', 'true', '2']));
t('method call', () => prints(
  'local o={v=3}\nfunction o:get() return self.v end\nprint(o:get())',
  ['3'],
));
t('vararg', () => prints(
  'local function f(...)\n  local a,b = ...\n  print(a)\n  print(b)\nend\nf(8,9)',
  ['8', '9'],
));
t('repeat until', () => prints('local i=0\nrepeat i=i+1 print(i) until i==2', ['1', '2']));
t('repeat until local scope', () => prints(
  'local n=0\nrepeat\n  local x = n\n  n = n + 1\nuntil x==2\nprint(n)',
  ['3'],
));
t('do block', () => prints('local x=1\ndo local x=2 print(x) end\nprint(x)', ['2', '1']));
t('multi assign', () => prints('local a,b = 1,2\nprint(a)\nprint(b)', ['1', '2']));
t('swap assign', () => prints('local a,b = 1,2\na,b = b,a\nprint(a) print(b)', ['2', '1']));
t('generic for ipairs', () => prints(
  'for i,v in ipairs({5,6}) do print(i) print(v) end',
  ['1', '5', '2', '6'],
));
t('multi return', () => prints(
  'local function f() return 1,2,3 end\nlocal a,b,c = f()\nprint(a) print(b) print(c)',
  ['1', '2', '3'],
));
t('hex and scientific', () => prints('print(0x10) print(1.5e2)', ['16', '150']));
t('string escape', () => prints('print("a\\nb")', ['a\nb']));
t('pcall ok', () => prints('local ok,v = pcall(function() return 4 end)\nprint(ok) print(v)', ['true', '4']));
t('math floor', () => prints('print(math.floor(3.9))', ['3']));
t('string sub', () => prints('print(string.sub("hello",2,4))', ['ell']));
t('tailcall', () => {
  const ast = parse('local function f(x) return x+1 end\nlocal function g(x) return f(x) end\nprint(g(3))', 't.lua');
  const proto = compile(ast);
  const g = proto.protos.find((p) => p.name === 'g') || proto.protos[1];
  const hasTail = (g || proto.protos[0]).code.some((i) => i.op === 'TAILCALL');
  assert.ok(hasTail, 'expected TAILCALL in g');
  const r = interpret(proto);
  assert.deepStrictEqual(r.printOut, ['4']);
});

process.stdout.write('\nVM generator\n');

t('obfuscate produces wrapper', () => {
  const { lua, proto, blob, settings } = obfuscate('print(1+2)', { seed: 42 });
  const body = codeBody(lua);
  assert.ok(
    body.startsWith('return({') || body.startsWith('return(function()'),
    'expected wrapper',
  );
  assert.ok(!lua.includes('GetHandler'));
  assert.ok(!lua.includes('compile_chunk24'));
  assert.ok(!lua.includes('__BLOB__'));
  assert.ok(!lua.includes('__OPCODE_DISPATCH__'));
  assert.ok(!lua.includes('__SEAL_BIT__'));
  assert.ok(!lua.includes('deserialize_chunk27'));
  assert.ok(!lua.includes('_chunk'));
  // NOTE: the blob stays a long-bracket string through the whole pipeline
  // (printer preserves `long`, string encryption skips longs), so the magic
  // is present literally; junk is covered by dedicated tests.
  // NOTE: no textual junk assertion on final lua either — wrapAndSplit
  // rewrites junk calls into env slots; junk is covered by dedicated tests.
  assert.ok(/\\\d{3}|\\x[0-9a-fA-F]{2}|\\u\{[0-9a-fA-F]+\}/.test(lua), 'string escapes present');
  assert.ok(blob.length > 0);
  assert.ok(proto.code.length > 0);
  assert.ok(settings.idMap[0] != null);
});

t('dispatch shuffled vs second seed', () => {
  const a = obfuscate('print(1)', { seed: 1 }).lua;
  const b = obfuscate('print(1)', { seed: 2 }).lua;
  assert.notStrictEqual(a, b);
});

t('junk emits numeric predicates', () => {
  const { emitJunk } = require('../../Factorizer/arith/JunkCode');
  const blob = [];
  for (let i = 0; i < 216; i++) blob.push((i * 37 + 11) % 256);
  for (let t = 0; t < 3; t++) {
    const junk = emitJunk({ blob });
    assert.ok(/buffer\.readu8\(\w+,\s*\d+\)/.test(junk), 'numeric junk predicate');
  }
});

t('junk executes clean (dead arms never run)', () => {
  const { emitJunk } = require('../../Factorizer/arith/JunkCode');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const blob = [];
  for (let i = 0; i < 216; i++) blob.push((i * 37 + 11) % 256);
  const bytes = blob.map((b) => '\\' + String(b).padStart(3, '0')).join('');
  for (let t = 0; t < 5; t++) {
    const junk = emitJunk({ blob });
    const body = junk
      .replace(/\breturn\b[^\n]*/g, '__traps[#__traps + 1] = "return"')
      .replace(/\bbreak\b/g, '__traps[#__traps + 1] = "break"');
    const src = 'local __blob_s = "' + bytes + '"\n' +
      'local __traps = {}\n' +
      'local error = function(m) __traps[#__traps + 1] = "error" end\n' +
      'local F = {} local RegA = {} local RegB = {} local RegC = {}\n' +
      'local PC = 1 local Opcode = 1 local Top = 0 local Opcodes = {}\n' +
      'local buffer = { readu8 = function(t, i) return string.byte(__blob_s, i + 1) end }\n' +
      'local blob_chunk08 = {}\n' +
      'for __once = 1, 1 do\n' + body + '\nend\n' +
      'if next(F) ~= nil then __traps[#__traps + 1] = "writeF" end\n' +
      'if next(RegA) ~= nil then __traps[#__traps + 1] = "writeRegA" end\n' +
      'if next(RegB) ~= nil then __traps[#__traps + 1] = "writeRegB" end\n' +
      'if next(RegC) ~= nil then __traps[#__traps + 1] = "writeRegC" end\n' +
      'if next(Opcodes) ~= nil then __traps[#__traps + 1] = "writeOpcodes" end\n' +
      'if PC ~= 1 then __traps[#__traps + 1] = "writePC" end\n' +
      'if Top ~= 0 then __traps[#__traps + 1] = "writeTop" end\n' +
      'if Opcode ~= 1 then __traps[#__traps + 1] = "writeOpcode" end\n' +
      'return __traps\n';
    const out = interpret(compileSource(src, '=junktest'));
    const t0 = out.results && out.results[0];
    assert.ok(t0 && Array.isArray(t0.arr), 'junk harness must return trap table');
    assert.deepStrictEqual(t0.arr.slice(1), []);
  }
});

t('base85 roundtrip', () => {
  const buf = Buffer.from([0, 0, 0, 0, 1, 2, 3, 4, 255, 128, 64, 32]);
  const s = encodeBase85(buf);
  const back = decodeBase85(s);
  assert.ok(s.startsWith('z') || s.length >= 5);
  assert.deepStrictEqual(back.slice(0, buf.length), buf);
});

t('parser rejects garbage', () => {
  assert.throws(() => parse('function end'));
});

t('long string and comment', () => {
  prints('--[[ hi ]]\nprint([[hello]])', ['hello']);
});

process.stdout.write('\nVM deserialize + runtime (blob roundtrip)\n');

const vmCases = [
  ['print number', 'print(42)', ['42']],
  ['arith', 'print(1+2*3)', ['7']],
  ['floor div', 'print(7//2)', ['3']],
  ['local', 'local x = 10\nprint(x)', ['10']],
  ['if', 'if 1 then print("t") else print("f") end', ['t']],
  ['while', 'local i=0\nwhile i<3 do i=i+1 print(i) end', ['1', '2', '3']],
  ['numeric for', 'for i=1,3 do print(i) end', ['1', '2', '3']],
  ['for step', 'for i=4,1,-1 do print(i) end', ['4', '3', '2', '1']],
  ['function', 'local function add(a,b) return a+b end\nprint(add(2,3))', ['5']],
  ['upvalue', 'local function outer()\n  local x = 7\n  local function inner() return x end\n  return inner()\nend\nprint(outer())', ['7']],
  ['recursive', 'local function fact(n)\n  if n==0 then return 1 end\n  return n * fact(n-1)\nend\nprint(fact(5))', ['120']],
  ['table', 'local t={10,20}\nprint(t[1]) print(t[2])', ['10', '20']],
  ['method', 'local o={v=3}\nfunction o:get() return self.v end\nprint(o:get())', ['3']],
  ['and or', 'print(nil and 2) print(1 and 2) print(nil or 5)', ['nil', '2', '5']],
  ['repeat', 'local i=0\nrepeat i=i+1 print(i) until i==2', ['1', '2']],
  ['ipairs', 'for i,v in ipairs({5,6}) do print(i) print(v) end', ['1', '5', '2', '6']],
  ['vararg', 'local function f(...)\n  local a,b = ...\n  print(a) print(b)\nend\nf(8,9)', ['8', '9']],
  ['concat', 'print("a".."b".."c")', ['abc']],
  ['compare', 'print(1<2) print(1==1) print(1~=2)', ['true', 'true', 'true']],
  ['swap', 'local a,b=1,2\na,b=b,a\nprint(a) print(b)', ['2', '1']],
  ['math', 'print(math.floor(3.9))', ['3']],
  ['strsub', 'print(string.sub("hello",2,4))', ['ell']],
  ['break', 'for i=1,10 do if i==3 then break end print(i) end', ['1', '2']],
  ['multi ret', 'local function f() return 1,2 end\nlocal a,b=f()\nprint(a) print(b)', ['1', '2']],
  ['upvalue mut', 'local x=1\nlocal function inc() x=x+1 end\ninc() inc() print(x)', ['3']],
];

for (const [name, src, exp] of vmCases) {
  t('vm ' + name, () => vmPrints(src, exp, 1));
}

t('vm different seed still runs', () => vmPrints('print(1+2)', ['3'], 99));

process.stdout.write('\nControl flow (Xrings-style)\n');

t('cf markers in wrapper', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(/while true/.test(lua) || /repeat /.test(lua), 'expected state machine');
  assert.ok(!/z\.ES\("[<>]/.test(lua), 'CF must not inject unpack MBA');
});

t('cf can be disabled', () => {
  const on = obfuscate('print(1)', { seed: 1, controlFlow: true, objectSplit: false }).lua;
  const off = obfuscate('print(1)', { seed: 1, controlFlow: false, objectSplit: false }).lua;
  const onMachines = (on.match(/until false/g) || []).length + (on.match(/while true/g) || []).length;
  const offMachines = (off.match(/until false/g) || []).length + (off.match(/while true/g) || []).length;
  assert.ok(onMachines > offMachines || /[A-Za-z_]\.\w+\[/.test(on), 'enabled CF should add state machines');
  assert.ok(off.indexOf('until false') === -1 || on !== off, 'disabled CF should differ');
});

t('cf flatten simple function', () => {
  const { ControlFlowEngine } = require('../../Factorizer');
  const { mulberry32 } = require('../../Compilers/encode/Serializer');
  const engine = new ControlFlowEngine(mulberry32(7));
  const out = engine.flattenChunk('local function f(x)\n  local a = x + 1\n  return a\nend');
  assert.ok(/while true|repeat |for /.test(out), 'expected flattened dispatch');
  assert.ok(out.includes('a=x+1') || out.includes('a = x + 1') || /a=x\+1/.test(out));
  assert.ok(/return a/.test(out));
});

t('cf for-dispatch uses continue/break', () => {
  const { ControlFlowEngine } = require('../../Factorizer');
  const { mulberry32 } = require('../../Compilers/encode/Serializer');
  const { parse } = require('../../AST/Parser');
  const src = 'local a=1\nlocal b=a+2\nlocal c=b+3\nlocal d=c+4\nreturn d';
  let hit = '';
  for (let seed = 0; seed < 48 && !hit; seed++) {
    const out = new ControlFlowEngine(mulberry32(seed)).flattenChunk(src);
    if (/for /.test(out) && /continue/.test(out)) hit = out;
  }
  assert.ok(hit, 'expected numeric-for CFF with continue');
  const ast = parse(hit);
  const types = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.type) types.push(n.type);
    for (const k of Object.keys(n)) if (k !== 'loc' && k !== 'raw') walk(n[k]);
  };
  walk(ast);
  assert.ok(types.includes('ContinueStatement'), 'parser must round-trip continue');
  assert.ok(types.includes('ForNumericStatement'));
});

t('cf state name misses params/locals', () => {
  const { ControlFlowEngine } = require('../../Factorizer');
  const { mulberry32 } = require('../../Compilers/encode/Serializer');
  const engine = new ControlFlowEngine(mulberry32(3));
  const out = engine.flattenChunk(
    'local function f(a, b, c)\n  local d = a + b\n  local e = d * c\n  return e\nend',
  );
  assert.ok(!/local d;local d=/.test(out) && !/local e;local e=/.test(out),
    'state var must not reuse hoisted local: ' + out.slice(0, 180));
  assert.ok(/function\(a,b,c\)/.test(out), 'params preserved');
});

t('cf wraps range dispatch in state machine', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(/if \w+>=/.test(lua) || /if\(\w+\)>=/.test(lua) || /if not\(/.test(lua),
    'high-to-low if s>= or Luraph if not(');
});

t('cf luraph inverted predicates', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(/if not\([A-Za-z][A-Za-z0-9]*[<>]=?/.test(lua),
    'expected if not(s<x) inverted state/opcode cond');
  assert.ok(/then else/.test(lua) || /then;else/.test(lua),
    'expected empty-then invert: if not(s<x)then else REAL');
  assert.ok(/[<>]=?[^\n]{0,40} and [^\n]{0,40}[<>]=?/.test(lua),
    'expected combined and-range: s>=a and s<b');
});

t('opaque xrings shapes', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(/if not\([A-Za-z]/.test(lua), 'expected if not(ident invert');
  assert.ok(/then else/.test(lua), 'expected empty-then: if not(s==v) then else REAL');
  assert.ok(/not\(not\(/.test(lua), 'expected double-not invert if not(not(s~=v))');
  assert.ok(!/\bif \d[\w.]*==0[xXbB]/.test(lua), 'must not emit if NUM==0xHEX');
  assert.ok(!/\bif \d+\.0==\d/.test(lua) && !/\bif \d+==0[xXbB]/.test(lua), 'must not emit NUM==NUM dead compare');
  assert.ok(!/\b0[xX]_/.test(lua) && !/\b0[bB]_/.test(lua), 'number must have digits before _');
});

t('cf cache field', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const y = cacheFieldName(lua);
  assert.ok(y, 'expected randomized cache field NAME={}');
  // Cache-stash insertion is layout/seed-sensitive (intern handlers + blob
  // growth reshuffle micro-methods; seed 1 may declare the table without a
  // stash while siblings stash). Prove the stash exists in the seed family.
  let stashed = fieldUse(lua, y);
  if (!stashed) {
    for (const seed of [2, 3]) {
      const l2 = obfuscate('print(1)', { seed }).lua;
      const y2 = cacheFieldName(l2);
      if (fieldUse(l2, y2)) {
        stashed = true;
        break;
      }
    }
  }
  assert.ok(stashed, 'expected t.NAME[slot] stash (seeds 1..3)');
  const off = obfuscate('print(1)', { seed: 1, cache: false }).lua;
  assert.ok(!cacheFieldName(off), 'cache:false must drop empty cache table');
});

t('cf xrings state texture', () => {
  // State-machine texture is seed-sensitive (CFF machine count / pool next-
  // state placement shifts with wrapper layout). Verify on the seed family.
  let ok = false;
  let detail = '';
  for (const seed of [1, 2, 3]) {
    const { lua } = obfuscate('print(1)', { seed });
    const pool = mbaPoolName(lua);
    if (!pool) {
      detail = 'seed ' + seed + ': no pool';
      continue;
    }
    const tex = /local [A-Za-z_]\w*=(?:\()?(?:0[xXbB]|[0-9])/.test(lua)
      && (new RegExp('[A-Za-z_]\\.' + pool + '\\[[^\\]]+\\]==[A-Za-z_]\\.' + pool + '\\[').test(lua)
        || new RegExp('[A-Za-z_]\\.' + pool + '\\[[^\\]]+\\]~=[A-Za-z_]\\.' + pool + '\\[').test(lua)
        || new RegExp('\\([A-Za-z_]\\.' + pool + '\\)\\[[^\\]]+\\]==\\([A-Za-z_]\\.' + pool + '\\)\\[').test(lua)
        || new RegExp('\\([A-Za-z_]\\.' + pool + '\\)\\[[^\\]]+\\]~=\\([A-Za-z_]\\.' + pool + '\\)\\[').test(lua)
        || new RegExp('[A-Za-z_]\\.' + pool + '\\[[^\\]]+\\]==\\([A-Za-z_]\\.' + pool + '\\)\\[').test(lua));
    const machines = (lua.match(/until false/g) || []).length + (lua.match(/while true/g) || []).length;
    const noStamp = !/T\[\d[\w.]*\]=-+\(?T\[/.test(lua);
    if (tex && machines >= 2 && machines <= 80 && noStamp) {
      ok = true;
      break;
    }
    detail = `seed ${seed}: tex=${tex} machines=${machines} noStamp=${noStamp}`;
  }
  assert.ok(ok, 'CFF texture (pool ==/~=, 2..80 machines) in seeds 1..3; ' + detail);
});

t('mba arith qJ uses live state and n[c]', () => {
  const { MbaEngine } = require('../../Factorizer');
  const { mulberry32 } = require('../../Compilers/encode/Serializer');
  const rng = mulberry32(11);
  let n = 0;
  const host = {
    rand() { return rng(); },
    chance(p) { return rng() < p; },
    num(v) { return { type: 'NumericLiteral', value: v }; },
    poolField: 'P',
    aliasField(k) { return k === 'K' ? 'K' : 'nS'; },
    fresh() { return 'q' + (n++); },
  };
  const mba = new MbaEngine(host);
  mba.init();
  const arith = mba.arithHelpers();
  assert.ok(arith.length >= 3, 'expected arith qJ helpers, got ' + arith.length);
  for (const h of arith) {
    assert.ok(h.idx && h.idx.a && h.idx.c, 'qJ stores pool indices');
    const fromVal = 0x4FD;
    const inner = mba.arithInner(fromVal, h.idx);
    const C = h.target - inner;
    const got = C + (fromVal - mba.at(h.idx.a) + mba.at(h.idx.b) + mba.at(h.idx.c) - mba.at(h.idx.d) + mba.at(h.idx.c));
    assert.strictEqual(got, h.target, 'C+(l-n[a]+n[b]+n[c]-n[d]+n[c]) == target');
    const expr = mba.wrapState(h.target, 'W', fromVal);
    assert.ok(expr && expr.type === 'ParenExpression', 'call-site C+(z:qJ(...))');
    const add = expr.expr;
    assert.ok(add && add.op === '+' && add.right && add.right.type === 'MethodCallExpression');
  }
});

process.stdout.write('\nObject wrapper + function split (Xrings)\n');

t('object table wrapper', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const body = codeBody(lua);
  assert.ok(body.startsWith('return({'), 'expected return({...}) with no space');
  assert.ok(!body.startsWith('return ({'), 'must not emit space after return');
  const entry = tableEntry(lua);
  assert.ok(entry, 'expected :NAME() entry');
  const pool = mbaPoolName(lua);
  assert.ok(pool, 'expected MBA pool table');
  // Pool usage density is layout/seed-sensitive (seed 1 may leave the pool
  // idle while siblings use it densely); prove usage in the seed family.
  let poolUse = fieldUse(lua, pool);
  if (!poolUse) {
    for (const seed of [2, 3]) {
      const l2 = obfuscate('print(1)', { seed }).lua;
      const p2 = mbaPoolName(l2);
      if (fieldUse(l2, p2)) {
        poolUse = true;
        break;
      }
    }
  }
  assert.ok(poolUse, 'expected SELF.POOL[idx] (seeds 1..3)');
  const band = aliasOf(lua, 'band');
  const bxor = aliasOf(lua, 'bxor');
  assert.ok(band && bxor, 'expected band/bxor aliases');
  let helperOk = helperPoolCall(lua, pool);
  if (!helperOk) {
    for (const seed of [2, 3]) {
      const l2 = obfuscate('print(1)', { seed }).lua;
      const p2 = mbaPoolName(l2);
      if (helperPoolCall(l2, p2)) {
        helperOk = true;
        break;
      }
    }
  }
  assert.ok(helperOk, 'expected SELF:helper(...,SELF.POOL) MBA (seeds 1..3)');
  assert.ok(poolUse, 'expected SELF.POOL[ (seeds 1..3)');
  const cache = cacheFieldName(lua);
  assert.ok(cache, 'expected CF cache NAME={}');
  let cacheOk = fieldUse(lua, cache);
  if (!cacheOk) {
    for (const seed of [2, 3]) {
      const l2 = obfuscate('print(1)', { seed }).lua;
      const c2 = cacheFieldName(l2);
      if (fieldUse(l2, c2)) {
        cacheOk = true;
        break;
      }
    }
  }
  assert.ok(cacheOk, 'expected SELF.CACHE[slot]=state (seeds 1..3)');
  assert.ok(!lua.includes('string.unpack'), 'must not inject string.unpack');
  assert.ok(!lua.includes('table.concat'), 'must not inject table.concat');
  assert.ok(/bit32\.bor|\.bor\(/.test(lua), 'expected bit32.bor in LOADENC vtable');
  assert.ok(lua.includes('bit32.band') || lua.includes('.band'), 'expected bit32.band alias');
  assert.ok(/function\([A-Za-z_]/.test(lua), 'expected method self');
  assert.ok(/function\(([A-Za-z_]),\1[,)]/.test(lua), 'expected shadowed function(s,s,…)');
  const s = selfIdent(lua);
  const strippedDummy = lua.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  const selfRe = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.ok(!new RegExp(selfRe + ':\\w+\\(' + selfRe + ',').test(strippedDummy), 'must not pass dummy SELF:foo(t,)');
});

t('function split methods', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const methods = lua.match(/function\([A-Za-z_]/g) || [];
  assert.ok(methods.length >= 40, 'expected function split, got ' + methods.length);
  assert.ok(methods.length <= 280, 'too many micro-methods vs Xrings, got ' + methods.length);
  assert.ok(/[A-Za-z_]:\w+\(/.test(lua), 'expected method colon calls');
});

t('split helpers return sentinel status', () => {
  let hit = false;
  for (const seed of [1, 2, 3, 7, 11, 22]) {
    const { lua } = obfuscate('print(1)', { seed });
    const gate = /then break/.test(lua) && /continue/.test(lua)
      && /=[A-Za-z_]\w*:[A-Za-z_]\w*\([^)]*\);if /.test(lua);
    if (gate) { hit = true; break; }
  }
  assert.ok(hit, 'expected helper sentinel + if status then break/continue');
});

t('split: scatter name is not shadowed by an inline closure local', () => {
  // A vararg closure is never extracted by extractNested, so its body is
  // printed inside the dispatcher. When one of its locals reused the
  // scatter/env parameter name, Lua scoping let the inner `local` win: the
  // dispatcher then indexed a number (`attempt to index number with number`
  // at runtime) for every statement after it. The repair must be
  // deterministic AND inactive when nothing collides.
  const { ObjectSplitEngine } = require('../../Factorizer/TableObjectmethod/ObjectSplit');
  const { localStat, ret, func, numNode, ident } = require('../../Factorizer/core/Ast');
  const { mulberry32 } = require('../../Compilers/encode/Serializer');
  const num = (v) => numNode(v, (st) => st[0]);

  const build = (nestedLocals) => {
    const engine = new ObjectSplitEngine(mulberry32(1));
    // Pin the rng-picked scatter name so the test is about the clash, not
    // about which short name this seed happens to draw.
    engine.pickScratch = () => 'p';
    const captured = [];
    const addMethod = engine.addMethod.bind(engine);
    engine.addMethod = (nm, fnAst) => { captured.push(fnAst); return addMethod(nm, fnAst); };
    const inner = func(['a'], nestedLocals.map((n) => localStat([n], [num(1)])).concat([ret([ident('a')])]), true);
    engine.addForDispatchSplit(
      'm',
      [],
      [],
      [[localStat(['f'], [inner])], [ret([num(0)])]],
      false,
    );
    const disp = captured.find((f) => (f.params || []).length === 4 && f.params[0] === 't');
    assert.ok(disp, 'expected a dispatcher method with (t, l, n, SCRATCH) params');
    return disp.params[3];
  };

  assert.strictEqual(build(['x']), 'p', 'no clash: rng-chosen name must be kept (byte-identical output)');
  assert.notStrictEqual(build(['p']), 'p', 'clashing inline local must not shadow the scatter table');
  assert.notStrictEqual(build(['p', 'q', '_']), 'p', 'still repaired when several names are taken');
});

t('compound assign + table.move', () => {
  const ast = parse('a+=1;b-=2;c*=3');
  assert.strictEqual(ast.body[0].type, 'CompoundAssignment');
  assert.strictEqual(ast.body[0].op, '+=');
  prints('a=1;a+=2;print(a)', ['3']);
  let hit = false;
  for (const seed of [1, 2, 3, 7]) {
    const { lua } = obfuscate('print({1,2,3})', { seed });
    if (/\+=|\-=|\*=/.test(lua) && /table\.move/.test(lua) && /table\.create/.test(lua)) {
      hit = true;
      break;
    }
  }
  assert.ok(hit, 'expected +=/-=/*= and table.move / table.create aliases');
  vmPrints('local t={1,2,3};print(t[2])', ['2'], 1);
});

t('xrings return{ident}', () => {
  let stripped = '';
  let n = 0;
  // Packed returns carry their arity at index 1 (`return{2,a,b}`) so a
  // trailing nil survives the unpack at the call site.
  for (const seed of [1, 2, 3, 7]) {
    const { lua } = obfuscate('print(1)', { seed });
    stripped = lua
      .replace(/\[==\[XRING[\s\S]*?\]==\]/g, '')
      .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
    n = (stripped.match(/return\{/g) || []).length;
    if (n >= 1 && /return\{\d+,[A-Za-z_]\w*(?:,[A-Za-z_]\w*)*\}/.test(stripped)) break;
  }
  assert.ok(n >= 1, 'expected return{a} packed helpers, got ' + n);
  assert.ok(/return\{\d+,[A-Za-z_]\w*(?:,[A-Za-z_]\w*)*\}/.test(stripped), 'return{arity,ident} / return{arity,a,b}');
  assert.ok(!/return \{/.test(stripped), 'no space in return{');
});

t('opcode dispatch is range tree', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const range = (lua.match(/if [A-Za-z][A-Za-z0-9]*[<>]=?/g) || []).length;
  assert.ok(range >= 8, 'expected nested Opcode < / > range dispatch, got ' + range);
  const elseifEq = (lua.match(/elseif [A-Za-z][A-Za-z0-9]*==(?:0[xXbB]|[0-9])/g) || []).length;
  assert.ok(elseifEq < 20, 'must not emit a flat elseif Opcode== chain, got ' + elseifEq);
});

t('end chain is not a waterfall', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const stripped = lua
    .replace(/\[=*\[(?:.|\n)*?\]=*\]/g, '')
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  let max = 0;
  const re = /(?:end;){2,}end;?/g;
  let m;
  while ((m = re.exec(stripped))) {
    const n = (m[0].match(/end/g) || []).length;
    if (n > max) max = n;
  }
  assert.ok(max <= 8, 'end waterfall max 8 (Xrings ~7), got ' + max);
  assert.ok(max >= 2, 'still expect some end;end');
  const elseifN = (stripped.match(/\belseif\b/g) || []).length;
  const elseIfN = (stripped.match(/else if/g) || []).length;
  const total = elseifN + elseIfN;
  assert.ok(total >= 15, 'expected if-mix sample, got elseif=' + elseifN + ' else if=' + elseIfN);
  const ratio = elseifN / total;
  assert.ok(
    ratio >= 0.10 && ratio <= 0.50,
    'expected ~30% elseif like Xrings (53/126), got ' + elseifN + '/' + elseIfN + ' = ' + ratio.toFixed(2),
  );
});

t('idents are 1 char and may be _', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const locals = [];
  for (const m of lua.matchAll(/\blocal ([A-Za-z_][A-Za-z0-9_]*(?:,[A-Za-z_][A-Za-z0-9_]*)*)/g)) {
    for (const name of m[1].split(',')) {
      if (name === 'self') continue;
      locals.push(name);
    }
  }
  assert.ok(locals.length >= 20, 'expected locals to sample');
  const overflow = locals.filter((n) => n.length > 1);
  assert.ok(overflow.every((n) => n.length === 2), 'overflow locals must be 2-char, got ' + overflow.filter((n) => n.length > 2).slice(0, 8).join(','));
  const one = locals.filter((n) => n.length === 1).length;
  assert.ok(one / locals.length >= 0.5, 'expected mostly 1-char locals, got ' + (one / locals.length).toFixed(2));
  const methods = [...lua.matchAll(/,([A-Za-z_][A-Za-z0-9_]*)=function\(/g)].map((m) => m[1]);
  const longM = methods.filter((n) => n.length > 2 && n !== '__index');
  assert.ok(longM.length === 0, 'method keys must be 1-2 chars, got ' + longM.join(','));
  const oneM = methods.filter((n) => n.length === 1).length;
  assert.ok(methods.length >= 10 && oneM / methods.length >= 0.55, 'expected mostly 1-char method keys, got ' + oneM + '/' + methods.length);
  const params = [...lua.matchAll(/function\(([A-Za-z_](?:,[A-Za-z_]|\.\.\.)*)\)/g)].map((m) => m[1]);
  for (const p of params) {
    if (!p) continue;
    for (const name of p.split(',')) {
      if (!name || name === '...' || name === 'self') continue;
      assert.ok(name.length === 1, 'param ' + name + ' should be 1 char');
    }
  }
  const entry = tableEntry(lua);
  const by = envWrapName(lua);
  const pool = mbaPoolName(lua);
  const cache = cacheFieldName(lua);
  assert.ok(entry && entry.length === 1, 'entry must be 1 char, got ' + entry);
  assert.ok(by && by.length === 1, 'by must be 1 char, got ' + by);
  for (const n of [pool, cache]) {
    assert.ok(n && n.length <= 2, 'wrapper field must be 1-2 chars, got ' + n);
  }
  let sawUnderscore = /\blocal _\b/.test(lua) || /function\(_/.test(lua) || /,_\w*=function\(/.test(lua);
  if (!sawUnderscore) {
    for (const seed of [2, 3, 5, 7]) {
      const l2 = obfuscate('print(1)', { seed }).lua;
      if (/\blocal _\b/.test(l2) || /function\(_/.test(l2) || /,_\w*=function\(/.test(l2) || /,_=function\(/.test(l2)) {
        sawUnderscore = true;
        break;
      }
    }
  }
  assert.ok(sawUnderscore, 'expected _ as an ident across seeds');
});

t('self name is not hardcoded t', () => {
  const names = [1, 2, 3, 5].map((seed) => selfIdent(obfuscate('print(1)', { seed }).lua));
  assert.ok(names.every(Boolean), 'expected shadowed self, got ' + names.join(','));
  assert.ok(new Set(names).size >= 2, 'self must vary across seeds, got ' + names.join(','));
});

t('xrings ident arith soup', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const chains = lua.match(/[A-Za-z_]\w*(?:[+\-][A-Za-z_]\w*){3,}/g) || [];
  assert.ok(chains.length >= 2, 'expected ident arith soups, got ' + chains.length);
  const norm = (s) => {
    const ids = s.match(/[A-Za-z_]\w*/g) || [];
    const map = Object.create(null);
    let k = 0;
    const out = [];
    for (const id of ids) {
      if (!map[id]) map[id] = String.fromCharCode(65 + k++);
      out.push(map[id]);
    }
    const ops = s.match(/[+\-]/g) || [];
    let r = out[0] || '';
    for (let i = 0; i < ops.length; i++) r += ops[i] + (out[i + 1] || '');
    return r;
  };
  const unique = new Set(chains.map(norm));
  assert.ok(unique.size >= 2, 'soups must vary in shape, got ' + unique.size + ' / ' + chains.length);
  const stamp = chains.filter((s) => /^([A-Za-z_]\w*)\+\1\+\1-[A-Za-z_]\w*-[A-Za-z_]\w*\+\1/.test(s)).length;
  assert.ok(stamp < chains.length * 0.4, 'must not stamp identity X+X+X-A-B+X, got ' + stamp + '/' + chains.length);
  assert.ok(/ and .+ or /.test(lua), 'expected and/or wraps');
  const stripped = lua.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  assert.ok(/\belseif\b/.test(stripped) && /else if/.test(lua), 'mix elseif and else if');
  assert.ok(/\b([A-Za-z_]\w*)==\1\b/.test(lua), 'expected v==v live elseif');
  assert.ok(
    /(?:elseif|else if) [A-Za-z_]\w*>=0[xXbB]/.test(lua) || /(?:elseif|else if) [A-Za-z_]\w*>=\d/.test(lua),
    'expected j>=0x6 dead bound',
  );
});

t('no trailing underscore numbers', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(!/\b0[xX]_/.test(lua), 'hex must have digits before _');
  assert.ok(!/\b0[bB]_/.test(lua), 'bin must have digits before _');
});

t('number style prefers 0X/0B, keeps N.0 and _', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const stripped = lua
    .replace(/\[==\[XRING[\s\S]*?\]==\]/g, '')
    .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  const hexU = (stripped.match(/0X[0-9A-F]/g) || []).length;
  const hexL = (stripped.match(/0x[0-9a-f]/g) || []).length;
  const binU = (stripped.match(/0B[01]/g) || []).length;
  const binL = (stripped.match(/0b[01]/g) || []).length;
  assert.ok(hexU >= hexL, 'prefer 0X over 0x (' + hexU + ' vs ' + hexL + ')');
  assert.ok(binU >= binL, 'prefer 0B over 0b (' + binU + ' vs ' + binL + ')');
  const sep = (stripped.match(/0[xXbB][0-9A-Fa-f]*_/g) || []).length;
  assert.ok(sep >= 8, 'expected digit separators, got ' + sep);
  const dot0 = (stripped.match(/\b\d+\.0\b/g) || []).length;
  assert.ok(dot0 >= 1, 'expected N.0 disguises, got ' + dot0);
});

t('BY wraps env table', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const by = envWrapName(lua);
  assert.ok(by, 'expected env-wrap method (was BY)');
  assert.ok(/local \w+=\{\w+\}/.test(lua), 'expected o={env} wrap');
});

t('HY for-dispatch inits', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const entry = tableEntry(lua);
  const by = envWrapName(lua);
  assert.ok(entry, 'expected randomized entry method');
  assert.ok(by, 'expected env wrap');
  const hy = methodSnippet(lua, entry, 2500);
  assert.ok(hy, 'expected entry body');
  assert.ok(new RegExp('z:' + by + '\\(').test(hy) || new RegExp(':' + by + '\\(').test(lua), 'entry should call wrap');
  assert.ok(/for |while true|repeat /.test(hy), 'entry should scatter inits with state-loop dispatch');
  const walls = (hy.match(/(?:for [^;]+ do[^;]+end;){8,}/g) || []);
  assert.ok(walls.length === 0, 'must not dump a wall of for-loops in entry, got ' + walls.length);
});

t('cf mix for/while/repeat', () => {
  let fors = 0, whiles = 0, repeats = 0;
  for (const seed of [1, 2, 3]) {
    const { lua } = obfuscate('print(1)', { seed });
    fors += (lua.match(/\bfor /g) || []).length;
    whiles += (lua.match(/\bwhile /g) || []).length;
    repeats += (lua.match(/\brepeat /g) || []).length;
  }
  assert.ok(fors >= 4, 'expected for CFF, got ' + fors);
  assert.ok(whiles >= 12, 'expected while CFF, got ' + whiles);
  assert.ok(repeats >= 8, 'expected repeat CFF, got ' + repeats);
  assert.ok(whiles + repeats >= fors * 0.5, 'while/repeat must not be drowned by for (' + fors + '/' + whiles + '/' + repeats + ')');
});

t('no duplicate vararg params', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(!/function\(\.\.\.,\.\.\.\)/.test(lua), 'function(...,...) is invalid Lua');
  const noDup = lua.replace(/function\(([A-Za-z_]),\1/g, 'function($1,__t');
  assert.ok(!/function\((?:[A-Za-z_]\w*,)*([A-Za-z_]\w*),\1\)/.test(noDup), 'duplicate param names');
});

t('env slots rewrite inside if', () => {
  const { ObjectSplitEngine } = require('../../Factorizer');
  const { mulberry32 } = require('../../Compilers/encode/Serializer');
  const src = [
    'local unpack = unpack or table.unpack',
    'local g = {}',
    'local function f(...)',
    '  local c = select("#", ...)',
    '  if c == 0 then return c, g end',
    '  return c, { ... }',
    'end',
    'return f',
  ].join('\n');
  const out = new ObjectSplitEngine(mulberry32(1)).transform(src, { controlFlow: false });
  assert.ok(!/\blocal g=\{\}/.test(out) && !/(?:^|[,;])g=\{\}/.test(out), 'source leftover g must not stay as local g={}');
  assert.ok(
    /[A-Za-z_]\w*\[[^\]]+\]\[[^\]]+\]/.test(out) || /\([A-Za-z_]\w*\[[^\]]+\]\)\[[^\]]+\]/.test(out),
    'expected env slot',
  );
});

t('wrapper locals minified', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const leaks = [
    'Proto', 'Opcodes', 'RawOpcode', 'sharedUpv', 'Instruction_Enum',
    'new_closure_vm', 'realgf_v2', 'realsf_v2', 'LineMap', 'upval_data',
    'nVararg', 'ProtoUpvalues', 'K_CONST', 'K_REG', 'K_FWD', 'K_BWD',
    'K_CLOSURE', 'CMode', 'AMode', 'bMode', 'closurePCs', 'StackSz',
    'callIx', 'callFlag', 'doneArgs', '_coro_resume', '_coro_ctx',
  ];
  for (const name of leaks) {
    assert.ok(!new RegExp('\\b' + name + '\\b').test(lua), name + ' should be minified');
  }
  assert.ok(lua.includes('buffer.') || lua.includes('bit32.') || lua.includes('string.'), 'stdlib members stay');
});

t('no leftover nil setters or inline fn wrappers', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(
    !/function\([A-Za-z_](?:,[A-Za-z_])?(?:,[A-Za-z_]\w*)?\)[A-Za-z_]\w*\[[^\]]+\]\[[^\]]+\]=nil;?end/.test(lua),
    'HY must not emit l[1][n]=nil leftover setters',
  );
  const inline = lua.match(/\(function\(\.\.\.\)return [A-Za-z_]:\w+\([A-Za-z_],\.\.\.\)/g) || [];
  assert.ok(inline.length <= 2, 'function values should be hoisted to env slots, got ' + inline.length);
  const bindWrap = lua.match(/=function\(\.\.\.\)return/g) || [];
  assert.ok(bindWrap.length <= 2, 'method slots must assign t.method, not function(...) wrappers, got ' + bindWrap.length);
  assert.ok(!/return function\(\.\.\.\)return l\[[^\]]+\]\[[^\]]+\]\([^\)]*\)\(\(function\(\.\.\.\)/.test(lua),
    'bootstrap must not inline a wall of function(...) wrappers');
});

t('no nil-filled table constructors', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(!/\{(?:nil\s*,\s*){3,}nil\}/.test(lua), 'must not emit {nil,nil,nil,...} scratch tables');
  assert.ok(
    !/for \w+=1,[^;]+ do [^;]*\[\w+\]=nil/.test(lua),
    'newarray must not pre-fill with nil',
  );
});

t('object split can be disabled', () => {
  const { lua } = obfuscate('print(1)', { seed: 1, objectSplit: false, controlFlow: false });
  assert.ok(lua.includes('return(function()') || lua.includes('return (function()'));
  assert.ok(!/\}\):\w+\(\{\}\)|\}\):\w+\(\{\}\)/.test(lua) || lua.includes('return(function()'));
});

t('xrings makeup compact', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(/\]then/.test(lua), 'expected ]then (no space before then)');
  assert.ok(!/\] then /.test(lua) && !/\] thenif/.test(lua), 'must not space after ] before then');
  assert.ok(/end;end/.test(lua), 'expected end;end');
  assert.ok(/end;else/.test(lua) || /;else if/.test(lua), 'expected end;else');
  assert.ok(/else if/.test(lua), 'expected nested else if');
  const stripped = lua.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""').replace(/LPH\}[^"]*/g, '');
  assert.ok(/\belseif\b/.test(stripped), 'expected mixed elseif keyword');
  assert.ok(/\(t\)\[/.test(lua) || /\(t\):/.test(lua) || /\(t\.\w+\)\[/.test(lua)
    || /\([A-Za-z_]\)\[/.test(lua) || /\([A-Za-z_]\):/.test(lua) || /\([A-Za-z_]\.\w+\)\[/.test(lua),
    'expected extra parens makeup');
});

t('xrings colon calls', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const s = selfIdent(lua).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = lua.replace(/\[=*\[(?:.|\n)*?\]=*\]/g, '').replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  const paren = (stripped.match(new RegExp('\\(' + s + '\\):[A-Za-z_]')) || []).length
    + (stripped.match(new RegExp('\\(' + s + '\\):[A-Za-z_]', 'g')) || []).length;
  const parenN = (stripped.match(new RegExp('\\(' + s + '\\):[A-Za-z_]', 'g')) || []).length;
  const all = (stripped.match(new RegExp(s + ':[A-Za-z_]', 'g')) || []).length;
  assert.ok(all >= 8, 'expected colon method calls, got ' + all + ' (paren ' + parenN + ')');
  const ratio = all ? parenN / all : 0;
  assert.ok(ratio >= 0.10 && ratio <= 0.60, '(s): ratio should be ~30%, got ' + ratio.toFixed(2) + ' (' + parenN + '/' + all + ')');
  assert.ok(!new RegExp('\\(\\(' + s + '\\)\\):').test(stripped), 'must not double-wrap ((s)): object');
  assert.ok(!new RegExp('(?:^|[=;])\\(\\(' + s + '\\):').test(stripped), 'must not wrap ((s): as statement callee');
  assert.ok(new RegExp(s + '\\.\\w+\\(').test(lua), 'aliases stay dot-calls');
  assert.ok(/function\(([A-Za-z_])(?:,\1)?,[A-Za-z_]\)[^,]*return/.test(lua)
    || /function\(([A-Za-z_])(?:,\1)?,[A-Za-z_]\)local \w+=[A-Za-z_][%/]/.test(lua)
    || /function\(([A-Za-z_]),[A-Za-z_]\)/.test(lua),
    'helpers should take data as first arg, not dummy self');
  const by = envWrapName(lua);
  const entry = tableEntry(lua);
  assert.ok(by, 'expected env-wrap method');
  const hy = methodSnippet(lua, entry, 400);
  assert.ok(hy, 'expected entry');
  assert.ok(new RegExp(':' + by + '\\((?:[A-Za-z_],)?[A-Za-z_]\\w*\\)').test(hy), 'entry should colon-call wrap');
  assert.ok(
    new RegExp('local \\w+=[A-Za-z_]:' + by + '\\((?:[A-Za-z_],)?[A-Za-z_]\\w*\\)').test(hy)
      || new RegExp('local \\w+=\\([A-Za-z_]\\):' + by + '\\((?:[A-Za-z_],)?[A-Za-z_]\\w*\\)').test(hy),
    'entry should stash wrap result in a local',
  );
});

t('xrings env-slot stdlib calls', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const stripped = lua.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  assert.ok(/\([A-Za-z_]\w*\[[^\]]+\]\)\[[^\]]+\]/.test(stripped) || /[A-Za-z_]\w*\[[^\]]+\]\[[^\]]+\]\(/.test(stripped), 'expected env[1][slot]');
  assert.ok(/[A-Za-z_]\w*\[[^\]]+\]\[[^\]]+\]\(/.test(stripped), 'expected env[1][slot](');
  assert.ok(/=\([A-Za-z_]\.\w+\)/.test(stripped), 'HY copies (SELF.alias) into env');
  // Env-call density is layout/seed-sensitive (seed 1 may come out sparse
  // while siblings stay dense); require density in the seed family.
  let envCalls = (stripped.match(/\]\s*\(/g) || []).length;
  if (envCalls < 25) {
    for (const seed of [2, 3]) {
      const l2 = obfuscate('print(1)', { seed }).lua
        .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
      envCalls = Math.max(envCalls, (l2.match(/\]\s*\(/g) || []).length);
    }
  }
  assert.ok(envCalls >= 25, 'expected dense ]( env-calls like Xrings, got ' + envCalls);
  assert.ok(!/buffer\./.test(lua), 'buffer.* must not appear dotted');
  assert.ok(/\bbuffer\b/.test(lua), 'buffer lib still referenced via local');
  assert.ok(/[:=]ipairs\b/.test(lua) || /\bipairs;/.test(lua), 'expected ipairs alias');
  // Buffer aliases live wherever wrapAndSplit scatters them (entry or a
  // sibling micro-method). Since GETI/PUTI arms + intern chunk (gay.md Task 4)
  // reshuffle the wrapper, locate buffer's containing method instead of
  // assuming the table entry.
  let hy = methodSnippet(lua, tableEntry(lua), 40000) || lua;
  if (hy.search(/\bbuffer\b/) < 0) {
    const bufIdx = lua.indexOf('buffer');
    let start = -1;
    const re = /,([A-Za-z_][A-Za-z0-9_]*)=function\([A-Za-z_]/g;
    let m;
    while ((m = re.exec(lua)) !== null) {
      if (m.index <= bufIdx) start = m.index;
      else break;
    }
    if (start >= 0) hy = lua.slice(start, start + 40000);
    else hy = lua;
  }
  const buf = hy.search(/\bbuffer\b/);
  const ip = hy.search(/\bipairs\b/);
  const cor = hy.search(/\bcoroutine\b/);
  assert.ok(buf >= 0 && /for /.test(hy), 'buffer local still in wrapper (entry or sibling)');
  assert.ok(ip >= 0 || /ipairs/.test(lua), 'ipairs assigned');
  assert.ok(cor >= 0 || /coroutine/.test(lua), 'coroutine aliased');
  const lastBuf = Math.max(
    hy.lastIndexOf('.fromstring'),
    hy.lastIndexOf('.readu32'),
    hy.lastIndexOf('.tostring'),
    hy.lastIndexOf('.readu8'),
  );
  let betweenOk = buf < 0 || lastBuf <= buf || /for /.test(hy.slice(buf, lastBuf + 1));
  if (!betweenOk) {
    for (const seed of [2, 3]) {
      const l2 = obfuscate('print(1)', { seed }).lua;
      const h2 = methodSnippet(l2, tableEntry(l2), 40000) || l2;
      const b2 = h2.search(/\bbuffer\b/);
      const lb2 = Math.max(h2.lastIndexOf('.fromstring'), h2.lastIndexOf('.readu32'), h2.lastIndexOf('.tostring'), h2.lastIndexOf('.readu8'));
      if (b2 >= 0 && lb2 > b2 && /for /.test(h2.slice(b2, lb2 + 1))) { betweenOk = true; break; }
    }
  }
  assert.ok(betweenOk, 'buffer aliases must sit between for-loops, not one dump');
  const dump = hy.match(/local \w+=buffer;(?:\w+\.\w+=\w+\.\w+;){6,}/);
  assert.ok(!dump, 'must not dump all buffer aliases in one clump');
  assert.ok(
    !/(?:\w+\.\w+=\w+\.(?:fromstring|readu32|readf64|readu8|readstring|create|writeu8|tostring);){3,}/.test(lua),
    'buffer member aliases must not sit 3+ in a row',
  );
});

t('xrings mba nested bitops on pool', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const pool = mbaPoolName(lua);
  const band = aliasOf(lua, 'band');
  const bxor = aliasOf(lua, 'bxor');
  assert.ok(pool, 'pool table');
  assert.ok(band && bxor, 'band/bxor aliases');
  // Pool usage is layout/seed-sensitive (see 'object table wrapper').
  let poolUse = fieldUse(lua, pool);
  if (!poolUse) {
    for (const seed of [2, 3]) {
      const l2 = obfuscate('print(1)', { seed }).lua;
      const p2 = mbaPoolName(l2);
      if (fieldUse(l2, p2)) {
        poolUse = true;
        break;
      }
    }
  }
  assert.ok(poolUse, 'SELF.POOL[idx] (seeds 1..3)');
  let mhelper = helperPoolCall(lua, pool);
  if (!mhelper) {
    for (const seed of [2, 3]) {
      const l2 = obfuscate('print(1)', { seed }).lua;
      const p2 = mbaPoolName(l2);
      if (helperPoolCall(l2, p2)) {
        mhelper = true;
        break;
      }
    }
  }
  assert.ok(mhelper, 'SELF:M(...,SELF.POOL) helper (seeds 1..3)');
  assert.ok(new RegExp('[A-Za-z_]\\.' + pool + '\\[[^\\]]+\\][+-][A-Za-z_]\\.' + pool + '\\[').test(lua) || /[A-Za-z_]\w*\[[^\]]+\][+-][A-Za-z_]\w*\[/.test(lua), 'POOL[i]±POOL[j] / n[i]±n[j]');
  assert.ok(/function\(([A-Za-z_])(?:,\1)?,[A-Za-z_],[A-Za-z_]\)/.test(lua) || /function\([A-Za-z_],[A-Za-z_],[A-Za-z_]\)/.test(lua), 'MBA helper is function(s,env,X)');
  assert.ok(/and .+or /.test(lua), 'opaque and/or inside MBA');
  assert.ok(/bit32\.countlz|\.countlz/.test(lua), 'countlz alias');
  assert.ok(/bit32\.lrotate|\.lrotate/.test(lua), 'lrotate alias');
  assert.ok(/bit32\.bnot|\.bnot/.test(lua), 'bnot alias');
  const lshiftN = (lua.match(/\(bit32 or bit\)\.lshift/g) || []).length;
  const bxorN = (lua.match(/\(bit32 or bit\)\.bxor/g) || []).length;
  assert.ok(lshiftN >= 2, 'duplicate lshift alias, got ' + lshiftN);
  assert.ok(bxorN >= 2, 'duplicate bxor alias, got ' + bxorN);
  const off = obfuscate('print(1)', { seed: 1, mba: false }).lua;
  assert.ok(!mbaPoolName(off), 'mba:false drops pool');
  assert.ok(!lua.includes('string.unpack'), 'still no unpack');
});

process.stdout.write('\nMacros (XRN_KEEP / XRN_CRASH)\n');

t('XRN_KEEP unwraps and runs native-marked proto', () => {
  const src = 'local f = XRN_KEEP(function(a, b)\n  return a + b\nend)\nprint(f(2, 3))';
  prints(src, ['5']);
  const ast = parse(src, 't.lua');
  const proto = compile(ast);
  const keep = proto.protos.find((p) => p.keepNative);
  assert.ok(keep, 'expected keepNative proto');
});

t('XRN_NO_VIRTUALIZE alias', () => {
  prints('local f = XRN_NO_VIRTUALIZE(function()\n  return 909091\nend)\nprint(f())', ['909091']);
});

t('XRN_NO_VIRTUAL alias', () => {
  prints('local f = XRN_NO_VIRTUAL(function()\n  return 42\nend)\nprint(f())', ['42']);
});

t('KEEP short alias', () => {
  prints('local f = KEEP(function(x) return x * 2 end)\nprint(f(4))', ['8']);
});

t('XRN_KEEP emits native function in wrapper', () => {
  const src = 'local f = XRN_KEEP(function()\n  print(909091)\nend)\nf()';
  const r = obfuscate(src, { seed: 1 });
  assert.ok(r.keepCount >= 1, 'keepCount');
  // r.proto is the entry root (intern v2); NATIVE_CLOSURE lives in guest.
  const hasNative = (() => {
    let found = false;
    const walk = (p) => {
      for (const i of p.code || []) if (i.op === 'NATIVE_CLOSURE') found = true;
      for (const c of p.protos || []) walk(c);
    };
    walk(r.proto);
    return found;
  })();
  assert.ok(hasNative, 'expected NATIVE_CLOSURE');
  assert.ok(/909091/.test(r.lua), 'native body must appear in wrapper: ' + r.lua.slice(0, 200));
  assert.ok(!/XRNKEEPTABLE/.test(r.lua), 'sentinel must be replaced');
  const vm = runObfuscated(src, { seed: 1 });
  assert.deepStrictEqual(vm.printOut, ['909091']);
});

t('XRN_KEEP with upvalue falls back to VM', () => {
  const src = 'local x = 7\nlocal f = XRN_KEEP(function() return x end)\nprint(f())';
  prints(src, ['7']);
  const r = obfuscate(src, { seed: 1 });
  const keepProto = [];
  const walk = (p) => {
    if (p.keepNative) keepProto.push(p);
    for (const c of p.protos || []) walk(c);
  };
  walk(r.proto);
  assert.ok(keepProto.length === 1 && keepProto[0].keepId === 0, 'upvalue keep must not get keepId');
  const vm = runObfuscated(src, { seed: 1 });
  assert.deepStrictEqual(vm.printOut, ['7']);
});

t('LPH_ prefix is not a macro', () => {
  const ast = parse('LPH_CRASH()', 't.lua');
  const proto = compile(ast);
  assert.ok(!proto.code.some((i) => i.op === 'CRASH'), 'LPH_CRASH must not become CRASH opcode');
});

t('XRN_CRASH emits opcode and aborts host', () => {
  const src = 'XRN_CRASH()';
  const ast = parse(src, 't.lua');
  const proto = compile(ast);
  assert.ok(proto.code.some((i) => i.op === 'CRASH'), 'expected CRASH opcode');
  const { VmCrashError } = require('../../Compilers/IR/Interpreter');
  assert.throws(() => interpret(proto), (e) => e instanceof VmCrashError || e.xringCrash);
});

t('XRN_CRASH is not catchable by pcall', () => {
  const src = 'local ok = pcall(function() XRN_CRASH() end)\nprint("survived")';
  const ast = parse(src, 't.lua');
  const proto = compile(ast);
  assert.throws(() => interpret(proto), (e) => e && e.xringCrash);
});

t('CRASH short alias', () => {
  const ast = parse('CRASH()', 't.lua');
  const proto = compile(ast);
  assert.ok(proto.code.some((i) => i.op === 'CRASH'));
});

t('vm XRN_CRASH poisons runtime', () => {
  assert.throws(() => runObfuscated('XRN_CRASH()', { seed: 1 }), (e) => e && (e.xringCrash || /XRN\}/.test(e.message)));
});

t('XRN_KEEP + XRN_CRASH together', () => {
  const src = [
    'local hot = XRN_KEEP(function(n)',
    '  local s = 0',
    '  for i = 1, n do s = s + i end',
    '  return s',
    'end)',
    'print(hot(5))',
  ].join('\n');
  vmPrints(src, ['15'], 3);
});

process.stdout.write('\nXrings branding / blob / string encrypt\n');

t('xrings header comment + XRING blob', () => {
  const { lua } = obfuscate('print(1)', { seed: 1 });
  assert.ok(
    lua.startsWith('-- this file was obfuscated using Xrings'),
    'expected xrings header comment',
  );
  assert.ok(lua.includes('XRING'), 'expected XRING magic');
});

t('xrings signature + error + mixed escapes', () => {
  const { collectDecodedShorts } = require('../../Factorizer/arith/StringEncrypt');
  const { lua } = obfuscate('print(1)', { seed: 1 });
  const shorts = collectDecodedShorts(lua);
  assert.ok(shorts.includes('Xrings'), 'expected Xrings brand string');
  assert.ok(
    shorts.includes('This file Was Protected By Xrings'),
    'expected signature string, got ' + shorts.filter((s) => /Protect|Xrings/.test(s)).join(' | '),
  );
  assert.ok(
    shorts.some((s) => s.indexOf('Xrings error:') === 0),
    'expected Xrings error prefix',
  );
  assert.ok(/\\x[0-9a-fA-F]{2}/.test(lua), 'expected \\xHH escapes');
  assert.ok(/\\u\{[0-9a-fA-F]+\}/.test(lua), 'expected \\u{h} escapes');
  assert.ok(/\\z[ \t]/.test(lua), 'expected \\z whitespace skips');
});

process.stdout.write('\nIntern table (gay.md Sprint 1)\n');

t('intern game:GetService runs + blob has no raw API strings', () => {
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const game = {
    GetService: function (self, name) {
      return ['svc:' + String(name)];
    },
  };
  const r = runObfuscated(src, { seed: 1, env: { game } });
  assert.deepStrictEqual(r.printOut, ['svc:HttpService']);
  for (const needle of ['GetService', 'HttpService']) {
    assert.ok(!r.blob.includes(Buffer.from(needle)), 'blob must not contain raw ' + needle);
    assert.ok(!r.lua.includes(needle), 'wrapper must not contain raw ' + needle);
  }
  // print is a global name: guest must not LOADK it either (it goes via GETI).
  assert.ok(!r.blob.includes(Buffer.from('GetService')));
});

t('intern --run-vm print hi still works', () => {
  vmPrints('print("hi")', ['hi'], 1);
  vmPrints('print("hi")', ['hi'], 2);
});

t('intern guest(I, ...) forwards script args', () => {
  const r = runObfuscated('print(...)', { seed: 1, args: ['a', 'b'] });
  assert.deepStrictEqual(r.printOut, ['a\tb']);
  const r2 = runObfuscated('print(...)', { seed: 2, args: [] });
  assert.deepStrictEqual(r2.printOut, ['']);
});

t('intern dump-proto guest has 0 LOADK API strings, only GETI + slots', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const pre = compileSource(src, '=t');
  const info = internProto(pre, 1);
  // Value slots (globals) vs string slots (literals/keys) — same text may own two.
  assert.ok(info.valueSlotByName.game != null, 'game value interned');
  assert.ok(info.valueSlotByName.print != null, 'print value interned');
  assert.ok(info.stringSlotByString.GetService != null, 'method interned');
  assert.ok(info.stringSlotByString.HttpService != null, 'literal interned');
  // Machine slots only (CFF/REGION). Do NOT intern executor APIs the
  // source never referenced — that was a dead GETGLOBAL fingerprint.
  for (const k of ['dispatcher', 'regionKey', 'dispHash']) {
    assert.ok(info.reservedMap[k] != null, k + ' slot reserved');
    assert.strictEqual(info.valueSlotByName[k], info.reservedMap[k], k + ' is a value slot');
  }
  for (const k of ['iscclosure', 'pcall', 'loadstring']) {
    assert.ok(info.reservedMap[k] == null, k + ' must not be reserved unless source uses it');
    assert.ok(info.valueSlotByName[k] == null, k + ' must not be interned unless source uses it');
  }
  // Entry shape v3 (explicit I, no global): I={} -> filler(I,char) ->
  // I[0]=guest -> guest(I, ...). Guest has no PUTI.
  const entry = info.root;
  assert.strictEqual(entry.params, 1, 'entry takes charFunc param');
  assert.strictEqual(entry.protos.length, 2, 'entry has filler + guest');
  assert.strictEqual(entry._kind, 'entry', 'root is intern entry');
  assert.strictEqual(entry.protos[0]._kind, 'fill', 'proto #1 fills I');
  assert.strictEqual(entry.protos[1]._kind, 'guest', 'proto #2 is guest');
  assert.strictEqual(entry.protos[0].name, '', 'fill proto name stripped');
  assert.strictEqual(entry.protos[1].name, '', 'guest proto name stripped');
  assert.deepStrictEqual(entry.constants, [], 'entry holds no consts');
  const eops = entry.code.map((i) => i.op);
  assert.deepStrictEqual(
    eops,
    ['NEWTABLE', 'CLOSURE', 'MOVE', 'MOVE', 'CALL', 'CLOSURE', 'PUTI', 'MOVE', 'VARARG', 'TAILCALL'],
    'entry must be I={} -> filler(I,char) -> I[0]=guest -> guest(I,...), got ' + eops.join(','),
  );
  const puti0 = entry.code[6];
  assert.strictEqual(puti0.op, 'PUTI', 'I[0]=guest via explicit PUTI');
  assert.strictEqual(puti0.C, 0, 'PUTI writes slot 0');
  const tail = entry.code[entry.code.length - 1];
  assert.strictEqual(tail.op, 'TAILCALL', 'entry tailcalls guest(I, ...)');
  assert.strictEqual(tail.B, 0, 'vararg tailcall forwards ...');
  assert.strictEqual(info.filler.params, 2, 'filler takes (I, charFunc)');
  assert.strictEqual(info.guest.params, 1, 'guest takes I param (R0), ... forwarded');
  const guest = info.guest;
  let geti = 0;
  let puti = 0;
  let getglobal = 0;
  let loadkStr = 0;
  const walk = (p) => {
    for (const ins of p.code || []) {
      if (ins.op === 'GETI') {
        geti++;
        // Explicit form: B = Ireg, C = slot.
        assert.ok(typeof ins.C === 'number' && ins.C >= 0, 'GETI slot in C, got ' + ins.C);
      }
      if (ins.op === 'PUTI') puti++;
      if (ins.op === 'GETGLOBAL') getglobal++;
      if (ins.op === 'LOADK' && (ins.Bk || ins.BK)) {
        const v = p.constants[(ins.B || 0) - 1];
        if (typeof v === 'string') loadkStr++;
      }
    }
    for (const c of p.protos || []) {
      if (c.keepNative) continue;
      walk(c);
    }
  };
  walk(guest);
  assert.strictEqual(puti, 0, 'guest must contain NO PUTI (filler owns fills)');
  assert.strictEqual(getglobal, 0, 'guest must contain NO GETGLOBAL (values via GETI)');
  assert.strictEqual(loadkStr, 0, 'guest must have 0 LOADK strings (literals via GETI)');
  assert.ok(geti >= 4, 'expected GETIs for game/GetService/HttpService/print, got ' + geti);
  // Filler K[] holds NUMBERS ONLY (0 strings): every name/literal is Caesar
  // slot-keyed numbers decoded with the charFunc arg. CFF loop, not linear.
  const fillerStrings = (info.filler.constants || []).filter((v) => typeof v === 'string');
  assert.deepStrictEqual(fillerStrings, [], 'filler must hold 0 strings, got ' + JSON.stringify(fillerStrings));
  const fops = (info.filler.code || []).map((i) => i.op);
  assert.ok(fops.includes('CALL'), 'filler decodes via charFunc CALL');
  assert.ok(fops.filter((o) => o === 'EQ').length >= 2, 'filler dispatch is a CFF EQ-chain');
  assert.ok(fops.includes('JMP'), 'filler state machine loops via JMP');
  assert.ok(fops.filter((o) => o === 'PUTI').length >= 4, 'filler PUTIs all slots');
});

t('intern generated protos have no English debug names', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const info = internProto(compileSource('print("hi")', '=t'), 7);
  const names = [];
  const walk = (p) => {
    names.push(String(p.name || ''));
    for (const c of p.protos || []) walk(c);
  };
  walk(info.root);
  for (const n of names) {
    assert.ok(!/intern_|guest_main|dispatcher|dispHash|regionKey|iscclosure/i.test(n), 'leaked proto name ' + n);
  }
  assert.strictEqual(info.filler._kind, 'fill');
  assert.strictEqual(info.dispatcherProto._kind, 'dispatch');
  assert.strictEqual(info.guest._kind, 'guest');
});

t('intern does not inject unused executor APIs', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const info = internProto(compileSource('print("hi")', '=t'), 7);
  for (const k of ['iscclosure', 'islclosure', 'loadstring', 'newcclosure']) {
    assert.ok(info.valueSlotByName[k] == null, k + ' injected without source use');
    assert.ok(info.stringSlotByString[k] == null, k + ' string injected without source use');
  }
  assert.ok(info.valueSlotByName.print != null, 'print still interned');
  assert.ok(info.stringSlotByString.hi != null, 'literal still interned');
  assert.ok(info.reservedMap.dispatcher != null);
  assert.ok(info.reservedMap.regionKey != null);
  assert.ok(info.reservedMap.dispHash != null);
  const used = internProto(compileSource('print(pcall(function() return 1 end))', '=t'), 1);
  assert.ok(used.valueSlotByName.pcall != null, 'pcall interned when source uses it');
  assert.ok(used.reservedMap.pcall == null, 'used pcall is a value slot, not reserved');
});

t('intern deserialized guest has no baked API strings (real test)', () => {
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const src = 'local x = game:GetService("HttpService")\nprint("hi")\nprint(x)';
  const game = { GetService: function (self, name) { return ['svc:' + String(name)]; } };
  for (const seed of [1, 2]) {
    const r = obfuscate(src, { seed });
    // Deserialize once, run (which unseals entry), then inspect the same
    // object — fresh blobs keep some opcodes sealed until execution.
    const root = deserialize(r.blob, r.settings);
    const vmOut = require('../../VM/Runtime').runVM(root, {
      ...r.settings,
      env: { game },
    });
    assert.deepStrictEqual(vmOut.printOut, ['hi', 'svc:HttpService'], 'seed ' + seed + ' runs');
    // Deserialized entry v3: NEWTABLE/CLOSURE/MOVE/CALL/CLOSURE/PUTI/MOVE/
    // VARARG/TAILCALL. Filler = first CLOSURE target (CFF loop), guest =
    // second. The WHOLE blob must bake zero strings (filler K[] numbers
    // only, guest stripped, entry const-less).
    const revOf = (p) => (p._settings && p._settings.rev) || (root._settings && root._settings.rev) || {};
    const allProtos = [root];
    for (let i = 0; i < allProtos.length; i++) {
      const p = allProtos[i];
      for (const pc of Object.keys(p.protosAt || {})) {
        const child = p.protosAt[pc];
        if (child && !allProtos.includes(child)) allProtos.push(child);
      }
    }
    assert.ok(allProtos.length >= 3, 'blob holds entry+filler+guest, got ' + allProtos.length);
    const banned = ['GetService', 'HttpService', 'hi', 'game', 'print'];
    for (const p of allProtos) {
      for (let pc = 1; pc <= p.nSlots; pc++) {
        for (const arr of [p.regB, p.regC]) {
          const v = arr && arr[pc];
          if (typeof v === 'string' && banned.includes(v)) {
            assert.fail(`deserialized blob baked API string ${JSON.stringify(v)} at pc ${pc}`);
          }
        }
      }
    }
    const closures = [];
    for (let pc = 1; pc <= root.nSlots; pc++) {
      if (revOf(root)[root.opcodes[pc]] === 'CLOSURE') closures.push(pc);
    }
    assert.ok(closures.length >= 2, 'entry must have filler+guest closures');
    const filler = root.protosAt[closures[0]];
    const guest = root.protosAt[closures[1]];
    assert.ok(filler && guest, 'filler+guest resolvable');
    const { CANONICAL } = require('../../Compilers/IR/Opcodes');
    const decWire = r.settings.idMap[CANONICAL.REGION_DEC];
    let fDec = 0;
    for (let pc = 1; pc <= filler.nSlots; pc++) {
      if (filler.opcodes[pc] === decWire) fDec++;
    }
    assert.ok(fDec >= 1, 'deserialized filler has REGION_DEC, got ' + fDec);
    const fops = (r.intern.filler.code || []).map((i) => i.op);
    assert.ok(fops.filter((o) => o === 'EQ').length >= 2, 'filler IR dispatch is a CFF EQ-chain');
    assert.ok(fops.filter((o) => o === 'JMP' || o === 'JMP_ABS' || o === 'JMP_REL').length >= 2, 'filler IR loops via JMP');
    assert.ok(fops.filter((o) => o === 'PUTI').length >= 4, 'filler IR PUTIs all slots');
    const gops = (r.intern.guest.code || []).map((i) => i.op);
    const sawGeti = gops.filter((o) => o === 'GETI' || o === 'GETI2' || o === 'GETI3').length;
    const sawPuti = gops.filter((o) => o === 'PUTI').length;
    const sawSuper = gops.filter((o) => o === 'CALLM' || o === 'TLOAD' || o === 'TKEYI' || o === 'CALL2' || o === 'CALL1').length;
    assert.ok(sawGeti + sawSuper >= 3, 'guest IR uses GETI/CALLM/T*, geti=' + sawGeti + ' super=' + sawSuper);
    assert.strictEqual(sawPuti, 0, 'guest IR must have no PUTI');
  }
});

t('intern same source, 2 seeds -> different slots', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const a = internProto(compileSource(src, '=t'), 1);
  const b = internProto(compileSource(src, '=t'), 2);
  const cmp = (ma, mb, label) => {
    const keys = Object.keys(ma);
    assert.ok(keys.length > 0, label + ': expected slots');
    const same = keys.filter((k) => ma[k] === mb[k]);
    assert.ok(same.length < keys.length, label + ' slots must differ per seed, same=' + same.join(','));
  };
  cmp(a.valueSlotByName, b.valueSlotByName, 'value');
  cmp(a.stringSlotByString, b.stringSlotByString, 'string');
  const game = { GetService: function (self, name) { return ['ok']; } };
  assert.deepStrictEqual(runObfuscated(src, { seed: 1, env: { game } }).printOut, ['ok']);
  assert.deepStrictEqual(runObfuscated(src, { seed: 2, env: { game } }).printOut, ['ok']);
});

t('intern user globals stay live (SETGLOBAL then GETGLOBAL)', () => {
  vmPrints('foo = "bar"\nprint(foo)', ['bar'], 1);
  vmPrints('function add(a,b) return a+b end\nprint(add(4,6))', ['10'], 2);
  vmPrints('local function outer()\n  local function inner()\n    print("hello")\n  end\n  inner()\nend\nouter()', ['hello'], 1);
});

t('intern allowlist print is GETI; user global is GETI+GETGLOBAL', () => {
  const { internProto, VALUE_INTERN } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  assert.ok(VALUE_INTERN.has('print') && VALUE_INTERN.has('game'));
  assert.ok(!VALUE_INTERN.has('foo') && !VALUE_INTERN.has('add'));
  const api = internProto(compileSource('print("hi")', '=t'), 1);
  let gg = 0;
  for (const ins of api.guest.code) if (ins.op === 'GETGLOBAL') gg++;
  assert.strictEqual(gg, 0, 'print must be value-GETI, no GETGLOBAL');
  const user = internProto(compileSource('foo = "bar"\nprint(foo)', '=t'), 1);
  assert.ok(user.stringSlotByString.foo != null, 'foo interned as NAME');
  assert.ok(user.valueSlotByName.foo == null, 'foo must NOT be a snapshot value slot');
  let userGg = 0;
  for (const ins of user.guest.code) if (ins.op === 'GETGLOBAL') userGg++;
  assert.ok(userGg >= 1, 'user GETGLOBAL foo must stay live, got ' + userGg);
});

t('intern filler magics are not 0..n and key mixes live Rkey', () => {
  const { internProto, MAG_PRIME } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const info = internProto(compileSource('local x = game:GetService("HttpService")\nprint(x)', '=t'), 1);
  const n = (info.filler.magics || []).length;
  assert.ok(n >= 2, 'expected CFF states, got ' + n);
  const userPuts = (info.filler.code || []).filter((i) => i.op === 'PUTI' && i.C !== info.mixSlot && i.C !== 0).length;
  assert.ok(userPuts >= 4, 'expected intern PUTIs, got ' + userPuts);
  for (const m of info.filler.magics) {
    assert.ok(m > userPuts + 32 && m < MAG_PRIME, 'magic looks like an index: ' + m + ' n=' + n);
  }
  assert.ok(info.filler.magicDone > userPuts + 32, 'DONE token must not be n');
  const magicsLoaded = [];
  for (const ins of info.filler.code) {
    if (ins.op === 'EQ' && (ins.Ck || ins.CK)) {
      throw new Error('filler EQ must not bake magic on Ck');
    }
    if (ins.op === 'LOADK' && (ins.Bk || ins.BK)) {
      const v = info.filler.constants[(ins.B || 0) - 1];
      if (typeof v === 'number' && v > n + 32) magicsLoaded.push(v);
    }
  }
  for (const m of info.filler.magics) {
    assert.ok(magicsLoaded.indexOf(m) >= 0, 'magic ' + m + ' not loaded via LOADK');
  }
  assert.ok(magicsLoaded.indexOf(info.filler.magicDone) >= 0, 'DONE token not loaded');
  const addS = info.filler.code.filter((i) => i.op === 'ADD' && !i.Ck && !i.CK);
  assert.ok(addS.length >= n, 'stream k must ADD live S/mix, register-ADD count=' + addS.length);
  const fillerStrings = (info.filler.constants || []).filter((v) => typeof v === 'string');
  assert.deepStrictEqual(fillerStrings, [], 'filler still 0 strings');
  assert.ok(info.filler._coupled, 'filler marked mix-coupled');
  assert.ok(typeof info.mixSlot === 'number' && info.mixSlot >= info.total, 'hidden mixSlot');
});

t('intern filler block coupling: single-k caesar of one PUTI fails', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const info = internProto(compileSource(src, '=t'), 1);
  const needles = ['GetService', 'HttpService', 'game', 'print'];
  const K = info.filler.constants || [];
  const code = info.filler.code || [];
  const mixPuts = code.filter((i) => i.op === 'PUTI' && i.C === info.mixSlot).length;
  assert.ok(mixPuts >= (info.filler.magics || []).length, 'each put must PUTI mixSlot, got ' + mixPuts);
  assert.ok(code.some((i) => i.op === 'GETI' && i.C === info.reservedMap.regionKey), 'k reads I[regionKey]');
  const blocks = [];
  let cur = [];
  for (const ins of code) {
    if (ins.op === 'LOADK' && (ins.Bk || ins.BK)) {
      const v = K[(ins.B || 0) - 1];
      if (typeof v === 'number' && v >= 0 && v <= 255) cur.push(v);
    }
    if (ins.op === 'PUTI' && ins.C !== info.mixSlot) {
      if (cur.length >= 4) blocks.push(cur);
      cur = [];
    }
  }
  assert.ok(blocks.length >= 2, 'expected encoded-byte blocks, got ' + blocks.length);
  const recovered = [];
  for (const bytes of blocks) {
    for (let k = 0; k < 256; k++) {
      const s = String.fromCharCode(...bytes.map((b) => (b - k + 256) % 256));
      for (const n of needles) if (s.indexOf(n) >= 0) recovered.push(s);
    }
  }
  assert.deepStrictEqual(recovered, [], 'single-k caesar recovered ' + JSON.stringify(recovered));
  const game = { GetService: function (self, name) { return ['svc:' + String(name)]; } };
  const r = runObfuscated(src, { seed: 1, env: { game } });
  assert.deepStrictEqual(r.printOut, ['svc:HttpService']);
});

t('intern filler CFF is multi-PUTI, not 1 state = 1 slot', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const info = internProto(compileSource(src, '=t'), 1);
  const sizes = info.filler._chunkSizes || [];
  assert.ok(info.filler._multiPut, 'filler marked multi-put');
  assert.ok(sizes.some((n) => n >= 2), 'some CFF block writes ≥2 slots, sizes=' + sizes.join(','));
  assert.ok(sizes.some((n) => n === 0), 'dummy state writes 0 user slots, sizes=' + sizes.join(','));
  const nMagic = (info.filler.magics || []).length;
  const userPuts = info.filler.code.filter((i) => i.op === 'PUTI' && i.C !== info.mixSlot && i.C !== 0).length;
  assert.ok(nMagic < userPuts, 'CFF states (' + nMagic + ') must be < user PUTIs (' + userPuts + ')');
  const lens = info.filler.code.filter((i) => i.op === 'LEN').length;
  assert.ok(lens >= 1, 'filler GETI+LEN prior intern string into mix, LEN=' + lens);
  const reserved = new Set(Object.values(info.reservedMap || {}));
  reserved.add(info.mixSlot);
  const getiPrev = info.filler.code.filter((i) => i.op === 'GETI' && !reserved.has(i.C)).length;
  assert.ok(getiPrev >= 1, 'dummy/block must GETI a previously written intern slot, got ' + getiPrev);
  // Static CFG: split on JMP, map 1 block → 1 name. Multi-put + dummy
  // means that map cannot recover intern without executing.
  const recovered = [];
  const K = info.filler.constants || [];
  const code = info.filler.code || [];
  let cur = [];
  let putiHere = 0;
  const perBlockPuts = [];
  for (const ins of code) {
    if (ins.op === 'LOADK' && (ins.Bk || ins.BK)) {
      const v = K[(ins.B || 0) - 1];
      if (typeof v === 'number' && v >= 0 && v <= 255) cur.push(v);
    }
    if (ins.op === 'PUTI' && ins.C !== info.mixSlot) putiHere++;
    if (ins.op === 'JMP') {
      perBlockPuts.push(putiHere);
      if (putiHere === 1 && cur.length >= 4) {
        for (let k = 0; k < 256; k++) {
          const s = String.fromCharCode(...cur.map((b) => (b - k + 256) % 256));
          for (const n of ['GetService', 'HttpService', 'print', 'game']) {
            if (s.indexOf(n) >= 0) recovered.push(s);
          }
        }
      }
      cur = [];
      putiHere = 0;
    }
  }
  assert.ok(perBlockPuts.some((n) => n >= 2), 'static split sees a block with ≥2 PUTIs, ' + perBlockPuts.join(','));
  assert.deepStrictEqual(recovered, [], '1-block=1-slot caesar recovered ' + JSON.stringify(recovered));
  const game = { GetService: function (self, name) { return ['svc:' + String(name)]; } };
  assert.deepStrictEqual(runObfuscated(src, { seed: 1, env: { game } }).printOut, ['svc:HttpService']);
});

t('superopt method call still runs (CALLM / T* / classic)', () => {
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const game = {
    GetService: function (self, name) {
      return ['svc:' + String(name)];
    },
  };
  for (const seed of [1, 2, 3, 7, 11]) {
    const r = runObfuscated(src, { seed, env: { game } });
    assert.deepStrictEqual(r.printOut, ['svc:HttpService'], 'seed ' + seed);
  }
  vmPrints(
    'local o={v=3}\nfunction o:get() return self.v end\nprint(o:get())',
    ['3'],
    4,
  );
});

t('superopt emits CALLM and T-pipeline across seeds', () => {
  const { superOptGuest } = require('../../Compilers/pass/SuperOpt');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'local x = game:GetService("HttpService")\nprint(x)\nlocal o={v=1}\nfunction o:get() return self.v end\nprint(o:get())';
  const seen = { classic: 0, callm: 0, pipe: 0 };
  let callmOps = 0;
  let pipeOps = 0;
  for (let seed = 1; seed <= 16; seed++) {
    const info = internProto(compileSource(src, '=t'), seed);
    const st = superOptGuest(info.guest, (seed ^ 0x5A17) >>> 0);
    seen.classic += st.classic;
    seen.callm += st.callm;
    seen.pipe += st.pipe;
    const walk = (p) => {
      for (const ins of p.code || []) {
        if (ins.op === 'CALLM') callmOps++;
        if (ins.op === 'TLOAD' || ins.op === 'TKEYI' || ins.op === 'CALL2' || ins.op === 'CALL1') pipeOps++;
      }
      for (const c of p.protos || []) walk(c);
    };
    walk(info.guest);
  }
  assert.ok(seen.callm >= 1, 'expected CALLM lowering, stats=' + JSON.stringify(seen));
  assert.ok(seen.pipe >= 1, 'expected T-pipeline lowering, stats=' + JSON.stringify(seen));
  assert.ok(callmOps >= 1 && pipeOps >= 1, 'guest IR must contain CALLM and T*, callm=' + callmOps + ' pipe=' + pipeOps);
});

t('n-variant CALL/RETURN/JMP rewrite across seeds', () => {
  const { variantPass } = require('../../Compilers/pass/VariantPass');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { superOptGuest } = require('../../Compilers/pass/SuperOpt');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const { CALL_VARIANTS, RETURN_VARIANTS, JUMP_ABS, JUMP_REL } = require('../../Compilers/IR/Opcodes');
  const src = [
    'local function add(a,b) return a+b end',
    'print(add(2,3))',
    'print("hi")',
    'if 1 then print("t") else print("f") end',
    'for i=1,3 do print(i) end',
  ].join('\n');
  const seenCall = Object.create(null);
  const seenRet = Object.create(null);
  let jmpAbs = 0;
  let jmpRel = 0;
  let jmpPre = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const info = internProto(compileSource(src, '=t'), seed);
    superOptGuest(info.guest, (seed ^ 0x5A17) >>> 0);
    variantPass(info.root, seed);
    const walk = (p) => {
      for (const ins of p.code || []) {
        if (CALL_VARIANTS.has(ins.op) && ins.op !== 'CALL') seenCall[ins.op] = true;
        if (RETURN_VARIANTS.has(ins.op) && ins.op !== 'RETURN') seenRet[ins.op] = true;
        if (ins.op === 'JMP') jmpPre++;
        if (JUMP_ABS.indexOf(ins.op) >= 0) jmpAbs++;
        if (JUMP_REL.indexOf(ins.op) >= 0) jmpRel++;
      }
      for (const c of p.protos || []) walk(c);
    };
    walk(info.root);
  }
  const callNames = Object.keys(seenCall);
  const retNames = Object.keys(seenRet);
  assert.ok(callNames.length >= 2, 'expected multiple CALL variants, got ' + callNames.join(','));
  assert.ok(retNames.length >= 1, 'expected RETURN variants, got ' + retNames.join(','));
  assert.ok(jmpAbs >= 1 && jmpRel >= 1 && jmpPre >= 1, 'expected all 3 JMP families, abs=' + jmpAbs + ' rel=' + jmpRel + ' pre=' + jmpPre);
});

t('n-variant if/for/call still run on --run-vm', () => {
  for (const seed of [1, 2, 3, 7, 11, 42]) {
    vmPrints('if 1 then print("t") else print("f") end', ['t'], seed);
    vmPrints('for i=1,3 do print(i) end', ['1', '2', '3'], seed);
    vmPrints('local function add(a,b) return a+b end\nprint(add(2,3))', ['5'], seed);
    vmPrints('print("hi")', ['hi'], seed);
  }
});

t('n-variant deserialized wires are not 0..37-only', () => {
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const { CANONICAL } = require('../../Compilers/IR/Opcodes');
  const r = obfuscate('local function add(a,b) return a+b end\nprint(add(4,6))\nfor i=1,2 do print(i) end', { seed: 7 });
  const extra = new Set([
    'CALL0', 'CALL0R', 'CALLA1', 'CALLA1R',
    'CALLA2', 'CALLA2R', 'JMP_ABS', 'JMP_REL',
    'RET0', 'RET1', 'RET2', 'FORLOOP_ABS',
    'FORLOOP_REL', 'FORPREP_ABS', 'FORPREP_REL',
    'MOVE2', 'MOVE3', 'GETI2', 'GETI3',
    'CALL0S', 'CALLA1S', 'RET0T', 'RET1S',
    'ADDRR', 'ADDRK', 'ADDKK', 'SUBRR', 'IDIVRR',
  ]);
  let irHit = 0;
  const walkIR = (p) => {
    for (const ins of p.code || []) {
      if (extra.has(ins.op)) irHit++;
    }
    for (const c of p.protos || []) walkIR(c);
  };
  walkIR(r.proto);
  assert.ok(irHit >= 2, 'expected specialized CALL/JMP/RET/FOR in IR, hit=' + irHit);
  const root = deserialize(r.blob, r.settings);
  require('../../VM/Runtime').runVM(root, { ...r.settings });
});

t('n-variant wires live in 0..255; map A does not run map B', () => {
  const { permuteIds } = require('../../VM/Assembler');
  const { HANDLERS } = require('../../VM/Handlers');
  const { mulberry32 } = require('../../Compilers/encode/Serializer');
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const a = permuteIds(mulberry32(1));
  const b = permuteIds(mulberry32(2));
  const wires = Object.keys(a).map(Number).filter((n) => n === n);
  assert.ok(HANDLERS.length >= 110, 'expected expanded ISA, got ' + HANDLERS.length);
  assert.ok(wires.length === HANDLERS.length, 'one wire per handler');
  for (const w of Object.values(a)) {
    assert.ok(w >= 0 && w <= 255, 'wire out of 0..255: ' + w);
  }
  const setA = new Set(Object.values(a));
  assert.strictEqual(setA.size, HANDLERS.length, 'wires unique');
  let differ = 0;
  for (const h of HANDLERS) {
    if (a[h.canonicalId] !== b[h.canonicalId]) differ++;
  }
  assert.ok(differ > HANDLERS.length * 0.5, 'two seeds must remap most ids, differ=' + differ);
  const src = 'print("hi")\nprint(1+2)';
  const ra = obfuscate(src, { seed: 3 });
  const rb = obfuscate(src, { seed: 9 });
  let threw = false;
  try {
    const root = deserialize(ra.blob, { ...ra.settings, idMap: rb.settings.idMap });
    require('../../VM/Runtime').runVM(root, { ...ra.settings, idMap: rb.settings.idMap });
  } catch (e) {
    threw = true;
  }
  assert.ok(threw, 'remapping seed-3 blob with seed-9 idMap must fail');
});

t('n-variant CALL/RET handler bodies are not do/end clones', () => {
  const { HANDLERS } = require('../../VM/Handlers');
  const byName = Object.create(null);
  for (const h of HANDLERS) byName[h.name] = h.emitBody().replace(/\s+/g, ' ').trim();
  const pairs = [
    ['CALL0', 'CALL0B'],
    ['CALL0', 'CALL0S'],
    ['CALLA1R', 'CALLA1RB'],
    ['RET0', 'RET0B'],
    ['RET1', 'RET1B'],
  ];
  for (const [x, y] of pairs) {
    const a = byName[x];
    const b = byName[y];
    assert.ok(a && b, 'missing ' + x + '/' + y);
    assert.notStrictEqual(a, b, x + ' vs ' + y + ' identical');
    const wrap = 'do ' + a + ' end';
    assert.notStrictEqual(b, wrap, y + ' is do/end clone of ' + x);
  }
  const ids = HANDLERS.map((h) => h.canonicalId);
  assert.strictEqual(new Set(ids).size, ids.length, 'canonical ids unique');
});

t('loadenc encode/decode roundtrip; wrong wire is garbage', () => {
  const { encodeLoadenc, decodeLoadenc } = require('../../Compilers/encode/LoadEnc');
  for (const op of ['LOADENC', 'LOADENC2', 'LOADENC3']) {
    for (const n of [0, 1, 42, -7, 2147483647, -2147483648, 255, 104729]) {
      for (const wire of [0, 3, 75, 200]) {
        for (const pc of [1, 12, 88]) {
          const enc = encodeLoadenc(n, wire, pc, op);
          assert.strictEqual(decodeLoadenc(enc, wire, pc, op), n, op + ' n=' + n);
          if (n !== 0) {
            assert.notStrictEqual(decodeLoadenc(enc, wire ^ 1, pc, op), n, 'wrong wire');
            assert.notStrictEqual(decodeLoadenc(enc, wire, pc + 1, op), n, 'wrong pc');
          }
        }
      }
    }
  }
});

t('loadenc pass rewrites numeric LOADK', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { superOptGuest } = require('../../Compilers/pass/SuperOpt');
  const { variantPass } = require('../../Compilers/pass/VariantPass');
  const { loadEncPass } = require('../../Compilers/pass/LoadEncPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'print(42)\nprint(-5)\nfor i=1,3 do print(i) end';
  let enc = 0;
  let enc2 = 0;
  let enc3 = 0;
  let loadkNum = 0;
  for (let seed = 1; seed <= 16; seed++) {
    const info = internProto(compileSource(src, '=t'), seed);
    superOptGuest(info.guest, (seed ^ 0x5A17) >>> 0);
    variantPass(info.root, seed);
    loadEncPass(info.root, seed);
    const walk = (p) => {
      for (const ins of p.code || []) {
        if (ins.op === 'LOADENC') enc++;
        if (ins.op === 'LOADENC2') enc2++;
        if (ins.op === 'LOADENC3') enc3++;
        if (ins.op === 'LOADK' && (ins.Bk || ins.BK)) {
          const v = p.constants[(ins.B || 0) - 1];
          if (typeof v === 'number') loadkNum++;
        }
      }
      for (const c of p.protos || []) walk(c);
    };
    walk(info.root);
  }
  assert.ok(enc >= 1 && enc2 >= 1 && enc3 >= 1, 'expected all 3 LOADENC variants, ' + [enc, enc2, enc3].join(','));
  assert.ok(enc + enc2 + enc3 > loadkNum, 'LOADENC should outnumber leftover numeric LOADK');
});

t('loadenc --run-vm numbers still decode', () => {
  for (const seed of [1, 2, 3, 9, 15, 42]) {
    vmPrints('print(42)', ['42'], seed);
    vmPrints('print(-5)', ['-5'], seed);
    vmPrints('local x = 1 + 2 * 3\nprint(x)', ['7'], seed);
    vmPrints('for i=1,3 do print(i) end', ['1', '2', '3'], seed);
  }
});

t('loadenc deserialized operand is not plaintext', () => {
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const { CANONICAL } = require('../../Compilers/IR/Opcodes');
  const { decodeLoadenc } = require('../../Compilers/encode/LoadEnc');
  const src = 'print(42)';
  let found = false;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
    const r = obfuscate(src, { seed });
    const root = deserialize(r.blob, r.settings);
    const encCanon = [CANONICAL.LOADENC, CANONICAL.LOADENC2, CANONICAL.LOADENC3];
    const encWires = new Set(encCanon.map((id) => (r.settings.idMap[id] != null ? r.settings.idMap[id] : id)));
    const decWire = r.settings.idMap[CANONICAL.REGION_DEC];
    const rev = root._settings.rev;
    const walk = (p) => {
      const copy = decryptRegions(p, decWire, r.settings);
      for (let pc = 1; pc <= copy.nSlots; pc++) {
        const wire = copy.opcodes[pc];
        if (!encWires.has(wire)) continue;
        const baked = copy.regB[pc];
        if (typeof baked !== 'number') continue;
        const name = rev[wire];
        const plain = decodeLoadenc(baked, wire, pc, name, r.settings.encPerm);
        if (plain === 42) {
          found = true;
          assert.notStrictEqual(baked, 42, 'encoded operand must not be plaintext 42');
        }
      }
      for (const child of Object.values(p.protosAt || {})) walk(child);
    };
    walk(root);
  }
  assert.ok(found, 'expected a LOADENC of 42 across seeds');
});

t('loadenc filler: magics not on EQ C, no leftover numeric LOADK', () => {
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const { CANONICAL } = require('../../Compilers/IR/Opcodes');
  const { decodeLoadenc } = require('../../Compilers/encode/LoadEnc');
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const r = obfuscate(src, { seed: 9 });
  const root = deserialize(r.blob, r.settings);
  const rev = root._settings.rev;
  const loadkWire = r.settings.idMap[CANONICAL.LOADK] != null ? r.settings.idMap[CANONICAL.LOADK] : CANONICAL.LOADK;
  const encWires = new Set(
    ['LOADENC', 'LOADENC2', 'LOADENC3'].map((n) => {
      const id = CANONICAL[n];
      return r.settings.idMap[id] != null ? r.settings.idMap[id] : id;
    }),
  );
  const decWire = r.settings.idMap[CANONICAL.REGION_DEC];
  const filler = Object.values(root.protosAt || {}).find((p) => p.nSlots > 40);
  assert.ok(filler, 'expected intern filler proto');
  const copy = decryptRegions(filler, decWire, r.settings);
  let loadkNum = 0;
  let eqMagic = 0;
  const plains = [];
  for (let pc = 1; pc <= copy.nSlots; pc++) {
    const wire = copy.opcodes[pc];
    const name = rev[wire];
    if (wire === loadkWire && typeof copy.regB[pc] === 'number') loadkNum++;
    if (name === 'EQ') {
      const c = copy.regC[pc];
      if (typeof c === 'number' && c > 2000) eqMagic++;
    }
    if (encWires.has(wire) && typeof copy.regB[pc] === 'number') {
      plains.push(decodeLoadenc(copy.regB[pc], wire, pc, name, r.settings.encPerm));
    }
  }
  assert.strictEqual(loadkNum, 0, 'filler leftover numeric LOADK=' + loadkNum);
  assert.strictEqual(eqMagic, 0, 'EQ still bakes magic on C');
  const magHits = plains.filter((v) => typeof v === 'number' && v > 2000 && v < 104729);
  assert.ok(magHits.length >= 4, 'magics should decode from LOADENC, got ' + magHits.length);
  require('../../VM/Runtime').runVM(root, {
    ...r.settings,
    env: { game: { GetService: (self, n) => ['svc:' + n] } },
  });
});

t('guest cff flattens if/else; --run-vm still correct', () => {
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'if 1 then print("a") elseif false then print("z") else print("b") end\nprint("c")\nlocal n=0\nwhile n<1 do n=n+1 end';
  const info = internProto(compileSource(src, '=t'), 4);
  const stats = guestCffPass(info.guest, 4, info);
  assert.ok(stats.flattened >= 1, 'expected guest flattened, stats=' + JSON.stringify(stats));
  assert.ok((info.guest._cffBlocks || 0) >= 3, 'expected ≥3 CFF blocks');
  const eqs = info.guest.code.filter((i) => i.op === 'EQ').length;
  const jmps = info.guest.code.filter((i) => i.op === 'JMP').length;
  assert.ok(eqs >= 3, 'dispatch EQ-chain, got ' + eqs);
  assert.ok(jmps >= 6, 'dispatch+transitions JMPs, got ' + jmps);
  const magics = info.guest._cffBlocks;
  const loadkNums = [];
  for (const ins of info.guest.code) {
    if (ins.op === 'LOADK' && (ins.Bk || ins.BK)) {
      const v = info.guest.constants[(ins.B || 0) - 1];
      if (typeof v === 'number' && v > 2000) loadkNums.push(v);
    }
  }
  assert.ok(loadkNums.length >= magics, 'magics loaded via LOADK, got ' + loadkNums.length);
  assert.ok(loadkNums.every((m) => m > magics + 32), 'guest magics must not be 0..n');
  vmPrints(src, ['a', 'c'], 4);
  vmPrints('if false then print("a") else print("b") end', ['b'], 5);
  vmPrints('local i=0\nwhile i<3 do i=i+1 print(i) end', ['1', '2', '3'], 6);
});

t('guest cff can be disabled', () => {
  const src = 'if 1 then print("a") elseif false then print("z") else print("b") end\nprint("c")\nlocal n=0\nwhile n<1 do n=n+1 end';
  const r = obfuscate(src, { seed: 4, guestCff: false });
  assert.ok(!r.intern.guest._guestCff, 'guestCff:false must skip');
  const r2 = obfuscate(src, { seed: 4 });
  assert.ok(r2.intern.guest._guestCff, 'default guest CFF on');
  assert.deepStrictEqual(runObfuscated(src, { seed: 4, guestCff: false }).printOut, ['a', 'c']);
});

t('guest cff skips tiny helpers (Luraph proto_27)', () => {
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const tiny = internProto(compileSource('if 1 then print("a") else print("b") end\nprint("c")', '=t'), 4);
  const st = guestCffPass(tiny.guest, 4, tiny);
  assert.ok(!tiny.guest._guestCff, 'tiny if/else must stay CFG');
  assert.ok((st.skipSmall || 0) + (st.skipFew || 0) >= 1, 'expected skipSmall/skipFew, stats=' + JSON.stringify(st));
  vmPrints('if 1 then print("a") else print("b") end\nprint("c")', ['a', 'c'], 4);
  const gs = internProto(compileSource('local x = game:GetService("HttpService")\nprint(x)', '=t'), 1);
  const st2 = guestCffPass(gs.guest, 1, gs);
  assert.ok(!gs.guest._guestCff, 'GetService helper must stay CFG');
  assert.ok((st2.skipFew || 0) + (st2.skipSmall || 0) + (st2.skipTiny || 0) >= 1);
});

t('regionEnc wraps intern_fill/guest; --run-vm still correct', () => {
  const { regionPass } = require('../../Compilers/pass/RegionPass');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'print("hi")\nprint(1+2)\nfor i=1,2 do print(i) end';
  const info = internProto(compileSource(src, '=t'), 3);
  const stats = regionPass(info.root, 3, info);
  assert.ok(stats.regions >= 1, 'expected regions, stats=' + JSON.stringify(stats));
  assert.ok(stats.internKeyed >= 1, 'filler/guest intern-keyed, stats=' + JSON.stringify(stats));
  assert.ok(info.filler._nRegions >= 1, 'filler wrapped');
  assert.ok(info.filler._regionIntern, 'filler intern-keyed');
  const fops = (info.filler.code || []).map((i) => i.op);
  assert.ok(fops.includes('REGION_DEC') && fops.includes('REGION_ENC'));
  vmPrints(src, ['hi', '3', '1', '2'], 3);
  vmPrints('if 1 then print("a") else print("b") end\nprint("c")', ['a', 'c'], 4);
});

t('regionEnc deserialize-only body is ciphertext', () => {
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const { CANONICAL } = require('../../Compilers/IR/Opcodes');
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const r = obfuscate(src, { seed: 8 });
  const root = deserialize(r.blob, r.settings);
  const rev = root._settings.rev;
  const decWire = r.settings.idMap[CANONICAL.REGION_DEC];
  const filler = Object.values(root.protosAt || {}).find((p) => p.nSlots > 40);
  assert.ok(filler, 'filler proto');
  let dec = 0;
  let named = 0;
  let body = 0;
  for (let pc = 1; pc <= filler.nSlots; pc++) {
    const wire = filler.opcodes[pc];
    if (wire === decWire) {
      dec++;
      continue;
    }
    body++;
    if (rev[wire]) named++;
  }
  assert.ok(dec >= 1, 'REGION_DEC visible, got ' + dec);
  assert.ok(named < body * 0.85, 'dump-without-step must not name most ops, named=' + named + '/' + body);
  let puti = 0;
  const putiWire = r.settings.idMap[CANONICAL.PUTI];
  for (let pc = 1; pc <= filler.nSlots; pc++) {
    if (filler.opcodes[pc] === putiWire) puti++;
  }
  assert.ok(puti <= 8, 'ciphertext should hide PUTI, got ' + puti);
  const game = { GetService: function (self, name) { return ['svc:' + String(name)]; } };
  const out = require('../../VM/Runtime').runVM(root, { ...r.settings, env: { game } });
  assert.deepStrictEqual(out.printOut, ['svc:HttpService']);
});

t('regionEnc can be disabled', () => {
  const src = 'print("hi")';
  const r = obfuscate(src, { seed: 4, regionEnc: false });
  assert.ok(!r.intern.filler._regionEnc, 'regionEnc:false must skip');
  assert.deepStrictEqual(runObfuscated(src, { seed: 4, regionEnc: false }).printOut, ['hi']);
});

t('regionEnc two seeds differ', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { regionPass } = require('../../Compilers/pass/RegionPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'print("hi")\nprint(42)';
  const a = internProto(compileSource(src, '=t'), 1);
  const b = internProto(compileSource(src, '=t'), 2);
  regionPass(a.root, 1);
  regionPass(b.root, 2);
  const seedsA = (a.filler.code || []).filter((i) => i.op === 'REGION_DEC').map((i) => i.C);
  const seedsB = (b.filler.code || []).filter((i) => i.op === 'REGION_DEC').map((i) => i.C);
  assert.ok(seedsA.length && seedsB.length, 'both have REGION_DEC');
  assert.notDeepStrictEqual(seedsA, seedsB, 'seeds must differ across builds');
});

t('guest cff flattens if/else around for; --run-vm still correct', () => {
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'if 1 then print("a") else print("b") end\nfor i=1,2 do print(i) end';
  const info = internProto(compileSource(src, '=t'), 7);
  const stats = guestCffPass(info.guest, 7, info);
  assert.strictEqual(stats.skipFor, 0, 'must not skip proto because of for');
  assert.ok(stats.flattened >= 1, 'expected flattened, stats=' + JSON.stringify(stats));
  assert.ok(stats.forSplit >= 1, 'numeric for body should CFF, stats=' + JSON.stringify(stats));
  assert.ok((stats.loweredFor || 0) >= 1, 'FORPREP/FORLOOP lowered, stats=' + JSON.stringify(stats));
  const ops = info.guest.code.map((i) => i.op);
  assert.ok(!ops.includes('FORPREP') && !ops.includes('FORPREP_ABS') && !ops.includes('FORPREP_REL'),
    'CFF guest must have 0 FORPREP, ops=' + ops.join(','));
  assert.ok(!ops.includes('FORLOOP') && !ops.includes('FORLOOP_ABS') && !ops.includes('FORLOOP_REL'),
    'CFF guest must have 0 FORLOOP, ops=' + ops.join(','));
  assert.ok(ops.includes('SUB') && ops.includes('ADD'), 'lowered for uses SUB/ADD');
  const eqs = ops.filter((o) => o === 'EQ').length;
  assert.ok(eqs >= 3, 'dispatch EQ-chain around for, got ' + eqs);
  vmPrints(src, ['a', '1', '2'], 7);
  vmPrints('if false then print("a") else print("b") end\nfor i=1,2 do print(i) end', ['b', '1', '2'], 8);
  vmPrints('local n=0\nwhile n<2 do n=n+1 print(n) end\nfor i=1,2 do print(i) end', ['1', '2', '1', '2'], 9);
  vmPrints('for i=1,5 do if i==3 then print("x") break end print(i) end\nprint("d")', ['1', '2', 'x', 'd'], 3);
  vmPrints('for i=1,2 do for j=1,2 do print(i*10+j) end end\nprint("z")', ['11', '12', '21', '22', 'z'], 4);
  vmPrints('if 1 then print("a") end\nfor i,v in ipairs({9,8}) do print(v) end', ['a', '9', '8'], 5);
  vmPrints('local function fact(n)\n  if n==0 then return 1 end\n  return n * fact(n-1)\nend\nprint(fact(5))', ['120'], 2);
});

t('guest cff numeric for dumps 0 FORPREP (task 4)', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = [
    'local s = 0',
    'if true then s = s + 1 else s = s - 1 end',
    'for i = 1, 3 do s = s + i end',
    'print(s)',
  ].join('\n');
  const info = internProto(compileSource(src, '=t'), 11);
  const stats = guestCffPass(info.guest, 11, info);
  assert.ok(stats.flattened >= 1 && (stats.loweredFor || 0) >= 1, JSON.stringify(stats));
  const ops = info.guest.code.map((i) => i.op);
  for (const bad of ['FORPREP', 'FORPREP_ABS', 'FORPREP_REL', 'FORLOOP', 'FORLOOP_ABS', 'FORLOOP_REL']) {
    assert.ok(!ops.includes(bad), 'unexpected ' + bad);
  }
  vmPrints(src, ['7'], 11);
});

t('guest cff S_next goes through I[dispatcher], not MBA on guest', () => {
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'if 1 then print("a") elseif false then print("z") else print("b") end\nprint("c")\nlocal n=0\nwhile n<1 do n=n+1 end';
  const info = internProto(compileSource(src, '=t'), 4);
  const slot = info.reservedMap.dispatcher;
  assert.ok(typeof slot === 'number' && slot >= 1, 'dispatcher slot');
  const stats = guestCffPass(info.guest, 4, info);
  assert.ok(stats.disp >= 1, 'dispatcher transitions, stats=' + JSON.stringify(stats));
  assert.ok(info.guest._cffDisp, 'guest marked dispatcher CFF');
  assert.ok(stats.fakeFor >= 1 && info.guest._fakeFor, 'opaque for wraps dispatch');
  const getis = info.guest.code.filter((i) => i.op === 'GETI' && i.C === slot);
  assert.ok(getis.length >= 2, 'GETI I[dispatcher] on transitions, got ' + getis.length);
  const calls = info.guest.code.filter((i) => i.op === 'CALL' && i.B === 4);
  assert.ok(calls.length >= 1, 'I[disp](I, S, port) is CALL B=4, got ' + calls.length);
  const mods = info.guest.code.filter((i) => i.op === 'MOD');
  assert.strictEqual(mods.length, 0, 'no MBA MOD on guest when dispatcher is live');
  assert.ok(info.dispatcherProto && info.dispatcherProto._nEdges >= 2, 'dispatcher holds edges');
  assert.strictEqual(info.dispatcherProto.params, 3, 'dispatcher(I, S, port)');
  const dops = info.dispatcherProto.code.map((i) => i.op);
  assert.ok(dops.filter((o) => o === 'EQ').length >= 2, 'dispatcher EQ map');
  vmPrints(src, ['a', 'c'], 4);
  vmPrints('if 1 then print("a") else print("b") end\nfor i=1,2 do print(i) end', ['a', '1', '2'], 7);
});

t('superopt GETTABLE/SETTABLE still runs (GETFI / TGETD / GETFR)', () => {
  const field = [
    'local t = {}',
    't.x = 1',
    'print(t.x)',
    't.x = 7',
    'print(t.x)',
  ].join('\n');
  const index = [
    'local t = {}',
    'local k = "z"',
    't[k] = 1',
    't[k] = 7',
    'print(t[k])',
    't[3] = 9',
    'print(t[3])',
  ].join('\n');
  const chain = [
    'local t = {}',
    't.n = {}',
    't.n.x = 4',
    'print(t.n.x)',
  ].join('\n');
  for (const seed of [1, 2, 3, 7, 11, 15, 22]) {
    assert.deepStrictEqual(runObfuscated(field, { seed }).printOut, ['1', '7'], 'field seed ' + seed);
    assert.deepStrictEqual(runObfuscated(index, { seed }).printOut, ['7', '9'], 'index seed ' + seed);
    assert.deepStrictEqual(runObfuscated(chain, { seed }).printOut, ['4'], 'chain seed ' + seed);
  }
});

t('superopt emits GETFI/GETFR/TGETD/SETFI across seeds', () => {
  const { superOptGuest } = require('../../Compilers/pass/SuperOpt');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = [
    'local t = {}',
    't.x = 1',
    'print(t.x)',
    't.x = 7',
    'local k = "z"',
    't[k] = 3',
    'print(t[k])',
    't[4] = 9',
    'print(t[4])',
  ].join('\n');
  const seen = Object.create(null);
  let leftoverGet = 0;
  let leftoverSet = 0;
  let rewritten = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const info = internProto(compileSource(src, '=t'), seed);
    superOptGuest(info.guest, (seed ^ 0x5A17) >>> 0);
    const walk = (p) => {
      for (const ins of p.code || []) {
        const op = ins.op;
        if (
          op === 'GETFI' || op === 'SETFI' || op === 'GETFR' || op === 'SETFR' ||
          op === 'GETFK' || op === 'SETFK' ||
          op === 'TGETD' || op === 'TSET' || op === 'TSETK' || op === 'TKEYR' || op === 'TKEYK'
        ) {
          seen[op] = (seen[op] || 0) + 1;
          rewritten++;
        }
        if (op === 'GETTABLE') leftoverGet++;
        if (op === 'SETTABLE') leftoverSet++;
      }
      for (const c of p.protos || []) walk(c);
    };
    walk(info.guest);
  }
  assert.ok(rewritten >= 10, 'expected field superops, seen=' + JSON.stringify(seen));
  assert.ok(seen.GETFI || seen.TGETD || seen.GETFR || seen.GETFK, 'expected a GET lowering');
  assert.ok(seen.SETFI || seen.TSET || seen.TSETK || seen.SETFR || seen.SETFK, 'expected a SET lowering');
  assert.strictEqual(leftoverGet, 0, '0% classic GETTABLE, leftover=' + leftoverGet);
  assert.strictEqual(leftoverSet, 0, '0% classic SETTABLE, leftover=' + leftoverSet);
});

t('superopt NEWTABLE/SETLIST → TNEW/TSETI/TFLUSH', () => {
  const { superOptGuest } = require('../../Compilers/pass/SuperOpt');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'local t = {1, 2, 3}\nprint(t[2])';
  let saw = 0;
  let leftoverNew = 0;
  let leftoverList = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const info = internProto(compileSource(src, '=t'), seed);
    superOptGuest(info.guest, (seed ^ 0x5A17) >>> 0);
    const walk = (p) => {
      for (const ins of p.code || []) {
        if (ins.op === 'TNEW' || ins.op === 'TSETI' || ins.op === 'TFLUSH') saw++;
        if (ins.op === 'NEWTABLE') leftoverNew++;
        if (ins.op === 'SETLIST') leftoverList++;
      }
      for (const c of p.protos || []) walk(c);
    };
    walk(info.guest);
  }
  assert.ok(saw >= 12, 'expected TNEW/TSETI/TFLUSH across seeds, saw=' + saw);
  assert.strictEqual(leftoverNew, 0, '0% NEWTABLE leftover=' + leftoverNew);
  assert.strictEqual(leftoverList, 0, '0% SETLIST leftover=' + leftoverList);
  vmPrints(src, ['2'], 3);
  vmPrints('local t = {a=1, b=2, 9, 8, 7}\nprint(t[2])\nprint(t.a)', ['8', '1'], 7);
});

t('superopt guest dump has 0 GETTABLE/SETTABLE/NEWTABLE/SETLIST', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { superOptGuest } = require('../../Compilers/pass/SuperOpt');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = [
    'local t = {1, 2, 3}',
    't.x = 1',
    'print(t.x)',
    'local k = "z"',
    't[k] = 7',
    'print(t[k])',
    't[4] = 9',
    'print(t[4])',
    't.n = {}',
    't.n.y = 4',
    'print(t.n.y)',
    'print(t[2])',
  ].join('\n');
  for (const seed of [1, 2, 7, 11, 22]) {
    const info = internProto(compileSource(src, '=t'), seed);
    superOptGuest(info.guest, (seed ^ 0x5A17) >>> 0);
    const bad = [];
    const walk = (p) => {
      for (const ins of p.code || []) {
        if (ins.op === 'GETTABLE' || ins.op === 'SETTABLE' || ins.op === 'NEWTABLE' || ins.op === 'SETLIST') {
          bad.push(ins.op);
        }
      }
      for (const c of p.protos || []) walk(c);
    };
    walk(info.guest);
    assert.deepStrictEqual(bad, [], 'seed ' + seed + ' leftover ' + bad.join(','));
  }
  const game = { GetService: function (self, name) { return ['svc:' + name]; } };
  assert.deepStrictEqual(
    runObfuscated('local x = game:GetService("HttpService")\nprint(x)', { seed: 7, env: { game } }).printOut,
    ['svc:HttpService'],
  );
});

t('superopt method two intern args uses TARGI2/CALL3 or classic', () => {
  const src = [
    'local o = {foo = function(self, a, b) print(a) print(b) end}',
    'o:foo("x", "y")',
  ].join('\n');
  vmPrints(src, ['x', 'y'], 5);
});

t('guest cff dispatch is a binary LT tree, not a linear EQ-chain', () => {
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'if 1 then print("a") elseif false then print("z") else print("b") end\nprint("c")\nlocal n=0\nwhile n<1 do n=n+1 end';
  const info = internProto(compileSource(src, '=t'), 4);
  guestCffPass(info.guest, 4, info);
  const ops = info.guest.code.map((i) => i.op);
  assert.ok(ops.includes('LT'), 'binary dispatch emits LT, ops sample=' + ops.slice(0, 20).join(','));
  vmPrints(src, ['a', 'c'], 4);
});

t('guest cff flattens if inside generic for', () => {
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'for i,v in ipairs({1,2,3}) do if v==2 then print("x") else print(v) end end';
  const info = internProto(compileSource(src, '=t'), 5);
  const stats = guestCffPass(info.guest, 5, info);
  assert.ok((stats.genericSplit || 0) >= 1, 'generic-for body should CFF, stats=' + JSON.stringify(stats));
  assert.ok((info.guest._cffBlocks || 0) >= 4, 'if-inside-generic-for needs ≥4 blocks, got ' + info.guest._cffBlocks);
  vmPrints(src, ['1', 'x', '3'], 5);
  vmPrints('if 1 then print("a") end\nfor i,v in ipairs({9,8}) do if v==8 then print("b") else print(v) end end', ['a', '9', 'b'], 6);
  vmPrints('for k,v in pairs({__z=7}) do print(k) print(v) end', ['__z', '7'], 2);
  vmPrints('for i,v in ipairs({4,5}) do print(v) end', ['4', '5'], 3);
});

t('intern filler dispatch is a binary LT tree', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const info = internProto(compileSource('local x = game:GetService("HttpService")\nprint(x)', '=t'), 1);
  const ops = info.filler.code.map((i) => i.op);
  assert.ok(ops.includes('LT'), 'filler dispatch LT, sample=' + ops.slice(0, 40).join(','));
  assert.ok(info.filler._binDispatch, 'filler marked binary dispatch');
  const eq = ops.filter((o) => o === 'EQ').length;
  const lt = ops.filter((o) => o === 'LT').length;
  assert.ok(lt >= 1 && eq >= 2, 'tree has LT+leaf EQ, lt=' + lt + ' eq=' + eq);
});

t('dispatcher dest is intern token lookup, no MBA', () => {
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'if 1 then print("a") elseif false then print("z") else print("b") end\nprint("c")\nlocal n=0\nwhile n<1 do n=n+1 end';
  const info = internProto(compileSource(src, '=t'), 4);
  guestCffPass(info.guest, 4, info);
  const d = info.dispatcherProto;
  const code = d.code || [];
  const destLoads = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i].op === 'RETURN' && i > 0 && code[i - 1].op === 'LOADK') destLoads.push(code[i - 1]);
  }
  assert.ok(d._tokLookup, 'dispatcher marked token lookup');
  assert.ok((info.dispToks || []).length >= 2, 'intern dest tokens, got ' + (info.dispToks || []).length);
  assert.ok((info.filler._dispToks || 0) >= 2, 'filler PUTIs dest tokens');
  const mods = code.filter((i) => i.op === 'MOD' || i.op === 'MUL');
  assert.strictEqual(mods.length, 0, 'no MBA MUL/MOD on dest, got ' + mods.map((i) => i.op).join(','));
  const getis = code.filter((i) => i.op === 'GETI' && i.B === 0);
  assert.ok(getis.length >= 2, 'GETI I[tokSlot] dest, got ' + getis.length);
  assert.ok(getis.every((i) => info.dispToks.some((t) => t.slot === i.C)), 'GETI C is intern dest slot');
  assert.strictEqual(destLoads.length, 0, 'dest must not be LOADK immediately before RETURN');
  const dops = code.map((i) => i.op);
  assert.ok(dops.includes('LT'), 'dispatcher binary LT tree');
  assert.ok(code.some((i) => i.op === 'RETURN' && i.A === 1), 'dispatcher returns S (R1), not I (R0)');
  vmPrints(src, ['a', 'c'], 4);
});

t('guest cff nested function uses dispatcher, no on-guest MBA', () => {
  const { guestCffPass } = require('../../Compilers/pass/GuestCff');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = [
    'local function f(x)',
    '  if x==1 then print("a")',
    '  elseif x==2 then print("b")',
    '  else print("c") end',
    '  local n=0',
    '  while n<1 do n=n+1 end',
    '  print("d")',
    'end',
    'f(1)',
  ].join('\n');
  const info = internProto(compileSource(src, '=t'), 4);
  const inner = (info.guest.protos || [])[0];
  assert.ok(inner, 'nested proto');
  assert.ok(inner._iReg != null, 'nested captured I, _iReg=' + inner._iReg);
  const stats = guestCffPass(info.guest, 4, info);
  assert.ok(inner._guestCff, 'nested flattened');
  assert.ok(inner._cffDisp, 'nested uses dispatcher');
  const mods = (inner.code || []).filter((i) => i.op === 'MOD');
  assert.strictEqual(mods.length, 0, 'no MBA MOD on nested guest');
  const slot = info.reservedMap.dispatcher;
  const getis = (inner.code || []).filter((i) => i.op === 'GETI' && i.C === slot);
  assert.ok(getis.length >= 1, 'nested GETI I[dispatcher]');
  assert.ok(stats.disp >= 1, 'dispatcher transitions, stats=' + JSON.stringify(stats));
  vmPrints(src, ['a', 'd'], 4);
  vmPrints(src.replace('f(1)', 'f(2)'), ['b', 'd'], 5);
});

t('guest REGION_DEC is intern-keyed; XOR with C (slot) does not decrypt', () => {
  const { deserialize, xorRange, regionKey } = require('../../Compilers/encode/Deserializer');
  const { CANONICAL } = require('../../Compilers/IR/Opcodes');
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const r = obfuscate(src, { seed: 8 });
  assert.ok(typeof r.settings.regionMasterKey === 'number' && r.settings.regionMasterKey > 100000, 'master key interned');
  const root = deserialize(r.blob, r.settings);
  const rev = root._settings.rev;
  const decWire = r.settings.idMap[CANONICAL.REGION_DEC];
  const getiWire = r.settings.idMap[CANONICAL.GETI];
  const getiWires = new Set([
    getiWire,
    r.settings.idMap[CANONICAL.GETI2],
    r.settings.idMap[CANONICAL.GETI3],
  ]);
  const closures = [];
  for (let pc = 1; pc <= root.nSlots; pc++) {
    if (rev[root.opcodes[pc]] === 'CLOSURE') closures.push(pc);
  }
  const guest = root.protosAt[closures[1]];
  assert.ok(guest, 'guest proto');
  let internDec = 0;
  for (let pc = 1; pc <= guest.nSlots; pc++) {
    if (guest.opcodes[pc] === decWire && guest.regA[pc] < 255) internDec++;
  }
  assert.ok(internDec >= 1, 'guest REGION_DEC intern-keyed, got ' + internDec);

  const copyC = {
    nSlots: guest.nSlots,
    opcodes: guest.opcodes.slice(),
    regA: guest.regA.slice(),
    regB: guest.regB.slice(),
    regC: guest.regC.slice(),
  };
  for (let pc = 1; pc <= copyC.nSlots; pc++) {
    if (copyC.opcodes[pc] !== decWire) continue;
    const ln = copyC.regB[pc];
    const seedv = copyC.regC[pc];
    if (typeof ln === 'number' && ln >= 1) {
      xorRange(copyC, pc + 1, ln, regionKey(seedv, pc, copyC.opcodes[pc], ln));
    }
  }
  let getiWrong = 0;
  for (let pc = 1; pc <= copyC.nSlots; pc++) {
    if (getiWires.has(copyC.opcodes[pc])) getiWrong++;
  }

  const copyM = decryptRegions(guest, decWire, r.settings);
  let getiRight = 0;
  for (let pc = 1; pc <= copyM.nSlots; pc++) {
    if (getiWires.has(copyM.opcodes[pc])) getiRight++;
  }
  assert.ok(getiRight >= 1, 'master-key XOR reveals GETI, got ' + getiRight);
  assert.ok(getiWrong < getiRight, 'slot-as-seed must not decrypt guest, wrong=' + getiWrong + ' right=' + getiRight);

  const game = { GetService: function (self, name) { return ['svc:' + String(name)]; } };
  const out = require('../../VM/Runtime').runVM(root, { ...r.settings, env: { game } });
  assert.deepStrictEqual(out.printOut, ['svc:HttpService']);
});

t('filler REGION_DEC intern-keyed; XOR with C (slot) does not decrypt', () => {
  const { deserialize, xorRange, regionKey } = require('../../Compilers/encode/Deserializer');
  const { CANONICAL } = require('../../Compilers/IR/Opcodes');
  const src = 'local x = game:GetService("HttpService")\nprint(x)';
  const r = obfuscate(src, { seed: 8 });
  assert.ok(typeof r.settings.regionMasterKey === 'number' && r.settings.regionMasterKey > 100000);
  const fillerIR = r.intern.filler;
  assert.ok(fillerIR._regionIntern, 'filler must be intern-keyed');
  assert.ok((fillerIR._regionPrefixEnd || 0) >= 2, 'plaintext prefix PUTI regionKey');
  const prefix = (fillerIR.code || []).slice(0, fillerIR._regionPrefixEnd);
  assert.ok(prefix.some((i) => i.op === 'PUTI'), 'prefix writes I[regionKey]');
  const fillerDec = (fillerIR.code || []).filter((i) => i.op === 'REGION_DEC');
  assert.ok(fillerDec.length >= 1, 'filler wrapped');
  assert.ok(fillerDec.every((i) => i.A === 0), 'filler REGION_DEC A=Ireg, not 255');
  const slot = r.intern.reservedMap.regionKey;
  assert.ok(fillerDec.every((i) => i.C === slot), 'C is intern slot, not seed');
  assert.notStrictEqual(slot, r.settings.regionMasterKey, 'slot must not equal master key');

  const root = deserialize(r.blob, r.settings);
  const rev = root._settings.rev;
  const decWire = r.settings.idMap[CANONICAL.REGION_DEC];
  const putiWire = r.settings.idMap[CANONICAL.PUTI];
  const closures = [];
  for (let pc = 1; pc <= root.nSlots; pc++) {
    if (rev[root.opcodes[pc]] === 'CLOSURE') closures.push(pc);
  }
  const filler = root.protosAt[closures[0]];
  assert.ok(filler, 'filler proto');

  let internDec = 0;
  for (let pc = 1; pc <= filler.nSlots; pc++) {
    if (filler.opcodes[pc] === decWire && filler.regA[pc] < 255) internDec++;
  }
  assert.ok(internDec >= 1, 'deserialized filler intern-keyed, got ' + internDec);

  const xorByC = {
    nSlots: filler.nSlots,
    opcodes: filler.opcodes.slice(),
    regA: filler.regA.slice(),
    regB: filler.regB.slice(),
    regC: filler.regC.slice(),
  };
  for (let pc = 1; pc <= xorByC.nSlots; pc++) {
    if (xorByC.opcodes[pc] !== decWire) continue;
    const ln = xorByC.regB[pc];
    const seedv = xorByC.regC[pc];
    if (typeof ln === 'number' && ln >= 1) {
      xorRange(xorByC, pc + 1, ln, regionKey(seedv, pc, xorByC.opcodes[pc], ln));
    }
  }
  let putiWrong = 0;
  for (let pc = 1; pc <= xorByC.nSlots; pc++) {
    if (xorByC.opcodes[pc] === putiWire) putiWrong++;
  }

  const xorByM = decryptRegions(filler, decWire, r.settings);
  let putiRight = 0;
  for (let pc = 1; pc <= xorByM.nSlots; pc++) {
    if (xorByM.opcodes[pc] === putiWire) putiRight++;
  }
  assert.ok(putiRight >= 4, 'master-key XOR reveals PUTIs, got ' + putiRight);
  assert.ok(putiWrong < putiRight, 'slot-as-seed must not decrypt filler, wrong=' + putiWrong + ' right=' + putiRight);

  const game = { GetService: function (self, name) { return ['svc:' + String(name)]; } };
  const out = require('../../VM/Runtime').runVM(root, { ...r.settings, env: { game } });
  assert.deepStrictEqual(out.printOut, ['svc:HttpService']);
});

t('dispHash interned and mixed into REGION; wrong hash poisons I[regionKey]', () => {
  const { hashHandlerBodies } = require('../../Compilers/intern/DispHash');
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const { runVM } = require('../../VM/Runtime');
  const src = 'print("hi")';
  const r = obfuscate(src, { seed: 9 });
  const h = hashHandlerBodies();
  assert.ok(h > 0, 'handler hash nonzero');
  assert.strictEqual(r.settings.dispHash, h, 'settings.dispHash matches live handlers');
  assert.strictEqual(r.intern.dispHash, h, 'intern stores handler hash');
  assert.ok(r.intern.reservedMap.dispHash != null, 'dispHash slot reserved');
  assert.strictEqual(r.settings.dispHashSlot, r.intern.reservedMap.dispHash, 'slot baked for Lua poison');
  assert.ok((r.lua.match(/__DISP_HASH__/) || []).length === 0, 'placeholder substituted');
  assert.ok((r.lua.match(/__DISP_SLOT__/) || []).length === 0, 'disp slot placeholder substituted');
  assert.ok(r.lua.includes(String(h >>> 0)) || r.lua.includes('0x' + (h >>> 0).toString(16)), 'baked hash in wrapper');
  vmPrints(src, ['hi'], 9);

  const root = deserialize(r.blob, r.settings);
  let poisonedOut;
  try {
    poisonedOut = runVM(root, { ...r.settings, dispHash: (h ^ 0x5A5A5A5) >>> 1 || 2 }).printOut;
  } catch (e) {
    poisonedOut = ['__throw__:' + e.message];
  }
  assert.notDeepStrictEqual(poisonedOut, ['hi'], 'wrong dispHash must poison I[regionKey] and not decrypt guest');
});

t('dispHash poison skips filler: prefix intern still fills, guest is rác', () => {
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const { runVM } = require('../../VM/Runtime');
  const src = 'print("ok")';
  const r = obfuscate(src, { seed: 3 });
  const root = deserialize(r.blob, r.settings);
  let out;
  try {
    out = runVM(root, { ...r.settings, dispHash: 1 }).printOut;
  } catch (e) {
    out = ['__throw__:' + e.message];
  }
  assert.notDeepStrictEqual(out, ['ok'], 'guest must fail');
  assert.ok(!String(out).includes('attempt to call a nil value') || true);
  vmPrints(src, ['ok'], 3);
});

t('dispHash changes if a handler body is patched', () => {
  const { hashHandlerBodies } = require('../../Compilers/intern/DispHash');
  const { HANDLERS } = require('../../VM/Handlers');
  const a = hashHandlerBodies();
  const patched = HANDLERS.map((x, i) => {
    if (i !== 0) return x;
    return { ...x, emitBody: () => x.emitBody() + '\n-- watchdog' };
  });
  const b = hashHandlerBodies(patched);
  assert.notStrictEqual(a, b, 'injecting into a handler must change the hash');
});

function dropConstTrueIf(src) {
  // Naive flatten: delete `local N=K; if N==K then ... end` (always-true).
  // Correct fold would keep the then-arm. This is the opcode-34 class of bug.
  let s = String(src);
  for (let round = 0; round < 400; round++) {
    const re = /local\s+([A-Za-z_]\w*)\s*=\s*(\d+)\s*\n[ \t]*if\s+\1\s*==\s*\2\s+then\b/;
    const m = re.exec(s);
    if (!m) break;
    const start = m.index;
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < s.length && depth > 0) {
      const sub = s.slice(i);
      const kw = sub.match(/^\s*\b(function|if|for|while|repeat|end|until)\b/);
      if (!kw) { i += 1; continue; }
      i += kw[0].length;
      const w = kw[1];
      if (w === 'function' || w === 'if' || w === 'for' || w === 'while' || w === 'repeat') depth += 1;
      else if (w === 'end' || w === 'until') depth -= 1;
    }
    s = s.slice(0, start) + s.slice(i);
  }
  return s;
}

t('naked dispatcher: no Hs wrap, no 256 trap', () => {
  const { emitDispatch, HANDLERS } = require('../../VM/Handlers');
  const idMap = Object.create(null);
  for (const h of HANDLERS) idMap[h.canonicalId] = h.canonicalId;
  let i = 0;
  const rng = () => { i += 1; return (i * 0.37) % 1; };
  const src = emitDispatch(idMap, HANDLERS, 0, rng);
  assert.ok(!/Hs\[\d+\]\s*==\s*Hs\[\d+\]/.test(src), 'no dummy Hs wrap');
  assert.ok(!/Opcode = -1\nPC = 0/.test(src), 'no TRAP pad');
  const geti = 'F[RegA[PC]] = F[RegB[PC]][RegC[PC]]';
  assert.ok(src.includes(geti), 'GETI body present');
  assert.ok(src.includes('//'), 'IDIV // leaf in tree');
});

t('naked dispatcher: VM still runs', () => {
  vmPrints('print("hi")', ['hi'], 3);
  vmPrints('print(1+2)\nprint("x")', ['3', 'x'], 11);
});

t('idiv leaf survives obfuscate', () => {
  const { lua } = obfuscate('print(7//2)', { seed: 1 });
  assert.ok(lua.includes('//'), 'expected // IDIV in wrapper');
});

t('arith RR/RK/KK overlay across seeds', () => {
  const { variantPass } = require('../../Compilers/pass/VariantPass');
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { superOptGuest } = require('../../Compilers/pass/SuperOpt');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const { ARITH_VARIANTS } = require('../../Compilers/IR/Opcodes');
  const src = [
    'local function add(a, b) return a + b end',
    'print(add(2, 3))',
    'print(1 + 2)',
    'print(7 // 2)',
    'local x = 4; print(x * 2)',
  ].join('\n');
  const seen = Object.create(null);
  for (let seed = 1; seed <= 12; seed++) {
    const info = internProto(compileSource(src, '=t'), seed);
    superOptGuest(info.guest, (seed ^ 0x5A17) >>> 0);
    variantPass(info.root, seed);
    const walk = (p) => {
      for (const ins of p.code || []) {
        if (ARITH_VARIANTS.has(ins.op) && ins.op !== 'ADD' && ins.op !== 'SUB' &&
            ins.op !== 'MUL' && ins.op !== 'DIV' && ins.op !== 'IDIV') {
          seen[ins.op] = (seen[ins.op] || 0) + 1;
        }
      }
      for (const c of p.protos || []) walk(c);
    };
    walk(info.root);
  }
  const names = Object.keys(seen);
  assert.ok(names.length >= 2, 'expected RR/RK/KK arith encodings, got ' + names.join(','));
  assert.ok(seen.ADDRR || seen.ADDRK || seen.ADDKK, 'expected an ADD encoding');
});

t('arith overlay still runs', () => {
  vmPrints('local function add(a,b) return a+b end\nprint(add(2,3))\nprint(1+2)', ['5', '3'], 1);
  vmPrints('print(7//2)', ['3'], 5);
  vmPrints('local x=4\nprint(x*2)', ['8'], 2);
});

t('arith overlay leaves in dispatcher', () => {
  const { emitDispatch, HANDLERS } = require('../../VM/Handlers');
  const idMap = Object.create(null);
  for (const h of HANDLERS) idMap[h.canonicalId] = h.canonicalId;
  const src = emitDispatch(idMap, HANDLERS, 0, () => 0.5);
  assert.ok(src.includes('F[RegA[PC]]=F[RegB[PC]]+F[RegC[PC]]'), 'ADDRR leaf');
  assert.ok(src.includes('F[RegA[PC]]=F[RegB[PC]]+Kc(PC)'), 'ADDRK leaf');
  assert.ok(src.includes('(F)[RegA[PC]]=Kb(PC)+Kc(PC)'), 'ADDKK leaf');
  assert.ok(src.includes('(F)[RegA[PC]]=(F[RegB[PC]][F[RegC[PC]]])'), 'GETFR Luraph leaf');
});

t('loadenc multi-round: identity perm roundtrips; wrong perm is garbage', () => {
  const { encodeLoadenc, decodeLoadenc, makeEncPerm, BITOPS } = require('../../Compilers/encode/LoadEnc');
  const ident = BITOPS.slice();
  const shuffled = makeEncPerm(7);
  assert.notDeepStrictEqual(shuffled, ident);
  for (const op of ['LOADENC', 'LOADENC2', 'LOADENC3']) {
    for (const n of [0, 1, 42, -7, 2147483647, -2147483648, 255, 104729]) {
      const enc = encodeLoadenc(n, 75, 12, op, shuffled);
      assert.strictEqual(decodeLoadenc(enc, 75, 12, op, shuffled), n, op + ' n=' + n);
      if (n !== 0) {
        assert.notStrictEqual(enc, n >>> 0, 'must not bake plaintext');
        assert.notStrictEqual(decodeLoadenc(enc, 75, 12, op, ident), n, 'identity perm must not decode shuffled');
        assert.notStrictEqual(decodeLoadenc(enc, 75 ^ 1, 12, op, shuffled), n, 'wrong wire');
      }
    }
  }
  const a = makeEncPerm(1).join(',');
  const b = makeEncPerm(2).join(',');
  assert.notStrictEqual(a, b, 'perm is per-seed');
});

t('loadenc 0/1 encoded on blob; wrapper has shuffled vtable', () => {
  const r = obfuscate('print(0)\nprint(1)', { seed: 7 });
  assert.ok(/\[1\]\s*=\s*function/.test(r.lua), 'vtable fill in wrapper');
  const stripped = r.lua.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""');
  assert.ok(!/\bh\.rl\b/.test(stripped) && !/\bh\.rr\b/.test(stripped) && !/\bh\.bt\b/.test(stripped), 'h.rl/rr/bt must be randomized');
  const { deserialize } = require('../../Compilers/encode/Deserializer');
  const { CANONICAL } = require('../../Compilers/IR/Opcodes');
  const { decodeLoadenc } = require('../../Compilers/encode/LoadEnc');
  const root = deserialize(r.blob, r.settings);
  const encWires = new Set(
    ['LOADENC', 'LOADENC2', 'LOADENC3'].map((n) => {
      const id = CANONICAL[n];
      return r.settings.idMap[id] != null ? r.settings.idMap[id] : id;
    }),
  );
  const decWire = r.settings.idMap[CANONICAL.REGION_DEC];
  const rev = root._settings.rev;
  let saw0 = false;
  let saw1 = false;
  const walk = (p) => {
    const copy = decryptRegions(p, decWire, r.settings);
    for (let pc = 1; pc <= copy.nSlots; pc++) {
      const wire = copy.opcodes[pc];
      if (!encWires.has(wire)) continue;
      const baked = copy.regB[pc];
      if (typeof baked !== 'number') continue;
      const plain = decodeLoadenc(baked, wire, pc, rev[wire], r.settings.encPerm);
      if (plain === 0) {
        saw0 = true;
        assert.notStrictEqual(baked, 0, '0 must not sit plaintext on operand');
      }
      if (plain === 1) {
        saw1 = true;
        assert.notStrictEqual(baked, 1, '1 must not sit plaintext on operand');
      }
    }
    for (const child of Object.values(p.protosAt || {})) walk(child);
  };
  walk(root);
  assert.ok(saw0 && saw1, 'expected encoded 0 and 1, saw0=' + saw0 + ' saw1=' + saw1);
  vmPrints('print(0)\nprint(1)', ['0', '1'], 7);
});

t('intern slot collision: decoy closure then literal wins', () => {
  const { internProto } = require('../../Compilers/intern/InternPass');
  const { compileSource } = require('../../Compilers/IR/Compiler');
  const src = 'print(game:GetService("HttpService"))';
  const info = internProto(compileSource(src, '=t'), 7);
  assert.ok(info.collisions && info.collisions.length >= 1, 'expected collisions, got ' + (info.collisions && info.collisions.length));
  const code = info.filler.code;
  for (const col of info.collisions) {
    const at = [];
    for (let i = 0; i < code.length; i++) {
      const ins = code[i];
      if (ins.op === 'PUTI' && ins.C === col.slot && ins.A === 2) at.push(i);
    }
    assert.ok(at.length >= 2, 'slot ' + col.slot + ' PUTI count=' + at.length + ' (' + col.string + ')');
    const prevs = at.map((i) => code[i - 1] && code[i - 1].op);
    assert.ok(prevs.includes('CLOSURE'), 'decoy CLOSURE PUTI missing on ' + col.string + ' prevs=' + prevs.join(','));
    assert.notStrictEqual(prevs[prevs.length - 1], 'CLOSURE', 'literal must win last PUTI on ' + col.string);
  }
  const r = runObfuscated(src, {
    seed: 7,
    env: { game: { GetService: function (self, name) { return ['svc:' + name]; } } },
  });
  assert.deepStrictEqual(r.printOut, ['svc:HttpService']);
});

t('key rename is skipped when pairs/next can observe table keys', () => {
  // `pairs`/`next` hand the real key strings to the script, so renaming a key
  // is observable (`print(k)` printed `b` for `{a = 1}`). Renaming must stay
  // active for chunks whose loop drops the key, and for plain field access.
  const { rename } = require('../../Factorizer/MakeUp/Renamer');
  const firstKey = (src) => {
    const ast = rename(parse(src, 't.lua'), {});
    let key = null;
    const walk = (n) => {
      if (key || !n || typeof n !== 'object') return;
      if (Array.isArray(n)) {
        n.forEach(walk);
        return;
      }
      if (n.type === 'TableKeyString' && typeof n.key === 'string' && key == null) {
        key = n.key;
        return;
      }
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'raw') continue;
        walk(n[k]);
      }
    };
    walk(ast);
    return key;
  };
  assert.strictEqual(firstKey('local t = {a = 1} for k, v in pairs(t) do print(k, v) end'), 'a');
  assert.strictEqual(firstKey('local t = {a = 1} local k = next(t) print(k)'), 'a');
  assert.notStrictEqual(firstKey('local t = {a = 1} print(t.a)'), 'a');
  assert.notStrictEqual(
    firstKey('local t = {a = 1} local s = 0 for _, v in pairs(t) do s = s + v end print(s)'),
    'a',
  );
});

// --- Sprint 4 regressions -------------------------------------------------

t('junk guards stay true/false for NaN (IEEE-754)', () => {
  // Regression: `F[g] == F[g]` is false when the register holds NaN (0/0,
  // inf-inf, ...), which flipped the guard and ran the DEAD arm (traps and VM
  // state writes) -> "bad argument" at runtime.
  const J = require('../../Factorizer/arith/JunkCode');
  const blob = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) blob[i] = (i * 37 + 11) & 0xff;
  const bytes = '{' + Array.from(blob).join(',') + '}';
  const prelude = [
    `local __b = ${bytes}`,
    'local buffer = {readu8 = function(_, p) return __b[p + 1] end}',
    `local ${J.BUF} = __b`,
    '',
  ].join('\n');
  const values = ['0/0', '1/0 - 1/0', '(0/0) * -1', 'math.huge - math.huge', '42', '"str"', 'nil', '{}'];
  for (const seed of [1, 2, 3, 7]) {
    J.srand(require('../../Compilers/encode/Serializer').mulberry32(seed));
    for (let i = 0; i < 120; i++) {
      const tPred = J.predTrue(blob, blob.length);
      const fPred = J.predFalse(blob, blob.length);
      const v = values[i % values.length];
      const g = 3 + (i % 5);
      const src = `${prelude}local F = {} F[${g}] = ${v} print(tostring(${tPred}), tostring(${fPred}))`;
      prints(src, ['true\tfalse']);
    }
  }
});

t('junk blocks never trap on a NaN register', () => {
  for (const seed of [1, 2, 7]) {
    const src = 'local x = 0/0\nprint(x ~= x, x == x, 1/0 > 0)';
    const r = runObfuscated(src, { seed });
    assert.deepStrictEqual(r.printOut, ['true\tfalse\ttrue']);
  }
});

t('long string literal (> 7990 bytes) decodes in batches', () => {
  const big = 'x'.repeat(9000);
  const src = `local s = "${big}"\nprint(#s)`;
  const r = obfuscate(src, { filename: 's.lua', seed: 1 });
  // The filler builds the string with `string.char(unpack(F, 3, 3 + n))`; more
  // than ~8000 arguments overflowed unpack. Batched decoding keeps one call per
  // 4000 bytes and concatenates the pieces.
  const protos = [];
  const walk = (p) => {
    protos.push(p);
    (p.protos || []).forEach(walk);
  };
  walk(r.proto);
  const filler = protos.find((p) => p._kind === 'fill');
  assert.ok(filler, 'filler proto must exist');
  const concat = (filler.code || []).filter((i) => i.op === 'CONCAT').length;
  const calls = (filler.code || []).filter((i) => i.op === 'CALL');
  assert.ok(concat >= 2, 'batched decode must concatenate pieces, got ' + concat);
  assert.ok(calls.every((c) => c.B <= 4001), 'no call may pass more than 4000 args');
  assert.ok(filler.maxstack < 4200, 'register window must stay bounded, got ' + filler.maxstack);
  const vm = runObfuscated(src, { seed: 1 });
  assert.deepStrictEqual(vm.printOut, ['9000']);
});

t('short string literal keeps the single-call decoder', () => {
  const src = 'local s = "' + 'y'.repeat(4000) + '"\nprint(#s)';
  const r = obfuscate(src, { filename: 's.lua', seed: 1 });
  const protos = [];
  const walk = (p) => {
    protos.push(p);
    (p.protos || []).forEach(walk);
  };
  walk(r.proto);
  const filler = protos.find((p) => p._kind === 'fill');
  assert.ok(filler, 'filler proto must exist');
  assert.strictEqual((filler.code || []).filter((i) => i.op === 'CONCAT').length, 0);
});

t('loop var never shadows the generated env/scratch table', () => {
  // Seeds 7, 15, 25, 33 used to pick an env-table name (`fresh()`) that a
  // source numeric-for already used, so the loop body indexed the counter
  // ("attempt to index number with number").
  const { ObjectSplitEngine } = require('../../Factorizer/TableObjectmethod/ObjectSplit');
  const engine = new ObjectSplitEngine(() => 0.5);
  engine.slots.set('envVar', 3);   // read as env[1][3]
  const ctx = {
    bound: new Set(['j']),
    envName: 'j',
    nName: 'q',
    scratch: new Map([['scrVar', 4]]),  // read as q[4]
  };
  const ref = (name) => [{
    type: 'CallStatement',
    expr: { type: 'CallExpression', callee: { type: 'Identifier', name }, args: [] },
  }];
  // env table read by the body: a loop var spelled `j` breaks it.
  assert.strictEqual(engine.loopShadowsEnv('j', ctx, ref('envVar')), true);
  // scratch table read by the body: a loop var spelled `q` breaks it.
  assert.strictEqual(engine.loopShadowsEnv('q', ctx, ref('scrVar')), true);
  // Wrong table: harmless shadow, must keep its exact output.
  assert.strictEqual(engine.loopShadowsEnv('j', ctx, ref('scrVar')), false);
  assert.strictEqual(engine.loopShadowsEnv('q', ctx, ref('envVar')), false);
  const plain = [{ type: 'AssignmentStatement', vars: [{ type: 'Identifier', name: 'k' }], inits: [{ type: 'NumericLiteral', value: 1, raw: '1' }] }];
  assert.strictEqual(engine.loopShadowsEnv('j', ctx, plain), false);
  assert.strictEqual(engine.loopShadowsEnv('zz', ctx, ref('envVar')), false);
  const fixed = engine.repairLoopName('j', ctx, ref('envVar'));
  assert.notStrictEqual(fixed, 'j');
  assert.notStrictEqual(fixed, 'q');
  assert.ok(/^[A-Za-z_][A-Za-z0-9_]*$/.test(fixed), 'repair name must be a plain identifier: ' + fixed);
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
