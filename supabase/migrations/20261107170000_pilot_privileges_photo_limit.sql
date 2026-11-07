-- Pilot security: remove unnecessary table-clearing capability from browser roles.
-- Existing SELECT/INSERT/UPDATE/DELETE policies and service_role are untouched.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Files uploaded through the listing-photo bucket must be 5 MB or smaller.
-- Existing objects remain readable. New GIF uploads are intentionally disabled;
-- the browser re-encodes JPG/PNG/WEBP to fresh JPEGs without source metadata.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']::text[]
WHERE id = 'listing-photos';
