'use strict';

/**
 * LOADENC family: integer constants encoded with (wire id, PC) through a
 * per-seed shuffled bit32 vtable (Luraph h[30] class).
 *
 * k is derived in 4–6 rounds; each round applies vtable[(offset+r)%6] and
 * mixes the opcode wire into the mix. Final step is XOR so encode/decode
 * stay inverses regardless of band/rotate in the key schedule.
 *
 * Decode must match VM handlers (h.bt[i] + h.x) bit-for-bit.
 */

const LOADENC_OPS = ['LOADENC', 'LOADENC2', 'LOADENC3'];
const BITOPS = ['band', 'bxor', 'bor', 'bnot', 'lrotate', 'rrotate'];

function u32(n) {
  return n >>> 0;
}

function i32(n) {
  return n | 0;
}

function rotl(a, n) {
  n &= 31;
  a = u32(a);
  if (n === 0) return a;
  return u32((a << n) | (a >>> (32 - n)));
}

function rotr(a, n) {
  n &= 31;
  a = u32(a);
  if (n === 0) return a;
  return u32((a >>> n) | (a << (32 - n)));
}

function applyOp(name, a, b) {
  a = u32(a);
  b = u32(b);
  switch (name) {
    case 'band': return a & b;
    case 'bor': return a | b;
    case 'bxor': return a ^ b;
    case 'bnot': return (~a) >>> 0;
    case 'lrotate': return rotl(a, b);
    case 'rrotate': return rotr(a, b);
    default: return a ^ b;
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeEncPerm(seed) {
  const rng = mulberry32(((seed == null ? 1 : seed) >>> 0) ^ 0xB1732D32);
  const p = BITOPS.slice();
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  return p;
}

function variantOf(op) {
  if (op === 'LOADENC2') return 2;
  if (op === 'LOADENC3') return 3;
  return 1;
}

function isLoadencOp(op) {
  return op === 'LOADENC' || op === 'LOADENC2' || op === 'LOADENC3';
}

function isEncodable(v) {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && Math.abs(v) <= 0x7FFFFFFF;
}

function roundsOf(variant) {
  if (variant === 2) return 5;
  if (variant === 3) return 6;
  return 4;
}

function offsetOf(variant) {
  if (variant === 2) return 2;
  if (variant === 3) return 4;
  return 0;
}

function mix(c, p, round, variant) {
  const r = (round + 1) >>> 0;
  c = u32(c);
  p = u32(p);
  // FNV-ish avalanche so consecutive PC / nearby wires cannot share k
  // (band/bor of linear mixes collided: LOADENC3 wire=3 pc=12 vs 13).
  const av = p * 16777619 + c * 2246822519 + r * 3266489917;
  if (variant === 2) return u32(c * (64 + r) + p * (4 + r) + r * 17 + av);
  if (variant === 3) return u32(p * (17 + r) + c * (9 + r * 3) + r + av);
  return u32(c + p * (32 + r) + c * (8 + r) + r * 13 + av);
}

function mixLua(round, variant) {
  const r = round + 1;
  const av = `p * 16777619 + c * 2246822519 + ${r} * 3266489917`;
  if (variant === 2) return `c * ${64 + r} + p * ${4 + r} + ${r * 17} + ${av}`;
  if (variant === 3) return `p * ${17 + r} + c * ${9 + r * 3} + ${r} + ${av}`;
  return `c + p * ${32 + r} + c * ${8 + r} + ${r * 13} + ${av}`;
}

function keyOf(wire, pc, variant, perm) {
  perm = perm && perm.length ? perm : BITOPS;
  const rounds = roundsOf(variant);
  const off = offsetOf(variant);
  const c = u32(wire);
  const p = u32(pc);
  let k = 0;
  for (let r = 0; r < rounds; r++) {
    const op = perm[(off + r) % perm.length];
    k = applyOp(op, k, mix(c, p, r, variant));
  }
  return u32(k);
}

function encodeLoadenc(n, wire, pc, op, perm) {
  const k = keyOf(wire, pc, variantOf(op), perm);
  return u32(i32(n) ^ k);
}

function decodeLoadenc(enc, wire, pc, op, perm) {
  const k = keyOf(wire, pc, variantOf(op), perm);
  return i32(u32(enc) ^ k);
}

function luaDecodeBody(variant) {
  const rounds = roundsOf(variant);
  const off = offsetOf(variant);
  const lines = [
    'local c, p, n = Opcode, PC, RegB[PC]',
    'local bt, k = h.bt, 0',
  ];
  for (let r = 0; r < rounds; r++) {
    const slot = (off + r) % 6 + 1;
    lines.push(`k = bt[${slot}](k, ${mixLua(r, variant)})`);
  }
  lines.push('n = h.x(n, k)');
  lines.push('if n >= 2147483648 then n = n - 4294967296 end');
  lines.push('F[RegA[PC]] = n');
  return lines.join('\n');
}

const OP_WRAP = {
  band: `function(a, b)
		return bit32.band(tonumber(a) or 0, tonumber(b) or 0)
	end`,
  bxor: `function(a, b)
		return bit32.bxor(tonumber(a) or 0, tonumber(b) or 0)
	end`,
  bor: `function(a, b)
		return bit32.bor(tonumber(a) or 0, tonumber(b) or 0)
	end`,
  bnot: `function(a, b)
		return bit32.bnot(tonumber(a) or 0)
	end`,
  lrotate: `function(a, b)
		return h.rl(a, b)
	end`,
  rrotate: `function(a, b)
		return h.rr(a, b)
	end`,
};

function luaVtableFill(perm) {
  perm = perm && perm.length === 6 ? perm : BITOPS;
  const slots = perm.map((name, i) => `\t[${i + 1}] = ${OP_WRAP[name]},`).join('\n');
  return `h.rl = function(a, n)
	a = bit32.band(tonumber(a) or 0, 4294967295)
	n = bit32.band(tonumber(n) or 0, 31)
	if n == 0 then return a end
	return bit32.band(bit32.bor(bit32.lshift(a, n), bit32.rshift(a, 32 - n)), 4294967295)
end
h.rr = function(a, n)
	a = bit32.band(tonumber(a) or 0, 4294967295)
	n = bit32.band(tonumber(n) or 0, 31)
	if n == 0 then return a end
	return bit32.band(bit32.bor(bit32.rshift(a, n), bit32.lshift(a, 32 - n)), 4294967295)
end
h.bt = {
${slots}
}
`;
}

function pickHFields(rng) {
  rng = rng || Math.random;
  const used = new Set(['h', 'x', 'b', 'a', 'n']);
  const alphabet = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const pick = () => {
    for (let i = 0; i < 400; i++) {
      const n = alphabet[Math.floor(rng() * alphabet.length)];
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
    return 'q';
  };
  return { rl: pick(), rr: pick(), bt: pick() };
}

function applyHFields(src, names) {
  if (!src || !names) return src;
  return String(src)
    .replace(/\bh\.rl\b/g, 'h.' + names.rl)
    .replace(/\bh\.rr\b/g, 'h.' + names.rr)
    .replace(/\bh\.bt\b/g, 'h.' + names.bt);
}

module.exports = {
  LOADENC_OPS,
  BITOPS,
  isLoadencOp,
  isEncodable,
  variantOf,
  keyOf,
  encodeLoadenc,
  decodeLoadenc,
  makeEncPerm,
  luaDecodeBody,
  luaVtableFill,
  pickHFields,
  applyHFields,
};
