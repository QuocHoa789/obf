# Xring

Lua 5.1 obfuscator written in JavaScript.

This pass implements **only**:

1. **AST compiler** (`Syntax.js`, `AST/Parser.js`, `Compilers/IR/Compiler.js`) — Lua 5.1 source → proto/instructions.
2. **Interpreter VM** (`VM/`) — IronBrew2-style chunked VM, **no JIT**. Opcode handlers live in `VM/Handlers.js` (ported from the C# emitters).
3. **Control-flow flattening** (`Factorizer/ControlFlow.js`) — CFF on wrapper functions.
4. **Object wrapper + function split** (`Factorizer/ObjectSplit.js`) — Lightray `return({...}):HY({})(...)`.

Out of scope (left empty): StringsEncrypt. Renamer is used.

## Macros

Compile-time directives, resolved **before** rename + virtualize. Names are
reserved identifiers — do not bind them as locals.

| Macro | Aliases | Effect |
|---|---|---|
| `XRN_KEEP(fn)` | `XRN_NO_VIRTUALIZE`, `XRN_NO_VIRTUAL`, `KEEP`, `NO_VIRTUALIZE` | Emit `fn` as native Lua (minified). Zero-upvalue only. |
| `XRN_CRASH()` | `CRASH` | Poison the VM and abort. Not recoverable via `pcall`. |

```lua
-- hot path: skip the VM
local dist = XRN_KEEP(function(x, y)
  return x * x + y * y
end)

-- fail-closed
if key ~= SECRET then
  XRN_CRASH()
end
```

`XRN_KEEP` must wrap a function expression. Captured upvalues fall back to the
VM so semantics stay correct. `XRN_CRASH` must be a direct call.

Stub while developing unobfuscated:

```lua
local function XRN_KEEP(f) return f end
local function XRN_NO_VIRTUALIZE(f) return f end
local function XRN_NO_VIRTUAL(f) return f end
local function XRN_CRASH() error("XRN}", 0) end
```

Do not `local` these names in the script you pass to Xring — the compiler
matches the identifier at the call site.

## Pipeline

```
Lua 5.1 source
    │
    ├─ Syntax.js                 lexer
    ├─ AST/Parser.js             AST
    ├─ Compilers/IR/Compiler.js     proto / Lua 5.1 opcodes
    ├─ Compilers/encode/Serializer.js   varint blob, baked K, relative jumps
    │
    └─ VM/Assembler.js           chunks + shuffled dispatch
         Factorizer/ObjectSplit  table wrapper + function split
         Factorizer/ControlFlow  CFF (state machines, for-dispatch)
         VM/VirtualMachine.js    interpreter template (no JIT)
         VM/Handlers.js          38 opcode bodies
         → Luau wrapper (buffer API)
```

## Control flow

Applied to VM-wrapper functions (deserializer, readers, bootstrap, Loop
setup). Flattening only:

- `while true` / `repeat until false` state machines with nested ifs
- numeric-`for` dispatchers whose iterator is the switch

No MBA, no `string.unpack` state encoding.

Disable with `{ controlFlow: false }`.

## Object wrapper + function split

Lightray `return({...}):HY({})(...)`:

- Method table `z` holds aliases (`K=bit32.band`, `z=unpack`, `P`, `Y`, …)
  and split methods `function(z,l,…)`.
- `BY` wraps the env: `{l}`. `HY` scatters leftover inits through
  for-dispatch setters onto `l[1][slot]`.
- Original functions become `z:name(l, …)` methods; bodies split into
  tiny methods dispatched by numeric-for.

Disable with `{ objectSplit: false }`.

Host check (no Luau):

```
blob → Compilers/encode/Deserializer.js → VM/Runtime.js
```

JIT variants (`LVM_CHUNK_24_JIT` / `26_JIT` / `31_JIT`) were **deleted**. `GetChunks` always emits the interpreter loop.

## CLI

```
node XringCLI/index.js input.lua -o out.lua --seed 1
node XringCLI/index.js input.lua --run --dump-proto
node XringCLI/index.js input.lua --run-vm --seed 1
```

- `--run` executes the compiled proto on the host JS compiler-interpreter.
- `--run-vm` serializes, deserializes the IronBrew blob (seal + baked K), and runs it.
- Generated `out.lua` targets **Luau** (`buffer.*`, `bit32`).

## Debug mode (isolated)

Diagnostics are strictly out-of-band: nothing is written into the generated
source, `stdout` is untouched, and no random number is consumed, so a debug
build is **byte-identical** to a normal one.

```
node XringCLI/index.js in.lua -o out.lua --debug                  # stderr
node XringCLI/index.js in.lua -o out.lua --debug --debug-log dbg.txt
node XringCLI/index.js in.lua -o out.lua --debug --debug-dir /tmp/xr-stages
XRING_DEBUG=1 node XringCLI/index.js in.lua -o out.lua             # env form
```

| Knob | Effect |
|---|---|
| `--debug` / `XRING_DEBUG=1` | log stage timings, notes, AST/proto findings |
| `--debug-log F` / `XRING_DEBUG_LOG` | append to `F` instead of stderr |
| `--debug-dir D` / `XRING_DEBUG_DIR` | dump per-stage Lua/AST artefacts into `D` |
| `XRING_DEBUG_CHECKS=0` | disable IR/AST validation checks |
| `obfuscate(src, { debug: true })` | same, for API callers |

`Debug.stage()` rethrows the original error with `err.xringStage` attached
(original stack preserved) — no empty catch blocks, no swallowed failures.

## VM notes

- Chunks 00..32 are declaration-anchor shuffled; bootstrap (`CHUNK_31`) is pinned last.
- 38 canonical handlers (MOVE..VARARG) plus CORO_* / REGION_DEC / CRASH / NATIVE_CLOSURE. Dispatch arm **order** and wire ids 0..37 are shuffled per seed.
- CLOSURE's nested MOVE test uses the remapped MOVE wire id (`__MOVE_ID__`).
- Interpreter loop is a real `while true`.
- JMP / FORPREP / FORLOOP targets are packed as K_FWD / K_BWD relative to 1-based PC.
