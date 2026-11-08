-- Synthetic performance fixture only, run against disposable localhost PostgreSQL 17.
-- 60,000 distinct profiles / 120,000 student contexts / 3,000 school roles.
-- No names, emails, passwords, real schools or real family data.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create table public.profiles (id uuid primary key, school_id uuid);
create table public.account_students (
  id uuid primary key, owner_user_id uuid not null, school_id uuid,
  active boolean not null, sort_order integer, created_at timestamptz default now(),
  grade_level text, academic_year text
);
create table public.user_roles (
  id uuid primary key, user_id uuid not null, school_id uuid, role text not null
);
insert into public.profiles(id,school_id)
select ('00000001-0000-4000-8000-'||lpad(to_hex(g),12,'0'))::uuid,
  case when g%19=0 then null::uuid
       when g%3=0 then 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
       when g%3=1 then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
       else 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid end
from generate_series(1,60000) g;
insert into public.account_students(id,owner_user_id,school_id,active,sort_order,grade_level,academic_year)
select ('00000002-0000-4000-8000-'||lpad(to_hex(g),12,'0'))::uuid,
 ('00000001-0000-4000-8000-'||lpad(to_hex(((g-1)%60000)+1),12,'0'))::uuid,
 case when g%23=0 then null::uuid
      when g%3=0 then 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      when g%3=1 then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
      else 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid end,
 g%7<>0,g%4,'6','2026-2027'
from generate_series(1,120000) g;
insert into public.user_roles(id,user_id,school_id,role)
select ('00000003-0000-4000-8000-'||lpad(to_hex(g),12,'0'))::uuid,
 ('00000001-0000-4000-8000-'||lpad(to_hex(g),12,'0'))::uuid,
 case when g%3=0 then 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      when g%3=1 then 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
      else 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid end,
 'school_admin'
from generate_series(1,3000) g;
create index profiles_school_id_idx on public.profiles(school_id);
create index account_students_owner_active_idx on public.account_students(owner_user_id,active,sort_order,created_at);
create index account_students_school_grade_idx on public.account_students(school_id,grade_level,academic_year) where active=true;
create index user_roles_school_id_idx on public.user_roles(school_id);
create unique index user_roles_school_admin_unique on public.user_roles(user_id,role,school_id) where role='school_admin' and school_id is not null;
grant usage on schema public to service_role;
grant select on public.profiles,public.account_students,public.user_roles to service_role;
analyze public.profiles;
analyze public.account_students;
analyze public.user_roles;
