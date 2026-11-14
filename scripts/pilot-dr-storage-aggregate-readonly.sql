-- WETUDY Storage aggregate reconciliation: production metadata READ ONLY.
-- No private object paths, owners, emails, JWTs or file contents are queried.
-- Feed the single JSON result to the offline verifier only after a same-window
-- encrypted export. Different timestamps can legitimately yield NO_GO drift.
BEGIN TRANSACTION READ ONLY;
WITH selected(bucket_id) AS (
 VALUES ('listing-photos'),('chat-attachments')
), summary AS (
 SELECT s.bucket_id,
   EXISTS(SELECT 1 FROM storage.buckets b WHERE b.id=s.bucket_id) AS bucket_exists,
   count(o.id)::int AS objects,
   count(o.id) FILTER(
     WHERE o.metadata->>'size' IS NULL
     OR NOT (o.metadata->>'size' ~ '^[0-9]{1,15}$'))::int AS invalid_size,
   COALESCE(sum(CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,15}$'
        THEN (o.metadata->>'size')::numeric ELSE 0 END),0)::bigint AS bytes
 FROM selected s
 LEFT JOIN storage.objects o ON o.bucket_id=s.bucket_id
 GROUP BY s.bucket_id
)
SELECT jsonb_build_object(
 'buckets',jsonb_object_agg(bucket_id,
   jsonb_build_object('objects',objects,'bytes',bytes,
     'invalidSize',invalid_size,'bucketExists',bucket_exists))
) AS storage_inventory_readonly
FROM summary;
ROLLBACK;
