'use strict';

/**
 * Opcode handler bodies (Lua snippets) ported from IronBrew2
 * OpcodeHandlers/Handlers/*.cs. Each emitter is independent so the generator
 * can shuffle dispatch-arm order and remap CanonicalId → wire id per build.
 *
 * JIT / closure-threading variants are intentionally omitted.
 */

const { luaDecodeBody } = require('../Compilers/encode/LoadEnc');

function handler(name, canonicalId, body) {
  return { name, canonicalId, emitBody: () => body };
}

const HANDLERS = [
  handler('MOVE', 0, 'F[RegA[PC]] = F[RegB[PC]]'),
  handler('LOADK', 1, 'F[RegA[PC]] = materialize_chunk18(RegB[PC])'),
  handler('LOADBOOL', 2, `F[RegA[PC]] = RegB[PC] ~= 0
if RegC[PC] ~= 0 then PC = PC + 1 end`),
  handler('LOADNIL', 3, 'for I = RegA[PC], RegB[PC] do F[I] = nil end'),
  handler('GETUPVAL', 4, `local uv = ProtoUpvalues[RegB[PC]]
if uv[4] then F[RegA[PC]] = uv[3] else F[RegA[PC]] = uv[2][uv[1]] end`),
  handler('GETGLOBAL', 5, 'F[RegA[PC]] = realgf_v2()[Kb(PC)]'),
  handler('GETTABLE', 6, 'F[RegA[PC]]=F[RegB[PC]][Kc(PC)]'),
  handler('SETGLOBAL', 7, 'realgf_v2()[Kb(PC)] = F[RegA[PC]]'),
  handler('SETUPVAL', 8, `local uv = ProtoUpvalues[RegB[PC]]
if uv[4] then uv[3] = F[RegA[PC]] else uv[2][uv[1]] = F[RegA[PC]] end`),
  handler('SETTABLE', 9, '(F)[RegA[PC]][Kb(PC)]=Kc(PC)'),
  handler('NEWTABLE', 10, 'F[RegA[PC]] = {}'),
  handler('SELF', 11, `(F)[RegA[PC]+1]=F[RegB[PC]];
(F)[RegA[PC]]=F[RegB[PC]][Kc(PC)];`),
  handler('ADD', 12, '(F)[RegA[PC]]=(Kb(PC))+(Kc(PC))'),
  handler('SUB', 13, '(F)[RegA[PC]]=(Kb(PC))-(Kc(PC))'),
  handler('MUL', 14, '(F)[RegA[PC]]=(Kb(PC))*(Kc(PC))'),
  handler('DIV', 15, '(F)[RegA[PC]]=(Kb(PC))/(Kc(PC))'),
  handler('MOD', 16, '(F)[RegA[PC]]=(Kb(PC))%(Kc(PC))'),
  handler('POW', 17, '(F)[RegA[PC]]=(Kb(PC))^(Kc(PC))'),
  handler('UNM', 18, 'F[RegA[PC]] = -F[RegB[PC]]'),
  handler('NOT', 19, 'F[RegA[PC]] = not F[RegB[PC]]'),
  handler('LEN', 20, 'F[RegA[PC]] = #F[RegB[PC]]'),
  handler('CONCAT', 21, `local s = F[RegB[PC]]
for I = RegB[PC] + 1, RegC[PC] do s = s .. F[I] end
F[RegA[PC]] = s`),
  handler('JMP', 22, 'PC = RegB[PC]'),
  handler('EQ', 23, `local lhs = Kb(PC)
local rhs = Kc(PC)
if (lhs == rhs) ~= (RegA[PC] ~= 0) then PC = PC + 1 end`),
  handler('LT', 24, `local lhs = Kb(PC)
local rhs = Kc(PC)
if (lhs < rhs) ~= (RegA[PC] ~= 0) then PC = PC + 1 end`),
  handler('LE', 25, `local lhs = Kb(PC)
local rhs = Kc(PC)
if (lhs <= rhs) ~= (RegA[PC] ~= 0) then PC = PC + 1 end`),
  handler('TEST', 26, 'if (not F[RegA[PC]]) ~= (RegC[PC] ~= 0) then else PC = PC + 1 end'),
  handler('TESTSET', 27, 'if (not F[RegB[PC]]) ~= (RegC[PC] ~= 0) then F[RegA[PC]] = F[RegB[PC]] else PC = PC + 1 end'),
  handler('CALL', 28, `local A, B, C = RegA[PC], RegB[PC], RegC[PC]
if B ~= 0 then Top = (A + B - 1) end
local limit, results
if B ~= 1 then
    limit, results = packargs_chunk21(F[A](unpackrange_chunk04(F, Top, A + 1)))
else
    limit, results = packargs_chunk21(F[A]())
end
if C ~= 1 then
    if C == 0 then
        limit = limit + A - 1
        Top = limit
    else
        limit = A + C - 2
        Top = limit + 1
    end
    local j = 0
    for I = A, limit do
        j = j + 1
        F[I] = results[j]
    end
else
    Top = A - 1
end`),
  handler('TAILCALL', 29, `local A, B = RegA[PC], RegB[PC]
if B ~= 0 then Top = A + B - 1 end
if B ~= 1 then
    return true, A, Top
else
    return true, A, 0
end`),
  handler('RETURN', 30, `local A, B = RegA[PC], RegB[PC]
if B == 0 then
    return false, A, Top
elseif B == 1 then
    return false, nil, nil
else
    return false, A, A + B - 2
end`),
  handler('FORLOOP', 31, `local B = RegA[PC]
local step = F[B + 2]
local idx = F[B] + step
F[B] = idx
if (step > 0 and idx <= F[B + 1]) or (step <= 0 and idx >= F[B + 1]) then
    F[B + 3] = idx
    PC = RegB[PC]
end`),
  handler('FORPREP', 32, `local B = RegA[PC]
F[B] = F[B] - F[B + 2]
PC = RegB[PC]`),
  handler('TFORLOOP', 33, `local A = RegA[PC]
local C = RegC[PC]
local base = A + 3

if C == 2 then
    F[base], F[base + 1] = F[A](F[A + 1], F[A + 2])
elseif C == 1 then
    F[base] = F[A](F[A + 1], F[A + 2])
else
    local ret = { F[A](F[A + 1], F[A + 2]) }
    for I = 1, C do F[base + I - 1] = ret[I] end
end

if F[base] ~= nil then
    F[A + 2] = F[base]
else
    PC = PC + 1
end`),
  handler('SETLIST', 34, `local B, C = RegB[PC], RegC[PC]
if C == 0 then C = 1 end
local offset = (C - 1) * 50
local last = B == 0 and Top or (RegA[PC] + B)
local t = F[RegA[PC]]
table.move(F, RegA[PC] + 1, last, offset + 1, t)`),
  handler('CLOSE', 35, `local A = RegA[PC]
for I = 1, #Allupvals_chunk09 do
    local uv = Allupvals_chunk09[I]
    if not uv[4] and uv[2] == F and uv[1] >= A then
        uv[3] = uv[2][uv[1]]
        uv[4] = true
    end
end`),
  handler('CLOSURE', 36, `local proto = Protos[PC]
local nUv = RegB[PC]
local newUpvals = nUv > 0 and {}
local new_closure_vm = main_chunk24(proto, newUpvals)
realsf_v2(new_closure_vm, realgf_v2())
F[RegA[PC]] = new_closure_vm
if newUpvals then
    for I = 1, nUv do
        PC = PC + 1
        local rawMv = Opcodes[PC]
        local mv
        if rawMv >= __SEAL_BIT__ then
            local key = sealkey_chunk32(PC)
            Opcodes[PC] = h.x(rawMv - __SEAL_BIT__, key)
            RegA[PC] = h.x(RegA[PC], key)
            RegB[PC] = h.x(RegB[PC], key)
            RegC[PC] = h.x(RegC[PC], key)
            mv = Opcodes[PC]
        else
            mv = rawMv
        end
        if mv == __MOVE_ID__ then
            local obj = ({ RegB[PC], F })
            newUpvals[I - 1] = obj
            Allupvals_chunk09[#Allupvals_chunk09 + 1] = obj
        else
            newUpvals[I - 1] = ProtoUpvalues[RegB[PC]]
        end
    end
end`),
  handler('VARARG', 37, `local B = RegB[PC] - 1
if B == -1 then
    B = nVararg
    Top = RegA[PC] + B - 1
end
for I = 0, B - 1 do F[RegA[PC] + I] = Varargs[I] end`),
  handler('GETI', 38, 'F[RegA[PC]] = F[RegB[PC]][RegC[PC]]'),
  handler('PUTI', 39, 'F[RegB[PC]][RegC[PC]] = F[RegA[PC]]'),
  handler('CALLM', 40, `local a, b, c = RegA[PC], RegB[PC], RegC[PC]
local objR = b % 256
local iR = (b - objR) / 256
iR = iR - iR % 1
local meth = c % 256
local argPack = (c - meth) / 256
argPack = argPack - argPack % 1
local I = F[iR]
local obj = F[objR]
local fn = obj[I[meth]]
if argPack < 1 then
    F[a] = fn(obj)
else
    F[a] = fn(obj, I[argPack - 1])
end
Top = a`),
  handler('TLOAD', 41, 'J = F[RegB[PC]]'),
  handler('TKEYI', 42, 'o = F[RegB[PC]][RegC[PC]]'),
  handler('TGET', 43, 'r = J[o]'),
  handler('TARGI', 44, 'E = F[RegB[PC]][RegC[PC]]'),
  handler('CALL2', 45, `F[RegA[PC]] = r(J, E)
Top = RegA[PC]`),
  handler('CALL1', 46, `F[RegA[PC]] = r(J)
Top = RegA[PC]`),
  handler('CALL0', 47, `F[RegA[PC]]()
Top = RegA[PC] - 1`),
  handler('CALL0R', 48, `local A = RegA[PC]
F[A] = F[A]()
Top = A + 1`),
  handler('CALLA1', 49, `local A = RegA[PC]
F[A](F[A + 1])
Top = A - 1`),
  handler('CALLA1R', 50, `local A = RegA[PC]
F[A] = F[A](F[A + 1])
Top = A + 1`),
  handler('CALLA2', 51, `local A = RegA[PC]
F[A](F[A + 1], F[A + 2])
Top = A - 1`),
  handler('CALLA2R', 52, `local A = RegA[PC]
F[A] = F[A](F[A + 1], F[A + 2])
Top = A + 1`),
  handler('CALLA3', 53, `local A = RegA[PC]
F[A](F[A + 1], F[A + 2], F[A + 3])
Top = A - 1`),
  handler('CALLA3R', 54, `local A = RegA[PC]
F[A] = F[A](F[A + 1], F[A + 2], F[A + 3])
Top = A + 1`),
  handler('CALL0B', 55, `local f = F[RegA[PC]]
select(1, f())
Top = RegA[PC] - 1`),
  handler('CALLA1RB', 56, `local a = RegA[PC]
local f, x = F[a], F[a + 1]
F[a] = f(x)
Top = a + 1`),
  handler('JMP_ABS', 57, 'PC = RegB[PC] - 1'),
  handler('CORO_SPAWN', 58, `local A, B, C = RegA[PC], RegB[PC], RegC[PC]
if B ~= 0 then Top = (A + B - 1) end
local co = coroutine.wrap(F[A])
_coro_ctx = {[5] = _coro_resume, [6] = Top, [7] = PC, [8] = _coro_ctx}
_coro_resume = co
local limit, results
if B ~= 1 then
    limit, results = packargs_chunk21(co(unpackrange_chunk04(F, Top, A + 1)))
else
    limit, results = packargs_chunk21(co())
end
local node = _coro_ctx
if node then
    _coro_resume = node[5]
    _coro_ctx = node[8]
end
if C ~= 1 then
    if C == 0 then
        limit = limit + A - 1
        Top = limit
    else
        limit = A + C - 2
        Top = limit + 1
    end
    local j = 0
    for I = A, limit do
        j = j + 1
        F[I] = results[j]
    end
else
    Top = A - 1
end`),
  handler('CORO_YIELD', 59, `local dest = RegA[PC]
local r1, r2, r3 = _coro_resume()
F[dest] = r1
if r1 ~= nil then
    F[dest + 1] = r2
    F[dest + 2] = r3
end`),
  handler('CORO_RESTORE', 60, `local node = _coro_ctx
if node then
    _coro_resume = node[5]
    Top = node[6]
    PC = node[7]
    _coro_ctx = node[8]
end`),
  handler('REGION_DEC', 61, `do
local stD, lnD = PC + 1, RegB[PC]
local lastD = stD + lnD - 1
if type(lnD) == 'number' and lnD >= 1 and lastD <= #Opcodes and not RgnHeld[stD] then
    if not Proto[22] then Proto[22] = {} end
    local rcD = Proto[22][stD] or 0
    local seedD = RegC[PC]
    if RegA[PC] < 255 then
        local It = F[RegA[PC]]
        if type(It) == 'table' then
            if type(It[0]) == 'function' and not RgnPoisoned[It] then
                RgnPoisoned[It] = true
                if It[__DISP_SLOT__] ~= __DISP_HASH__ then
                    local cur = It[RegC[PC]]
                    if type(cur) == 'number' then It[RegC[PC]] = cur + 1 end
                end
            end
            seedD = It[RegC[PC]]
        end
    end
    if type(seedD) ~= 'number' then seedD = 0 end
    if rcD == 0 then
        local kkD = h.x(h.x(h.x(h.x(h.x(seedD, PC), Opcode), lnD), (PC + 1) * 16777619), __DISP_HASH__)
        local uD = 0
        for jD = stD, lastD do
            uD = uD + 1
            local Z7 = h.b(h.x(kkD, uD), 127)
            local Zf = h.x(h.x(kkD, uD * 16777619), jD)
            Opcodes[jD] = h.x(Opcodes[jD], Z7)
            local vA = RegA[jD]
            if type(vA) == 'number' and vA % 1 == 0 then
                local x = h.x(vA, Zf)
                if x >= 2147483648 then x = x - 4294967296 end
                RegA[jD] = x
            end
            local vB = RegB[jD]
            if type(vB) == 'number' and vB % 1 == 0 then
                local x = h.x(vB, Zf)
                if x >= 2147483648 then x = x - 4294967296 end
                RegB[jD] = x
            end
            local vC = RegC[jD]
            if type(vC) == 'number' and vC % 1 == 0 then
                local x = h.x(vC, Zf)
                if x >= 2147483648 then x = x - 4294967296 end
                RegC[jD] = x
            end
        end
    end
    Proto[22][stD] = rcD + 1
    RgnHeld[stD] = {lnD, seedD, PC, Opcode}
end
end`),
  handler('CRASH', 62, `do
PC = 0
Opcode = -1
F = nil
Opcodes = nil
RegA = nil
RegB = nil
RegC = nil
Proto = nil
error("XRN}", 0)
end`),
  handler('NATIVE_CLOSURE', 63, 'F[RegA[PC]] = native_chunk33[RegB[PC]]'),
  handler('RET0', 64, 'return false, nil, nil'),
  handler('RET1', 65, `local A = RegA[PC]
return false, A, A`),
  handler('RET2', 66, `local A = RegA[PC]
return false, A, A + 1`),
  handler('RET3', 67, `local A = RegA[PC]
return false, A, A + 2`),
  handler('RET0B', 68, `Top = RegA[PC] - 1
return false, nil, nil`),
  handler('RET1B', 69, `local a = RegA[PC]
return false, a, a + 0`),
  handler('JMP_REL', 70, 'PC = PC + RegB[PC]'),
  handler('FORLOOP_ABS', 71, `local B = RegA[PC]
local step = F[B + 2]
local idx = F[B] + step
F[B] = idx
if (step > 0 and idx <= F[B + 1]) or (step <= 0 and idx >= F[B + 1]) then
    F[B + 3] = idx
    PC = RegB[PC] - 1
end`),
  handler('FORLOOP_REL', 72, `local B = RegA[PC]
local step = F[B + 2]
local idx = F[B] + step
F[B] = idx
if (step > 0 and idx <= F[B + 1]) or (step <= 0 and idx >= F[B + 1]) then
    F[B + 3] = idx
    PC = PC + RegB[PC]
end`),
  handler('FORPREP_ABS', 73, `local B = RegA[PC]
F[B] = F[B] - F[B + 2]
PC = RegB[PC] - 1`),
  handler('FORPREP_REL', 74, `local B = RegA[PC]
F[B] = F[B] - F[B + 2]
PC = PC + RegB[PC]`),
  handler('LOADENC', 75, luaDecodeBody(1)),
  handler('LOADENC2', 76, luaDecodeBody(2)),
  handler('LOADENC3', 77, luaDecodeBody(3)),
  handler('REGION_ENC', 78, `do
local lnD = RegB[PC]
local stD = PC - lnD
local hld = RgnHeld[stD]
if hld then
    if not Proto[22] then Proto[22] = {} end
    local rcD = (Proto[22][stD] or 1) - 1
    if rcD <= 0 then
        local kkD = h.x(h.x(h.x(h.x(h.x(hld[2], hld[3]), hld[4]), hld[1]), (hld[3] + 1) * 16777619), __DISP_HASH__)
        local uD = 0
        local lastD = stD + hld[1] - 1
        if lastD > #Opcodes then lastD = #Opcodes end
        for jD = stD, lastD do
            uD = uD + 1
            local Z7 = h.b(h.x(kkD, uD), 127)
            local Zf = h.x(h.x(kkD, uD * 16777619), jD)
            Opcodes[jD] = h.x(Opcodes[jD], Z7)
            local vA = RegA[jD]
            if type(vA) == 'number' and vA % 1 == 0 then
                local x = h.x(vA, Zf)
                if x >= 2147483648 then x = x - 4294967296 end
                RegA[jD] = x
            end
            local vB = RegB[jD]
            if type(vB) == 'number' and vB % 1 == 0 then
                local x = h.x(vB, Zf)
                if x >= 2147483648 then x = x - 4294967296 end
                RegB[jD] = x
            end
            local vC = RegC[jD]
            if type(vC) == 'number' and vC % 1 == 0 then
                local x = h.x(vC, Zf)
                if x >= 2147483648 then x = x - 4294967296 end
                RegC[jD] = x
            end
        end
        Proto[22][stD] = nil
    else
        Proto[22][stD] = rcD
    end
    RgnHeld[stD] = nil
end
end`),
  handler('TKEYR', 79, 'o = F[RegB[PC]]'),
  handler('TKEYK', 80, 'o = Kb(PC)'),
  handler('TGETD', 81, 'F[RegA[PC]] = J[o]'),
  handler('TSET', 82, 'J[o] = F[RegB[PC]]'),
  handler('TSETK', 83, 'J[o] = Kb(PC)'),
  handler('GETFI', 84, `local a, b, c = RegA[PC], RegB[PC], RegC[PC]
local objR = b % 256
local iR = (b - objR) / 256
iR = iR - iR % 1
local I = F[iR]
F[a] = F[objR][I[c]]`),
  handler('SETFI', 85, `local a, b, c = RegA[PC], RegB[PC], RegC[PC]
local objR = b % 256
local iR = (b - objR) / 256
iR = iR - iR % 1
local I = F[iR]
F[objR][I[c]] = F[a]`),
  handler('GETFR', 86, '(F)[RegA[PC]]=(F[RegB[PC]][F[RegC[PC]]])'),
  handler('SETFR', 87, '(F)[RegA[PC]][F[RegB[PC]]]=F[RegC[PC]]'),
  handler('TNEW', 88, `do
local t = {}
F[RegA[PC]] = t
end`),
  handler('TSETI', 89, 'F[RegA[PC]][RegB[PC]] = F[RegC[PC]]'),
  handler('TFLUSH', 90, `local n, page = RegB[PC], RegC[PC]
if page < 1 then page = 1 end
local base = (page - 1) * 50
local t = F[RegA[PC]]
local last = n == 0 and Top or (RegA[PC] + n)
table.move(F, RegA[PC] + 1, last, base + 1, t)`),
  handler('TARGI2', 91, 'q = F[RegB[PC]][RegC[PC]]'),
  handler('CALL3', 92, `F[RegA[PC]] = r(J, E, q)
Top = RegA[PC]`),
  handler('CALL0S', 93, `local a = RegA[PC]
local f = F[a]
f()
Top = a - 1`),
  handler('CALL0T', 94, `Top = RegA[PC]
F[Top]()
Top = Top - 1`),
  handler('CALL0RS', 95, `local a = RegA[PC]
local f = F[a]
F[a] = select(1, f())
Top = a + 1`),
  handler('CALLA1S', 96, `local a = RegA[PC]
local f, x = F[a], F[a + 1]
f(x)
Top = a - 1`),
  handler('CALLA1T', 97, `local a = RegA[PC]
Top = a + 1
F[a](F[Top])
Top = a - 1`),
  handler('CALLA1RS', 98, `local a = RegA[PC]
local f, x = F[a], F[a + 1]
F[a] = select(1, f(x))
Top = a + 1`),
  handler('CALLA2S', 99, `local a = RegA[PC]
local f, x, y = F[a], F[a + 1], F[a + 2]
f(x, y)
Top = a - 1`),
  handler('CALLA2RS', 100, `local a = RegA[PC]
local f, x, y = F[a], F[a + 1], F[a + 2]
F[a] = select(1, f(x, y))
Top = a + 1`),
  handler('CALLA3S', 101, `local a = RegA[PC]
local f = F[a]
f(F[a + 1], F[a + 2], F[a + 3])
Top = a - 1`),
  handler('RET0T', 102, `do
Top = RegA[PC] - 1
return false, nil, nil
end`),
  handler('RET0X', 103, `local _ = RegA[PC]
Top = _ - 1
return false, nil, nil`),
  handler('RET1S', 104, `return false, RegA[PC], RegA[PC]`),
  handler('RET1X', 105, `local lo = RegA[PC]
return false, lo, lo`),
  handler('RET2S', 106, `local lo = RegA[PC]
return false, lo, lo + 1`),
  handler('RET2X', 107, `local lo, hi = RegA[PC], RegA[PC] + 1
return false, lo, hi`),
  handler('RET3S', 108, `local lo = RegA[PC]
return false, lo, lo + 2`),
  handler('RET3X', 109, `local lo = RegA[PC]
local hi = lo + 2
return false, lo, hi`),
  handler('RET4', 110, `local A = RegA[PC]
return false, A, A + 3`),
  handler('RET4S', 111, `local lo = RegA[PC]
return false, lo, lo + 3`),
  handler('RET5', 112, `local A = RegA[PC]
return false, A, A + 4`),
  handler('MOVE2', 113, `do
local v = F[RegB[PC]]
F[RegA[PC]] = v
end`),
  handler('MOVE3', 114, 'F[RegA[PC]] = (F[RegB[PC]])'),
  handler('GETI2', 115, `local t = F[RegB[PC]]
F[RegA[PC]] = t[RegC[PC]]`),
  handler('GETI3', 116, `do
local b, c = RegB[PC], RegC[PC]
F[RegA[PC]] = F[b][c]
end`),
  handler('GETFK', 117, 'F[RegA[PC]]=F[RegB[PC]][Kc(PC)]'),
  handler('SETFK', 118, '(F)[RegA[PC]][Kb(PC)]=F[RegC[PC]]'),
  handler('IDIV', 119, '(F)[RegA[PC]]=(Kb(PC))//(Kc(PC))'),
  handler('ADDRR', 120, 'F[RegA[PC]]=F[RegB[PC]]+F[RegC[PC]]'),
  handler('ADDRK', 121, 'F[RegA[PC]]=F[RegB[PC]]+Kc(PC)'),
  handler('ADDKK', 122, '(F)[RegA[PC]]=Kb(PC)+Kc(PC)'),
  handler('SUBRR', 123, 'F[RegA[PC]]=F[RegB[PC]]-F[RegC[PC]]'),
  handler('SUBRK', 124, 'F[RegA[PC]]=F[RegB[PC]]-Kc(PC)'),
  handler('SUBKK', 125, '(F)[RegA[PC]]=Kb(PC)-Kc(PC)'),
  handler('MULRR', 126, 'F[RegA[PC]]=F[RegB[PC]]*F[RegC[PC]]'),
  handler('MULRK', 127, 'F[RegA[PC]]=F[RegB[PC]]*Kc(PC)'),
  handler('MULKK', 128, '(F)[RegA[PC]]=Kb(PC)*Kc(PC)'),
  handler('DIVRR', 129, 'F[RegA[PC]]=F[RegB[PC]]/F[RegC[PC]]'),
  handler('DIVRK', 130, 'F[RegA[PC]]=F[RegB[PC]]/Kc(PC)'),
  handler('DIVKK', 131, '(F)[RegA[PC]]=Kb(PC)/Kc(PC)'),
  handler('IDIVRR', 132, 'F[RegA[PC]]=F[RegB[PC]]//F[RegC[PC]]'),
  handler('IDIVRK', 133, 'F[RegA[PC]]=F[RegB[PC]]//Kc(PC)'),
  handler('IDIVKK', 134, '(F)[RegA[PC]]=Kb(PC)//Kc(PC)'),
];

const BY_NAME = Object.create(null);
const BY_ID = Object.create(null);
for (const h of HANDLERS) {
  BY_NAME[h.name] = h;
  BY_ID[h.canonicalId] = h;
}

function wrapHandlerBody(body) {
  return body;
}


function indentBody(body, spaces) {

  const pad = ' '.repeat(spaces);
  return body.split('\n').map((ln) => (ln.trim() === '' ? '' : pad + ln)).join('\n');
}

function sprinkleBin(bits, rand) {
  if (!bits || bits.length < 2) return bits;
  let out = bits.charAt(0);
  let since = 1;
  for (let i = 1; i < bits.length; i++) {
    if (since >= 2 && i < bits.length - 1 && rand() < 0.14 && out.charAt(out.length - 1) !== '_') {
      out += '_';
      if (rand() < 0.22) out += '_';
      since = 0;
    }
    out += bits.charAt(i);
    since++;
  }
  if (rand() < 0.14 && out.charAt(out.length - 1) !== '_') {
    out += '_';
    if (rand() < 0.18) out += '_';
  }
  return out || bits;
}

function mixNum(n, rng) {
  const rand = typeof rng === 'function' ? rng : () => 0.5;
  const r = rand();
  const v = n >>> 0;
  const hexTrail = () => {
    if (rand() >= 0.18) return '';
    return rand() < 0.28 ? '__' : '_';
  };
  if (r < 0.40) return '0X' + v.toString(16).toUpperCase() + hexTrail();
  if (r < 0.55) return '0x' + v.toString(16) + hexTrail();
  if (r < 0.84 && v < 0x40000) {
    const p = rand() < 0.28 ? '0b' : '0B';
    return p + sprinkleBin(v.toString(2), rand);
  }
  return String(v);
}

/**
 * Xrings opcode dispatch: nested range-if, not a flat elseif Opcode== chain.
 * Binary split while >4 arms (depth ~4 for 64 ops). Groups of 4 print as
 * nested `else if` (Xrings majority). Max stacked `end` stays ~7.
 */
function emitDispatch(idMap, order, indent, rng) {
  const sp = indent || 28;
  const rand = rng || Math.random;
  const arms = (order || HANDLERS).map((h) => ({
    wire: idMap && idMap[h.canonicalId] != null ? idMap[h.canonicalId] : h.canonicalId,
    name: h.name,
    body: wrapHandlerBody(h.emitBody()),
  }));
  arms.sort((a, b) => a.wire - b.wire);
  return emitRangeTree(arms, sp, rand);
}

function leafIf(arm, pad, sp, rand) {
  const body = indentBody(arm.body, sp + 2);
  const id = mixNum(arm.wire, rand);
  const style = Math.floor(rand() * 3);
  if (style === 1) return `${pad}if not(Opcode~=${id})then\n${body}\n${pad}end`;
  if (style === 2) return `${pad}if Opcode>=${id} and Opcode<=${id} then\n${body}\n${pad}end`;
  return `${pad}if Opcode == ${id} then\n${body}\n${pad}end`;
}

function rangeCond(nextWire, rand) {
  const n = mixNum(nextWire, rand);
  const r = rand();
  if (r < 0.35) return `not(Opcode>=${n})`;
  if (r < 0.7) return `Opcode<${n}`;
  if (nextWire > 0) return `Opcode<=${mixNum(nextWire - 1, rand)}`;
  return `Opcode<${n}`;
}

function emitRangeTree(arms, sp, rng) {
  const pad = ' '.repeat(sp);
  const rand = () => (typeof rng === 'function' ? rng() : Math.random());
  if (!arms.length) return pad + 'do end';
  if (arms.length === 1) return leafIf(arms[0], pad, sp, rand);
  if (arms.length <= 4) {
    const cond = rangeCond(arms[1].wire, rand);
    const head = indentBody(arms[0].body, sp + 2);
    if (rand() < 0.32) {
      let out = `${pad}if ${cond} then\n${head}\n`;
      for (let i = 1; i < arms.length; i++) {
        const body = indentBody(arms[i].body, sp + 2);
        if (i === arms.length - 1) {
          out += `${pad}else\n${body}\n${pad}end`;
        } else {
          out += `${pad}elseif ${rangeCond(arms[i + 1].wire, rand)} then\n${body}\n`;
        }
      }
      return out;
    }
    const rest = arms.length === 2
      ? `${pad}else\n${indentBody(arms[1].body, sp + 2)}\n${pad}end`
      : `${pad}else\n${emitRangeTree(arms.slice(1), sp + 2, rng)}\n${pad}end`;
    return `${pad}if ${cond} then\n${head}\n${rest}`;
  }
  const mid = Math.floor(arms.length / 2);
  const pivot = arms[mid].wire;
  const left = emitRangeTree(arms.slice(0, mid), sp + 2, rng);
  const right = emitRangeTree(arms.slice(mid), sp + 2, rng);
  const n = mixNum(pivot, rand);
  const r = rand();
  if (r < 0.22) {
    return `${pad}if Opcode >= ${n} then\n${right}\n${pad}else\n${left}\n${pad}end`;
  }
  if (r < 0.36 && pivot > 0) {
    const lo = mixNum(pivot - 1, rand);
    return `${pad}if Opcode <= ${lo} then\n${left}\n${pad}else\n${right}\n${pad}end`;
  }
  if (r < 0.48 && pivot > 0) {
    const lo = mixNum(pivot - 1, rand);
    return `${pad}if Opcode > ${lo} then\n${right}\n${pad}else\n${left}\n${pad}end`;
  }
  if (r < 0.68) {
    return `${pad}if not(Opcode<${n})then\n${right}\n${pad}else\n${left}\n${pad}end`;
  }
  if (r < 0.84) {
    return `${pad}if not(Opcode>=${n})then\n${left}\n${pad}else\n${right}\n${pad}end`;
  }
  return `${pad}if Opcode < ${n} then\n${left}\n${pad}else\n${right}\n${pad}end`;
}

module.exports = {
  HANDLERS,
  BY_NAME,
  BY_ID,
  emitDispatch,
  wrapHandlerBody,
  indentBody,
};
