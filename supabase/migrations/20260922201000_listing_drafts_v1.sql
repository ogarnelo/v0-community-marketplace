-- Persistent per-user listing draft used by the publishing flow.
-- Drafts are private to their owner and never appear in the public marketplace.

create table if not exists public.listing_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_drafts_user_unique unique (user_id),
  constraint listing_drafts_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint listing_drafts_photos_array check (jsonb_typeof(photos) = 'array')
);

alter table public.listing_drafts enable row level security;

revoke all on public.listing_drafts from anon;
grant select, insert, update, delete on public.listing_drafts to authenticated;
grant all on public.listing_drafts to service_role;

drop policy if exists listing_drafts_select_own on public.listing_drafts;
create policy listing_drafts_select_own
on public.listing_drafts
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists listing_drafts_insert_own on public.listing_drafts;
create policy listing_drafts_insert_own
on public.listing_drafts
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists listing_drafts_update_own on public.listing_drafts;
create policy listing_drafts_update_own
on public.listing_drafts
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists listing_drafts_delete_own on public.listing_drafts;
create policy listing_drafts_delete_own
on public.listing_drafts
for delete
to authenticated
using (user_id = (select auth.uid()));

create index if not exists listing_drafts_updated_at_idx
  on public.listing_drafts (updated_at desc);
