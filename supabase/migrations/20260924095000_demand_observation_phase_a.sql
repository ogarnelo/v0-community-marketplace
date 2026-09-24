-- Phase A: turn zero-result searches and stale conversations into observable demand.
-- Additive only: existing saved-search and conversation behavior remains unchanged.

alter table public.saved_searches
  add column if not exists need_details text;

alter table public.saved_searches
  add column if not exists intent_source text not null default 'saved_search';

comment on column public.saved_searches.need_details is
  'Optional free-text detail supplied by the user when a zero-result search becomes explicit demand.';

comment on column public.saved_searches.intent_source is
  'Where the saved demand originated, e.g. saved_search or zero_results_prompt.';

create table if not exists public.conversation_outcome_feedback (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feedback_role text not null check (feedback_role in ('buyer', 'seller')),
  reason text not null check (
    reason in (
      'bought_here',
      'unavailable',
      'seller_no_response',
      'price',
      'distance',
      'found_other',
      'no_longer_needed',
      'sold_here',
      'sold_elsewhere',
      'still_available',
      'buyer_no_response',
      'decided_not_to_sell',
      'other'
    )
  ),
  details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

comment on table public.conversation_outcome_feedback is
  'Low-friction feedback from participants when a conversation has gone inactive.';

create index if not exists conversation_outcome_feedback_created_idx
  on public.conversation_outcome_feedback (created_at desc);

create index if not exists conversation_outcome_feedback_reason_idx
  on public.conversation_outcome_feedback (reason, created_at desc);

alter table public.conversation_outcome_feedback enable row level security;

revoke all on table public.conversation_outcome_feedback from anon;
revoke all on table public.conversation_outcome_feedback from authenticated;
grant select on table public.conversation_outcome_feedback to authenticated;
grant all on table public.conversation_outcome_feedback to service_role;

drop policy if exists conversation_outcome_feedback_select_authorized
  on public.conversation_outcome_feedback;

create policy conversation_outcome_feedback_select_authorized
  on public.conversation_outcome_feedback
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.is_superadmin())
  );
