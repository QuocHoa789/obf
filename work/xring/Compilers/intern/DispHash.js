'use strict';

/**
 * Canonical FNV-1a of every VM handler body. Compile and load must agree.
 * Mismatch poisons I[regionKey] (guest REGION_DEC only — filler prefix still
 * runs) so ciphertext never opens. Mix into XOR still uses the compile-time
 * hash; the intern slot is what goes stale.
 */

const { HANDLERS } = require('../../VM/Handlers');

function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function hashHandlerBodies(handlers) {
  const list = (handlers || HANDLERS).slice().sort((a, b) => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return a.canonicalId - b.canonicalId;
  });
  let h = 2166136261;
  for (const x of list) {
    const body = typeof x.emitBody === 'function' ? x.emitBody() : '';
    const s = String(x.name) + '\n' + String(x.canonicalId) + '\n' + String(body);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  // Keep inside signed 31-bit so intern prefix LOADK is LOADENC-encodable.
  return (h >>> 1) || 1;
}

module.exports = { fnv1a, hashHandlerBodies };
