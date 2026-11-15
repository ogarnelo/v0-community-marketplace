-- Disposable Supabase CLI local: real Storage API, GoTrue owners and RLS.
-- Files are generated entirely in the runner, never in production.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('wetudy-pilot-qa-private','wetudy-pilot-qa-private',false,1048576,ARRAY['text/plain'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY qa_pilot_private_storage_insert ON storage.objects
 FOR INSERT TO authenticated
 WITH CHECK(bucket_id='wetudy-pilot-qa-private' AND owner_id=(SELECT auth.uid()::text));
CREATE POLICY qa_pilot_private_storage_select ON storage.objects
 FOR SELECT TO authenticated
 USING(bucket_id='wetudy-pilot-qa-private' AND owner_id=(SELECT auth.uid()::text));
CREATE POLICY qa_pilot_private_storage_delete ON storage.objects
 FOR DELETE TO authenticated
 USING(bucket_id='wetudy-pilot-qa-private' AND owner_id=(SELECT auth.uid()::text));
NOTIFY pgrst,'reload schema';
