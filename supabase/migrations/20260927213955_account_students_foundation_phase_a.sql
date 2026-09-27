-- Account students foundation — Phase A.
-- STRICTLY ADDITIVE.
-- This migration creates a new table only. It deliberately does NOT alter,
-- update or backfill profiles, saved_searches, demand_requests, listings,
-- conversations, agreements or any other existing production table.

create table if not exists public.account_students (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null,
  alias text,
  school_id uuid references public.schools(id) on delete set null,
  grade_level text not null,
  academic_year text not null,
  is_primary boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint account_students_relationship_check
    check (relationship in ('self', 'guardian')),
  constraint account_students_alias_length_check
    check (alias is null or char_length(trim(alias)) between 1 and 80),
  constraint account_students_grade_length_check
    check (char_length(trim(grade_level)) between 1 and 80),
  constraint account_students_academic_year_check
    check (academic_year ~ '^[0-9]{4}/[0-9]{2}$')
);

create index if not exists account_students_owner_active_idx
  on public.account_students (owner_user_id, active, sort_order, created_at);

create index if not exists account_students_school_grade_idx
  on public.account_students (school_id, grade_level, academic_year)
  where active = true;

create unique index if not exists account_students_one_active_self_idx
  on public.account_students (owner_user_id)
  where relationship = 'self' and active = true;

create unique index if not exists account_students_one_primary_idx
  on public.account_students (owner_user_id)
  where is_primary = true and active = true;

alter table public.account_students enable row level security;

-- Authenticated clients can only read their own student contexts.
-- Writes remain server-side so later business rules can be enforced centrally.
revoke all on table public.account_students from anon, authenticated;
grant select on table public.account_students to authenticated;

drop policy if exists account_students_select_own on public.account_students;
create policy account_students_select_own
  on public.account_students
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);
