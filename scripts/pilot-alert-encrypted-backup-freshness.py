#!/usr/bin/env python3
"""Read-only metadata gate for Wetudy's encrypted backup artifacts.

Never downloads the archive, connects to Supabase, performs restores, or
handles encryption passwords. Call it with JSON produced by `gh api`.
The check proves RECENCY and prior PARTIAL restore success, not full recovery.
"""
import argparse
import datetime as dt
import json
import sys

UTC = dt.timezone.utc


def parse_iso(value):
    if not isinstance(value, str):
        return None
    try:
        result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return result.astimezone(UTC) if result.tzinfo else None
    except ValueError:
        return None


def assess(artifact_payload, run_payload, backup_runs_payload, now, max_age_hours=24, min_remaining_hours=48):
    artifacts = artifact_payload.get("artifacts", [])
    runs = run_payload.get("workflow_runs", [])
    backup_runs = backup_runs_payload.get("workflow_runs", [])
    if not all(isinstance(items, list) for items in (artifacts, runs, backup_runs)):
        return {"ready": False, "reason": "invalid_metadata"}

    valid_backup_runs = {}
    for item in backup_runs:
        if not isinstance(item, dict):
            continue
        if (item.get("name") != "Wetudy encrypted database backup"
                or item.get("path") != ".github/workflows/wetudy-encrypted-db-backup.yml"
                or item.get("head_branch") != "main"
                or item.get("conclusion") != "success"):
            continue
        started = parse_iso(item.get("created_at"))
        if isinstance(item.get("id"), int) and started and started <= now:
            valid_backup_runs[item["id"]] = started

    candidates = []
    for item in artifacts:
        if not isinstance(item, dict) or item.get("name") != "wetudy-encrypted-postgres-backup":
            continue
        created = parse_iso(item.get("created_at"))
        expiry = parse_iso(item.get("expires_at"))
        if item.get("expired") is True or not created or not expiry:
            continue
        if created > now or expiry <= now or not isinstance(item.get("id"), int):
            continue
        source = item.get("workflow_run", {})
        if not isinstance(source, dict) or source.get("head_branch") != "main":
            continue
        original_run_at = valid_backup_runs.get(source.get("id"))
        if original_run_at is None or original_run_at > created:
            continue
        candidates.append((created, expiry, item["id"], source["id"]))
    if not candidates:
        return {"ready": False, "reason": "missing_verified_backup_provenance"}

    created, expires, artifact_id, backup_run_id = max(candidates)
    age = (now-created).total_seconds()/3600
    remaining = (expires-now).total_seconds()/3600
    if age > max_age_hours:
        return {"ready": False, "reason": "backup_too_old", "artifact_id": artifact_id,
                "age_hours": round(age, 2)}
    if remaining < min_remaining_hours:
        return {"ready": False, "reason": "backup_expiring", "artifact_id": artifact_id,
                "remaining_hours": round(remaining, 2)}

    good_restores = []
    for item in runs:
        if not isinstance(item, dict) or item.get("conclusion") != "success":
            continue
        if (item.get("name") != "Wetudy combined encrypted backup recovery check"
                or item.get("path") != ".github/workflows/pilot-combined-encrypted-recovery.yml"
                or item.get("head_branch") != "main"):
            continue
        started = parse_iso(item.get("created_at"))
        if started is not None and created <= started <= now:
            good_restores.append(started)
    if not good_restores:
        return {"ready": False, "reason": "no_successful_partial_restore_after_backup",
                "artifact_id": artifact_id}

    return {"ready": True, "reason": "recent_encrypted_backup_and_partial_restore",
            "artifact_id": artifact_id, "backup_run_id": backup_run_id,
            "age_hours": round(age, 2),
            "remaining_hours": round(remaining, 2),
            "partial_restore_at": max(good_restores).isoformat()}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--artifacts-json", required=True, help="Local GH artifact metadata JSON file")
    p.add_argument("--runs-json", required=True, help="Local GH restore-run metadata JSON file")
    p.add_argument("--backup-runs-json", required=True, help="Local GH backup-run metadata JSON file")
    p.add_argument("--now", help="ISO 8601 timestamp, only for deterministic tests")
    p.add_argument("--max-age-hours", type=float, default=24)
    p.add_argument("--min-remaining-hours", type=float, default=48)
    args = p.parse_args()
    if args.max_age_hours <= 0 or args.min_remaining_hours < 0:
        p.error("Invalid readiness thresholds")
    now = parse_iso(args.now) if args.now else dt.datetime.now(UTC)
    if not now:
        p.error("Invalid --now timestamp")
    with open(args.artifacts_json, encoding="utf-8") as f:
        artifacts = json.load(f)
    with open(args.runs_json, encoding="utf-8") as f:
        runs = json.load(f)
    with open(args.backup_runs_json, encoding="utf-8") as f:
        backup_runs = json.load(f)
    result = assess(artifacts, runs, backup_runs, now, args.max_age_hours, args.min_remaining_hours)
    print(json.dumps(result, sort_keys=True))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
