'use strict';

/**
 * Lua 5.1 canonical opcode ids. The VM generator remaps these per-build.
 * Intern opcodes (GETI/PUTI) live at 38/39; superops CALLM/T* at 40..46;
 * N-variant CALL/RETURN/JMP at 47..57 and 64..74;
 * extras (CORO_*, REGION_DEC, CRASH, NATIVE_CLOSURE) live at 58..63.
 * Extra CALL/RET/MOVE/GETI conventions continue at 93..116; IDIV at 119;
 * arith RR/RK/KK overlay at 120..134.
 * Wire ids are a permutation into 0..255 (not the canonical numbers).
 */

const CANONICAL = {
  MOVE: 0,
  LOADK: 1,
  LOADBOOL: 2,
  LOADNIL: 3,
  GETUPVAL: 4,
  GETGLOBAL: 5,
  GETTABLE: 6,
  SETGLOBAL: 7,
  SETUPVAL: 8,
  SETTABLE: 9,
  NEWTABLE: 10,
  SELF: 11,
  ADD: 12,
  SUB: 13,
  MUL: 14,
  DIV: 15,
  MOD: 16,
  POW: 17,
  UNM: 18,
  NOT: 19,
  LEN: 20,
  CONCAT: 21,
  JMP: 22,
  EQ: 23,
  LT: 24,
  LE: 25,
  TEST: 26,
  TESTSET: 27,
  CALL: 28,
  TAILCALL: 29,
  RETURN: 30,
  FORLOOP: 31,
  FORPREP: 32,
  TFORLOOP: 33,
  SETLIST: 34,
  CLOSE: 35,
  CLOSURE: 36,
  VARARG: 37,
  GETI: 38,
  PUTI: 39,
  CALLM: 40,
  TLOAD: 41,
  TKEYI: 42,
  TGET: 43,
  TARGI: 44,
  CALL2: 45,
  CALL1: 46,
  CALL0: 47,
  CALL0R: 48,
  CALLA1: 49,
  CALLA1R: 50,
  CALLA2: 51,
  CALLA2R: 52,
  CALLA3: 53,
  CALLA3R: 54,
  CALL0B: 55,
  CALLA1RB: 56,
  JMP_ABS: 57,
  CORO_SPAWN: 58,
  CORO_YIELD: 59,
  CORO_RESTORE: 60,
  REGION_DEC: 61,
  CRASH: 62,
  NATIVE_CLOSURE: 63,
  RET0: 64,
  RET1: 65,
  RET2: 66,
  RET3: 67,
  RET0B: 68,
  RET1B: 69,
  JMP_REL: 70,
  FORLOOP_ABS: 71,
  FORLOOP_REL: 72,
  FORPREP_ABS: 73,
  FORPREP_REL: 74,
  LOADENC: 75,
  LOADENC2: 76,
  LOADENC3: 77,
  REGION_ENC: 78,
  TKEYR: 79,
  TKEYK: 80,
  TGETD: 81,
  TSET: 82,
  TSETK: 83,
  GETFI: 84,
  SETFI: 85,
  GETFR: 86,
  SETFR: 87,
  TNEW: 88,
  TSETI: 89,
  TFLUSH: 90,
  TARGI2: 91,
  CALL3: 92,
  CALL0S: 93,
  CALL0T: 94,
  CALL0RS: 95,
  CALLA1S: 96,
  CALLA1T: 97,
  CALLA1RS: 98,
  CALLA2S: 99,
  CALLA2RS: 100,
  CALLA3S: 101,
  RET0T: 102,
  RET0X: 103,
  RET1S: 104,
  RET1X: 105,
  RET2S: 106,
  RET2X: 107,
  RET3S: 108,
  RET3X: 109,
  RET4: 110,
  RET4S: 111,
  RET5: 112,
  MOVE2: 113,
  MOVE3: 114,
  GETI2: 115,
  GETI3: 116,
  GETFK: 117,
  SETFK: 118,
  IDIV: 119,
  ADDRR: 120,
  ADDRK: 121,
  ADDKK: 122,
  SUBRR: 123,
  SUBRK: 124,
  SUBKK: 125,
  MULRR: 126,
  MULRK: 127,
  MULKK: 128,
  DIVRR: 129,
  DIVRK: 130,
  DIVKK: 131,
  IDIVRR: 132,
  IDIVRK: 133,
  IDIVKK: 134,
};

const NAMES = Object.create(null);
for (const [k, v] of Object.entries(CANONICAL)) NAMES[v] = k;

const JUMP_PRE = ['JMP', 'FORLOOP', 'FORPREP'];
const JUMP_ABS = ['JMP_ABS', 'FORLOOP_ABS', 'FORPREP_ABS'];
const JUMP_REL = ['JMP_REL', 'FORLOOP_REL', 'FORPREP_REL'];
const JUMP_OPS = new Set([...JUMP_PRE, ...JUMP_ABS, ...JUMP_REL]);

function isJumpOp(op) {
  return JUMP_OPS.has(op);
}

function jumpKind(op) {
  if (JUMP_ABS.indexOf(op) >= 0) return 'abs';
  if (JUMP_REL.indexOf(op) >= 0) return 'rel';
  if (JUMP_PRE.indexOf(op) >= 0) return 'pre';
  return null;
}

const CALL_VARIANTS = new Set([
  'CALL', 'CALL0', 'CALL0B', 'CALL0R', 'CALL0S', 'CALL0T', 'CALL0RS',
  'CALLA1', 'CALLA1R', 'CALLA1RB', 'CALLA1S', 'CALLA1T', 'CALLA1RS',
  'CALLA2', 'CALLA2R', 'CALLA2S', 'CALLA2RS',
  'CALLA3', 'CALLA3R', 'CALLA3S', 'CALL3',
]);
const RETURN_VARIANTS = new Set([
  'RETURN',
  'RET0', 'RET0B', 'RET0T', 'RET0X',
  'RET1', 'RET1B', 'RET1S', 'RET1X',
  'RET2', 'RET2S', 'RET2X',
  'RET3', 'RET3S', 'RET3X',
  'RET4', 'RET4S', 'RET5',
]);
const MOVE_VARIANTS = new Set(['MOVE', 'MOVE2', 'MOVE3']);
const GETI_VARIANTS = new Set(['GETI', 'GETI2', 'GETI3']);
const ARITH_VARIANTS = new Set([
  'ADD', 'ADDRR', 'ADDRK', 'ADDKK',
  'SUB', 'SUBRR', 'SUBRK', 'SUBKK',
  'MUL', 'MULRR', 'MULRK', 'MULKK',
  'DIV', 'DIVRR', 'DIVRK', 'DIVKK',
  'IDIV', 'IDIVRR', 'IDIVRK', 'IDIVKK',
]);

const BINOPS = {
  '+': 'ADD',
  '-': 'SUB',
  '*': 'MUL',
  '/': 'DIV',
  '//': 'IDIV',
  '%': 'MOD',
  '^': 'POW',
  '..': 'CONCAT',
  '==': 'EQ',
  '~=': 'EQ',
  '<': 'LT',
  '<=': 'LE',
  '>': 'LT',
  '>=': 'LE',
};

const UNOPS = {
  '-': 'UNM',
  not: 'NOT',
  '#': 'LEN',
};

module.exports = {
  CANONICAL,
  NAMES,
  BINOPS,
  UNOPS,
  JUMP_PRE,
  JUMP_ABS,
  JUMP_REL,
  JUMP_OPS,
  isJumpOp,
  jumpKind,
  CALL_VARIANTS,
  RETURN_VARIANTS,
  MOVE_VARIANTS,
  GETI_VARIANTS,
  ARITH_VARIANTS,
};
