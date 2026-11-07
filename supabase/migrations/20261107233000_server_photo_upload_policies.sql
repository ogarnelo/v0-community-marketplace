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
