-- My Course beta foundation.
-- Additive only: no changes to marketplace/chat/agreement behavior.

create table if not exists public.product_feature_access (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  user_id uuid references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_feature_access_target_check
    check (num_nonnulls(user_id, school_id) = 1),
  constraint product_feature_access_feature_key_check
    check (char_length(feature_key) between 2 and 80)
);

create unique index if not exists product_feature_access_user_unique
  on public.product_feature_access (feature_key, user_id)
  where user_id is not null;

create unique index if not exists product_feature_access_school_unique
  on public.product_feature_access (feature_key, school_id)
  where school_id is not null;

alter table public.product_feature_access enable row level security;

revoke insert, update, delete on table public.product_feature_access from anon, authenticated;
grant select on table public.product_feature_access to authenticated;

drop policy if exists "Users can read applicable feature access" on public.product_feature_access;
create policy "Users can read applicable feature access"
  on public.product_feature_access
  for select
  to authenticated
  using (
    enabled = true
    and (
      user_id = (select auth.uid())
      or (
        school_id is not null
        and exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.school_id = product_feature_access.school_id
        )
      )
    )
  );

create table if not exists public.family_learners (
  id uuid primary key default gen_random_uuid(),
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  label text not null default 'Hijo/a',
  grade_level text not null,
  academic_year text not null,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_learners_label_check
    check (char_length(label) between 1 and 80),
  constraint family_learners_grade_level_check
    check (char_length(grade_level) between 1 and 80),
  constraint family_learners_academic_year_check
    check (academic_year ~ '^[0-9]{4}/[0-9]{2}$')
);

create index if not exists family_learners_parent_idx
  on public.family_learners (parent_user_id, active, sort_order, created_at);

create index if not exists family_learners_school_idx
  on public.family_learners (school_id, grade_level, academic_year)
  where active = true;

alter table public.family_learners enable row level security;
grant select, insert, update, delete on table public.family_learners to authenticated;

drop policy if exists "Users can read own learners" on public.family_learners;
create policy "Users can read own learners"
  on public.family_learners
  for select
  to authenticated
  using ((select auth.uid()) = parent_user_id);

drop policy if exists "Users can create own learners" on public.family_learners;
create policy "Users can create own learners"
  on public.family_learners
  for insert
  to authenticated
  with check ((select auth.uid()) = parent_user_id);

drop policy if exists "Users can update own learners" on public.family_learners;
create policy "Users can update own learners"
  on public.family_learners
  for update
  to authenticated
  using ((select auth.uid()) = parent_user_id)
  with check ((select auth.uid()) = parent_user_id);

drop policy if exists "Users can delete own learners" on public.family_learners;
create policy "Users can delete own learners"
  on public.family_learners
  for delete
  to authenticated
  using ((select auth.uid()) = parent_user_id);

alter table public.demand_requests
  add column if not exists learner_id uuid references public.family_learners(id) on delete set null,
  add column if not exists course_material_id uuid references public.course_materials(id) on delete set null;

create index if not exists demand_requests_learner_idx
  on public.demand_requests (learner_id, status, created_at desc)
  where learner_id is not null;

create index if not exists demand_requests_course_material_idx
  on public.demand_requests (course_material_id)
  where course_material_id is not null;
