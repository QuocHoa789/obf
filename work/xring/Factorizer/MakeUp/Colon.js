'use strict';

/**
 * Xrings colon-call convention:
 *
 *   methods  →  t:fn(...)   or  (t):fn(...)   (~30% paren)
 *   aliases  →  t.K  t.nS                     (dot, never colon)
 *
 * First arg after self is DATA, not a dummy env / extra self.
 * ~half of *data-only* helpers print `function(t,t,…)` — second t *is* the
 * data arg. Callers stay `t:foo(l, extra)`, never `t:foo(t, l)`.
 */

const { ident, paren, mcall, SELF } = require('../core/Ast');

const COLON_PAREN = 0.32;

function zSelf(rng, p) {
  const rate = p == null ? COLON_PAREN : p;
  if (rng && rng() < rate) return paren(ident(SELF));
  return ident(SELF);
}

function zcall(method, args, rng) {
  return mcall(zSelf(rng), method, args || []);
}

function isZIdent(node) {
  return node && node.type === 'Identifier' && node.name === SELF;
}

module.exports = { COLON_PAREN, zSelf, zcall, isZIdent, SELF };