-- Durable, minimal post-publication outbox. Captures listing IDs in the same
-- database transaction as a new listing; no email is sent by this migration.
-- The worker is feature-flagged OFF and is intentionally not scheduled yet.
create table if not exists public.marketplace_alert_outbox (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  state text not null default 'pending'
    check (state in ('pending','processing','completed','failed')),
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  attempts integer not null default 0 check (attempts between 0 and 4),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  completed_at timestamptz
);

alter table public.marketplace_alert_outbox enable row level security;
revoke all on table public.marketplace_alert_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.marketplace_alert_outbox to service_role;

create index if not exists marketplace_alert_outbox_due_idx
  on public.marketplace_alert_outbox(next_attempt_at, created_at)
  where state in ('pending', 'processing');

create schema if not exists wetudy_internal;
revoke all on schema wetudy_internal from public, anon, authenticated;

create or replace function wetudy_internal.marketplace_alert_enqueue_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'available'
     and new.is_demo is distinct from true
     and (new.seller_id is not null or new.user_id is not null) then
    insert into public.marketplace_alert_outbox(listing_id)
    values (new.id)
    on conflict (listing_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function wetudy_internal.marketplace_alert_enqueue_v1()
  from public, anon, authenticated;

drop trigger if exists marketplace_alert_enqueue_after_insert_v1 on public.listings;
create trigger marketplace_alert_enqueue_after_insert_v1
  after insert on public.listings
  for each row execute function wetudy_internal.marketplace_alert_enqueue_v1();

-- Atomic claim with SKIP LOCKED and a fencing token. Only the service role
-- can execute. An abandoned job can be reclaimed after the lease expires.
create or replace function public.marketplace_alert_claim_outbox_v1(
  p_limit integer default 1,
  p_lease_seconds integer default 240
)
returns table(listing_id uuid, lease_token uuid, attempts integer)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 2
     or p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'Invalid outbox claim limits';
  end if;

  return query
    with due as (
      select q.listing_id
      from public.marketplace_alert_outbox as q
      where q.expires_at > now()
        and q.attempts < 4
        and (
          (q.state = 'pending' and q.next_attempt_at <= now())
          or (q.state = 'processing' and q.lease_until < now())
        )
      order by q.next_attempt_at, q.created_at, q.listing_id
      for update skip locked
      limit p_limit
    )
    update public.marketplace_alert_outbox as q
    set state = 'processing',
        attempts = q.attempts + 1,
        lease_token = gen_random_uuid(),
        lease_until = now() + make_interval(secs => p_lease_seconds)
    from due
    where q.listing_id = due.listing_id
    returning q.listing_id, q.lease_token, q.attempts;
end;
$$;

revoke all on function public.marketplace_alert_claim_outbox_v1(integer,integer)
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_claim_outbox_v1(integer,integer)
  to service_role;

-- A worker cannot finish a job it no longer owns. The error field accepts
-- only a short machine-readable code, never PII or provider error bodies.
create or replace function public.marketplace_alert_settle_outbox_v1(
  p_listing_id uuid,
  p_lease_token uuid,
  p_success boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed integer;
begin
  update public.marketplace_alert_outbox as q
  set state = case
        when p_success then 'completed'
        when q.attempts >= 4 or q.expires_at <= now() then 'failed'
        else 'pending'
      end,
      next_attempt_at = case when p_success then q.next_attempt_at
        else now() + case
          when q.attempts <= 1 then interval '2 minutes'
          when q.attempts = 2 then interval '5 minutes'
          else interval '15 minutes'
        end
      end,
      completed_at = case when p_success then now() else null end,
      last_error_code = case when p_success then null
        else left(regexp_replace(coalesce(p_error_code, 'unknown'), '[^a-z0-9_-]', '', 'g'), 64)
      end,
      lease_token = null,
      lease_until = null
  where q.listing_id = p_listing_id
    and q.state = 'processing'
    and q.lease_token = p_lease_token;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.marketplace_alert_settle_outbox_v1(uuid,uuid,boolean,text)
  from public, anon, authenticated;
grant execute on function public.marketplace_alert_settle_outbox_v1(uuid,uuid,boolean,text)
  to service_role;

notify pgrst, 'reload schema';
