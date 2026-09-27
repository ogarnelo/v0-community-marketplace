-- Account students foundation.
-- ADDITIVE ONLY. This migration intentionally keeps profiles.school_id and
-- profiles.grade_level unchanged for backwards compatibility with the
-- production account, marketplace and existing filters.

create table if not exists public.account_students (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null,
  alias text,
  school_id uuid not null references public.schools(id) on delete restrict,
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

-- Normal clients may read only their own student contexts.
-- Writes are intentionally server-side so account type / relationship rules
-- can be enforced without exposing a broad direct-write surface.
revoke all on table public.account_students from anon, authenticated;
grant select on table public.account_students to authenticated;

drop policy if exists account_students_select_own on public.account_students;
create policy account_students_select_own
  on public.account_students
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

-- Link personalized demand/alerts to a student without changing any existing
-- marketplace behavior. Existing rows remain general with student_id = null.
alter table public.demand_requests
  add column if not exists student_id uuid references public.account_students(id) on delete set null;

create index if not exists demand_requests_student_idx
  on public.demand_requests (student_id, status, created_at desc)
  where student_id is not null;

alter table public.saved_searches
  add column if not exists student_id uuid references public.account_students(id) on delete set null;

create index if not exists saved_searches_student_idx
  on public.saved_searches (student_id, created_at desc)
  where student_id is not null;

-- Conservative compatibility backfill:
-- only profiles that already have BOTH school and grade are migrated.
-- profiles.school_id / profiles.grade_level are deliberately retained and
-- remain the current production compatibility context.
with current_year as (
  select
    case
      when extract(month from current_date) >= 8
        then extract(year from current_date)::int
      else extract(year from current_date)::int - 1
    end as start_year
),
legacy_context as (
  select
    p.id as owner_user_id,
    case
      when p.user_type = 'student' then 'self'
      when p.user_type = 'parent' then 'guardian'
      else null
    end as relationship,
    p.school_id,
    p.grade_level,
    cy.start_year::text || '/' || right((cy.start_year + 1)::text, 2) as academic_year
  from public.profiles p
  cross join current_year cy
  where p.school_id is not null
    and p.grade_level is not null
    and p.user_type in ('student', 'parent')
)
insert into public.account_students (
  owner_user_id,
  relationship,
  alias,
  school_id,
  grade_level,
  academic_year,
  is_primary,
  active,
  sort_order
)
select
  legacy.owner_user_id,
  legacy.relationship,
  null,
  legacy.school_id,
  legacy.grade_level,
  legacy.academic_year,
  true,
  true,
  0
from legacy_context legacy
where legacy.relationship is not null
  and not exists (
    select 1
    from public.account_students existing
    where existing.owner_user_id = legacy.owner_user_id
      and existing.active = true
  );
