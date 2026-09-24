-- Liquidity attribution V1: stable need identity using existing demand_requests.

alter table public.saved_searches
  add column if not exists demand_request_id uuid references public.demand_requests(id) on delete set null;

alter table public.conversations
  add column if not exists demand_request_id uuid references public.demand_requests(id) on delete set null;

alter table public.agreements
  add column if not exists demand_request_id uuid references public.demand_requests(id) on delete set null;

alter table public.demand_requests
  add column if not exists matched_listing_id uuid references public.listings(id) on delete set null,
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists confirmed_agreement_id uuid references public.agreements(id) on delete set null,
  add column if not exists first_result_at timestamptz,
  add column if not exists first_contact_at timestamptz,
  add column if not exists first_agreement_at timestamptz,
  add column if not exists resolved_at timestamptz;

create index if not exists saved_searches_demand_request_id_idx
  on public.saved_searches (demand_request_id)
  where demand_request_id is not null;

create index if not exists conversations_demand_request_id_idx
  on public.conversations (demand_request_id)
  where demand_request_id is not null;

create index if not exists agreements_demand_request_id_idx
  on public.agreements (demand_request_id)
  where demand_request_id is not null;

create index if not exists demand_requests_liquidity_idx
  on public.demand_requests (school_id, category, grade_level, created_at desc);

create index if not exists demand_requests_resolved_at_idx
  on public.demand_requests (resolved_at)
  where resolved_at is not null;

-- Backfill existing explicit zero-result saved searches so pilot data keeps a stable need_id.
insert into public.demand_requests (
  id,
  user_id,
  title,
  normalized_query,
  category,
  grade_level,
  isbn,
  school_id,
  status,
  source,
  metadata,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  s.user_id,
  left(coalesce(nullif(trim(s.need_details), ''), nullif(trim(s.query), ''), nullif(trim(s.isbn_query), ''), nullif(trim(s.category), ''), nullif(trim(s.grade_level), ''), 'Necesidad guardada'), 160),
  nullif(lower(trim(coalesce(s.query, s.need_details, ''))), ''),
  s.category,
  s.grade_level,
  s.isbn_query,
  s.school_id,
  'open',
  'saved_search',
  jsonb_build_object('saved_search_id', s.id::text, 'intent_source', s.intent_source),
  s.created_at,
  coalesce(s.updated_at, s.created_at)
from public.saved_searches s
where s.demand_request_id is null
  and s.results_count = 0
  and s.intent_source = 'zero_results_prompt'
  and not exists (
    select 1
    from public.demand_requests d
    where d.metadata ->> 'saved_search_id' = s.id::text
  );

update public.saved_searches s
set demand_request_id = d.id
from public.demand_requests d
where s.demand_request_id is null
  and d.metadata ->> 'saved_search_id' = s.id::text;
