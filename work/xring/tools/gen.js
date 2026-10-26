// Dev helper: obfuscate a file with a given seed/option overrides.
//   node tools/gen.js <input.lua> <seed> '<json opts>' <out.lua>
const { obfuscate } = require('../VM/Virtualization');
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const opts = JSON.parse(process.argv[4] || '{}');
const r = obfuscate(src, { filename: 'in.lua', seed: Number(process.argv[3] || 1), ...opts });
fs.writeFileSync(process.argv[5] || '/tmp/out.lua', r.lua);
