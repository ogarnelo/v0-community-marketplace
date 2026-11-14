#!/usr/bin/env python3
"""Offline fail-closed static guard; does not execute SQL or connect to databases."""
from pathlib import Path
import re
import sys

PATHS = (
    "scripts/pilot-privacy-prod-preflight-readonly.sql",
    "scripts/pilot-dr-prod-inventory-readonly.sql",
)

class UnsafePreflight(ValueError):
    pass

def mask(sql):
    out=[]; i=0; n=len(sql)
    while i<n:
        c=sql[i]
        if sql.startswith("--",i):
            j=sql.find("\n",i)
            if j<0: j=n
            out.append(" "*(j-i)); i=j
        elif sql.startswith("/*",i):
            depth=1; j=i+2
            while j<n and depth:
                if sql.startswith("/*",j): depth+=1; j+=2
                elif sql.startswith("*/",j): depth-=1; j+=2
                else: j+=1
            if depth: raise UnsafePreflight("unclosed block comment")
            out.append(" "*(j-i)); i=j
        elif c in ("'",'"'):
            quote=c; j=i+1
            while j<n:
                if sql[j]==quote:
                    if j+1<n and sql[j+1]==quote: j+=2
                    else: j+=1; break
                else: j+=1
            else: raise UnsafePreflight("unclosed string/identifier")
            out.append(quote*2+" "*max(0,j-i-2)); i=j
        elif c=="$":
            m=re.match(r"\$[A-Za-z_0-9]*\$",sql[i:])
            if m:
                tag=m.group(); end=sql.find(tag,i+len(tag))
                if end<0: raise UnsafePreflight("unclosed dollar quote")
                j=end+len(tag); out.append(" "*(j-i)); i=j
            else: out.append(c); i+=1
        else: out.append(c); i+=1
    return "".join(out)

def validate(sql):
    statements=[s.strip() for s in mask(sql).split(";") if s.strip()]
    if len(statements)<3: raise UnsafePreflight("missing queries")
    if not re.fullmatch(r"BEGIN\s+TRANSACTION\s+READ\s+ONLY",statements[0],re.I):
        raise UnsafePreflight("must start BEGIN TRANSACTION READ ONLY")
    if not re.fullmatch("ROLLBACK",statements[-1],re.I):
        raise UnsafePreflight("must end ROLLBACK")
    forbidden=re.compile(r"\b(?:INSERT|UPDATE|DELETE|UPSERT|MERGE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|DO|CALL|COPY|EXECUTE|LOCK|VACUUM|ANALYZE|REFRESH|DISCARD|LISTEN|NOTIFY|SET|RESET|INTO)\b",re.I)
    functions=re.compile(r"\b(?:pg_read_file|pg_read_binary_file|pg_ls_dir|lo_export|dblink|set_config|pg_notify|pg_sleep|pg_advisory_lock|pg_terminate_backend)\s*\(",re.I)
    for i,stmt in enumerate(statements[1:-1],1):
        if not re.match(r"^(?:SELECT|WITH)\b",stmt,re.I):
            raise UnsafePreflight("non-SELECT statement "+str(i))
        if forbidden.search(stmt) or functions.search(stmt):
            raise UnsafePreflight("unsafe keyword or function in statement "+str(i))
    return len(statements)-2

def test():
    good=[
        "BEGIN TRANSACTION READ ONLY; SELECT count(*) FROM pg_class; ROLLBACK;",
        "-- DELETE FROM t;\nBEGIN TRANSACTION READ ONLY; SELECT 'DROP; TABLE' AS note; ROLLBACK;",
        "BEGIN TRANSACTION READ ONLY; WITH x AS (SELECT 1) SELECT * FROM x; ROLLBACK;",
        "BEGIN TRANSACTION READ ONLY; /* /* DELETE */ */ SELECT 1; ROLLBACK;",
    ]
    bad=[
        "BEGIN; SELECT 1; ROLLBACK;",
        "BEGIN TRANSACTION READ ONLY; SELECT 1; COMMIT;",
        "BEGIN TRANSACTION READ ONLY; SELECT 1; DELETE FROM x; ROLLBACK;",
        "BEGIN TRANSACTION READ ONLY; WITH x AS (DELETE FROM x RETURNING *) SELECT * FROM x; ROLLBACK;",
        "BEGIN TRANSACTION READ ONLY; SELECT pg_read_file('/etc/passwd'); ROLLBACK;",
        "BEGIN TRANSACTION READ ONLY; SELECT 1 INTO x; ROLLBACK;",
        "BEGIN TRANSACTION READ ONLY; SELECT 1; /* unclosed",
        "BEGIN TRANSACTION READ ONLY; SELECT 1; ROLLBACK; SELECT 2;",
        "BEGIN TRANSACTION READ ONLY; SELECT 1; CALL bad(); ROLLBACK;",
        "BEGIN TRANSACTION READ ONLY; SELECT set_config('x','y',true); ROLLBACK;",
    ]
    for s in good: validate(s)
    for s in bad:
        try: validate(s)
        except UnsafePreflight: continue
        raise AssertionError("unsafe mutation accepted: "+s)
    print("PASS SQL mutation tests: 4 allowed, 10 rejected")

if __name__=="__main__":
    test()
    for p in PATHS:
        try: count=validate(Path(p).read_text(encoding="utf-8"))
        except (UnsafePreflight,OSError) as e:
            print("BLOCK "+p+": "+str(e),file=sys.stderr); sys.exit(2)
        print("PASS "+p+": "+str(count)+" read-only queries")
