-- WETUDY storage references: READ-ONLY aggregate audit for pilot cost control.
-- No object keys, names, addresses, emails or image URLs are returned.
-- Never use these aggregates to authorize deletion. Referenced assets may
-- exist in other systems, historical records, moderation or pending drafts.
--
-- Checked on 2026-11-09: listing-photos 33 objects, 11 matched to listings
-- and listing_photos, 22 unmatched by THOSE paths; 0 broken array references.
-- This query is a point-in-time observation, not a delete candidate list.
WITH direct_photo_refs AS (
  SELECT url AS ref FROM public.listing_photos WHERE url IS NOT NULL
  UNION ALL
  SELECT a.ref
    FROM public.listings l CROSS JOIN LATERAL unnest(l.photos) AS a(ref)
   WHERE a.ref IS NOT NULL
  UNION ALL
  SELECT CASE WHEN jsonb_typeof(d.photo) = 'string'
              THEN d.photo #>> '{}'
              ELSE COALESCE(d.photo->>'url', d.photo->>'storageUrl',
                            d.photo->>'storage_path', d.photo->>'path')
         END AS ref
    FROM public.listing_drafts ld
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(ld.photos) = 'array'
           THEN ld.photos ELSE '[]'::jsonb END
    ) AS d(photo)
),
photo_ref_paths AS (
  SELECT DISTINCT
    split_part(
      CASE WHEN ref LIKE '%/storage/v1/object/%'
           THEN regexp_replace(
             ref, '^.*?/storage/v1/object/(?:public|sign|authenticated)/listing-photos/', '')
           ELSE regexp_replace(ref, '^listing-photos/', '')
      END, '?', 1
    ) AS object_path
  FROM direct_photo_refs
  WHERE ref IS NOT NULL AND ref <> ''
),
attachment_ref_paths AS (
  SELECT DISTINCT split_part(
    CASE WHEN attachment_path LIKE '%/storage/v1/object/%'
         THEN regexp_replace(
           attachment_path,
           '^.*?/storage/v1/object/(?:public|sign|authenticated)/chat-attachments/', '')
         ELSE regexp_replace(attachment_path, '^chat-attachments/', '')
    END, '?', 1) AS object_path
  FROM public.messages
  WHERE attachment_path IS NOT NULL AND attachment_path <> ''
),
object_inventory AS (
  SELECT o.bucket_id,
         o.name,
         CASE WHEN o.metadata->>'size' ~ '^[0-9]+$'
              THEN (o.metadata->>'size')::bigint ELSE 0 END AS reported_bytes
    FROM storage.objects o
   WHERE o.bucket_id IN ('listing-photos', 'chat-attachments')
),
matched AS (
 SELECT o.bucket_id,o.name,o.reported_bytes,
   CASE WHEN o.bucket_id='listing-photos'
        THEN EXISTS (SELECT 1 FROM photo_ref_paths r WHERE r.object_path=o.name)
        ELSE EXISTS (SELECT 1 FROM attachment_ref_paths r WHERE r.object_path=o.name)
   END AS referenced
 FROM object_inventory o
)
SELECT bucket_id AS bucket,
       count(*)::bigint AS total_objects,
       sum(reported_bytes)::bigint AS declared_bytes,
       count(*) FILTER (WHERE referenced)::bigint AS matched_by_scanned_paths,
       count(*) FILTER (WHERE NOT referenced)::bigint AS not_matched_by_scanned_paths
FROM matched GROUP BY bucket_id ORDER BY bucket_id;
