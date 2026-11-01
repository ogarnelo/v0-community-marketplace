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
