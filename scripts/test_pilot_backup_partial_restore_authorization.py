"""Synthetic metadata tests: recent partial restore NEVER authorizes production SQL."""
from datetime import datetime, timezone
import importlib.util
from pathlib import Path
import unittest

SRC=Path(__file__).with_name("pilot-alert-encrypted-backup-freshness.py")
spec=importlib.util.spec_from_file_location("wetudy_backup_freshness",SRC)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
NOW=datetime(2026,11,15,10,0,tzinfo=timezone.utc)

def fixture(with_acl=False):
    source={"id":100,"head_branch":"main"}
    backup_runs={"workflow_runs":[{
        "id":100,"name":"Wetudy encrypted database backup",
        "path":".github/workflows/wetudy-encrypted-db-backup.yml",
        "head_branch":"main","conclusion":"success",
        "created_at":"2026-11-15T07:00:00Z"}]}
    artifacts={"artifacts":[{
        "id":200,"name":"wetudy-encrypted-postgres-backup",
        "created_at":"2026-11-15T07:30:00Z",
        "expires_at":"2026-11-20T07:30:00Z",
        "expired":False,"workflow_run":source}]}
    runs={"workflow_runs":[{
        "id":300,"name":"Wetudy combined encrypted backup recovery check",
        "path":".github/workflows/pilot-combined-encrypted-recovery.yml",
        "head_branch":"main","conclusion":"success",
        "created_at":"2026-11-15T08:00:00Z"}]}
    proofs={"artifacts":[{
        "id":301,"name":"wetudy-partial-restore-proof-db-200",
        "created_at":"2026-11-15T08:20:00Z",
        "expired":False,
        "workflow_run":{"id":300,"head_branch":"main"}}]}
    if with_acl:
        proofs["artifacts"].append({
            "id":302,"name":"wetudy-acl-verified-proof-db-200",
            "created_at":"2026-11-15T08:25:00Z",
            "expired":False,
            "workflow_run":{"id":300,"head_branch":"main"}})
    return artifacts,runs,backup_runs,proofs

class PartialRestoreMustNotAuthorizeProduction(unittest.TestCase):
    def check(self,parts):
        return mod.assess(*parts, NOW)
    def test_valid_partial_proof_is_not_full_dr(self):
        r=self.check(fixture())
        self.assertIs(r["ready"],True)
        self.assertIs(r["acl_snapshot_verified"],False)
        self.assertIs(r["full_disaster_recovery_certified"],False)
        self.assertIs(r["production_sql_migration_authorized"],False)

    def test_acl_proof_still_never_authorizes_full_restore(self):
        r=self.check(fixture(with_acl=True))
        self.assertIs(r["ready"],True)
        self.assertIs(r["acl_snapshot_verified"],True)
        self.assertIs(r["full_disaster_recovery_certified"],False)
        self.assertIs(r["production_sql_migration_authorized"],False)

    def test_unrelated_restore_proof_cannot_certify_backup(self):
        art,runs,backup,proof=fixture(with_acl=True)
        proof["artifacts"][0]["name"]="wetudy-partial-restore-proof-db-999"
        r=self.check((art,runs,backup,proof))
        self.assertIs(r["ready"],False)

    def test_expired_backup_not_ready_even_with_proof(self):
        art,runs,backup,proof=fixture(with_acl=True)
        art["artifacts"][0]["expired"]=True
        r=self.check((art,runs,backup,proof))
        self.assertIs(r["ready"],False)

if __name__=="__main__":
    unittest.main()
