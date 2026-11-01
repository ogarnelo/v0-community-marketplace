-- WhatsApp guided listing flow — pilot only. NEVER apply to production without approval.
-- Requires migration 20261101130000_whatsapp_account_link_pilot.sql first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('whatsapp-draft-photos', 'whatsapp-draft-photos', false, 3145728,
        array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do nothing;
-- No anon/authenticated storage access: all upload/download/delete uses service role.
drop policy if exists "WhatsApp drafts accessible to service role only" on storage.objects;
-- Do not grant a policy to anon or authenticated.

create table if not exists public.whatsapp_listing_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  step text not null default 'idle'
    check (step in ('idle','category','title','description','details','condition','intent','price','originalPrice','grade','review','published')),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  draft_photo_path text,
  last_message_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lease_id uuid,
  in_flight_until timestamptz
);

create table if not exists public.whatsapp_incoming_events (
  message_id text primary key check (length(message_id) between 8 and 256),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing','completed')),
  attempts int not null default 1 check (attempts between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_incoming_events_created_idx
  on public.whatsapp_incoming_events (created_at);

create table if not exists public.whatsapp_ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null default (now() at time zone 'utc')::date,
  requests int not null default 0 check (requests >= 0),
  primary key (user_id, usage_day)
);

alter table public.whatsapp_listing_sessions enable row level security;
alter table public.whatsapp_incoming_events enable row level security;
alter table public.whatsapp_ai_daily_usage enable row level security;
revoke all on public.whatsapp_listing_sessions from public, anon, authenticated;
revoke all on public.whatsapp_incoming_events from public, anon, authenticated;
revoke all on public.whatsapp_ai_daily_usage from public, anon, authenticated;
grant all on public.whatsapp_listing_sessions to service_role;
grant all on public.whatsapp_incoming_events to service_role;
grant all on public.whatsapp_ai_daily_usage to service_role;

-- Prevent overlapping webhook handlers for one WhatsApp account.
-- A 2-minute lease is chosen to exceed bounded Meta+OpenAI download timeouts.
create or replace function public.claim_whatsapp_incoming(
  p_user_id uuid, p_message_id text, p_lease_id uuid
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.whatsapp_listing_sessions%rowtype;
  v_event public.whatsapp_incoming_events%rowtype;
begin
  if p_message_id is null or length(p_message_id) not between 8 and 256
     or p_lease_id is null then return 'invalid'; end if;

  insert into public.whatsapp_listing_sessions (user_id)
  values (p_user_id) on conflict (user_id) do nothing;

  select * into v_session from public.whatsapp_listing_sessions
  where user_id = p_user_id for update;

  if v_session.in_flight_until is not null
     and v_session.in_flight_until > now() then return 'busy'; end if;

  select * into v_event from public.whatsapp_incoming_events
  where message_id = p_message_id for update;

  if v_event.message_id is not null then
    if v_event.user_id <> p_user_id then return 'invalid'; end if;
    if v_event.status = 'completed' or v_event.attempts >= 3 then return 'duplicate'; end if;
    update public.whatsapp_incoming_events
      set attempts = attempts + 1, updated_at = now()
      where message_id = p_message_id;
  else
    insert into public.whatsapp_incoming_events (message_id, user_id)
    values (p_message_id, p_user_id);
  end if;

  update public.whatsapp_listing_sessions
    set lease_id = p_lease_id, in_flight_until = now() + interval '2 minutes'
    where user_id = p_user_id;

  return 'claimed';
end;
$$;

-- Atomically persist a state transition and mark the message completed.
create or replace function public.complete_whatsapp_incoming(
  p_user_id uuid, p_message_id text, p_lease_id uuid,
  p_step text, p_payload jsonb, p_photo_path text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_step not in ('idle','category','title','description','details','condition','intent','price','originalPrice','grade','review','published')
     or jsonb_typeof(p_payload) <> 'object' or pg_catalog.octet_length(p_payload::text) > 12000
     or (p_photo_path is not null and (
       length(p_photo_path) > 300 or
       p_photo_path not like p_user_id::text || '/%'))
  then return false; end if;

  update public.whatsapp_listing_sessions
    set step=p_step, payload=p_payload, draft_photo_path=p_photo_path,
        updated_at=now(), last_message_at=now(),
        lease_id=null, in_flight_until=null
    where user_id=p_user_id and lease_id=p_lease_id
      and in_flight_until > now();
  if not found then return false; end if;

  update public.whatsapp_incoming_events set status='completed', updated_at=now()
    where message_id=p_message_id and user_id=p_user_id;
  return found;
end;
$$;

create or replace function public.release_whatsapp_incoming(
  p_user_id uuid, p_lease_id uuid
) returns boolean
language sql security definer set search_path = ''
as $$
  update public.whatsapp_listing_sessions
  set lease_id = null, in_flight_until = null
  where user_id = p_user_id and lease_id = p_lease_id
  returning true;
$$;

-- Global + per-user limits, serialized to avoid parallel overage.
create or replace function public.reserve_whatsapp_ai_request(
  p_user_id uuid
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_total int;
  v_current int;
begin
  perform pg_catalog.pg_advisory_xact_lock(72218840);
  select coalesce(sum(requests),0) into v_total
  from public.whatsapp_ai_daily_usage where usage_day = v_today;
  select requests into v_current
  from public.whatsapp_ai_daily_usage
  where user_id=p_user_id and usage_day=v_today;
  if v_total >= 100 or coalesce(v_current,0) >= 5 then return false; end if;
  insert into public.whatsapp_ai_daily_usage(user_id, usage_day, requests)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_day)
  do update set requests = whatsapp_ai_daily_usage.requests + 1;
  return true;
end;
$$;

revoke all on function public.claim_whatsapp_incoming(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.complete_whatsapp_incoming(uuid,text,uuid,text,jsonb,text) from public,anon,authenticated;
revoke all on function public.release_whatsapp_incoming(uuid,uuid) from public,anon,authenticated;
revoke all on function public.reserve_whatsapp_ai_request(uuid) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_incoming(uuid,text,uuid) to service_role;
grant execute on function public.complete_whatsapp_incoming(uuid,text,uuid,text,jsonb,text) to service_role;
grant execute on function public.release_whatsapp_incoming(uuid,uuid) to service_role;
grant execute on function public.reserve_whatsapp_ai_request(uuid) to service_role;
