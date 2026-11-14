-- WETUDY P0: read-only PRODUCTION disaster-recovery scope inventory.
-- It is an inventory, NOT a backup, not an export of credentials, and NOT a GO.
-- Never return user emails, file paths, JWTs, profile details or objects.
BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT count(*) FROM pg_tables WHERE schemaname='public') AS public_tables,
 (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS public_rls_policies,
 (SELECT count(*) FROM auth.users) AS auth_account_count,
 (SELECT count(*) FROM storage.buckets) AS storage_bucket_count,
 (SELECT count(*) FROM storage.objects) AS storage_object_count,
 pg_database_size(current_database()) AS database_bytes,
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='auth') AS auth_schema_tables,
 (SELECT count(*) FROM information_schema.tables WHERE table_schema='storage') AS storage_schema_tables,
 'INVENTORY_ONLY__FULL_AUTH_STORAGE_RECOVERY_UNVERIFIED' AS recovery_gate;

-- Aggregate metadata only: no bucket names, object names, owner IDs or file paths.
SELECT
 count(*) AS objects_with_size_metadata,
 COALESCE(SUM(
  CASE WHEN (metadata->>'size') ~ '^[0-9]{1,18}$'
  THEN (metadata->>'size')::numeric
  ELSE 0 END
 ),0) AS known_object_bytes,
 count(*) FILTER(WHERE (metadata->>'size') IS NULL) AS objects_missing_size_metadata
FROM storage.objects;
ROLLBACK;
