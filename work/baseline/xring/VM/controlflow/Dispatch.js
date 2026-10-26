'use strict';

/**
 * Xrings / Luraph opcode + for-loop dispatch: nested range-if tree.
 *
 *   if J<mid then ... else if J>=... then ... else if J==... end
 *   if not(J<mid)then RIGHT else LEFT end     -- Birk inverted
 *   if J>=a and J<b then ARM end
 *   if not(J<next)then else ARM end           -- empty then, real in else
 *
 * Long chains binary-split so stacked `end`s stay at Xrings's ~7.
 * Short arms print as if/else if; printer mixes in ~30% `elseif`.
 */

const { unwrap, ident, bin, un, paren, ifStat, ifChain, bool, localStat, assign, brk, cont } = require('../../Factorizer/core/Ast');

const RELOPS = new Set(['<', '>', '<=', '>=', '==', '~=']);

function condIdent(cond) {
  cond = unwrap(cond);
  if (!cond || typeof cond !== 'object') return null;
  if (cond.type === 'UnaryExpression' && cond.op === 'not') return condIdent(cond.arg);
  if (cond.type !== 'BinaryExpression') return null;
  if (cond.op === 'and' || cond.op === 'or') {
    const a = condIdent(cond.left);
    const b = condIdent(cond.right);
    if (a && b && a === b) return a;
    return a || b;
  }
  if (!RELOPS.has(cond.op)) return null;
  const l = unwrap(cond.left);
  const r = unwrap(cond.right);
  if (l && l.type === 'Identifier' && r && r.type === 'NumericLiteral') return l.name;
  if (r && r.type === 'Identifier' && l && l.type === 'NumericLiteral') return r.name;
  return null;
}

function isRangeIfTree(node, name) {
  if (!node || node.type !== 'IfStatement') return false;
  const clauses = node.clauses || [];
  if (!clauses.length) return false;
  let id = name || condIdent(clauses[0].cond);
  if (!id) return false;
  for (const c of clauses) {
    const n = condIdent(c.cond);
    if (n && n !== id) return false;
  }
  const els = node.elseBody;
  if (!els || !els.length) return true;
  if (els.length === 1 && els[0].type === 'IfStatement') {
    return isRangeIfTree(els[0], id);
  }
  return true;
}

function isRangeDispatchBody(stats) {
  if (!stats || !stats.length) return false;
  const rest = [];
  for (const s of stats) {
    if (!s) continue;
    if (s.type === 'LocalStatement' || s.type === 'ReturnStatement' || s.type === 'BreakStatement' || s.type === 'ContinueStatement') continue;
    rest.push(s);
  }
  if (!rest.length) return false;
  if (rest.length === 1 && rest[0].type === 'IfStatement') return isRangeIfTree(rest[0]);
  if (rest.length === 1 && rest[0].type === 'ForNumericStatement') {
    return isRangeDispatchBody(rest[0].body);
  }
  if (rest.length === 1 && (rest[0].type === 'WhileStatement' || rest[0].type === 'RepeatStatement')) {
    return isRangeDispatchBody(rest[0].body);
  }
  return false;
}

function astWeight(node) {
  if (!node || typeof node !== 'object') return 0;
  if (Array.isArray(node)) return node.reduce((a, b) => a + astWeight(b), 0);
  let n = 1;
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'raw') continue;
    n += astWeight(node[k]);
  }
  return n;
}

function isFatLeaf(body) {
  if (!body || !body.length) return false;
  if (body.length > 1) return true;
  return astWeight(body) > 24;
}

function walkRangeLeaves(node, fn) {
  if (!node || node.type !== 'IfStatement') return node;
  const clauses = (node.clauses || []).map((c) => ({
    cond: c.cond,
    body: mapLeafBody(c.body, fn),
  }));
  let elseBody = node.elseBody;
  if (elseBody && elseBody.length) elseBody = mapLeafBody(elseBody, fn);
  return { type: 'IfStatement', clauses, elseBody };
}

function mapLeafBody(body, fn) {
  if (!body || !body.length) return body || [];
  if (body.length === 1 && body[0].type === 'IfStatement' && isRangeIfTree(body[0])) {
    return [walkRangeLeaves(body[0], fn)];
  }
  if (isFatLeaf(body)) return fn(body);
  return body;
}

function notRel(iter, op, bound, num) {
  return un('not', paren(bin(op, ident(iter), num(bound))));
}

function armCond(iter, gi, hits, start, step, num, chance) {
  const threshold = start + step * gi;
  const next = start + step * (gi + 1);
  if (chance(0.42)) return notRel(iter, '<', threshold, num);
  if (gi < hits - 1 && chance(0.28)) {
    return bin('and', bin('>=', ident(iter), num(threshold)), bin('<', ident(iter), num(next)));
  }
  if (chance(0.22) && threshold > 0) return bin('>', ident(iter), num(threshold - 1));
  return bin('>=', ident(iter), num(threshold));
}

function wrapFirst(iter, start, step, real, num, chance) {
  if (!chance(0.6)) return real;
  if (chance(0.4)) {
    return [ifStat(un('not', paren(bin('==', ident(iter), num(start)))), [], real)];
  }
  if (chance(0.35)) {
    return [ifStat(
      un('not', paren(un('not', paren(bin('~=', ident(iter), num(start)))))),
      [],
      real,
    )];
  }
  return [ifStat(notRel(iter, '<', start + step, num), [], real)];
}

/**
 * High-to-low range dispatch.
 * hits<=4 → short if-chain (printer mixes ~30% elseif).
 * hits>4  → binary `if J>=mid then HI else LO` so stacked `end`s stay ~7.
 */
function rangeIfHighToLow(iter, hits, start, step, armFn, num, host) {
  const chance = host && typeof host.chance === 'function'
    ? (p) => host.chance(p)
    : () => false;

  function range(lo, hi) {
    const n = hi - lo;
    if (n <= 0) return [];
    if (n === 1) {
      const body = armFn(lo);
      return lo === 0 ? wrapFirst(iter, start, step, body, num, chance) : body;
    }
    if (n <= 4) {
      const clauses = [];
      for (let gi = hi - 1; gi > lo; gi--) {
        clauses.push({
          cond: armCond(iter, gi, hits, start, step, num, chance),
          body: armFn(gi),
        });
      }
      const elseBody = lo === 0
        ? wrapFirst(iter, start, step, armFn(0), num, chance)
        : armFn(lo);
      return [ifChain(clauses, elseBody, false)];
    }
    const mid = lo + Math.floor(n / 2);
    const threshold = start + step * mid;
    const right = range(mid, hi);
    const left = range(lo, mid);
    const cond = chance(0.5)
      ? bin('>=', ident(iter), num(threshold))
      : notRel(iter, '<', threshold, num);
    return [ifStat(cond, right, left)];
  }

  if (hits <= 1) return armFn(0);
  return range(0, hits);
}

/** Luraph mix: ~30% numeric-for, ~45% while true, ~25% repeat until false. */
function pickLoopKind(host) {
  const chance = host && typeof host.chance === 'function' ? (p) => host.chance(p) : () => false;
  if (chance(0.30)) return 'for';
  if (chance(0.64)) return 'while';
  return 'repeat';
}

function advanceIter(iter, step) {
  return assign([ident(iter)], [bin('+', ident(iter), step)]);
}

/**
 * Wrap `body` (uses `iter`) in for / while true / repeat until false.
 * `onContinue` is prepended before `continue` in while/repeat (iter += step).
 */
function numericStateLoop(iter, start, stop, step, body, kind, opts) {
  opts = opts || {};
  if (kind === 'for') {
    return [{
      type: 'ForNumericStatement',
      name: iter,
      start,
      stop,
      step,
      body: body || [],
    }];
  }
  const init = localStat([iter], [start]);
  const tail = [
    ifStat(
      un('not', paren(bin('<', ident(iter), stop))),
      [brk()],
      [advanceIter(iter, step), cont()],
    ),
  ];
  const loopBody = (body || []).concat(opts.noTail ? [] : tail);
  if (kind === 'repeat') {
    return [init, { type: 'RepeatStatement', body: loopBody, cond: bool(false) }];
  }
  return [init, { type: 'WhileStatement', cond: bool(true), body: loopBody }];
}

module.exports = {
  condIdent,
  isRangeIfTree,
  isRangeDispatchBody,
  astWeight,
  isFatLeaf,
  walkRangeLeaves,
  rangeIfHighToLow,
  notRel,
  pickLoopKind,
  advanceIter,
  numericStateLoop,
};
