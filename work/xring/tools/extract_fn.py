#!/usr/bin/env python3
"""Extract a function body from Xring's single-line minified output.

Usage: tools/extract_fn.py out.lua NAME [NAME...]
Prints `NAME=function(...) ... end` bodies by brace/keyword depth matching.
"""
import sys


def find_fn(line, name):
    import re
    pat = re.compile(r'(?:^|[,{(;])' + re.escape(name) + r'\s*=\s*function\b|(?:^|[,{(;])function\s+' + re.escape(name) + r'\b')
    m = pat.search(line)
    return m.start() if m else -1


KEYWORDS = ('function', 'if', 'for', 'while', 'do')


def word_at(line, j, w):
    if not line.startswith(w, j):
        return False
    before = line[j - 1] if j > 0 else ' '
    after = line[j + len(w)] if j + len(w) < len(line) else ' '
    return not (before.isalnum() or before == '_') and not (after.isalnum() or after == '_')


def extract(line, start):
    j = start
    depth = 0
    started = False
    while j < len(line):
        c = line[j]
        if c == '"' or c == "'":
            q = c
            j += 1
            while j < len(line):
                if line[j] == '\\':
                    j += 2
                    continue
                if line[j] == q:
                    j += 1
                    break
                j += 1
            continue
        for w in KEYWORDS:
            if word_at(line, j, w):
                depth += 1
                started = True
                j += len(w)
                break
        else:
            if word_at(line, j, 'end'):
                depth -= 1
                j += 3
                if started and depth == 0:
                    return line[start:j]
                continue
            j += 1
    return line[start:]


def main():
    path = sys.argv[1]
    names = sys.argv[2:]
    text = open(path, encoding='utf-8', errors='replace').read()
    for line in text.split('\n'):
        for name in names:
            pos = find_fn(line, name)
            if pos < 0:
                continue
            body = extract(line, pos)
            print('=== %s (%d chars) ===' % (name, len(body)))
            print(body)
            print()


if __name__ == '__main__':
    main()
