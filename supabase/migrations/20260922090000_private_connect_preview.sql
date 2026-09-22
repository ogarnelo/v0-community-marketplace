-- Private Stripe Connect preview: connected recipient accounts and delayed transfers.
-- Server-written. No public checkout activation is introduced here.

create table if not exists public.commerce_connected_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'stripe',
  provider_account_id text not null unique,
  api_namespace text not null default 'v2',
  configuration text not null default 'recipient',
  onboarding_status text not null default 'created',
  transfers_enabled boolean not null default false,
  requirements_due text[] not null default '{}',
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_connected_accounts_provider_check
    check (provider = 'stripe'),
  constraint commerce_connected_accounts_namespace_check
    check (api_namespace in ('v1', 'v2')),
  constraint commerce_connected_accounts_configuration_check
    check (configuration = 'recipient'),
  constraint commerce_connected_accounts_status_check
    check (onboarding_status in ('created', 'onboarding', 'ready', 'restricted'))
);

comment on table public.commerce_connected_accounts is
  'Private commerce preview. Minimal Stripe connected-account state; no identity documents or KYC values are stored here.';

alter table public.commerce_connected_accounts enable row level security;

revoke all on table public.commerce_connected_accounts from public;
revoke all on table public.commerce_connected_accounts from anon;
revoke all on table public.commerce_connected_accounts from authenticated;
grant select on table public.commerce_connected_accounts to authenticated;
grant all on table public.commerce_connected_accounts to service_role;

drop policy if exists commerce_connected_accounts_select_authorized
  on public.commerce_connected_accounts;

create policy commerce_connected_accounts_select_authorized
  on public.commerce_connected_accounts
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_superadmin())
  );

create table if not exists public.commerce_transfers (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null unique references public.payment_intents(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  connected_account_user_id uuid not null references public.commerce_connected_accounts(user_id) on delete restrict,
  provider text not null default 'stripe',
  provider_transfer_id text unique,
  amount numeric not null check (amount > 0),
  currency text not null default 'EUR',
  status text not null default 'eligible',
  release_reason text,
  metadata jsonb not null default '{}'::jsonb,
  released_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_transfers_provider_check
    check (provider = 'stripe'),
  constraint commerce_transfers_status_check
    check (status in ('eligible', 'releasing', 'released', 'reversed', 'failed'))
);

comment on table public.commerce_transfers is
  'Private commerce preview. Tracks delayed Stripe Connect transfers separately from buyer charges.';

alter table public.commerce_transfers enable row level security;

revoke all on table public.commerce_transfers from public;
revoke all on table public.commerce_transfers from anon;
revoke all on table public.commerce_transfers from authenticated;
grant select on table public.commerce_transfers to authenticated;
grant all on table public.commerce_transfers to service_role;

drop policy if exists commerce_transfers_select_authorized
  on public.commerce_transfers;

create policy commerce_transfers_select_authorized
  on public.commerce_transfers
  for select
  to authenticated
  using (
    seller_id = (select auth.uid())
    or (select public.is_superadmin())
  );

create index if not exists commerce_connected_accounts_status_idx
  on public.commerce_connected_accounts (onboarding_status, transfers_enabled);

create index if not exists commerce_transfers_status_idx
  on public.commerce_transfers (status, created_at desc);

create index if not exists commerce_transfers_seller_idx
  on public.commerce_transfers (seller_id, created_at desc);
