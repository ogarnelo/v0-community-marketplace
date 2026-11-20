BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $pre$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('listing photo uploads stay in own user folder','conversation participants can upload own chat attachments')) <> 2 THEN
 RAISE EXCEPTION 'WETUDY_PHOTO_UNEXPECTED_LEGACY_POLICIES'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd='INSERT') <> 2 THEN
 RAISE EXCEPTION 'WETUDY_PHOTO_UNEXPECTED_OTHER_INSERT_POLICIES'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
 RAISE EXCEPTION 'WETUDY_STORAGE_RLS_DISABLED'; END IF;
 IF to_regprocedure('public.claim_photo_upload_slot(uuid)') IS NULL THEN
 RAISE EXCEPTION 'WETUDY_PHOTO_QUOTA_MISSING'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='conversation participants can read chat attachments' AND cmd='SELECT') THEN
 RAISE EXCEPTION 'WETUDY_CHAT_READ_POLICY_MISSING'; END IF;
END $pre$;
-- REVIEW ONLY / NEVER AUTODEPLOY — explicit Supabase authorization required.
-- Coordinate migration with server route rollout, retain existing reads and document uploads.
-- Only the trusted server may upload images. Browser clients may upload
-- documents to conversation attachments if they are conversation members.
-- Existing images, listing records and signed-image reads stay unchanged.

DROP POLICY IF EXISTS "listing photo uploads stay in own user folder"
  ON storage.objects;

DROP POLICY IF EXISTS "conversation participants can upload own chat attachments"
  ON storage.objects;

CREATE POLICY "conversation participants may upload documents only"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
  AND lower(storage.extension(name)) IN ('pdf','doc','docx')
  AND COALESCE(metadata ->> 'mimetype','') IN (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.buyer_id = (SELECT auth.uid()) OR c.seller_id = (SELECT auth.uid()))
  )
);

-- Do not open a new policy for listing photos. service_role bypasses RLS
-- and the authenticated photo-upload API checks ownership first.
-- Preserve the private chat read policy for conversation participants.

DO $post$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('listing photo uploads stay in own user folder','conversation participants can upload own chat attachments')) THEN
 RAISE EXCEPTION 'WETUDY_PHOTO_LEGACY_INSERT_REMAINS'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd='INSERT') <> 1 THEN
 RAISE EXCEPTION 'WETUDY_PHOTO_UNEXPECTED_INSERT_COUNT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='conversation participants may upload documents only' AND cmd='INSERT' AND roles @> ARRAY['authenticated']::name[] AND with_check LIKE '%application/pdf%' AND with_check LIKE '%storage.extension%') THEN
 RAISE EXCEPTION 'WETUDY_PHOTO_DOCUMENT_POLICY_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='conversation participants can read chat attachments' AND cmd='SELECT') THEN
 RAISE EXCEPTION 'WETUDY_CHAT_READ_POLICY_LOST'; END IF;
END $post$;
COMMIT;
