// Dev helper: dump the statement groups that addForDispatchSplit emits for a
// chosen source function, in source order, so we can check dispatch ordering.
const { ObjectSplitEngine } = require('../Factorizer/TableObjectmethod/ObjectSplit');
const { printAst } = require('../Factorizer/core/Printer');
const { obfuscate } = require('../VM/Virtualization');
const fs = require('fs');

const proto = ObjectSplitEngine.prototype;
const want = process.argv[3] || 'nSlots';
const orig = proto.addForDispatchSplit;
proto.addForDispatchSplit = function (name, params, innerLocals, groups, vararg) {
  const text = groups
    .map((g, i) => {
      const chunk = { type: 'Chunk', body: g };
      let src;
      try { src = printAst(chunk, () => 0.5); } catch (e) { src = '<print error ' + e.message + '>'; }
      return `-- group ${i}\n${src}`;
    })
    .join('\n');
  if (text.indexOf(want) >= 0) {
    fs.writeFileSync(`/tmp/groups_${name}.lua`, text);
    console.log(`wrote /tmp/groups_${name}.lua (${groups.length} groups)`);
  }
  return orig.call(this, name, params, innerLocals, groups, vararg);
};
const src = fs.readFileSync(process.argv[2], 'utf8');
obfuscate(src, { filename: 'in.lua', seed: 1 });
