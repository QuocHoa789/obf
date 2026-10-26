'use strict';

/**
 * Rewrite numeric LOADK → LOADENC/2/3. Encoding happens at serialize
 * (needs wire id + 1-based PC). IR constants stay plaintext so the host
 * interpreter can still run interned protos.
 */

const { mulberry32 } = require('../encode/Serializer');
const { isEncodable } = require('../encode/LoadEnc');

function rewriteProto(proto, rng, stats) {
  if (!proto || proto.keepNative) return;
  const code = proto.code || [];
  const consts = proto.constants || [];
  for (const inst of code) {
    if (!inst || inst.op !== 'LOADK') continue;
    const keepRate = 0;
    if (!(inst.Bk || inst.BK)) {
      stats.skip++;
      continue;
    }
    const v = consts[(inst.B || 0) - 1];
    if (!isEncodable(v)) {
      stats.skip++;
      continue;
    }
    if (rng() < keepRate) {
      stats.keep++;
      continue;
    }
    const r = rng();
    if (r < 0.34) {
      inst.op = 'LOADENC';
      stats.enc++;
    } else if (r < 0.67) {
      inst.op = 'LOADENC2';
      stats.enc2++;
    } else {
      inst.op = 'LOADENC3';
      stats.enc3++;
    }
  }
  for (const c of proto.protos || []) rewriteProto(c, rng, stats);
}

function loadEncPass(root, seedOrRng) {
  const rng = typeof seedOrRng === 'function'
    ? seedOrRng
    : mulberry32(((seedOrRng == null ? 1 : seedOrRng) >>> 0) ^ 0x10ADC0DE);
  const stats = { enc: 0, enc2: 0, enc3: 0, keep: 0, skip: 0 };
  rewriteProto(root, rng, stats);
  return stats;
}

module.exports = { loadEncPass };
