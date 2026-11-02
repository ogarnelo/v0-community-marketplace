-- Wetudy WhatsApp: restricted opt-in linking pilot, migration NOT auto-applied.
-- No WhatsApp payloads are stored; only the verified sender ID and short-lived request hash.
create table if not exists public.whatsapp_account_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wa_id text not null unique,
  linked_at timestamptz not null default now(),
  constraint whatsapp_account_links_wa_id_format check (wa_id ~ '^[0-9]{8,20}$')
);
create table if not exists public.whatsapp_link_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  pending_wa_id text,
  verified_at timestamptz,
  constraint whatsapp_link_requests_pending_format check (pending_wa_id is null or pending_wa_id ~ '^[0-9]{8,20} check (token_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists whatsapp_link_requests_expiry_idx
  on public.whatsapp_link_requests (expires_at);

alter table public.whatsapp_account_links enable row level security;
alter table public.whatsapp_link_requests enable row level security;

revoke all on public.whatsapp_account_links from public, anon, authenticated;
revoke all on public.whatsapp_link_requests from public, anon, authenticated;
grant all on public.whatsapp_account_links to service_role;
grant all on public.whatsapp_link_requests to service_role;

-- Deliberately no authenticated policies: linking/unlinking only through the
-- authenticated server endpoint, validated Meta signature, and service role.
comment on table public.whatsapp_account_links is 'Private opt-in WhatsApp identity mapping for pilot accounts. Not a user profile phone number.';
comment on table public.whatsapp_link_requests is 'One-time hashed tokens for linking; never store plaintext token.';

-- Atomic link: consume the one-time token and bind the provider-verified WA ID
-- in one transaction. Only the service role may invoke this SECURITY DEFINER.
create or replace function public.link_whatsapp_account_from_token(
  p_token_hash text, p_wa_id text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' or p_wa_id !~ '^[0-9]{8,20}$' then
    return 'invalid';
  end if;
  select req.user_id into v_user_id
  from public.whatsapp_link_requests req
  where req.token_hash = p_token_hash and req.consumed_at is null
    and req.expires_at > now()
  for update;
  if v_user_id is null then return 'expired'; end if;
  if exists(
    select 1 from public.whatsapp_account_links
    where wa_id=p_wa_id and user_id<>v_user_id
  ) then return 'wa_in_use'; end if;
  update public.whatsapp_link_requests
  set consumed_at=now(), pending_wa_id=p_wa_id, verified_at=now()
  where user_id=v_user_id;
  return 'pending_confirmation';
end;
$$;

-- Second factor: logged-in account owner must approve the last four digits
-- of Meta-verified sender ID from Wetudy itself. Provider only supplies
-- candidate identity, never creates an actual account link by itself.
create or replace function public.confirm_whatsapp_account_link(
  p_user_id uuid
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_pending text;
  v_existing text;
begin
  select pending_wa_id into v_pending
    from public.whatsapp_link_requests
    where user_id=p_user_id and consumed_at is not null
      and pending_wa_id is not null
      and verified_at > now()-interval '10 minutes'
    for update;
  if v_pending is null then return 'expired'; end if;
  select wa_id into v_existing from public.whatsapp_account_links
    where user_id=p_user_id for update;
  if v_existing is not null and v_existing<>v_pending
  then return 'already_linked'; end if;
  if exists(
    select 1 from public.whatsapp_account_links
    where wa_id=v_pending and user_id<>p_user_id
  ) then return 'wa_in_use'; end if;
  insert into public.whatsapp_account_links(user_id,wa_id)
    values(p_user_id,v_pending)
    on conflict (user_id) do nothing;
  delete from public.whatsapp_link_requests where user_id=p_user_id;
  return 'linked';
exception when unique_violation then return 'wa_in_use';
end;
$$;

revoke all on function public.link_whatsapp_account_from_token(text, text)
  from public, anon, authenticated;
grant execute on function public.link_whatsapp_account_from_token(text, text)
  to service_role;
),
  constraint whatsapp_link_requests_token_hash_format check (token_hash ~ '^[a-f0-9]{64}$')
);
create index if not exists whatsapp_link_requests_expiry_idx
  on public.whatsapp_link_requests (expires_at);

alter table public.whatsapp_account_links enable row level security;
alter table public.whatsapp_link_requests enable row level security;

revoke all on public.whatsapp_account_links from public, anon, authenticated;
revoke all on public.whatsapp_link_requests from public, anon, authenticated;
grant all on public.whatsapp_account_links to service_role;
grant all on public.whatsapp_link_requests to service_role;

-- Deliberately no authenticated policies: linking/unlinking only through the
-- authenticated server endpoint, validated Meta signature, and service role.
comment on table public.whatsapp_account_links is 'Private opt-in WhatsApp identity mapping for pilot accounts. Not a user profile phone number.';
comment on table public.whatsapp_link_requests is 'One-time hashed tokens for linking; never store plaintext token.';

-- Atomic link: consume the one-time token and bind the provider-verified WA ID
-- in one transaction. Only the service role may invoke this SECURITY DEFINER.
create or replace function public.link_whatsapp_account_from_token(
  p_token_hash text,
  p_wa_id text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_existing_wa text;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' or p_wa_id !~ '^[0-9]{8,20}$' then
    return 'invalid';
  end if;

  select req.user_id into v_user_id
  from public.whatsapp_link_requests req
  where req.token_hash = p_token_hash
    and req.consumed_at is null
    and req.expires_at > now()
  for update;

  if v_user_id is null then
    return 'expired';
  end if;

  select link.wa_id into v_existing_wa
  from public.whatsapp_account_links link
  where link.user_id = v_user_id
  for update;

  if v_existing_wa is not null and v_existing_wa <> p_wa_id then
    return 'already_linked';
  end if;

  if exists(
    select 1 from public.whatsapp_account_links link
    where link.wa_id = p_wa_id and link.user_id <> v_user_id
  ) then
    return 'wa_in_use';
  end if;

  insert into public.whatsapp_account_links (user_id, wa_id)
  values (v_user_id, p_wa_id)
  on conflict (user_id) do update
  set linked_at = now();

  update public.whatsapp_link_requests
  set consumed_at = now()
  where user_id = v_user_id;

  return 'linked';
exception
  when unique_violation then
    return 'wa_in_use';
end;
$$;

revoke all on function public.link_whatsapp_account_from_token(text, text)
  from public, anon, authenticated;
grant execute on function public.link_whatsapp_account_from_token(text, text)
  to service_role;

revoke all on function public.confirm_whatsapp_account_link(uuid) from public,anon,authenticated;
grant execute on function public.confirm_whatsapp_account_link(uuid) to service_role;
