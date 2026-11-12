'use strict';
/**
 * Optional Lua oracle for differential tests.
 *
 * Runs a Lua 5.1-flavoured source string on Fengari (a JavaScript Lua 5.3
 * runtime) and returns the captured `print` output normalised to Lua 5.1 /
 * Xring number formatting (Lua 5.3 prints `3.0`, Lua 5.1 prints `3`).
 *
 * Fengari is an OPTIONAL dev dependency: `npm install --no-save fengari`.
 * The obfuscator itself never requires this file.  When fengari is missing the
 * harness must report the affected checks as BLOCKED, never as PASS.
 */
let fengari = null;
try {
  fengari = require('fengari');
} catch (e) {
  fengari = null;
}

function available() {
  return !!fengari;
}

function normalizeNumberPrint(s) {
  // %.14g in 5.3 renders integral floats as `3.0`; 5.1 renders `3`.
  return s.replace(/(^|[^\w.])(-?\d+)\.0(?![\d.])/g, (m, p, d) => p + d);
}

function fmt(L, i) {
  const { lua, to_jsstring } = fengari;
  const t = lua.lua_type(L, i);
  const T = lua;
  if (t === T.LUA_TNIL) return 'nil';
  if (t === T.LUA_TBOOLEAN) return lua.lua_toboolean(L, i) ? 'true' : 'false';
  if (t === T.LUA_TNUMBER || t === T.LUA_TSTRING) {
    return normalizeNumberPrint(to_jsstring(lua.lua_tostring(L, i)));
  }
  if (t === T.LUA_TTABLE) return 'table';
  if (t === T.LUA_TFUNCTION) return 'function';
  return 'userdata';
}

function runLua(src, opts) {
  if (!fengari) return { ok: false, blocked: true, error: 'fengari not installed', printOut: [] };
  const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;
  const out = [];
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  lua.lua_pushjsfunction(L, (L2) => {
    const n = lua.lua_gettop(L2);
    const parts = [];
    for (let i = 1; i <= n; i++) parts.push(fmt(L2, i));
    out.push(parts.join('\t'));
    lua.lua_settop(L2, 0);
    return 0;
  });
  lua.lua_setglobal(L, to_luastring('print'));
  const t0 = Date.now();
  const st = lauxlib.luaL_loadstring(L, to_luastring(src));
  if (st !== lua.LUA_OK) {
    const err = to_jsstring(lua.lua_tostring(L, -1));
    return { ok: false, error: err, printOut: out, ms: Date.now() - t0 };
  }
  const call = lua.lua_pcall(L, 0, 0, 0);
  const ms = Date.now() - t0;
  if (call !== lua.LUA_OK) {
    return { ok: false, error: to_jsstring(lua.lua_tostring(L, -1)), printOut: out, ms };
  }
  return { ok: true, printOut: out, ms };
}

module.exports = { runLua, available, normalizeNumberPrint };
