local ok, err = xpcall(function() return require("./d20k_debug") end, function(e) return debug.traceback(tostring(e), 2) end)
print("OK:", ok)
print(err)
