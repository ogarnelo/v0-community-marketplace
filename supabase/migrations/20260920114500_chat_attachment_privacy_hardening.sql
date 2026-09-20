-- Chat attachments are private conversation data.
-- Paths are written as <conversation_id>/<uploader_user_id>/<filename>.
drop policy if exists "authenticated users can read chat attachments" on storage.objects;
drop policy if exists "authenticated users can upload chat attachments" on storage.objects;
drop policy if exists "authenticated users can update chat attachments" on storage.objects;
drop policy if exists "authenticated users can delete chat attachments" on storage.objects;

create policy "conversation participants can read chat attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-attachments'
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (
        c.buyer_id = (select auth.uid())
        or c.seller_id = (select auth.uid())
      )
  )
);

create policy "conversation participants can upload own chat attachments"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.conversations c
    where c.id::text = (storage.foldername(name))[1]
      and (
        c.buyer_id = (select auth.uid())
        or c.seller_id = (select auth.uid())
      )
  )
);
