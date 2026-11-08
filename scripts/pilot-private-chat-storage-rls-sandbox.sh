#!/usr/bin/env bash
# Synthetic adversarial storage/message RLS checks against disposable PG17.
# Storage policies are loaded verbatim from the CHECKED-IN migration.
set -euo pipefail
: "${DATABASE_URL:?local disposable DATABASE_URL required}"
python3 - <<'PY'
import os
from urllib.parse import urlsplit
u=urlsplit(os.environ["DATABASE_URL"])
if u.scheme not in ("postgres","postgresql") or u.hostname not in ("localhost","127.0.0.1","::1"):
    raise SystemExit("Refusing private-chat RLS test against nonlocal database")
PY
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE SCHEMA storage;
-- Emulate storage.foldername(path) only for the path layout used by Wetudy.
CREATE FUNCTION storage.foldername(p text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN cardinality(string_to_array(p,'/')) > 1
    THEN (string_to_array(p,'/'))[1:cardinality(string_to_array(p,'/'))-1]
    ELSE ARRAY[]::text[] END
$$;
CREATE TABLE public.conversations(id uuid PRIMARY KEY,buyer_id uuid,seller_id uuid);
CREATE TABLE public.messages(id uuid PRIMARY KEY,conversation_id uuid,sender_id uuid,body text);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
INSERT INTO public.conversations VALUES
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102'),
('00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000105');
INSERT INTO public.messages VALUES
('00000000-0000-4000-8000-000000000401','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000101','chat A'),
('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000104','chat B');
INSERT INTO storage.objects VALUES
('00000000-0000-4000-8000-000000000501','chat-attachments','00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000101/doc-a.pdf'),
('00000000-0000-4000-8000-000000000502','chat-attachments','00000000-0000-4000-8000-000000000302/00000000-0000-4000-8000-000000000104/doc-b.pdf');
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own conversations" ON public.conversations FOR SELECT TO authenticated
USING (buyer_id=(select auth.uid()) OR seller_id=(select auth.uid()));
-- Mirror the messages policy predicate currently deployed, with synthetic rows.
CREATE POLICY messages_select_own_conversations ON public.messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id=messages.conversation_id
AND (c.buyer_id=(select auth.uid()) OR c.seller_id=(select auth.uid()))));
CREATE POLICY messages_insert_own_conversations ON public.messages FOR INSERT TO authenticated
WITH CHECK (sender_id=(select auth.uid()) AND EXISTS
(SELECT 1 FROM public.conversations c WHERE c.id=messages.conversation_id
AND (c.buyer_id=(select auth.uid()) OR c.seller_id=(select auth.uid()))));
GRANT USAGE ON SCHEMA public,auth,storage TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), storage.foldername(text) TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT,INSERT ON public.messages TO authenticated;
GRANT SELECT,INSERT ON storage.objects TO authenticated;
SQL
# Run EXACT storage policies from the checked-in migration (no production DB).
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" -f supabase/migrations/20260920114500_chat_attachment_privacy_hardening.sql

# User 101 can read chat A but not chat B, and sees only A private attachment.
psql -X -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.messages) <> 1 OR
    (SELECT count(*) FROM storage.objects) <> 1 THEN
    RAISE EXCEPTION 'Chat A participant accessed other conversation/attachment';
 END IF;
END $check$;
INSERT INTO storage.objects VALUES
 ('00000000-0000-4000-8000-000000000503','chat-attachments','00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000101/allowed.pdf');
DO $check$
BEGIN
 BEGIN
   INSERT INTO storage.objects VALUES
    ('00000000-0000-4000-8000-000000000504','chat-attachments','00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000103/impersonated.pdf');
   RAISE EXCEPTION 'Uploader impersonation unexpectedly accepted';
 EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
 END;
END $check$;
ROLLBACK;
-- User 102 is also an authorized participant in A.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.messages)<>1 OR
    (SELECT count(*) FROM storage.objects)<>1 THEN
   RAISE EXCEPTION 'Seller A lost participant access';
 END IF;
END $check$;
ROLLBACK;
-- User 103 is not a participant in any conversation.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.messages)<>0 OR
    (SELECT count(*) FROM storage.objects)<>0 THEN
    RAISE EXCEPTION 'Third party read private chat or attachment';
 END IF;
 BEGIN
   INSERT INTO storage.objects VALUES
    ('00000000-0000-4000-8000-000000000505','chat-attachments','00000000-0000-4000-8000-000000000301/00000000-0000-4000-8000-000000000103/not-allowed.pdf');
   RAISE EXCEPTION 'Third party uploaded into protected chat';
 EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
 END;
END $check$;
ROLLBACK;
SQL
echo "PASS disposable PostgreSQL: buyer, seller, unrelated user, uploader impersonation and cross-chat denies."
