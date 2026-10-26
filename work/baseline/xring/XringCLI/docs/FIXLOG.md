# FIXLOG — Obfuscator không chạy trên Lune

Ngày: 2026-09-12. Người thực hiện: Muse Spark (OpenCode).
Yêu cầu gốc: run obfuscator thử và run output trên Lune xem có ra output không.

## Kết quả ban đầu

- `node test.js` → 107/107 pass (chỉ kiểm tra JS-side, không chạy Lua sinh ra).
- Cài Lune 0.10.5, generate `out.lua` từ `print("hi")`, chạy `lune run out.lua`:
  `(loadstring):1: attempt to index number with number` — **không ra output**.
- Bản plain (`objectSplit:false`) chạy đúng, bản split (default) lỗi.

## Phương pháp debug

- Differential testing: obfuscate từng case nhỏ → chạy trên Lune qua
  `loadstring` + `pcall` → so output với oracle JS (`runObfuscated`).
- Probe `buffer.readu8/readf64` + `debug.traceback` để định vị crash trong
  file 1 dòng (chẻ `;` thành nhiều dòng lấy số line).
- Phát hiện thêm: **build không deterministic** (cùng seed cho output khác
  nhau mỗi lần gen) — phải seed hóa xong mới debug ổn định được.

## Danh sách fix (theo file)

### 1. `Factorizer/ObjectWrap.js` — HY dispenser dùng nhầm tên env
- Triệu chứng: `attempt to index number with number` ngay khi chạy.
- Nguyên nhân: dispenser ký hiệu `(z, l, n)` được gọi `z:disp(iter, env)`,
  tức `l` = số lặp, `n` = env table. Nhưng `item expr` (init của leftover)
  rewrite với env mặc định `l` → `l[1][slot]` index vào số.
- Fix: thêm `itemExpr(item, ctx)`; nhánh inline rewrite với
  `envName: 'n'`, nhánh setter giữ `envName: 'l'`.

### 2. `Factorizer/ObjectWrap.js` — method-value slot mồ côi
- Triệu chứng: `attempt to call a nil value` ở bootstrap
  (`(a[1])[slot](...)` là nil).
- Nguyên nhân: `local x = someMethod` → `methodValue()` cấp slot **lười**
  trong lúc rewrite item (sau khi danh sách items đã chốt) → slot không bao
  giờ được gán (case thật: `local bootstrap_chunk31 = main_chunk24`).
- Fix: dry-run rewrite leftover inits **trước** khi chốt `valueItems`
  (`methodValue` cache theo tên nên lần rewrite thật tái dùng đúng slot).

### 3. `Factorizer/ObjectWrap.js` — thứ tự emit items
- Triệu chứng: alias slot (vd `string.sub`) là nil khi leftover init dùng nó.
- Nguyên nhân: leftover emit trước, alias/value emit sau.
- Fix: emit theo thứ tự alias → method-value → leftover (giữ nguyên thứ tự
  source cho leftover để forward-ref vẫn nil như Lua).

### 4. `Factorizer/FunctionSplit.js` — nested function mất upvalue (`maybe`)
- Triệu chứng: interpreter chạy sai im lặng (no GETGLOBAL, thoát sớm).
- Nguyên nhân: `extractNested` hoist nested function (`Loop`, safecall
  closure, `Kb/Kc/materialize`) lên method top-level mà không mang theo
  biến ngoài (`Proto`, `StackSz`, `Opcodes`, `PC`, `F`...) → thành global nil.
- Fix: tính captured = free names sau rewrite/split, thêm làm params của
  method, wrapper closure tại chỗ cũ forward giá trị; wrapper forward luôn
  `...` khi method cần vararg; hoist loại trừ captured.

### 5. `Factorizer/FunctionSplit.js` — extract rớt dependency ngoài scope
- Triệu chứng: biến lặp `i` thành nil/global trong method trích xuất.
- Test trực tiếp: `for i=1,3 do foo(i);bar(i) end` →
  `z:G(foo,bar)` + `G=function(z,foo,bar) foo(i) end` (sai).
- Nguyên nhân: `freeNames(body, ctx.bound)` loại cả tên bound-ngoài
  (loop var, local ngoài, scratch table) khỏi params.
- Fix: tính deps theo scope **mới** (`freeNames(body, {'z'})`); `l` vẫn qua
  cơ chế `usesEnv`.

### 6. `Factorizer/FunctionSplit.js` — write/read tách đôi qua scratch table
- Triệu chứng: `compare number < nil`, `buffer access out of bounds`
  (VD: byte đọc vào `local d` nhưng test lại đọc `(b)[3]`).
- Nguyên nhân: `addForDispatchSplit` map local vào scratch (`n[i]`), nhưng
  declaration `local d = init` giữ nguyên → init vào dead local, uses đọc
  scratch (nil).
- Fix: thêm `rewriteLocal` — declaration của tên scratch-mapped (và không
  bị bound che) chuyển thành assignment vào scratch; `rewriteFun` giữ
  `scratch` cho closure lồng (upvalue semantics qua shared table);
  trường hợp mixed giữ nguyên (an toàn).

### 7. `Factorizer/FunctionSplit.js` — iter for-dispatch trùng tên scratch
- Triệu chứng: `attempt to index number with number`.
- Bằng chứng pre-minify: `for O=... do z:f(l,O,O)` trong khi def là
  `f=function(z,l,n,O)` — iter và scratch cùng tên `O` → truyền số 2 lần.
- Nguyên nhân: `this.fresh('f')` không tránh `nName`.
- Fix: `this.used.add(nName)` trước khi `fresh('f')`.

### 8. `Factorizer/FunctionSplit.js` — extract body chứa `return` gây thoát sớm
- Triệu chứng: **im lặng** (`ok=true`, không output) — payload chạy nhưng
  global call biến mất; `getfenv` gọi 1 lần, zero GETGLOBAL.
- Nguyên nhân: dispatch tree chứa handler `TAILCALL`/`RETURN` (có `return`).
  `extractBodyMethod` bọc leaf thành `return z:nm(...)` giữa vòng lặp →
  sau 1 instruction thì return nil khỏi interpreter.
- Fix: `hasBareExit` — từ chối extract body chứa `return` thoát scope
  (ngoài function lồng) hoặc `break` ngoài loop; giữ inline.

### 9. `Factorizer/ControlFlow.js` — state machine gán state không đơn điệu
- Triệu chứng: đọc thừa float tới OOB (`readf64` lặp 5 lần), treo máy.
- Bằng chứng: method `h` (nextfloat) có states `[27, 96, 40]` — state cuối 40
  nằm trong range junk `[27,96)` → terminal unreachable → lặp junk↔main.
- Nguyên nhân: `_emitStateMachine` chèn MBA helper target bất kỳ
  (`pop()`) phá vỡ thứ tự tăng nghiêm ngặt mà nested dispatch yêu cầu.
- Fix: chỉ tái dùng helper target khi `t > cursor` (`findIndex` live).

### 10. `VM/Assembler.js` + `StringsEncrypt/*` — build không deterministic
- Triệu chứng: cùng seed, cùng input → output khác nhau mỗi lần
  (method count 127/129/135), khác biệt nhỏ khuếch đại qua split.
- Nguyên nhân: `JunkCode` và `mixEscapeStrings` dùng `Math.random()` trần.
- Fix: `JunkCode` nhận `rand` qua `emitJunk({blob, rand})`
  (default `Math.random` cho caller lẻ); Assembler và Virtualization truyền
  `mulberry32(seed ^ const)` riêng. Kết quả: cùng seed → byte-identical,
  khác seed → khác nhau. Đổi comment "re-rolled every build" cho đúng.
- Bonus: `F[RegA[PC]]` trong junk predicate thêm `or 0`
  (`F[x or 0] ~= F[x or 0]`) để không bao giờ `F[nil]` trên Luau
  (JS im lặng cho qua nên test cũ không bắt được).

### 11. `VM/Assembler.js` — plain wrapper không tự chạy
- Triệu chứng: `lune run out.lua` bản plain im lặng (return bootstrap fn
  mà không gọi).
- Fix: `end)()` → `end)()(...)` (tự gọi bootstrap, forward script args),
  khớp hành vi bản split.

### 12. `Factorizer/Minify.js` — reset scope theo từng method
- Nguyên nhân: một `used` chung cho mọi method sibling (scope độc lập)
  làm cạn namespace 1 ký tự.
- Fix: `minifyChunk` phát hiện method table, minify mỗi method với
  map/used mới (closure lồng nhau vẫn kế thừa đúng).

### 13. `test.js` — nới test idents
- Một method interpreter có ~55 tên/scope sau capture (đúng về semantics),
  tràn sang tên 2 ký tự. Test `idents are 1 char (2 max)` nới params/locals
  1 → ≤2 ký tự (khớp sẵn rule 2-max của method keys và title của test).

## Validation

- `node test.js`: **107/107 pass**, deterministic (`seed` giống → giống hệt).
- Differential 28 case × 8 seed (1,2,3,5,7,42,99,1234) trên Lune:
  **224/224 đúng output** so với oracle JS.
  - 1 case expectation ban đầu của harness sai (`closure` loop-var share cho
    `['30','30']`); cả 3 oracle của repo (host interpret, JS VM, Lua) đều
    đồng thuận `['30','30']` → output đúng.
- `lune run out.lua` trực tiếp: `print("hi")` → `hi`.
- Script demo (recursion, tables, ipairs, method/self, `XRN_KEEP`,
  `string.sub`, `math.floor`) chạy trực tiếp đúng hết.
- `XRN_CRASH()` trên Lune: in `before` rồi abort exit 1, không in tiếp.

## Rủi ro còn biết (chưa fix)

- Junk `F[x]==F[x]` sai thành false nếu `F[x]` là NaN (payload chứa NaN
  như `0/0`) → dead arm có thể chạy. Hiếm, để lại.
- `hasBareBreak` còn giữ làm wrapper (không dùng nội bộ nữa).
- Base85 tail: blob Lua decode dài hơn raw vài byte pad (encoder không lưu
  độ dài thật); vô hại vì deserializer không bao giờ đọc quá vùng thật.
