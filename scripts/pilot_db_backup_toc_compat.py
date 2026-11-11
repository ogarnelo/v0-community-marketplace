#!/usr/bin/env python3
"""Narrow public pg_restore TOC table/section parser: metadata only."""
import re

TOC_LINE = re.compile(
    r"^\s*\d+;\s+\d+\s+\d+\s+(TABLE(?: DATA)?)\s+"
    r"([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s"
)
def parse_toc(text):
    result = set()
    for line in text.splitlines():
        match = TOC_LINE.match(line)
        if match:
            result.add((match.group(2),match.group(3),match.group(1)))
    return result
