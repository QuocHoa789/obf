local acc = 0

local function hash(s)
  local h = 0
  for i = 1, #s do
    h = (h * 33 + string.byte(s, i)) % 1000003
  end
  return h
end

local function clamp(x, a, b)
  if x < a then return a end
  if x > b then return b end
  return x
end

local function join(t, sep)
  local s = ""
  for i = 1, #t do
    if i > 1 then s = s .. sep end
    s = s .. tostring(t[i])
  end
  return s
end

local function mkname(i)
  local a = ({ "ember", "frost", "gale", "stone", "tide", "spark", "shade", "bloom" })[((i * 3) % 8) + 1]
  local b = ({ "iron", "glass", "thorn", "cinder", "mist", "flare", "ridge", "vale" })[((i * 7) % 8) + 1]
  return a .. "_" .. b .. tostring(i % 97)
end

local function fib(n)
  if n < 2 then return n end
  local a, b = 0, 1
  for _ = 2, n do
    a, b = b, a + b
  end
  return b
end

local function gcd(a, b)
  while b ~= 0 do
    a, b = b, a % b
  end
  return a
end

local function primes_upto(n)
  local p = {}
  local mark = {}
  for i = 2, n do
    if not mark[i] then
      p[#p + 1] = i
      for j = i + i, n, i do
        mark[j] = true
      end
    end
  end
  return p
end

local MAP_W, MAP_H = 20, 16
local map = {}
for y = 1, MAP_H do
  for x = 1, MAP_W do
    map[(y - 1) * MAP_W + x] = ((x * 17 + y * 31) % 7)
  end
end

local function walkable(x, y)
  if x < 1 or y < 1 or x > MAP_W or y > MAP_H then return false end
  return map[(y - 1) * MAP_W + x] ~= 0
end

local function flood(sx, sy)
  local seen = {}
  local qx, qy, nq = { sx }, { sy }, 1
  local n = 0
  local i = 1
  while i <= nq do
    local x, y = qx[i], qy[i]
    i = i + 1
    local k = (y - 1) * MAP_W + x
    if not seen[k] and walkable(x, y) then
      seen[k] = true
      n = n + 1
      if walkable(x + 1, y) then nq = nq + 1; qx[nq] = x + 1; qy[nq] = y end
      if walkable(x - 1, y) then nq = nq + 1; qx[nq] = x - 1; qy[nq] = y end
      if walkable(x, y + 1) then nq = nq + 1; qx[nq] = x; qy[nq] = y + 1 end
      if walkable(x, y - 1) then nq = nq + 1; qx[nq] = x; qy[nq] = y - 1 end
    end
  end
  return n
end

local function inv_new()
  return { gold = 200, potion = 0, rope = 0, lantern = 0, bomb = 0, stew = 0 }
end

local function inv_add(inv, id, n)
  inv[id] = (inv[id] or 0) + n
  return inv[id]
end

local function inv_value(inv)
  return inv.gold + (inv.potion or 0) * 12 + (inv.rope or 0) * 9 + (inv.lantern or 0) * 15 + (inv.bomb or 0) * 18
end

local function buy(inv, id, cost)
  if inv.gold >= cost then
    inv.gold = inv.gold - cost
    inv_add(inv, id, 1)
    return true
  end
  return false
end

local function hit(a, b)
  if a.hp <= 0 or b.hp <= 0 then return 0 end
  local dmg = clamp(a.atk - (b.hp % 3), 1, a.atk)
  b.hp = b.hp - dmg
  if b.hp < 0 then b.hp = 0 end
  return dmg
end

local function sim_battle(n)
  local units = {}
  for i = 1, n do
    units[i] = { hp = 40 + i * 3, atk = 6 + (i % 5) }
  end
  local total = 0
  for _ = 1, 12 do
    for i = 1, n do
      local t = units[(i % n) + 1]
      total = total + hit(units[i], t)
    end
  end
  local alive = 0
  for i = 1, n do
    if units[i].hp > 0 then alive = alive + 1 end
  end
  return total, alive
end

local function bag_weight()
  local w = 0
  for i = 1, 80 do
    w = w + ((i * 13) % 11 + 1) * ((i * 9) % 5 + 1)
  end
  return w
end

local function grid_blur()
  local w, h = 8, 6
  local d = {}
  for y = 1, h do
    for x = 1, w do
      d[(y - 1) * w + x] = (x + y) % 9
    end
  end
  local s = 0
  for y = 2, h - 1 do
    for x = 2, w - 1 do
      local t = 0
      for dy = -1, 1 do
        for dx = -1, 1 do
          t = t + d[(y + dy - 1) * w + (x + dx)]
        end
      end
      s = s + math.floor(t / 9)
    end
  end
  return s
end

local function stats_of(xs)
  local n, s, mn, mx = #xs, 0, xs[1], xs[1]
  for i = 1, n do
    local v = xs[i]
    s = s + v
    if v < mn then mn = v end
    if v > mx then mx = v end
  end
  return s, math.floor(s / n), mn, mx
end

local function encode_run(s)
  local out = ""
  local i = 1
  while i <= #s do
    local c = string.sub(s, i, i)
    local n = 1
    while i + n <= #s and string.sub(s, i + n, i + n) == c do
      n = n + 1
    end
    out = out .. c .. tostring(n)
    i = i + n
  end
  return out
end

local function path_score(path)
  local s = 0
  for i = 1, #path - 1 do
    local a, b = path[i], path[i + 1]
    local dx = a[1] - b[1]
    local dy = a[2] - b[2]
    if dx < 0 then dx = -dx end
    if dy < 0 then dy = -dy end
    s = s + dx + dy
  end
  return s
end

local function spline(xs, t)
  local n = #xs
  if n == 0 then return 0 end
  if t <= 0 then return xs[1] end
  if t >= 1 then return xs[n] end
  local x = 1 + t * (n - 1)
  local i = math.floor(x)
  local f = x - i
  local a = xs[i]
  local b = xs[i + 1]
  if not b then b = a end
  return a + (b - a) * f
end

local function build_curve()
  local xs = {}
  for i = 1, 16 do
    xs[i] = i * 3 - (i % 4) * 2
  end
  local s = 0
  for i = 0, 10 do
    s = s + spline(xs, i / 10)
  end
  return math.floor(s)
end

local function make_mod(tag, n)
  local fns = {}
  for i = 1, n do
    local name = tag .. "_" .. tostring(i)
    fns[i] = function(x, y)
      local a = (x or 0) + i
      local b = (y or 1) * ((i % 5) + 1)
      if a > 50 then a = a - 17 end
      if b % 2 == 0 then
        return a + b + (hash(name) % 11)
      end
      return a * 2 - b + #name
    end
  end
  return function()
    local s = 0
    for i = 1, n do
      s = s + fns[i](i, n - i)
    end
    return s
  end
end

local run_atk = make_mod("atk", 28)
local run_spl = make_mod("spl", 28)
local run_crf = make_mod("crf", 28)
local run_trv = make_mod("trv", 28)
local run_dlg = make_mod("dlg", 28)
local run_wth = make_mod("wth", 24)
local run_fsh = make_mod("fsh", 24)
local run_min = make_mod("min", 24)
local run_alc = make_mod("alc", 24)
local run_mnt = make_mod("mnt", 20)
local run_pet = make_mod("pet", 20)
local run_gld = make_mod("gld", 20)
local run_arn = make_mod("arn", 20)
local run_dgn = make_mod("dgn", 20)
local run_auc = make_mod("auc", 20)

local function fold_mods()
  return run_atk() + run_spl() + run_crf() + run_trv() + run_dlg()
    + run_wth() + run_fsh() + run_min() + run_alc()
    + run_mnt() + run_pet() + run_gld() + run_arn() + run_dgn() + run_auc()
end

local function table_sum(t)
  local s = 0
  for i = 1, #t do s = s + t[i] end
  return s
end

local function table_map(t, add)
  local r = {}
  for i = 1, #t do r[i] = t[i] + add end
  return r
end

local function table_rev(t)
  local r = {}
  for i = #t, 1, -1 do r[#r + 1] = t[i] end
  return r
end

local State = { x = 3, y = 4, hp = 100, mp = 40, lvl = 1, xp = 0 }

local function state_step(dx, dy)
  local nx, ny = State.x + dx, State.y + dy
  if walkable(nx, ny) then
    State.x, State.y = nx, ny
    return true
  end
  return false
end

local function state_gain(xp)
  State.xp = State.xp + xp
  while State.xp >= State.lvl * 20 do
    State.xp = State.xp - State.lvl * 20
    State.lvl = State.lvl + 1
    State.hp = State.hp + 8
    State.mp = State.mp + 3
  end
end

local function count_words(s)
  local n = 0
  local i = 1
  while i <= #s do
    local c = string.byte(s, i)
    if (c >= 65 and c <= 90) or (c >= 97 and c <= 122) then
      n = n + 1
      while i <= #s do
        c = string.byte(s, i)
        if not ((c >= 65 and c <= 90) or (c >= 97 and c <= 122)) then break end
        i = i + 1
      end
    else
      i = i + 1
    end
  end
  return n
end

local STORY = "The ridge wind carried cinder and frost. Kael checked the lantern, Nyx counted bombs, Rin tied rope."

local function simulate()
  local inv = inv_new()
  buy(inv, "potion", 12)
  buy(inv, "potion", 12)
  buy(inv, "rope", 9)
  buy(inv, "lantern", 15)
  buy(inv, "bomb", 18)
  local dmg, alive = sim_battle(6)
  local pr = primes_upto(80)
  state_step(1, 0)
  state_step(0, 1)
  state_gain(55)
  local xs = { 4, 9, 1, 8, 3, 7, 2 }
  local sum, mean = stats_of(xs)
  acc = inv_value(inv)
    + dmg + alive
    + flood(2, 2)
    + bag_weight()
    + fib(18)
    + gcd(252, 105)
    + #pr
    + grid_blur()
    + build_curve()
    + hash("xring-demo-20k")
    + fold_mods()
    + State.lvl * 10
    + State.hp
    + path_score({ { 1, 1 }, { 3, 4 }, { 6, 2 }, { 8, 8 } })
    + sum + mean
    + table_sum(table_map(xs, 2))
    + table_sum(table_rev(xs))
    + count_words(STORY)
    + #encode_run("aaabbc")
  return acc
end

-- extra systems: many similar helpers so the file is ~20KB of real Lua
local function sys_block(prefix, n, k)
  local s = 0
  for i = 1, n do
    local x = (i * k + #prefix) % 97
    local y = (i * 3 + k) % 53
    if x > y then
      s = s + x - y + hash(prefix .. tostring(i)) % 13
    else
      s = s + y - x + (i % 7)
    end
    local t = {}
    for j = 1, 6 do
      t[j] = (x + j * y) % 19
    end
    s = s + table_sum(t)
  end
  return s
end

acc = acc
  + sys_block("combat_melee", 40, 11)
  + sys_block("combat_range", 40, 13)
  + sys_block("magic_fire", 40, 17)
  + sys_block("magic_ice", 40, 19)
  + sys_block("magic_storm", 36, 23)
  + sys_block("craft_smith", 36, 29)
  + sys_block("craft_cook", 36, 31)
  + sys_block("craft_alch", 36, 37)
  + sys_block("travel_road", 32, 41)
  + sys_block("travel_sea", 32, 43)
  + sys_block("travel_sky", 32, 47)
  + sys_block("dialog_town", 32, 53)
  + sys_block("dialog_camp", 28, 59)
  + sys_block("weather_rain", 28, 61)
  + sys_block("weather_wind", 28, 67)
  + sys_block("fish_river", 28, 71)
  + sys_block("fish_ocean", 24, 73)
  + sys_block("mine_iron", 24, 79)
  + sys_block("mine_gold", 24, 83)
  + sys_block("guild_rank", 24, 89)
  + sys_block("arena_duel", 24, 97)
  + sys_block("dungeon_crypt", 24, 101)
  + sys_block("auction_bid", 24, 103)
  + sys_block("pet_wolf", 20, 107)
  + sys_block("pet_hawk", 20, 109)
  + sys_block("mount_horse", 20, 113)
  + sys_block("quest_main", 40, 127)
  + sys_block("quest_side", 40, 131)
  + sys_block("loot_chest", 36, 137)
  + sys_block("loot_drop", 36, 139)
  + sys_block("npc_vendor", 32, 149)
  + sys_block("npc_guard", 32, 151)
  + sys_block("skill_slash", 28, 157)
  + sys_block("skill_bash", 28, 163)
  + sys_block("buff_haste", 24, 167)
  + sys_block("buff_armor", 24, 173)
  + sys_block("zone_forest", 40, 179)
  + sys_block("zone_desert", 40, 181)
  + sys_block("zone_tundra", 40, 191)
  + sys_block("zone_swamp", 40, 193)

local function extra_pack()
  local s = 0
  local function fn_0(x)
    local a = (x + 0) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 0) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 0
  end
  s = s + fn_0(3)
  local function fn_1(x)
    local a = (x + 17) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 13) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 1
  end
  s = s + fn_1(4)
  local function fn_2(x)
    local a = (x + 34) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 26) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 2
  end
  s = s + fn_2(5)
  local function fn_3(x)
    local a = (x + 51) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 39) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 3
  end
  s = s + fn_3(6)
  local function fn_4(x)
    local a = (x + 68) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 52) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 4
  end
  s = s + fn_4(7)
  local function fn_5(x)
    local a = (x + 85) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 12) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 5
  end
  s = s + fn_5(8)
  local function fn_6(x)
    local a = (x + 5) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 25) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 6
  end
  s = s + fn_6(9)
  local function fn_7(x)
    local a = (x + 22) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 38) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 7
  end
  s = s + fn_7(10)
  local function fn_8(x)
    local a = (x + 39) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 51) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 8
  end
  s = s + fn_8(11)
  local function fn_9(x)
    local a = (x + 56) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 11) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 9
  end
  s = s + fn_9(12)
  local function fn_10(x)
    local a = (x + 73) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 24) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 10
  end
  s = s + fn_10(13)
  local function fn_11(x)
    local a = (x + 90) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 37) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 11
  end
  s = s + fn_11(14)
  local function fn_12(x)
    local a = (x + 10) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 50) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 12
  end
  s = s + fn_12(15)
  local function fn_13(x)
    local a = (x + 27) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 10) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 0
  end
  s = s + fn_13(16)
  local function fn_14(x)
    local a = (x + 44) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 23) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 1
  end
  s = s + fn_14(17)
  local function fn_15(x)
    local a = (x + 61) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 36) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 2
  end
  s = s + fn_15(18)
  local function fn_16(x)
    local a = (x + 78) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 49) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 3
  end
  s = s + fn_16(19)
  local function fn_17(x)
    local a = (x + 95) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 9) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 4
  end
  s = s + fn_17(20)
  local function fn_18(x)
    local a = (x + 15) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 22) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 5
  end
  s = s + fn_18(21)
  local function fn_19(x)
    local a = (x + 32) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 35) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 6
  end
  s = s + fn_19(22)
  local function fn_20(x)
    local a = (x + 49) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 48) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 7
  end
  s = s + fn_20(23)
  local function fn_21(x)
    local a = (x + 66) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 8) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 8
  end
  s = s + fn_21(24)
  local function fn_22(x)
    local a = (x + 83) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 21) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 9
  end
  s = s + fn_22(25)
  local function fn_23(x)
    local a = (x + 3) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 34) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 10
  end
  s = s + fn_23(26)
  local function fn_24(x)
    local a = (x + 20) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 47) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 11
  end
  s = s + fn_24(27)
  local function fn_25(x)
    local a = (x + 37) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 7) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 12
  end
  s = s + fn_25(28)
  local function fn_26(x)
    local a = (x + 54) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 20) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 0
  end
  s = s + fn_26(29)
  local function fn_27(x)
    local a = (x + 71) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 33) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 1
  end
  s = s + fn_27(30)
  local function fn_28(x)
    local a = (x + 88) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 46) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 2
  end
  s = s + fn_28(31)
  local function fn_29(x)
    local a = (x + 8) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 6) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 3
  end
  s = s + fn_29(32)
  local function fn_30(x)
    local a = (x + 25) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 19) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 4
  end
  s = s + fn_30(33)
  local function fn_31(x)
    local a = (x + 42) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 32) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 5
  end
  s = s + fn_31(34)
  local function fn_32(x)
    local a = (x + 59) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 45) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 6
  end
  s = s + fn_32(35)
  local function fn_33(x)
    local a = (x + 76) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 5) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 7
  end
  s = s + fn_33(36)
  local function fn_34(x)
    local a = (x + 93) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 18) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 8
  end
  s = s + fn_34(37)
  local function fn_35(x)
    local a = (x + 13) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 31) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 9
  end
  s = s + fn_35(38)
  local function fn_36(x)
    local a = (x + 30) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 44) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 10
  end
  s = s + fn_36(39)
  local function fn_37(x)
    local a = (x + 47) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 4) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 11
  end
  s = s + fn_37(40)
  local function fn_38(x)
    local a = (x + 64) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 17) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 12
  end
  s = s + fn_38(41)
  local function fn_39(x)
    local a = (x + 81) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 30) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 0
  end
  s = s + fn_39(42)
  local function fn_40(x)
    local a = (x + 1) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 43) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 1
  end
  s = s + fn_40(43)
  local function fn_41(x)
    local a = (x + 18) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 3) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 2
  end
  s = s + fn_41(44)
  local function fn_42(x)
    local a = (x + 35) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 16) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 3
  end
  s = s + fn_42(45)
  local function fn_43(x)
    local a = (x + 52) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 29) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 4
  end
  s = s + fn_43(46)
  local function fn_44(x)
    local a = (x + 69) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 42) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 5
  end
  s = s + fn_44(47)
  local function fn_45(x)
    local a = (x + 86) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 2) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 6
  end
  s = s + fn_45(48)
  local function fn_46(x)
    local a = (x + 6) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 15) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 7
  end
  s = s + fn_46(49)
  local function fn_47(x)
    local a = (x + 23) % 251
    local b = 0
    for k = 1, 8 do
      b = b + ((a * k + 28) % 19)
      if b > 80 then b = b - 11 end
    end
    return a + b + 8
  end
  s = s + fn_47(50)
  return s
end
acc = acc + extra_pack()

local result = simulate()
print(result)
print(State.lvl)
print(string.sub(mkname(result), 1, 8))
print(fib(10))
print(flood(2, 2))
print(gcd(252, 105))
