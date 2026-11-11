#!/usr/bin/env python3
"""Fail closed unless the partial restore points at the dedicated local CI database.

No connection is made. Intended to run before any backup download or SQL.
"""
import os
import sys
from urllib.parse import urlsplit


def validate(raw):
    try:
        url = urlsplit(raw)
        port = url.port
    except (ValueError, TypeError):
        raise ValueError("Invalid local restore URL")
    if not (
        url.scheme in ("postgresql", "postgres")
        and url.hostname == "127.0.0.1"
        and port == 5432
        and url.username == "wetudy_restore"
        and url.path == "/wetudy_restore"
        and not url.query and not url.fragment
        and url.password
    ):
        raise ValueError("Restore target must be the dedicated local PG17 test database")
    return True


if __name__ == "__main__":
    try:
        validate(os.environ.get("LOCAL_RESTORE_URL", ""))
    except ValueError as error:
        print("BLOCKED: " + str(error), file=sys.stderr)
        sys.exit(2)
