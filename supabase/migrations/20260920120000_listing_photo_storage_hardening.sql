-- Listing photos are public assets, but only authenticated users may upload
-- inside their own user folder. Bucket-level constraints mirror the UI.
drop policy if exists "Give users authenticated access to folder 1l9i60a_0" on storage.objects;
drop policy if exists "listing photo uploads stay in own user folder" on storage.objects;

create policy "listing photo uploads stay in own user folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

update storage.buckets
set
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']::text[]
where id = 'listing-photos';
