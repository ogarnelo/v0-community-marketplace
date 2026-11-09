-- Disposable local Supabase Auth + REST + Storage test fixture.
-- No real user accounts, schools or production schemas are referenced.
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  school_id uuid
);
create table public.school_access_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  code text not null,
  is_active boolean not null default true
);
create table public.conversations (
  id uuid primary key,
  buyer_id uuid not null,
  seller_id uuid not null
);
-- Fictional family association, restricted to the current authenticated UID.
create table public.profiles (
  id uuid primary key,
  school_id uuid,
  first_name text,
  last_name text,
  full_name text,
  user_type text,
  postal_code text
);
alter table public.profiles enable row level security;
create policy qa_profiles_self_select on public.profiles for select
to authenticated using (id = (select auth.uid()));
create policy qa_profiles_self_insert on public.profiles for insert
to authenticated with check (id = (select auth.uid()));
create policy qa_profiles_self_update on public.profiles for update
to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));
grant select,insert,update on public.profiles to authenticated;

alter table public.user_roles enable row level security;
alter table public.school_access_codes enable row level security;
alter table public.conversations enable row level security;

create policy qa_roles_select_self on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));
create policy qa_codes_select_school_role on public.school_access_codes for select to authenticated
using (is_active and exists (
  select 1 from public.user_roles r
  where r.user_id = (select auth.uid())
    and r.role = 'school_admin'
    and r.school_id = school_access_codes.school_id
));
create policy qa_conversations_select_participant on public.conversations for select to authenticated
using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

grant select on public.user_roles, public.school_access_codes, public.conversations to authenticated;
insert into public.school_access_codes (school_id,code) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','QA-ALFA-ONLY'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','QA-BETA-ONLY'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','QA-GAMMA-ONLY');
insert into storage.buckets (id,name,public,file_size_limit) values
  ('chat-attachments','chat-attachments',false,10485760);
