#!/usr/bin/env python3
"""Select an unexpired PostgreSQL backup produced by the official successful main workflow.

Metadata only; no network calls, secrets, backup bytes or production connections.
Fail closed if the source run cannot be corroborated.
"""
import datetime as dt
import json
import sys

BACKUP_NAME = "wetudy-encrypted-postgres-backup"
WORKFLOW_NAME = "Wetudy encrypted database backup"
WORKFLOW_PATH = ".github/workflows/wetudy-encrypted-db-backup.yml"


def timestamp(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo is not None else None
    except ValueError:
        return None


def select(artifact_data, run_data, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    artifacts = artifact_data.get("artifacts")
    runs = run_data.get("workflow_runs")
    if not isinstance(artifacts, list) or not isinstance(runs, list):
        raise ValueError("Invalid GitHub metadata")
    trusted_runs = {}
    for run in runs:
        if not isinstance(run, dict):
            continue
        if (run.get("name") != WORKFLOW_NAME
                or run.get("path") != WORKFLOW_PATH
                or run.get("head_branch") != "main"
                or run.get("event") != "workflow_dispatch"
                or run.get("conclusion") != "success"):
            continue
        started = timestamp(run.get("created_at"))
        if type(run.get("id")) is int and started and started <= now:
            trusted_runs[run["id"]] = started
    matches = []
    for artifact in artifacts:
        if not isinstance(artifact, dict) or artifact.get("name") != BACKUP_NAME:
            continue
        source = artifact.get("workflow_run")
        if not isinstance(source, dict) or source.get("head_branch") != "main":
            continue
        started = trusted_runs.get(source.get("id"))
        created = timestamp(artifact.get("created_at"))
        expires = timestamp(artifact.get("expires_at"))
        if (type(artifact.get("id")) is not int or artifact.get("expired") is not False
                or not started or not created or not expires):
            continue
        if started <= created <= now < expires:
            matches.append((created, artifact["id"]))
    if not matches:
        raise ValueError("No unexpired archive from a successful official main backup")
    return max(matches)[1]


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: pilot-select-trusted-backup-artifact.py ARTIFACTS.json RUNS.json")
    try:
        with open(sys.argv[1], encoding="utf8") as file:
            artifacts = json.load(file)
        with open(sys.argv[2], encoding="utf8") as file:
            runs = json.load(file)
        print(select(artifacts, runs))
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as exc:
        print("BLOCKED: untrusted encrypted backup provenance: " + str(exc), file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
