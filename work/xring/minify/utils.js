'use strict';

/*
 * Port of luasrcdiet utils.lua (general utility functions).
 */

const M = {};

function merge() {
  const result = {};
  for (let i = 0; i < arguments.length; i++) {
    const tab = arguments[i];
    for (const key of Object.keys(tab)) {
      result[key] = tab[key];
    }
  }
  return result;
}

M.merge = merge;

module.exports = M;