-- Pilot-only durable send-intent primitives. NOT connected to any mail route.
-- A sending/ambiguous intent must never be automatically retried; provider
-- confirmation is non-atomic with Postgres. Do not enable the outbox worker.
create table if not exists public.marketplace_alert_email_intents (
  event_key text primary key check (length(event_key) between 1 and 200),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  state text not null default 'prepared'
    check (state in ('prepared','sending','accepted','ambiguous')),
  send_token uuid not null default gen_random_uuid(),
  provider_message_id text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  accepted_at timestamptz,
  constraint marketplace_alert_email_intents_timestamps_chk
    check (
      (state='prepared' and started_at is null and accepted_at is null)
      or (state in ('sending','ambiguous') and started_at is not null and accepted_at is null)
      or (state='accepted' and started_at is not null and accepted_at is not null)
    )
);
alter table public.marketplace_alert_email_intents enable row level security;
revoke all on public.marketplace_alert_email_intents from public, anon, authenticated;
grant select, insert, update on public.marketplace_alert_email_intents to service_role;

-- Atomic, idempotent reservation. An existing event with different payload is
-- rejected; no data about recipients, postcodes or school affiliation stored.
create or replace function public.marketplace_alert_email_prepare_v1(
  p_event_key text, p_payload_sha256 text
) returns table(outcome text, intent_token uuid)
language plpgsql security invoker set search_path = ''
as $$
declare v_row public.marketplace_alert_email_intents%rowtype;
begin
  if p_event_key is null or length(p_event_key) not between 1 and 200
    or p_payload_sha256 is null or p_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid alert intent parameters';
  end if;
  insert into public.marketplace_alert_email_intents(event_key,payload_sha256)
  values(p_event_key,p_payload_sha256)
  on conflict (event_key) do nothing;
  select * into v_row from public.marketplace_alert_email_intents
    where event_key=p_event_key for update;
  if v_row.payload_sha256 <> p_payload_sha256 then
    return query select 'payload_conflict'::text,null::uuid;
  else
    return query select v_row.state::text,v_row.send_token;
  end if;
end;
$$;

-- Exactly ONE transition may reach the external-provider boundary. After
-- this transition the operation is uncertain until explicit reconciliation.
create or replace function public.marketplace_alert_email_begin_v1(
  p_event_key text,p_payload_sha256 text,p_token uuid
) returns boolean
language sql security invoker set search_path = ''
as $$
  with transition as (
    update public.marketplace_alert_email_intents i
    set state='sending',started_at=now()
    where i.event_key=p_event_key and i.payload_sha256=p_payload_sha256
      and i.send_token=p_token and i.state='prepared'
    returning 1
  )
  select exists(select 1 from transition);
$$;

create or replace function public.marketplace_alert_email_accept_v1(
  p_event_key text,p_token uuid,p_provider_message_id text
) returns boolean
language sql security invoker set search_path = ''
as $$
  with transition as (
    update public.marketplace_alert_email_intents i
    set state='accepted',accepted_at=now(),
        provider_message_id=nullif(left(trim(p_provider_message_id),200),'')
    where i.event_key=p_event_key and i.send_token=p_token
      and i.state='sending'
      and p_provider_message_id is not null and length(trim(p_provider_message_id)) between 1 and 200
    returning 1
  )
  select exists(select 1 from transition);
$$;

-- No RPC transitions ambiguous/sending to prepared: unknown outcomes require
-- manual, auditable reconciliation before any retry can be considered.
create or replace function public.marketplace_alert_email_ambiguous_v1(
  p_event_key text,p_token uuid
) returns boolean
language sql security invoker set search_path = ''
as $$
  with transition as (
    update public.marketplace_alert_email_intents i set state='ambiguous'
    where i.event_key=p_event_key and i.send_token=p_token
      and i.state='sending'
    returning 1
  )
  select exists(select 1 from transition);
$$;

revoke all on function public.marketplace_alert_email_prepare_v1(text,text) from public,anon,authenticated;
revoke all on function public.marketplace_alert_email_begin_v1(text,text,uuid) from public,anon,authenticated;
revoke all on function public.marketplace_alert_email_accept_v1(text,uuid,text) from public,anon,authenticated;
revoke all on function public.marketplace_alert_email_ambiguous_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_alert_email_prepare_v1(text,text) to service_role;
grant execute on function public.marketplace_alert_email_begin_v1(text,text,uuid) to service_role;
grant execute on function public.marketplace_alert_email_accept_v1(text,uuid,text) to service_role;
grant execute on function public.marketplace_alert_email_ambiguous_v1(text,uuid) to service_role;
-- Private counts only: no recipient, event key, provider ID, postcode or school.
create or replace function public.marketplace_alert_email_intent_health_v1()
returns table(
  total bigint, prepared bigint, sending bigint, accepted bigint,
  ambiguous bigint, oldest_unresolved_minutes integer
)
language sql security invoker set search_path = ''
as $
  select count(*)::bigint,
    count(*) filter (where state='prepared')::bigint,
    count(*) filter (where state='sending')::bigint,
    count(*) filter (where state='accepted')::bigint,
    count(*) filter (where state='ambiguous')::bigint,
    coalesce(floor(extract(epoch from (now()-min(started_at)
      filter (where state in ('sending','ambiguous'))))/60)::integer,0)
  from public.marketplace_alert_email_intents;
$;
revoke all on function public.marketplace_alert_email_intent_health_v1()
  from public,anon,authenticated;
grant execute on function public.marketplace_alert_email_intent_health_v1()
  to service_role;

notify pgrst, 'reload schema';
