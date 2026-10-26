// Split-wrapper self test: every case goes through ObjectSplit.wrapAndSplit
// (the same call the assembler makes) and is compared against the unwrapped
// reference, both run on the Luau CLI.
//
//   node tools/split_selftest.js [path/to/luau]
//
// The cases are the VM shapes the splitter has to keep intact: buffer reads
// with a mutating cursor, bit helpers, state loops with a *call* limit,
// multi-value assignment/return, closures over scratch slots.
const { wrapAndSplit } = require('../Factorizer/TableObjectmethod/ObjectSplit');
const { mulberry32 } = require('../Compilers/encode/Serializer');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const LUAU = process.argv[2] || path.join(__dirname, '..', '..', '.bin', 'luau');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'xrsplit-'));

const run = (src, tag) => {
  const file = path.join(TMP, tag + '.lua');
  fs.writeFileSync(file, src);
  try {
    return execFileSync(LUAU, [file], { encoding: 'utf8', timeout: 30000 }).trim();
  } catch (e) {
    return 'ERR:' + String(e.stderr || e.message).split('\n').slice(0, 3).join('|');
  }
};

const cases = {
  readu8: `local blob = buffer.fromstring("ABCD")
local cursor = 1
local function nxt() local a = buffer.readu8(blob, cursor - 1) cursor = cursor + 1 return a end
local function main() return function(...) print(nxt()) end end
return function(...) return main()(...) end`,

  readu8LateBlob: `local blob
local cursor = 1
local function nxt() local a = buffer.readu8(blob, cursor - 1) cursor = cursor + 1 return a end
local function main() return function(...) print(nxt()) end end
blob = buffer.fromstring("ABCD")
return function(...) return main()(...) end`,

  readu32f64: `local blob = buffer.fromstring("ABCDEFGHIJKLMNOP")
local cursor = 1
local function main() return function(...)
  local a = buffer.readu32(blob, cursor - 1) cursor = cursor + 4
  local b = buffer.readf64(blob, cursor - 1) cursor = cursor + 8
  print(a, b)
end end
return function(...) return main()(...) end`,

  loopCallLimit: `local blob = buffer.fromstring("\\1\\2\\3\\4\\5\\6\\7\\8")
local cursor = 1
local function nextint() local v = buffer.readu32(blob, cursor - 1) cursor = cursor + 4 return v end
local function main() return function(...)
  local seen = 0
  for i = 1, nextint() do seen = seen + i end
  print(seen)
end end
return function(...) return main()(...) end`,

  multiRet: `local function a() return 1, 2 end
local function b() local x, y = a() return x + y end
local function main() return function(...) print(b()) end end
return function(...) return main()(...) end`,

  multiRet4: `local function four() return 1, 2, 3, 4 end
local function b() local w, x, y, z = four() return w + x + y + z end
local function main() return function(...) print(b()) end end
return function(...) return main()(...) end`,

  multiAssign: `local function four() return 1, 2, 3, 4 end
local w, x, y, z
local function b() w, x, y, z = four() return w * x * y * z end
local function main() return function(...) print(b()) end end
return function(...) return main()(...) end`,

  bitHelpers: `local h = { x = function(a, b) return a % b end, b = function(a) return a * 2 end }
local function main() return function(...) print(h.x(7, 3), h.b(4)) end end
return function(...) return main()(...) end`,

  // Trailing nils in multi-value returns: packing them into a plain table
  // (`return{a,b}`) lost every value after the last non-nil one, because
  // `unpack` stops at `#t`. Packed returns now carry their arity.
  multiRetNil: `local function a() local x, y = 1, nil return x, y end
local function b() local p, q, r = 'p', nil, 'r' return p, q, r end
local function main() return function(...)
  print(select('#', a()), a())
  print(select('#', b()), b())
end end
return function(...) return main()(...) end`,

  multiRetNilVar: `local function f() local t = nil return t end
local function g() local u, v = 4, nil return u, v end
local function main() return function(...)
  local n = select('#', f())
  local m, w, z = g()
  print(n, m, w, z)
end end
return function(...) return main()(...) end`,

  closureCounter: `local function main() return function(...)
  local n = 0
  local function inc() n = n + 1 return n end
  inc() inc()
  print(n)
end end
return function(...) return main()(...) end`,
};

const opts = { controlFlow: true, cache: true, mba: true };
let fail = 0;
for (const [name, src] of Object.entries(cases)) {
  let wrapped;
  try {
    wrapped = wrapAndSplit(src, mulberry32(1), opts);
  } catch (e) {
    console.log('TRANSFORM-ERROR ' + name + ': ' + e.message);
    fail += 1;
    continue;
  }
  const ref = `local _boot = (function()\n${src}\nend)()\n_boot()\n`;
  const got = run(wrapped, name + '_split');
  const want = run(ref, name + '_ref');
  const ok = got === want;
  if (!ok) fail += 1;
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ` want=${JSON.stringify(want)} got=${JSON.stringify(got)}`));
}
console.log(fail ? `${fail} failures` : 'all pass');
process.exit(fail ? 1 : 0);
