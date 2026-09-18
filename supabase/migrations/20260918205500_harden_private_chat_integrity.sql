-- Protect private chat integrity while preserving the current UI contract.

-- Private chat data is never available to anonymous clients.
revoke all on public.conversations from anon;
revoke all on public.messages from anon;

-- Authenticated users only need to create a conversation with its three
-- relationship columns and touch updated_at afterwards.
revoke insert, update, delete, truncate, references, trigger
  on public.conversations from authenticated;

grant insert (listing_id, buyer_id, seller_id)
  on public.conversations to authenticated;
grant update (updated_at)
  on public.conversations to authenticated;

-- Message content is immutable once sent. The browser may insert a message,
-- and recipients may only update read_at.
revoke insert, update, delete, truncate, references, trigger
  on public.messages from authenticated;

grant insert (
  conversation_id,
  sender_id,
  body,
  read_at,
  attachment_url,
  attachment_path,
  attachment_name,
  attachment_type,
  attachment_size
) on public.messages to authenticated;

grant update (read_at)
  on public.messages to authenticated;

drop policy if exists "Users can insert own conversations"
  on public.conversations;

create policy "Users can insert valid own conversations"
on public.conversations
for insert
to authenticated
with check (
  buyer_id = (select auth.uid())
  and seller_id is not null
  and seller_id <> (select auth.uid())
  and exists (
    select 1
    from public.listings l
    where l.id = conversations.listing_id
      and l.seller_id = conversations.seller_id
      and l.status = 'available'
  )
);

drop policy if exists "Users can update own conversations"
  on public.conversations;

create policy "Participants can touch own conversations"
on public.conversations
for update
to authenticated
using (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
)
with check (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
);

drop policy if exists messages_update_own_conversations
  on public.messages;

create policy messages_update_read_receipts
on public.messages
for update
to authenticated
using (
  sender_id is distinct from (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.buyer_id = (select auth.uid())
        or c.seller_id = (select auth.uid())
      )
  )
)
with check (
  sender_id is distinct from (select auth.uid())
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.buyer_id = (select auth.uid())
        or c.seller_id = (select auth.uid())
      )
  )
);
