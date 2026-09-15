-- Internal sandbox for future protected agreements.
-- This does not activate checkout, Stripe Connect onboarding, Correos labels or buyer protection for users.

create table if not exists public.payment_shipping_sandbox_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  agreement_id uuid references public.agreements(id) on delete set null,
  provider text not null,
  mode text not null default 'sandbox',
  scenario text not null,
  amount_cents integer,
  currency text not null default 'eur',
  status text not null default 'planned',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  constraint payment_shipping_sandbox_provider_check check (provider in ('stripe_connect', 'correos', 'shipping_aggregator')),
  constraint payment_shipping_sandbox_mode_check check (mode in ('sandbox', 'test'))
);

create index if not exists payment_shipping_sandbox_runs_created_idx
  on public.payment_shipping_sandbox_runs(created_at desc);

alter table public.payment_shipping_sandbox_runs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_shipping_sandbox_runs' and policyname = 'payment_shipping_sandbox_admin_select') then
    create policy payment_shipping_sandbox_admin_select
      on public.payment_shipping_sandbox_runs
      for select
      to authenticated
      using (public.is_superadmin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_shipping_sandbox_runs' and policyname = 'payment_shipping_sandbox_admin_insert') then
    create policy payment_shipping_sandbox_admin_insert
      on public.payment_shipping_sandbox_runs
      for insert
      to authenticated
      with check (public.is_superadmin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'payment_shipping_sandbox_runs' and policyname = 'payment_shipping_sandbox_admin_update') then
    create policy payment_shipping_sandbox_admin_update
      on public.payment_shipping_sandbox_runs
      for update
      to authenticated
      using (public.is_superadmin())
      with check (public.is_superadmin());
  end if;
end $$;
