// Dev helper: dump (a) the rewritten statement list and (b) the grouped
// statement list that addForDispatchSplit consumes, for the function whose
// body mentions `want`. Used to verify grouping preserves order/content.
const { ObjectSplitEngine } = require('../Factorizer/TableObjectmethod/ObjectSplit');
const { printAst } = require('../Factorizer/core/Printer');
const { obfuscate } = require('../VM/Virtualization');
const fs = require('fs');

const P = ObjectSplitEngine.prototype;
const want = process.argv[3] || 'nSlots';
const pr = (stats) => stats.map((s, i) => `-- [${i}]\n` + printAst({ type: 'Chunk', body: [s] }, () => 0.5)).join('\n');
const origSplit = P.splitAndAdd;
P.splitAndAdd = function (fn) {
  let text = '';
  try { text = printAst({ type: 'Chunk', body: fn.body }, () => 0.5); } catch (e) { text = ''; }
  if (text.indexOf(want) >= 0) {
    fs.writeFileSync('/tmp/split_src.lua', pr(fn.body));
    console.log('source stats:', fn.body.length, 'params:', fn.params.length, '-> /tmp/split_src.lua');
  }
  return origSplit.call(this, fn);
};
const origGroup = P.groupStats;
const origAdd = P.addForDispatchSplit;
P.groupStats = function (stats) {
  const text = stats.map((s) => printAst({ type: 'Chunk', body: [s] }, () => 0.5)).join('\n');
  if (text.indexOf(want) >= 0) {
    fs.writeFileSync('/tmp/split_in.lua', pr(stats));
    console.log('rewritten stats:', stats.length, '-> /tmp/split_in.lua');
  }
  return origGroup.call(this, stats);
};
P.addForDispatchSplit = function (name, params, innerLocals, groups, vararg) {
  const flat = [];
  groups.forEach((g, gi) => g.forEach((s) => flat.push(`-- group ${gi}\n` + printAst({ type: 'Chunk', body: [s] }, () => 0.5))));
  const text = flat.join('\n');
  if (text.indexOf(want) >= 0) {
    fs.writeFileSync('/tmp/split_groups.lua', flat.join('\n'));
    console.log('groups:', groups.length, 'stats:', flat.length, '-> /tmp/split_groups.lua');
  }
  return origAdd.call(this, name, params, innerLocals, groups, vararg);
};
const src = fs.readFileSync(process.argv[2], 'utf8');
obfuscate(src, { filename: 'in.lua', seed: 1 });
