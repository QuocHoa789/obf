local function fact(n)
  if n == 0 then return 1 end
  return n * fact(n - 1)
end

local o = { v = 3, name = "xring" }
function o:get()
  return self.v
end
function o:greet(who)
  return string.sub(self.name, 1, 2) .. ":" .. who
end

local acc = 0
for i = 1, 8 do
  acc = acc + i
end

local t = { 10, 20, 30 }
for i, v in ipairs(t) do
  acc = acc + v
end

print(fact(5))
print(o:get())
print(o:greet("hi"))
print(acc)
print(math.floor(3.9))
print(string.sub("hello", 2, 4))
