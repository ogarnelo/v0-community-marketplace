-- Mi curso persistent needs — additive foundation.
-- Creates a dedicated table without altering existing demand/search tables.
-- No backfill and no writes to existing production tables.

create table if not exists public.course_needs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.account_students(id) on delete cascade,
  title text not null,
  isbn text,
  category text not null,
  academic_year text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint course_needs_title_length_check
    check (char_length(trim(title)) between 1 and 180),
  constraint course_needs_isbn_length_check
    check (isbn is null or char_length(trim(isbn)) between 1 and 32),
  constraint course_needs_category_length_check
    check (char_length(trim(category)) between 1 and 80),
  constraint course_needs_academic_year_check
    check (academic_year ~ '^[0-9]{4}/[0-9]{2}$'),
  constraint course_needs_status_check
    check (status in ('active', 'fulfilled', 'archived'))
);

create index if not exists course_needs_owner_student_active_idx
  on public.course_needs (owner_user_id, student_id, academic_year, created_at desc)
  where status = 'active';

create index if not exists course_needs_active_isbn_idx
  on public.course_needs (isbn)
  where status = 'active' and isbn is not null;

alter table public.course_needs enable row level security;

-- Authenticated clients can read only their own needs.
-- Writes remain server-side so ownership/student validation is centralized.
revoke all on table public.course_needs from anon, authenticated;
grant select on table public.course_needs to authenticated;

drop policy if exists course_needs_select_own on public.course_needs;
create policy course_needs_select_own
  on public.course_needs
  for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);
