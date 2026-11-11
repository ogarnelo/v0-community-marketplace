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


def assess(artifact_payload, run_payload, backup_runs_payload, proof_payload, now, max_age_hours=24, min_remaining_hours=48):
    artifacts = artifact_payload.get("artifacts", [])
    runs = run_payload.get("workflow_runs", [])
    backup_runs = backup_runs_payload.get("workflow_runs", [])
    proofs = proof_payload.get("artifacts", [])
    if not all(isinstance(items, list) for items in (artifacts, runs, backup_runs, proofs)):
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

    # A successful later run is NOT proof that it recovered this exact backup:
    # restore can select another artifact. The final workflow step uploads a
    # metadata-only proof, named with the ACTUAL backup artifact ID. GitHub
    # associates that proof with its producing successful restore run.
    proof_name = "wetudy-partial-restore-proof-db-" + str(artifact_id)
    matched_proofs = []
    for proof in proofs:
        if not isinstance(proof, dict) or proof.get("name") != proof_name:
            continue
        proof_created = parse_iso(proof.get("created_at"))
        source = proof.get("workflow_run")
        if (proof.get("expired") is True or proof_created is None
                or proof_created < created or proof_created > now
                or not isinstance(source, dict)
                or source.get("head_branch") != "main"):
            continue
        source_id = source.get("id")
        for run in runs:
            if not isinstance(run, dict) or run.get("id") != source_id:
                continue
            if (run.get("conclusion") != "success"
                    or run.get("name") != "Wetudy combined encrypted backup recovery check"
                    or run.get("path") != ".github/workflows/pilot-combined-encrypted-recovery.yml"
                    or run.get("head_branch") != "main"):
                continue
            started = parse_iso(run.get("created_at"))
            if started and created <= started <= proof_created:
                matched_proofs.append((proof_created, source_id, proof.get("id")))
    if not matched_proofs:
        return {"ready": False, "reason": "no_restore_witness_for_exact_backup",
                "artifact_id": artifact_id}


    proof_at, restore_run_id, proof_artifact_id = max(matched_proofs)
    return {"ready": True, "reason": "recent_encrypted_backup_and_correlated_partial_restore",
            "artifact_id": artifact_id, "backup_run_id": backup_run_id,
            "restore_run_id": restore_run_id, "proof_artifact_id": proof_artifact_id,
            "age_hours": round(age, 2),
            "remaining_hours": round(remaining, 2),
            "partial_restore_at": proof_at.isoformat()}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--artifacts-json", required=True, help="Local GH artifact metadata JSON file")
    p.add_argument("--runs-json", required=True, help="Local GH restore-run metadata JSON file")
    p.add_argument("--backup-runs-json", required=True, help="Local GH backup-run metadata JSON file")
    p.add_argument("--proof-artifacts-json", required=True, help="Local GH restore witness metadata JSON file")
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
    with open(args.proof_artifacts_json, encoding="utf-8") as f:
        proofs = json.load(f)
    result = assess(artifacts, runs, backup_runs, proofs, now, args.max_age_hours, args.min_remaining_hours)
    print(json.dumps(result, sort_keys=True))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
