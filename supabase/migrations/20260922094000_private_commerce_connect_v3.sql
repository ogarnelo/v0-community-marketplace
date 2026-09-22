-- Private commerce Connect foundation.
-- Public launch remains disabled; writes are service_role-only.

create table if not exists public.seller_connect_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique,
  account_type text not null default 'express',
  onboarding_status text not null default 'pending',
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  charges_enabled boolean not null default false,
  transfers_active boolean not null default false,
  requirements_currently_due jsonb not null default '[]'::jsonb,
  requirements_eventually_due jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_connect_accounts_status_allowed
    check (onboarding_status in ('pending','restricted','ready','disabled'))
);

alter table public.seller_connect_accounts enable row level security;
revoke all on table public.seller_connect_accounts from public;
revoke all on table public.seller_connect_accounts from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.seller_connect_accounts from authenticated;
grant select on table public.seller_connect_accounts to authenticated;
grant all on table public.seller_connect_accounts to service_role;

drop policy if exists seller_connect_accounts_select_owner
  on public.seller_connect_accounts;
create policy seller_connect_accounts_select_owner
  on public.seller_connect_accounts
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_superadmin())
  );

create table if not exists public.commerce_transfers (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete restrict,
  seller_id uuid not null references auth.users(id) on delete restrict,
  stripe_account_id text not null,
  provider_transfer_id text unique,
  amount numeric not null check (amount > 0),
  currency text not null default 'EUR',
  status text not null default 'pending',
  provider_reversal_id text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  released_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_transfers_payment_unique unique(payment_intent_id),
  constraint commerce_transfers_status_allowed
    check (status in ('pending','released','reversed','failed'))
);

alter table public.commerce_transfers enable row level security;
revoke all on table public.commerce_transfers from public;
revoke all on table public.commerce_transfers from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.commerce_transfers from authenticated;
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

create table if not exists public.commerce_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete restrict,
  buyer_id uuid not null references auth.users(id) on delete restrict,
  provider_refund_id text unique,
  amount numeric not null check (amount > 0),
  currency text not null default 'EUR',
  status text not null default 'pending',
  transfer_reversal_id text,
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_refunds_payment_unique unique(payment_intent_id),
  constraint commerce_refunds_status_allowed
    check (status in ('pending','succeeded','failed'))
);

alter table public.commerce_refunds enable row level security;
revoke all on table public.commerce_refunds from public;
revoke all on table public.commerce_refunds from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.commerce_refunds from authenticated;
grant select on table public.commerce_refunds to authenticated;
grant all on table public.commerce_refunds to service_role;

drop policy if exists commerce_refunds_select_authorized
  on public.commerce_refunds;
create policy commerce_refunds_select_authorized
  on public.commerce_refunds
  for select
  to authenticated
  using (
    buyer_id = (select auth.uid())
    or (select public.is_superadmin())
  );

create index if not exists seller_connect_accounts_status_idx
  on public.seller_connect_accounts(onboarding_status, updated_at desc);

create index if not exists commerce_transfers_seller_idx
  on public.commerce_transfers(seller_id, created_at desc);

create index if not exists commerce_refunds_buyer_idx
  on public.commerce_refunds(buyer_id, created_at desc);
