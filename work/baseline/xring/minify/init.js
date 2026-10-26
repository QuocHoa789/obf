'use strict';

/*
 * Port of luasrcdiet init.lua (public API).
 */

const llex = require('./llex.js');
const lparser = require('./lparser.js');
const optlex = require('./optlex.js');
const optparser = require('./optparser.js');
const utils = require('./utils.js');

const merge = utils.merge;

function noop() {
  return;
}

function opts_to_legacy(opts) {
  const res = {};
  for (const key of Object.keys(opts)) {
    res['opt-' + key] = opts[key];
  }
  return res;
}

const M = {};

M._NAME = 'luasrcdiet';
M._VERSION = '1.0.0';
M._HOMEPAGE = 'https://github.com/jirutka/luasrcdiet';

M.NONE_OPTS = {
  binequiv: false,
  comments: false,
  emptylines: false,
  entropy: false,
  eols: false,
  experimental: false,
  locals: false,
  numbers: false,
  srcequiv: false,
  strings: false,
  whitespace: false,
};

M.BASIC_OPTS = merge(M.NONE_OPTS, {
  comments: true,
  emptylines: true,
  srcequiv: true,
  whitespace: true,
});

M.DEFAULT_OPTS = merge(M.BASIC_OPTS, {
  locals: true,
  numbers: true,
});

M.MAXIMUM_OPTS = merge(M.DEFAULT_OPTS, {
  entropy: true,
  eols: true,
  strings: true,
});

M.optimize = function(opts, source) {
  if (typeof source !== 'string') {
    throw new Error("bad argument #2: expected string, got a " + typeof source);
  }

  opts = opts ? merge(M.NONE_OPTS, opts) : M.DEFAULT_OPTS;
  const legacy_opts = opts_to_legacy(opts);

  const lexed = llex.lex(source);
  const toklist = lexed[0];
  const seminfolist = lexed[1];
  const toklnlist = lexed[2];
  const xinfo = lparser.parse(toklist, seminfolist, toklnlist);

  optparser.print = noop;
  optparser.optimize(legacy_opts, toklist, seminfolist, xinfo);

  optlex.print = noop;
  const optlexed = optlex.optimize(legacy_opts, toklist, seminfolist, toklnlist);
  const optim_source = optlexed[1].join('');

  return optim_source;
};

module.exports = M;