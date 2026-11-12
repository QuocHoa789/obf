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

- ~~Junk `F[x]==F[x]` sai thành false nếu `F[x]` là NaN~~ → **đã fix ở Sprint 4**.
- `hasBareBreak` còn giữ làm wrapper (không dùng nội bộ nữa).
- Base85 tail: blob Lua decode dài hơn raw vài byte pad (encoder không lưu
  độ dài thật); vô hại vì deserializer không bao giờ đọc quá vùng thật.

---

# Sprint 2 (2026-10-26) — split path: hai bug gốc còn sót

Mọi thay đổi dưới đây nằm **trong nhánh `objectSplit`** (FunctionSplit +
Minify). Nhánh không split (`objectSplit:false`) không bị chạm: nó không đi
qua `FunctionSplit`/`ObjectSplit` nên output giữ nguyên từng byte.

## A. `FunctionSplit.addForDispatchSplit` — tên bảng scratch bị shadow

- **Triệu chứng**: file sinh ra chạy tới lần đọc thứ N của deserializer rồi
  chết với `attempt to index number with number`. Trước đó mọi byte đọc từ
  blob **giống hệt** bản chưa split (đối chiếu từng lần `buffer.readu8/u32/f64`
  giữa `objectSplit:false` và `objectSplit:true`), nên lỗi không phải ở
  serialize/deserialize.
- **Nguyên nhân**: `extractNested` không bao giờ tách closure **vararg** ra
  thành method riêng, nên thân của nó được in ngay trong dispatcher. Nếu trong
  đó có `local p = ...` trùng tên tham số bảng scratch mà
  `pickScratch()` chọn, phạm vi Lua cho `local` thắng: mọi `p[slot]` phía sau
  trong cùng block đọc vào một *number*. Đúng lỗi `attempt to index number`.
  (Đây là closure chính của interpreter VM — nơi chứa toàn bộ vòng đọc opcode.)
- **Fix**: `collectNestedFnNames()` gom params + `local` của mọi function lồng
  nhau; `addForDispatchSplit` chỉ **đổi tên** khi tên vừa bốc thật sự nằm trong
  tập đó, và tên thay thế lấy từ `pickRepairName()` — bảng chữ cái cố định,
  **không dùng rng**. Input không đụng độ giữ nguyên chuỗi tên ⇒ byte-identical.
- **Test hồi quy**: `split: scatter name is not shadowed by an inline closure
  local` — kiểm tra cả hai chiều (không đụng độ ⇒ giữ nguyên tên; đụng độ ⇒ đổi).
- **Kết quả**: `XringCLI/examples/input.lua` và `demo.lua` (seed 1) chạy đúng
  (`hi`, `120 / 3 / xr:hi / 96 / 3 / ell`).

## B. `FunctionSplit.numericForAsStateLoop` — limit/step bị đánh giá lại

- **Nguyên nhân**: `for i = a, b, c do` đánh giá `a`, `b`, `c` **một lần**.
  Khi hạ xuống `while`/`repeat`, điều kiện so sánh và bước tăng nằm trong thân
  vòng nên một `b` có side effect (ví dụ `nextint_chunk14()`) bị gọi lại mỗi
  vòng ⇒ đọc thêm byte từ blob ⇒ lệch cursor.
- **Fix**: hoist các biểu thức không "an toàn đánh giá một lần" ra biến run-local
  trước vòng lặp (`numericForAsStateLoop`), tên do `pickHoistName()` sinh, đánh
  số `<i>_b`, `<i>_b2`, … **không dùng rng**.
- Đây là bug đúng đắn thật nhưng **không phải** nguyên nhân của A (sửa riêng nó
  vẫn crash y như cũ).

## C. `MakeUp/Minify` — alias ẩn bị method key chiếm tên

- **Nguyên nhân**: `minifyKeys` cấp tên method từ pool riêng, không biết các
  alias ẩn (`buffer.*`, `setmetatable`, `coroutine.wrap`, `ipairs`, …) vì chúng
  không phải table field mà được ghi bằng clump `self.<alias> = <global>`. Trùng
  tên ⇒ clump ghi đè method (hoặc ngược lại) ⇒ `call nil` / gọi nhầm hàm.
- **Fix**: `fixAliasKeyCollisions()` dò trùng và đổi tên **alias** (không đổi
  tên method, để layout method table giữ nguyên), tên thay thế lấy từ
  `REPAIR_ALPHABET` cố định — không dùng rng; `rewriteAliasProps()` viết lại
  `self.<alias>` / `self:<alias>` tương ứng.

## Validation của sprint này

- `node XringCLI/tests/test.js`: **182 passed, 0 failed** (thêm 1 test hồi quy).
- `node tools/audit_outputs.js`: debug-neutrality **PASS** trên 195 lượt
  (65 chương trình × 3 seed) — bật `XRING_DEBUG` không đổi một byte output.
- `node tools/diff_lua.js --seeds 1` (Luau 0.744 làm oracle): **59 pass,
  5 fail, 1 blocked**; 5 fail đều là khác biệt *ngôn ngữ/runtime* đã biết
  (`Infinity` vs `inf`, `%` âm, thứ tự `pairs`, `[[...]]` nhiều dòng).

## Còn mở (chưa fix trong sprint này)

- `XringCLI/examples/demo20k.lua` → `attempt to compare nil < number`;
  `Higay.lua`, `higa2.lua` → `too many results to unpack`. **Cả ba fail y hệt
  khi `objectSplit:false`**, tức là không thuộc nhánh split và không do hai fix
  trên.
- `tools/split_selftest.js` còn 4 case FAIL (alias ẩn vs method key trong
  chương trình *không phải* chunk VM do pipeline sinh ra). Công cụ này là
  harness dev, không nằm trong `test.js`.

# Sprint 3 (2026-10-26) — audit lại toàn pipeline, 5 bug gốc + hệ debug

Bối cảnh: chạy lại **toàn bộ** đường ống (không chỉ nhánh split) bằng oracle
thật (Luau 0.744 CLI build từ source), so sánh *4 nguồn*: IR interpreter
(`--run`), VM JS (`--run-vm`), file Lua sinh ra (Luau), và bản gốc chưa sửa
(`work/baseline/xring`). Hai công cụ mới:

- `tools/audit_baseline.js` — obfuscate cùng input bằng **bản gốc** và bản đã
  sửa, so byte + phân loại từng khác biệt: `baseline-broken` (bản gốc sai,
  bản sửa đúng), `REGRESSION` (bản gốc đúng, bản sửa sai), `STILL-BROKEN`
  (cả hai sai). Bất kỳ `REGRESSION` nào cũng là lỗi chặn release.
- `tools/rt_sweep.js` — chạy **source gốc** và **file đã obfuscate** trên Luau
  rồi so output; phân loại `PASS / FAIL / ERROR / NO-ORACLE` (source không
  chạy được trên Luau — ví dụ cú pháp Lua 5.1 — **không** tính là pass).

## 0. Hệ debug tách rời (`Debug.js`, `XRING_DEBUG=1`, `--debug`)

- Bật bằng `XRING_DEBUG=1`, `--debug`, hoặc `obfuscate(src,{debug:true})`.
- Đầu ra **chỉ** stderr (hoặc `--debug-log <file>` / `XRING_DEBUG_LOG`), dump
  từng stage vào `--debug-dir` / `XRING_DEBUG_DIR`; **không** ghi vào source
  sinh ra, không ghi stdout, không giữ file output khác.
- Tuyệt đối không dùng rng ⇒ bật/tắt debug không đổi một byte output. Kiểm
  chứng tự động: `tools/audit_outputs.js` → *debug neutrality PASS (195 lượt
  = 65 chương trình × 3 seed)*.
- `stage()` gắn `err.xringStage` rồi **rethrow** lỗi gốc (không có catch rỗng,
  không nuốt exception); `checkAst`/`checkProto` chỉ *báo cáo*, không sửa AST.

## A. `RegionPass` — ranh giới region cắt ngay sau instruction có "skip"

- **Triệu chứng**: `examples/path_score`-style code với seed 38/46 trả `4`
  thay vì `18`; nhánh `if dy < 0 then dy = -dy end` không chạy.
- **Khoanh vùng**: tắt từng option một (`regionEnc:false` → đúng), rồi ddmin
  xuống 12 dòng ⇒ chỉ `regionEnc` + seed 38. Dump proto guest thấy
  `LOADBOOL A11 / TEST A11 / REGION_ENC / JMP A0 B149`.
- **Nguyên nhân**: `TEST`/`TESTSET`/`LOADBOOL C≠0`/`TFORLOOP` điều khiển
  `PC++` để *bỏ qua* instruction kế tiếp. Nếu region kết thúc đúng sau một
  instruction như vậy, `REGION_ENC` trở thành instruction bị bỏ qua ⇒
  `PC++` nhảy qua wrapper, khối region không được mã hoá lại và `JMP` vẫn
  chạy.
- **Fix**: `skipsNext(inst)` + cắt đuôi trong `pickRegions`
  (`while (size > 0 && skipsNext(code[i + size - 1])) size--; j = i + size`).
  Chỉ chạm vào các region mà **giới hạn `MAX_LEN`** rơi đúng vào instruction
  skip; input khác giữ nguyên chuỗi instruction ⇒ byte-identical.
- **Test**: seed 38/46 (`path_score` = 18), `demo20k` seed 1–3.

## B. `MakeUp/Minify.fixAliasKeyCollisions` — pool tên thay thế thiếu

- **Triệu chứng**: `tools/split_selftest.js` case `multiRet4` →
  `attempt to call a number`; file sinh ra có `J.h = setmetatable` trong khi
  `h` đã là method.
- **Nguyên nhân**: khi alias ẩn và method key trùng tên, repair đổi tên alias
  bằng `pickFree()`, nhưng pool "đã dùng" chỉ chứa method key — không chứa
  *các alias field khác* và không chứa tên trong `this.used` (local/helper
  được tham chiếu bằng literal).
- **Fix**: `taken` cộng thêm mọi `this.aliasFields.values()` và mọi tên
  `this.used`. (Phương án "cấm alias trùng trong `minifyKeys`" đã thử và
  **revert**: nó làm method key 1 ký tự tụt còn 20/83, phá byte-identity.)

## C. `IR/Compiler.table()` — `SETLIST` phải bắt đầu ở mốc 50 slot

- **Triệu chứng**: `table-mixed` (constructor có field list xen field hash) in
  `1 2 s` — mất phần list phía sau.
- **Nguyên nhân**: `SETLIST` chỉ ghi được một dãy bắt đầu tại biên page 50 của
  bảng. Constructor bị field hash cắt ngang rồi "resume" giữa page ⇒ phần
  đuôi bị bỏ.
- **Fix**: `flush()` phát `SETTABLE A=r B=<const idx> Bk C=e.reg` cho từng phần
  tử khi `(firstIndex-1) % 50 !== 0`, và xếp mỗi phần tử list vào slot
  `r + 1 + ((listIndex-1) % 50)` (kèm clamp/alloc `freereg` + bump `maxstack`).
- **Kết quả**: `table-mixed` in `1 2 s 3 4 3` từ cả source lẫn bản obfuscate.

## D. `ObjectSplit.packFnReturns` — `unpack` cắt mất nil ở cuối (**bug chính**)

- **Triệu chứng**: `print(1,2,3,nil)` → `1 2 3` với seed 2/3 (seed 1 đúng);
  `select('#', f())` trả 1 thay vì 2; corpus `return-no-val`, `bool-ops` FAIL.
  IR interpreter **và** `runVM` đều đúng ⇒ lỗi nằm ở source Lua sinh ra.
- **Khoanh vùng**: override `print`/`unpack` từ *ngoài* file (không sửa byte
  nào của output) → thấy một `unpack(t)` **không bound** nhận bảng
  `{1,2,3}` (bảng kết quả 4 giá trị `1,2,3,nil`). `debug.info` cho biết thủ
  phạm là helper `F` do bộ split sinh: `local M={t,i,e} … return
  t.<aliasUnpack>(t:K(l,M))`.
- **Nguyên nhân**: pass "pack return" đổi `return a, b, c` thành
  `return {a, b, c}` và mọi call site thành `unpack(self:m(...))`. Bảng
  `{a,b,c}` **không giữ được nil ở cuối** (`#t` dừng ở phần tử non-nil cuối),
  nên `unpack` cắt mất các giá trị nil phía sau — sai semantics multi-return.
  Guard sẵn có chỉ loại `return nil` **literal**, không loại biểu thức *có
  thể* nil.
- **Fix** (2 phía, cùng một đại diện):
  - pack: `return {<arity>, a, b, c}` — arity là số literal (không dùng rng,
    `numNode(n, null, 'plain')`);
  - call site: `(function(q) return self.<unp>(q, 2, q[1] + 1) end)(self:m(...))`
    — bound chính xác theo arity ⇒ nil ở cuối được giữ. Dùng closure ẩn danh
    để call site vẫn là *biểu thức* ở mọi vị trí, và **không** lấy thêm tên từ
    rng (tên `q` chỉ tham chiếu chính bảng packed nên không thể shadow gì).
  - `return f()` / `return ...` (arity chỉ biết lúc chạy) **không pack nữa**:
    arity tĩnh không tồn tại nên pack sẽ làm mất giá trị; giữ nguyên
    multi-return gốc. Guard đặt **trước** mọi lần gọi rng nên chuỗi rng của
    các hàm còn pack không đổi.
- **Test hồi quy**: `tools/split_selftest.js` thêm `multiRetNil`,
  `multiRetNilVar` (đã xác nhận **FAIL** trên code cũ, PASS trên code mới);
  `test.js` cập nhật `xrings return{ident}` sang dạng `return{<arity>,…}`
  (vẫn kiểm tra "không có space", không nới lỏng gì khác).
- **Kết quả**: `print(1,2,3,nil)` → `1 2 3 nil` cho seed 1–5; `return-no-val`,
  `bool-ops`, `table-ctor-multiret`, `vararg-*` đều PASS trên Luau.

## E. `MakeUp/Renamer` — `pairs`/`next` làm lộ tên key

- **Triệu chứng**: `local t = {a = 1}; for k, v in pairs(t) do print(k, v) end`
  in `b 1` (key bị đổi tên thành `b` rồi bị `print(k)` nhìn thấy).
- **Nguyên nhân**: rename key bảng là *quan sát được* khi key string được trao
  lại cho script (`pairs`/`next`); mọi *access tĩnh* đã được rewrite nên pass
  tưởng là an toàn.
- **Fix**: `keysEscapeOf()` — bỏ rename key cho chunk khi: có `next(...)` bất
  kỳ; `pairs(t)` ở vị trí iterator mà **biến key được dùng** trong thân vòng;
  hoặc `pairs` xuất hiện ngoài vị trí iterator. Chunk chỉ duyệt mà **bỏ key**
  (`for _, v in pairs(t)`) vẫn rename ⇒ output giữ nguyên từng byte.
- **Test hồi quy**: `test.js` — `key rename is skipped when pairs/next can
  observe table keys` (4 nhánh: pairs dùng key, `next`, access tĩnh, pairs bỏ
  key).

## Validation của sprint này (Luau 0.744 làm oracle)

| Gate | Kết quả |
|---|---|
| `node XringCLI/tests/test.js` | **183 passed, 0 failed** |
| `node tools/split_selftest.js` | **11/11 PASS** (thêm `multiRetNil`, `multiRetNilVar`) |
| `node tools/rt_sweep.js --seeds=1,2,3` | **PASS 192 / FAIL 0 / ERROR 0 / NO-ORACLE 3** |
| `node tools/diff_lua.js --seeds 1` | **61 pass / 3 fail / 1 blocked / 0 timeout** |
| `node tools/audit_baseline.js ../baseline/xring --seeds=1 --luau …` | **0 REGRESSION**, 1 `STILL-BROKEN` (`semicolon`, xem dưới) |
| `node tools/audit_outputs.js` | debug-neutrality **PASS** (195 lượt) |
| `demo20k` seed 1/2/3 | `413323 / 2 / frost_fl / 55 / 15 / 21` |
| Performance (obfuscate `demo20k`, seed 1) | 7.63–8.02 s (bản gốc 7.62–7.79 s) — **không đổi** |

## Khác biệt còn lại — phân loại rõ, không tính là pass

- `semicolon` — **NO-ORACLE**: source dùng `;` kiểu Lua 5.1 không parse được
  trên Luau, nên không có reference để so. Không phải lỗi obfuscator.
- `mod-neg`, `arith` — khác biệt **ngôn ngữ**: oracle tham chiếu là Lua 5.3
  (fengari) còn deliverable chạy trên Luau (`-7 % 3` = `-1` vs `2`,
  `Infinity` vs `inf`). Bản plain chạy trên Luau cũng cho kết quả y hệt bản
  obfuscate.
- `long-string` — khác biệt **harness** (output có newline nên bị tách dòng
  khác nhau khi so), text giống nhau.
- `Higay.lua`, `higa2.lua` — fixture Lightray, ngoài phạm vi.

## Còn mở

- Hiện tượng treo `v1` ghi nhận ở sprint 2 **không còn reproducer** (file
  `/tmp` đã mất) và toàn bộ corpus hiện chạy `0 timeout`; nếu gặp lại cần
  lưu file input + seed trước khi điều tra tiếp.
- ~~Junk predicate `F[x] == F[x]` sai nếu `F[x]` là `NaN`~~ → **đã fix ở
  Sprint 4** (xem dưới).

# Sprint 4 (2026-10-26) — 3 bug gốc còn lại sau khi user test ZIP

Bối cảnh: sau khi nhận `xring_fixed.zip`, user test thêm và báo còn lỗi. Kiểm
tra lại thì đúng là còn **3 bug gốc** (đều có trong archive gốc, không phải
regression của các sprint trước), trong đó 2 bug trước đây bị phân loại sai.

## A. `Factorizer/arith/JunkCode.regEq/regNe` — guard junk sai khi gặp NaN

- **Triệu chứng**: `local x = 0/0 print(x ~= x)` → bản obfuscate chết với
  `bad argument` (hoặc `attempt to compare nil < nil`); thêm `{junk:false}`
  thì đúng (`true`). 12/13 cấu hình pass đều sai, chỉ `junk:false` đúng.
- **Nguyên nhân**: `predTrue()` phát ra tautology `F[g] == F[g]`. IEEE-754:
  mọi so sánh với NaN đều **false**, nên khi register đang giữ NaN
  (`0/0`, `inf-inf`, …) guard lật thành false ⇒ **dead arm** (trap + ghi
  `F`/`Opcodes`/`PC`) thực sự chạy. `regNe()` (`F[g] ~= F[g]`, kỳ vọng luôn
  false) sai theo chiều ngược lại.
- **Fix**: viết rõ cả hai nửa để bất biến đúng với **mọi** giá trị, kể cả NaN:
  - `predTrue`  : `(F[g] == F[g]) or  (F[g] ~= F[g])`  — luôn true
  - `predFalse` : `(F[g] == F[g]) and (F[g] ~= F[g])`  — luôn false
- **Ảnh hưởng byte output**: đây là **thay đổi byte có chủ ý duy nhất trên
  diện rộng** — text của guard junk đổi với mọi input có junk (mặc định).
  Không thể tránh: predicate được *in vào output*, mà tautology `x == x`
  không thể vừa giữ nguyên text vừa đúng với NaN. Ngữ nghĩa không đổi
  (`audit_outputs` + `rt_sweep` xác nhận), chỉ phần *dead* (không bao giờ
  được chạy) đổi cách viết. Muốn quay lại byte cũ: revert đúng 2 dòng trong
  `JunkCode.js` (comment mô tả tại chỗ).
- **Test hồi quy**: `test.js` — `junk guards stay true/false for NaN (IEEE-754)`
  (240 predicate × 8 giá trị gồm NaN/`nil`/string/table, chạy qua
  compile+interpret: đã xác nhận **FAIL** trên code cũ) và
  `junk blocks never trap on a NaN register`.

## B. `Compilers/intern/InternPass` — literal dài ≥ ~8000 byte ⇒ `too many results to unpack`

- **Triệu chứng**: một string literal dài (đo được: 7990 byte OK, 8000 byte
  fail) làm cả file obfuscate chết ngay khi load:
  `too many results to unpack`. Input lớn nhất trong `examples/`
  (`Higay.lua` 16 297 byte, `higa2.lua` 17 127 byte) fail vì đúng lý do này.
- **Nguyên nhân**: filler decode string **từng byte vào các register liên
  tiếp** rồi gọi `charFunc` **một lần** với `CALL B = len + 1`
  (`fill.maxstack = litLen + 16`). VM thực hiện call đó bằng
  `unpack(F, first, last)` → số kết quả ≈ độ dài literal, vượt giới hạn
  stack của `unpack` (~8000) ⇒ lỗi.
- **Fix**: khi pool có literal > `SINGLE_CALL_MAX = 7990` byte thì decode
  **theo lô 4000 byte**: mỗi lô `CALL` ≤ 4000 arg, kết quả `CONCAT` dần vào
  `R_acc`. Chỉ số byte `i` vẫn là chỉ số **toàn cục** nên chuỗi keystream /
  `Rmix` / `Rstate` không đổi; `maxstack` từ `litLen + 16` xuống còn
  `R_acc2 + 1` (≈ 2018 cho literal 8 KB; 43 480 → ~2018 cho `Higay`).
- **Bảo toàn byte**: literal ≤ 7990 byte (mọi input từng chạy được) đi qua
  nhánh cũ **nguyên vẹn** — `RK`, `maxstack`, toàn bộ bytecode không đổi
  (đã đo hash: 10/300/2000/4000/7990 byte **IDENTICAL** với trước fix;
  7991/8000 byte đổi — đúng nhóm từng fail).
- **Test hồi quy**: `long string literal (> 7990 bytes) decodes in batches`
  (kiểm tra có `CONCAT`, không call nào > 4000 arg, `maxstack < 4200`, và
  decode đúng độ dài) + `short string literal keeps the single-call decoder`
  (literal 4000 byte: **không** có `CONCAT` ⇒ layout cũ được giữ).
- **Đo sau fix**: literal 300 / 1999 / 2000 / 2001 / 4000 / 4001 / 7990 /
  7991 / 8000 / 9000 byte đều decode đúng trên Luau. `Higay.lua` và
  `higa2.lua` obfuscate xong (10.9 MB / 10.8 MB) và **không còn**
  `too many results to unpack`.

## C. `FunctionSplit.rewrite` — biến vòng lặp che bảng env/scratch ⇒ `attempt to index number with number`

- **Triệu chứng**: 4/40 seed (7, 15, 25, 33) sinh file chết ngay khi chạy
  (`print(1)` cũng chết). Trước đây bị bỏ qua vì bản gốc **không parse được**
  trên Luau nên không ai chạy tới chỗ này.
- **Nguyên nhân**: `ObjectSplitEngine.fresh()` chỉ tránh keyword + tên method,
  **không** tránh identifier của chính chunk đang rewrite. Khi tên bảng
  `env`/`n` (scratch) trùng tên biến `for` của source, thân vòng lặp đọc
  `env[1][slot]` nhưng `env` đã bị biến đếm che ⇒ index vào number. Bản gốc
  cũng dính y hệt (`for l=(l)[38.0],y do (l[0x25__])[l]=true`) — chỉ là file
  gốc không chạy được nên lỗi bị che.
- **Fix**: `FunctionSplit.loopShadowsEnv()` — nếu biến vòng lặp trùng
  `ctx.envName`/`ctx.nName` **và** thân vòng thật sự đọc bảng đó
  (`loopBodyTables()` phân biệt slot env vs slot scratch) thì đổi tên biến
  vòng bằng `repairLoopName()` (deterministic, **không** lấy rng) và map lại
  các reference trong thân qua `ctx.varRename`; giới hạn `start/stop/step`
  giữ scope ngoài (Lua đánh giá chúng trước khi biến vòng tồn tại).
- **Bảo toàn byte**: shadow *vô hại* (thân không đọc bảng) **không** bị đổi
  tên ⇒ output giữ nguyên; chỉ nhóm từng chết mới đổi.
- **Test hồi quy**: `test.js` — `loop var never shadows the generated
  env/scratch table` (env-slot, scratch-slot, shadow vô hại, tên không liên
  quan) — **FAIL** trên code cũ.
- **Đo sau fix**: `print(1)` seed 1–40 pass hết; `rt_sweep
  --seeds=7,15,25,33` **PASS 256 / FAIL 0**; 67 case `nojunk` seed 2
  (arith, precedence, …) trước đây fail cũng pass; không case nào từng PASS
  bị đổi byte (xem diff bên dưới).

## Bảo toàn output — kiểm chứng bằng snapshot 268 case

Chụp hash (`sha256[0:16]:len`) cho **65 corpus + `input.lua` + `demo.lua` ×
seed 1,2 × {default, junk:false} = 268 case** *trước* khi sửa, rồi so lại:

| Nhóm | Số case | Kết luận |
|---|---|---|
| Giống **từng byte** | 67 | `nojunk` seed 1 và các case không bị ảnh hưởng |
| Chỉ khác phần guard junk (bug A) | 134 | toàn bộ case `default`; ngữ nghĩa không đổi |
| Đổi vì **trước đó fail** (bug C) | 67 | 66/67 giờ PASS, 1 `semicolon` NO-ORACLE |

Đối chiếu riêng nhóm 67 (65 corpus + `input.lua` + `demo.lua`, seed 2,
`junk:false` — seed 2 là seed hay trùng tên bảng env): chạy cả bản *trước
fix* và *sau fix* trên Luau → trước fix **0 PASS** (tất cả đều
`attempt to index number with number`), sau fix **66 PASS / 1 NO-ORACLE**
(`semicolon`, Luau không parse `;;`) ⇒ **không input nào từng chạy đúng mà bị
đổi byte**.

## Validation của sprint này (Luau 0.744 làm oracle)

| Gate | Kết quả |
|---|---|
| `node XringCLI/tests/test.js` | **188 passed, 0 failed** (+5 test mới; 3 test mới đã xác nhận FAIL trên code cũ) |
| `node tools/split_selftest.js` | **11/11 PASS** |
| `node tools/rt_sweep.js --seeds=1,2,3` | **PASS 192 / FAIL 0 / ERROR 0 / NO-ORACLE 3** |
| `node tools/rt_sweep.js --seeds=7,15,25,33` | **PASS 256 / FAIL 0 / ERROR 0 / NO-ORACLE 4** |
| `node tools/diff_lua.js --seeds 1` | **61 pass / 3 fail / 1 blocked / 0 timeout** (3 fail: oracle/harness, xem dưới) |
| `node tools/audit_baseline.js ../baseline/xring --seeds=1` | **0 REGRESSION**, 1 `STILL-BROKEN` (`semicolon`) |
| `node tools/audit_outputs.js --seeds=1` | debug-neutrality **PASS** (195 lượt) |
| `demo20k` seed 1/2/3 | `413323` (khớp plain) |
| Literal dài | 300 … 9000 byte decode đúng; `Higay`/`higa2` obfuscate xong, không còn `too many results to unpack` |
| Performance (`demo20k`, seed 1, 3 lần) | 6.5–7.1 s (bản gốc 5.7–6.0 s; output gốc không chạy được) |

## Phân loại lại (sửa nhận định sai của sprint trước)

- `Higay.lua`, `higa2.lua`: **KHÔNG** phải "fixture ngoài phạm vi" — chúng
  fail đúng vì bug B (`too many results to unpack`). Đã fix.
- `long-string` trong `diff_lua`: vẫn là khác biệt **harness** (output chứa
  newline nên bị tách dòng khác nhau khi so text), **không** liên quan bug B.
- `arith`, `mod-neg` trong `diff_lua`: khác biệt **oracle** (fengari Lua 5.3
  vs Luau: `-7 % 3`, `inf` vs `Infinity`); bản plain chạy trên Luau cho kết
  quả y bản obfuscate.
- `semicolon`: **NO-ORACLE** — Luau không parse `;;` kiểu Lua 5.1.
