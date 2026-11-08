-- Real Supabase local stack ONLY. No hosted database calls.
create table public.conversations (
 id uuid primary key,
 buyer_id uuid not null,
 seller_id uuid not null
);
create table public.messages (
 id uuid primary key,
 conversation_id uuid not null references public.conversations(id),
 attachment_path text,
 attachment_type text
);
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
create policy qa_conversations_select_participant on public.conversations
for select to authenticated
using (buyer_id=(select auth.uid()) or seller_id=(select auth.uid()));
create policy qa_messages_select_participant on public.messages
for select to authenticated
using (exists(
  select 1 from public.conversations c where c.id=messages.conversation_id
  and (c.buyer_id=(select auth.uid()) or c.seller_id=(select auth.uid()))
));
grant select on public.conversations,public.messages to authenticated;
insert into storage.buckets(id,name,public,file_size_limit)
values('chat-attachments','chat-attachments',false,10485760);
