'use strict';
const LVM_CHUNK_00 = `
local safecall_chunk00 = pcall
`;

const LVM_CHUNK_01 = `
		local cursor_chunk01 = 1
`;

const LVM_CHUNK_02 = `
		local voidtbl_chunk02 = {}
`;

const LVM_CHUNK_03 = `
		local indirect_chunk03 = function(...)
			return (...)[...]
		end;
`;

const LVM_CHUNK_04 = `
		local unpackrange_chunk04 = function(tbl, start, finish)
			finish = finish or 1;
			start = start or #tbl

			return unpack(tbl, finish, start)
		end;
`;

const LVM_CHUNK_05 = `
		local newarray_chunk05 = table.create
`;

const LVM_CHUNK_06 = `
		local regscratch_chunk06 = nil;
`;

const LVM_CHUNK_07 = `
		local bigbase_chunk07 = 4294967296;
`;

const LVM_CHUNK_08 = `
		local blob_chunk08
`;

const LVM_CHUNK_09 = `
		local upvals_chunk09 = {}
`;

const LVM_CHUNK_10 = `
		local sidestack_chunk10 = {}
`;

const LVM_CHUNK_11 = `
		local signedmax_chunk11 = 2147483648
`;

const LVM_CHUNK_12 = `
		local extract_chunk12 = function(value, bits, off)
			local res = (value / (2 ^ off)) % (2 ^ bits)
			res = res - res % 1
			return res
		end;
`;

const LVM_CHUNK_13 = `
		local nextbyte_chunk13 = (function()
			local a = buffer.readu8(blob_chunk08, cursor_chunk01 - 1)
			cursor_chunk01 = cursor_chunk01 + 1
			return a
		end)
`;

const LVM_CHUNK_14 = `
		local nextint_chunk14 = function()
			local v = buffer.readu32(blob_chunk08, cursor_chunk01 - 1)
			cursor_chunk01 = cursor_chunk01 + 4

			return v
		end;
`;

const LVM_CHUNK_15 = `
		local nextint64_chunk15 = function()
			local lo = nextint_chunk14()
			local hi = nextint_chunk14()

			if hi >= signedmax_chunk11 then
				hi = hi - bigbase_chunk07
			end

			local result = hi * bigbase_chunk07 + lo
			return result
		end
`;

const LVM_CHUNK_16 = `
		local nextfloat_chunk16 = function()
			local v = buffer.readf64(blob_chunk08, cursor_chunk01 - 1)
			cursor_chunk01 = cursor_chunk01 + 8

			return v
		end;
`;

const LVM_CHUNK_17 = `
		local nextvarint_chunk17 = function()
			local value, mul = 0, 1;
			repeat
				local bv = buffer.readu8(blob_chunk08, cursor_chunk01 - 1)
				value = (value + ((bv > 127 and bv - 128 or bv) * mul))
				mul = (mul * 128)
				cursor_chunk01 = cursor_chunk01 + 1
			until bv < 128;

			return value
		end;
`;

const LVM_CHUNK_18 = `
		local constcache_chunk18_direct = nil;
`;

const LVM_CHUNK_19 = `
		local readvarint_chunk19 = function()
			return nextvarint_chunk17()
		end
`;

const LVM_CHUNK_20 = `
		local nextstring_chunk20 = function()
			local len = nextvarint_chunk17()
			local s = buffer.readstring(blob_chunk08, cursor_chunk01 - 1, len)
			cursor_chunk01 = cursor_chunk01 + len
			return s
		end;
`;

const LVM_CHUNK_21 = `
		local packargs_chunk21 = function(...)
			local count = select('#', ...)
			if count == 0 then
				return count, voidtbl_chunk02
			end;
			return count, {
				...
			}
		end;
`;

const LVM_CHUNK_22 = `
		local constcached_chunk22, instdecode_chunk22 = nil;
`;

const LVM_CHUNK_23 = `
local main_chunk24;
`;

const LVM_CHUNK_24 = `
main_chunk24 = (function(Proto, ProtoUpvalues)
			local StackSz, LineMap, Opcodes, RegB, RegA, Decrypted, Consts, Protos, RegC, AIsK, BIsK, CIsK = Proto[6], Proto[11], Proto[3], Proto[4], Proto[5], Proto[8], Proto[9], Proto[7], Proto[10], Proto[12], Proto[13], Proto[14]
			local CA0, CA1, CA2 = Proto[17], Proto[18], Proto[19]
			local MapAt = Proto[16]
			local OA = Proto[20]

			local Loop = function(...)
				local F = newarray_chunk05(StackSz)
				local Top, PC = 1, 1
				local J, E, r, o, q
				local Allupvals_chunk09 = {}
				local RgnHeld = {}
				local RgnPoisoned = {}

				local nArgs, Args = packargs_chunk21(...)
				local doneArgs, argIx = 0, 1
				local realgf_v2, realsf_v2 = getfenv, setfenv

				local _coro_resume, _coro_ctx = nil, nil

				local loopKey, loopCtrl, loopLimit, sharedUpv

			local SM = Proto[21]
			local SMdone = {}

				if Proto[15] then
					for _, RG in ipairs(Proto[15]) do
						if not RG[4] then
							RG[4] = true
							local u = 0
							for j = RG[1], RG[1] + RG[2] - 1 do
								u = u + 1
								local Z = h.b(h.x(RG[3], u), 127)
								Proto[3][j] = h.x(Proto[3][j], Z)
								if not Proto[12][j] then Proto[5][j] = h.x(Proto[5][j], Z) end
								if not Proto[13][j] then Proto[4][j] = h.x(Proto[4][j], Z) end
								if not Proto[14][j] then Proto[10][j] = h.x(Proto[10][j], Z) end
							end
						end
					end
				end

			local function materialize_chunk18(v)
				__MATERIALIZE_BODY__
			end
			local function Kb(i)
				if BIsK[i] then return materialize_chunk18(RegB[i]) end
				return F[RegB[i]]
			end
			local function Kc(i)
				if CIsK[i] then return materialize_chunk18(RegC[i]) end
				return F[RegC[i]]
			end
			local function _carr(i)
				local m = i % 3
				if m == 0 then return CA0 elseif m == 1 then return CA1 else return CA2 end
			end

				local Params = Proto[1]
				for I = 1, Params do F[I - 1] = Args[I] end
				local nVararg = nArgs - Params
				if nVararg < 0 then nVararg = 0 end
				local Varargs = {}
				for I = 1, nVararg do Varargs[I - 1] = Args[Params + I] end

				local ok, signal, callIx, callFlag = safecall_chunk00(function()
					local Hs = {}
					do local z=1 while z<=64 do Hs[z]=0 z=z+1 end end
					while true do
						local RawOpcode = Opcodes[PC]
						local Opcode
						if RawOpcode >= __SEAL_BIT__ then
							local key = sealkey_chunk32(PC)
							Opcodes[PC] = h.x(RawOpcode - __SEAL_BIT__, key)
							RegA[PC] = h.x(RegA[PC], key)
							RegB[PC] = h.x(RegB[PC], key)
							RegC[PC] = h.x(RegC[PC], key)
							Opcode = Opcodes[PC]
							if OA then local o = OA[PC]; if o then Opcode = o end end
							local MapId = MapAt and MapAt[PC] or 0
							__OPCODE_DISPATCH__
							PC = PC + 1
						elseif __NOP_CHECK__ then
							PC = PC + 1
						else
							Opcode = RawOpcode
							if OA then local o = OA[PC]; if o then Opcode = o end end
							local MapId = MapAt and MapAt[PC] or 0
							__OPCODE_DISPATCH__
							__SELFMOD_DECOY__
							PC = PC + 1
						end
					end
				end)

				if not ok then
					if sharedUpv then
						for uvIx, upval_data, t in sharedUpv do
							if uvIx >= 1 then
								(upval_data)[2] = (upval_data);
								(upval_data)[3] = (F[uvIx]);
								(upval_data)[1] = 3
								sharedUpv[uvIx] = nil
							end
						end
					end;
					if type(signal) ~= 'string' then
						error(signal, 0)
					else
						if not (string.match(signal, ":(\\d+)[:\\r\\n]")) then
							error(signal, 0)
						else
							error('Xrings error:' .. (LineMap[PC] or '(unknown)') .. ': ' .. tostring(signal), 0)
						end
					end
				else
					if next(RgnHeld) then
						for stD, hld in pairs(RgnHeld) do
							if not Proto[22] then Proto[22] = {} end
							local rcD = (Proto[22][stD] or 1) - 1
							if rcD <= 0 then
								local kk = h.x(h.x(h.x(h.x(h.x(hld[2], hld[3]), hld[4]), hld[1]), (hld[3] + 1) * 16777619), __DISP_HASH__)
								local uD = 0
								local lastD = stD + hld[1] - 1
								for jD = stD, lastD do
									uD = uD + 1
									local Z7 = h.b(h.x(kk, uD), 127)
									local Zf = h.x(h.x(kk, uD * 16777619), jD)
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
					end
					if signal then

						if callFlag ~= 0 then
							return F[callIx](unpackrange_chunk04(F, callFlag, callIx + 1))
						else
							return F[callIx]()
						end
					else

					if callIx ~= nil then
						return unpackrange_chunk04(F, callFlag, callIx)
					else
						return
					end
					end
				end
			end;
			return Loop
		end)
`;

const LVM_CHUNK_25 = `
		blob_chunk08 = buffer.fromstring((function(blob)
			blob = string.gsub(blob, 'z', '!!!!!')
			local Chars = {}
			for Char = 0, 255 do
				Chars[Char] = string.char(Char)
			end
			return string.gsub(blob, '.....', setmetatable({}, {
				__index = function(t, key)
					local a, b, c, d, e = string.byte(key, 1, 5)
					local Tuple = ((e - 33) + (d - 33) * 85 + (c - 33) * 7225 + (b - 33) * 614125 + (a - 33) * 52200625)
					a = Tuple % 256
					Tuple = (Tuple - a) / 256
					b = Tuple % 256
					Tuple = (Tuple - b) / 256
					c = Tuple % 256
					Tuple = (Tuple - c) / 256
					d = Tuple % 256
					local Value = Chars[d] .. Chars[c] .. Chars[b] .. Chars[a]
					t[key] = Value
					return Value
				end
			}))
		end)(string.sub(__BLOB__, 6)))
`;

const LVM_CHUNK_26 = `
local readproto_chunk26 = (function()
			local nInsts = nextvarint_chunk17()
			local Proto = {}
			local I = 1
			local Slots = newarray_chunk05(nInsts)

			for i = 1, nInsts do
				local rawInst = nextvarint_chunk17()

				if instdecode_chunk22[rawInst] then
					Slots[i] = (instdecode_chunk22[rawInst])
				else
					local base = (rawInst / 4)
					base = base - base % 1
					local pair = ({
						base,
						rawInst % 4
					})
					instdecode_chunk22[rawInst] = pair
					Slots[i] = pair
				end
			end

			local nSlots = nextvarint_chunk17() - __SLOT_BIAS__

			Proto[2] = Slots
			Proto[3] = newarray_chunk05(nSlots)
			Proto[4] = newarray_chunk05(nSlots)
			Proto[5] = newarray_chunk05(nSlots)
			Proto[7]  = newarray_chunk05(nSlots)
			Proto[8] = newarray_chunk05(nSlots);
			Proto[9] = __PROTO9_INIT__
			Proto[10] = newarray_chunk05(nSlots)
			Proto[12] = newarray_chunk05(nSlots)
			Proto[13] = newarray_chunk05(nSlots)
			Proto[14] = newarray_chunk05(nSlots)

			local closurePCs = {}
			local LineMap = {}
			for I = 1, nSlots do
				local RawC = readvarint_chunk19()
				local CMode = RawC % 8;
				local RawA = readvarint_chunk19()
				local AMode = RawA % 8;
				local RawB = readvarint_chunk19()

				local RegA = (RawA - AMode) / 8
				local Instruction_Enum = readvarint_chunk19()
				local RegC = (RawC - CMode) / 8
				local bMode = RawB % 8;
				local RegB = (RawB - bMode) / 8

				Proto[10][I] = RegC
				Proto[4][I] = RegB
				Proto[5][I] = RegA
				Proto[3][I] = Instruction_Enum

				local K_CONST = 0
				local K_REG = 7
				local K_FWD = 1
				local K_BWD = 4
				local K_CLOSURE = 2
				local K_REL_FWD = 3
				local K_REL_BWD = 5

				if bMode == K_CONST then
					Proto[13][I] = true
					Proto[4][I] = __BAKE_B__
				elseif bMode == K_REG then
					Proto[4][I] = RegB
				elseif bMode == K_FWD then
					(Proto[4])[I] = I + RegB
				elseif bMode == K_BWD then
					Proto[4][I] = I - RegB
				elseif bMode == K_REL_FWD then
					Proto[4][I] = RegB
				elseif bMode == K_REL_BWD then
					Proto[4][I] = -RegB
				end

				if CMode == K_CONST then
					Proto[14][I] = true
					Proto[10][I] = __BAKE_C__
				elseif CMode == K_REG then
					Proto[10][I] = RegC
				elseif CMode == K_FWD then
					Proto[10][I] = I + RegC
				elseif CMode == K_BWD then
					(Proto[10])[I] = (I - RegC)
				else
					if CMode == K_CLOSURE then
						local off = #(regscratch_chunk06)
						regscratch_chunk06[off + 1] = Proto[7]
						regscratch_chunk06[off + 2] = I
						regscratch_chunk06[off + 3] = RegC
						closurePCs[I] = true
					end
				end;

				if AMode == K_CONST then
					Proto[12][I] = true
					Proto[5][I] = __BAKE_A__
				elseif AMode == K_REG then
					Proto[5][I] = RegA
				elseif AMode == K_FWD then
					Proto[5][I] = (I + RegA)
				else
					if AMode == K_BWD then
						Proto[5][I] = I - RegA
					end
				end
			end;

			__CONST_SCATTER__

			local Opcodes = Proto[3]
			local RegBArr = Proto[4]
			local IsJump = {}
			local IsRelJump = {}
			for _, jid in ipairs({__JMP_IDS__}) do IsJump[jid] = true end
			for _, jid in ipairs({__JMP_REL_IDS__}) do IsRelJump[jid] = true end
			local RegionDecId = __REGION_DEC_ID__
			local inRgn = {}
			for pc = 1, nSlots do
				if Opcodes[pc] == RegionDecId then
					local ln = RegBArr[pc]
					if type(ln) == 'number' and ln >= 1 then
						inRgn[pc] = true
						for j = pc, pc + ln + 1 do inRgn[j] = true end
					end
				end
			end
			local function xor_rgn(st, ln, kk)
				if type(ln) ~= 'number' or ln < 1 then return end
				local last = st + ln - 1
				if last > nSlots then last = nSlots end
				if st < 1 or last < st then return end
				local u = 0
				for j = st, last do
					u = u + 1
				local Z7 = h.b(h.x(kk, u), 127)
				local Zf = h.x(h.x(kk, u * 16777619), j)
				Opcodes[j] = h.x(Opcodes[j], Z7)
					local vA = Proto[5][j]
					if type(vA) == 'number' and vA % 1 == 0 then
						local x = h.x(vA, Zf)
						if x >= 2147483648 then x = x - 4294967296 end
						Proto[5][j] = x
					end
					local vB = Proto[4][j]
					if type(vB) == 'number' and vB % 1 == 0 then
						local x = h.x(vB, Zf)
						if x >= 2147483648 then x = x - 4294967296 end
						Proto[4][j] = x
					end
					local vC = Proto[10][j]
					if type(vC) == 'number' and vC % 1 == 0 then
						local x = h.x(vC, Zf)
						if x >= 2147483648 then x = x - 4294967296 end
						Proto[10][j] = x
					end
				end
			end
			local inLoop = {}
			for pc = 1, nSlots do
				local tgt
				if IsJump[Opcodes[pc]] then
					tgt = RegBArr[pc]
				elseif IsRelJump[Opcodes[pc]] then
					tgt = pc + (RegBArr[pc] or 0)
				end
				if type(tgt) == 'number' and tgt >= 1 and tgt < pc then
					for j = tgt, pc do inLoop[j] = true end
				end
			end

			local sealCount = 0
			local maxSeal = math.floor(nSlots * 0.15)
			if maxSeal < 1 then maxSeal = 1 end
			local skipNext = 0
			for pc = 1, nSlots do
				if skipNext > 0 then
					skipNext = skipNext - 1
				elseif not inLoop[pc] and not inRgn[pc] then
					if closurePCs[pc] then
						local nUv = RegBArr[pc]
						if type(nUv) == 'number' and nUv > 0 then
							skipNext = nUv
						end
					end
					local ok = not Proto[12][pc] and not Proto[13][pc] and not Proto[14][pc]
						and type(Proto[4][pc]) ~= 'string' and type(Proto[10][pc]) ~= 'string'
						and (type(Proto[4][pc]) ~= 'number' or Proto[4][pc] % 1 == 0)
						and (type(Proto[10][pc]) ~= 'number' or Proto[10][pc] % 1 == 0)
					if ok and (pc * __SEAL_MUL__) % 7 < 1 and sealCount < maxSeal then
						local key = sealkey_chunk32(pc)
						Opcodes[pc] = h.x(Opcodes[pc], key) + __SEAL_BIT__
						Proto[5][pc] = h.x(Proto[5][pc] or 0, key)
						Proto[4][pc] = h.x(Proto[4][pc] or 0, key)
						Proto[10][pc] = h.x(Proto[10][pc] or 0, key)
						sealCount = sealCount + 1
					end
				end
			end
			__SELFMOD_SHADOW__

			Proto[6] = nextvarint_chunk17()

			Proto[11] = LineMap
			for Line = 1, nextint_chunk14() do
				local a = nextint_chunk14()
				local b = (a / 2)

				if a % 2 == 0 then
					LineMap[I] = b - b % 1
				else
					I = nextint_chunk14()
					local line_number = nextint_chunk14()
					for i = b - b % 1, I do
						LineMap[i] = line_number
					end
				end

				I = I + 1;
			end
			Proto[1] = nextvarint_chunk17()

			local nRgn = nextvarint_chunk17()
			if nRgn > 0 then
				local Rgns = {}
				for _ = 1, nRgn do
					Rgns[#Rgns + 1] = {nextvarint_chunk17(), nextvarint_chunk17(), nextvarint_chunk17()}
				end
				for _, rg in ipairs(Rgns) do
					local u = 0
					for j = rg[1], rg[1] + rg[2] - 1 do
						u = u + 1
						local Z = h.b(h.x(rg[3], u), 127)
						Proto[3][j] = h.x(Proto[3][j], Z)
						if not Proto[12][j] then Proto[5][j] = h.x(Proto[5][j], Z) end
						if not Proto[13][j] then Proto[4][j] = h.x(Proto[4][j], Z) end
						if not Proto[14][j] then Proto[10][j] = h.x(Proto[10][j], Z) end
					end
				end
				Proto[15] = Rgns
			end

			local nMap = nextvarint_chunk17()
			if nMap > 0 then
				local MapAt = {}
				for i = 1, nMap do MapAt[i] = nextvarint_chunk17() end
				Proto[16] = MapAt
			end

			local nOA = nextvarint_chunk17()
			if nOA > 0 then
				local OA = {}
				for i = 1, nOA do
					local pc = nextvarint_chunk17()
					OA[pc] = nextvarint_chunk17()
				end
				Proto[20] = OA
			end

			local RegionMaster = __REGION_MASTER__
			local rgnSites = {}
			for pc = 1, nSlots do
				if Opcodes[pc] == RegionDecId then
					local ln = Proto[4][pc]
					local a = Proto[5][pc]
					local c = Proto[10][pc]
					if type(ln) == 'number' and ln >= 1 and pc + ln <= nSlots then
						local seed = c
						if type(a) == 'number' and a < 255 and RegionMaster ~= 0 then
							seed = RegionMaster
						end
						if type(seed) == 'number' then
							rgnSites[#rgnSites + 1] = {pc, ln, seed, Opcodes[pc]}
						end
					end
				end
			end
			for i = 1, #rgnSites do
				local s = rgnSites[i]
				xor_rgn(s[1] + 1, s[2], h.x(h.x(h.x(h.x(h.x(s[3], s[1]), s[4]), s[2]), (s[1] + 1) * 16777619), __DISP_HASH__))
			end

			return Proto
		end)
`;

const LVM_CHUNK_27 = `
		local deserialize_chunk27 = (function()
			instdecode_chunk22 = {}

			local nConsts = nextvarint_chunk17() - __CONST_BIAS__
			constcache_chunk18_direct = newarray_chunk05(nConsts)

			constcached_chunk22 = nextbyte_chunk13() ~= 0

			for I = 1, nConsts do
				local Type = nextbyte_chunk13()
				if Type == __TYPE_FLOAT__ then
					constcache_chunk18_direct[I] = nextfloat_chunk16()
				elseif Type == __TYPE_NIL__ then
					constcache_chunk18_direct[I] = nil
				elseif Type < __TYPE_FLOAT__ then
					constcache_chunk18_direct[I] = nextbyte_chunk13() == 1
				elseif Type == __TYPE_STRING__ then
					local len = nextvarint_chunk17()
					local buf = buffer.create(len)
					for i = 1, len do
						buffer.writeu8(buf, i - 1, (nextbyte_chunk13() - __STR_OFFSET__ + 256) % 256)
					end
					constcache_chunk18_direct[I] = buffer.tostring(buf)
				else
					constcache_chunk18_direct[I] = nextint64_chunk15()
				end
			end

			local nProtos = nextvarint_chunk17() - __PROTO_BIAS__
			local Protos = newarray_chunk05(nProtos)
			regscratch_chunk06 = newarray_chunk05(nProtos * 3)

			for I = 1, nProtos do
				Protos[I] = readproto_chunk26()
			end

			for I = 1, #regscratch_chunk06, 3 do
				regscratch_chunk06[I][regscratch_chunk06[I + 1]] = Protos[regscratch_chunk06[I + 2]]
			end;

			if constcached_chunk22 then
				sidestack_chunk10[3] = constcache_chunk18_direct
				sidestack_chunk10[1] = Protos;
			end

			constcache_chunk18_direct = nil

			local rootIdx = nextvarint_chunk17()
			local res = Protos[rootIdx]

			regscratch_chunk06 = nil
			constcached_chunk22, instdecode_chunk22 = nil;

			return res
		end)
`;

const LVM_CHUNK_28 = `
		local blobcoder_chunk28 = (function(blob)
			blob = string.gsub(blob, 'z', '!!!!!')
			local Chars = {}
			for Char = 0, 255 do
				Chars[Char] = string.char(Char)
			end
			return string.gsub(blob, '.....', setmetatable({}, {
				__index = function(t, key)
					local a, b, c, d, e = string.byte(key, 1, 5)
					local Tuple = ((e - 33) + (d - 33) * 85 + (c - 33) * 7225 + (b - 33) * 614125 + (a - 33) * 52200625)
					a = Tuple % 256
					Tuple = (Tuple - a) / 256
					b = Tuple % 256
					Tuple = (Tuple - b) / 256
					c = Tuple % 256
					Tuple = (Tuple - c) / 256
					d = Tuple % 256
					local Value = Chars[d] .. Chars[c] .. Chars[b] .. Chars[a]
					t[key] = Value
					return Value
				end
			}))
		end)
`;

const LVM_CHUNK_29 = `
local tail_chunk29 = function(...)
			return (...)()
		end
`;

const LVM_CHUNK_30 = `
		local data_chunk30 = deserialize_chunk27()
`;

const LVM_CHUNK_32 = `
		local sealkey_chunk32 = function(pc)
			return (pc * __SEAL_MUL__ + __SEAL_ADD__) % 64
		end
`;

const LVM_CHUNK_31 = `
		local bootstrap_chunk31 = main_chunk24
		return function(...)
			return bootstrap_chunk31(
				data_chunk30,
				upvals_chunk09
			)(
				string.char,
				...
			)
		end
`;

const LVM_CHUNK_34 = `
		local signature_chunk34 = "This file Was Protected By Xrings"
`;

const LVM_CHUNK_35 = `
		local brand_chunk35 = "Xrings Was Here"
`;

const CHUNK_META = [
  { id: 0, name: 'safecall_chunk00', src: LVM_CHUNK_00, declares: ['safecall_chunk00'], refs: [] },
  { id: 1, name: 'cursor_chunk01', src: LVM_CHUNK_01, declares: ['cursor_chunk01'], refs: [] },
  { id: 2, name: 'voidtbl_chunk02', src: LVM_CHUNK_02, declares: ['voidtbl_chunk02'], refs: [] },
  { id: 3, name: 'indirect_chunk03', src: LVM_CHUNK_03, declares: ['indirect_chunk03'], refs: [] },
  { id: 4, name: 'unpackrange_chunk04', src: LVM_CHUNK_04, declares: ['unpackrange_chunk04'], refs: [] },
  { id: 5, name: 'newarray_chunk05', src: LVM_CHUNK_05, declares: ['newarray_chunk05'], refs: [] },
  { id: 6, name: 'regscratch_chunk06', src: LVM_CHUNK_06, declares: ['regscratch_chunk06'], refs: [] },
  { id: 7, name: 'bigbase_chunk07', src: LVM_CHUNK_07, declares: ['bigbase_chunk07'], refs: [] },
  { id: 8, name: 'blob_chunk08', src: LVM_CHUNK_08, declares: ['blob_chunk08'], refs: [] },
  { id: 9, name: 'upvals_chunk09', src: LVM_CHUNK_09, declares: ['upvals_chunk09'], refs: [] },
  { id: 10, name: 'sidestack_chunk10', src: LVM_CHUNK_10, declares: ['sidestack_chunk10'], refs: [] },
  { id: 11, name: 'signedmax_chunk11', src: LVM_CHUNK_11, declares: ['signedmax_chunk11'], refs: [] },
  { id: 12, name: 'extract_chunk12', src: LVM_CHUNK_12, declares: ['extract_chunk12'], refs: [] },
  { id: 13, name: 'nextbyte_chunk13', src: LVM_CHUNK_13, declares: ['nextbyte_chunk13'], refs: ['blob_chunk08', 'cursor_chunk01'] },
  { id: 14, name: 'nextint_chunk14', src: LVM_CHUNK_14, declares: ['nextint_chunk14'], refs: ['blob_chunk08', 'cursor_chunk01'] },
  { id: 15, name: 'nextint64_chunk15', src: LVM_CHUNK_15, declares: ['nextint64_chunk15'], refs: ['nextint_chunk14', 'signedmax_chunk11', 'bigbase_chunk07'] },
  { id: 16, name: 'nextfloat_chunk16', src: LVM_CHUNK_16, declares: ['nextfloat_chunk16'], refs: ['blob_chunk08', 'cursor_chunk01'] },
  { id: 17, name: 'nextvarint_chunk17', src: LVM_CHUNK_17, declares: ['nextvarint_chunk17'], refs: ['blob_chunk08', 'cursor_chunk01'] },
  { id: 18, name: 'constcache_chunk18', src: LVM_CHUNK_18, declares: ['constcache_chunk18_direct'], refs: [] },
  { id: 19, name: 'readvarint_chunk19', src: LVM_CHUNK_19, declares: ['readvarint_chunk19'], refs: ['nextvarint_chunk17'] },
  { id: 20, name: 'nextstring_chunk20', src: LVM_CHUNK_20, declares: ['nextstring_chunk20'], refs: ['nextvarint_chunk17', 'blob_chunk08', 'cursor_chunk01'] },
  { id: 21, name: 'packargs_chunk21', src: LVM_CHUNK_21, declares: ['packargs_chunk21'], refs: ['voidtbl_chunk02'] },
  { id: 22, name: 'constcached_chunk22', src: LVM_CHUNK_22, declares: ['constcached_chunk22', 'instdecode_chunk22'], refs: [] },
  { id: 23, name: 'main_fwd_chunk23', src: LVM_CHUNK_23, declares: ['main_chunk24'], refs: [] },
  {
    id: 24, name: 'main_chunk24', src: LVM_CHUNK_24, assigns: ['main_chunk24'],
    refs: [
      'main_chunk24', 'newarray_chunk05', 'packargs_chunk21', 'safecall_chunk00',
      'unpackrange_chunk04', 'sealkey_chunk32',
      // The __OPCODE_DISPATCH__ placeholder expands to dispatch + junk that
      // reads blob_chunk08. The Loop must be *defined* after the
      // `local blob_chunk08` declaration, otherwise its junk upvalue misses
      // the local and reads a nil global (seed-dependent topo order).
      'blob_chunk08',
    ],
  },
  { id: 25, name: 'blob_assign_chunk25', src: LVM_CHUNK_25, assigns: ['blob_chunk08'], refs: ['blob_chunk08'] },
  {
    id: 26, name: 'readproto_chunk26', src: LVM_CHUNK_26, declares: ['readproto_chunk26'],
    refs: [
      'nextvarint_chunk17', 'newarray_chunk05', 'instdecode_chunk22', 'readvarint_chunk19',
      'constcache_chunk18_direct', 'regscratch_chunk06', 'sealkey_chunk32', 'nextint_chunk14',
    ],
  },
  {
    id: 27, name: 'deserialize_chunk27', src: LVM_CHUNK_27, declares: ['deserialize_chunk27'],
    refs: [
      'instdecode_chunk22', 'nextvarint_chunk17', 'constcache_chunk18_direct', 'newarray_chunk05',
      'nextbyte_chunk13', 'nextfloat_chunk16', 'nextint64_chunk15', 'readproto_chunk26',
      'regscratch_chunk06', 'sidestack_chunk10', 'constcached_chunk22',
    ],
  },
  { id: 28, name: 'blobcoder_chunk28', src: LVM_CHUNK_28, declares: ['blobcoder_chunk28'], refs: [] },
  { id: 29, name: 'tail_chunk29', src: LVM_CHUNK_29, declares: ['tail_chunk29'], refs: [] },
  { id: 30, name: 'data_chunk30', src: LVM_CHUNK_30, declares: ['data_chunk30'], refs: ['deserialize_chunk27', 'blob_chunk08'] },
  { id: 32, name: 'sealkey_chunk32', src: LVM_CHUNK_32, declares: ['sealkey_chunk32'], refs: [] },
  {
    id: 31, name: 'bootstrap_chunk31', src: LVM_CHUNK_31, pinLast: true,
    declares: ['bootstrap_chunk31'],
    refs: [
      'main_chunk24', 'data_chunk30', 'upvals_chunk09', 'deserialize_chunk27',
      'indirect_chunk03', 'tail_chunk29', 'nextfloat_chunk16', 'nextbyte_chunk13',
      'nextint_chunk14', 'bootstrap_chunk31',
    ],
  },
  { id: 34, name: 'signature_chunk34', src: LVM_CHUNK_34, declares: ['signature_chunk34'], refs: [] },
  { id: 35, name: 'brand_chunk35', src: LVM_CHUNK_35, declares: ['brand_chunk35'], refs: [] },
];
function getChunks() {
  return CHUNK_META.map((c) => ({ ...c, src: c.src }));
}

module.exports = {
  CHUNK_META,
  getChunks,
  LVM_CHUNK_00, LVM_CHUNK_01, LVM_CHUNK_02, LVM_CHUNK_03, LVM_CHUNK_04,
  LVM_CHUNK_05, LVM_CHUNK_06, LVM_CHUNK_07, LVM_CHUNK_08, LVM_CHUNK_09,
  LVM_CHUNK_10, LVM_CHUNK_11, LVM_CHUNK_12, LVM_CHUNK_13, LVM_CHUNK_14,
  LVM_CHUNK_15, LVM_CHUNK_16, LVM_CHUNK_17, LVM_CHUNK_18, LVM_CHUNK_19,
  LVM_CHUNK_20, LVM_CHUNK_21, LVM_CHUNK_22, LVM_CHUNK_23, LVM_CHUNK_24,
  LVM_CHUNK_25, LVM_CHUNK_26, LVM_CHUNK_27, LVM_CHUNK_28, LVM_CHUNK_29,
  LVM_CHUNK_30, LVM_CHUNK_31, LVM_CHUNK_32, LVM_CHUNK_34, LVM_CHUNK_35,
};
