-- Disposable PostgreSQL 17 fixture continuation. Loaded only after
-- scripts/pilot-marketplace-alert-outbox-synthetic.sql in the CI service.
-- Never execute this fixture on a live Supabase project.

create schema if not exists auth;
create or replace function auth.uid()
returns uuid language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

alter table public.listings add column if not exists postal_code text;
create table public.profiles(id uuid primary key, postal_code text);
create table public.marketplace_postal_centroids(postal_code text primary key);
insert into public.marketplace_postal_centroids(postal_code)
values ('28001'), ('08001'), ('04001');
insert into public.profiles(id, postal_code)
values ('10000000-0000-4000-8000-000000000001', '28001');

\i supabase/migrations/20261110113419_marketplace_listing_postal_snapshot_v1.sql

do $$
begin
  if has_schema_privilege('anon','wetudy_internal','USAGE')
     or has_function_privilege('anon',
       'wetudy_internal.marketplace_listing_postal_snapshot_v1()','execute')
     or has_function_privilege('authenticated',
       'wetudy_internal.marketplace_listing_postal_snapshot_v1()','execute') then
    raise exception 'Postal trigger leaked execute privileges';
  end if;
  if (select count(*) from public.listings where postal_code is not null) <> 0 then
    raise exception 'Migration rewrote existing listings';
  end if;
end $$;

-- Authenticated publishing ignores an arbitrary client-supplied code.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
insert into public.listings(id,seller_id,status,is_demo,postal_code) values
 ('00000000-0000-4000-8000-000000000006',
  '10000000-0000-4000-8000-000000000001','available',false,'08001');

do $$
begin
  if (select postal_code from public.listings
      where id='00000000-0000-4000-8000-000000000006') <> '28001'
     or not exists (
       select 1 from public.marketplace_alert_outbox
       where listing_id='00000000-0000-4000-8000-000000000006'
     ) then
    raise exception 'Authenticated publisher location not frozen';
  end if;
end $$;

-- An account move changes the location of the NEXT ad, not the old one.
update public.profiles set postal_code='08001'
 where id='10000000-0000-4000-8000-000000000001';
insert into public.listings(id,seller_id,status,is_demo) values
 ('00000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000001','available',false);

do $$
begin
  if (select postal_code from public.listings
      where id='00000000-0000-4000-8000-000000000006') <> '28001'
     or (select postal_code from public.listings
      where id='00000000-0000-4000-8000-000000000007') <> '08001' then
    raise exception 'Moving publisher moved an already published ad';
  end if;
end $$;

-- Invalid or missing CP must not allow spoofing a known postal location.
update public.profiles set postal_code='99999'
 where id='10000000-0000-4000-8000-000000000001';
insert into public.listings(id,seller_id,status,is_demo,postal_code) values
 ('00000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000001','available',false,'28001');

do $$
begin
  if (select postal_code from public.listings
      where id='00000000-0000-4000-8000-000000000008') is not null then
    raise exception 'Invalid profile CP accepted arbitrary listing CP';
  end if;
end $$;

-- An intentionally marked DEMO stays untouched and is not queued, even
-- when created in the same authenticated session as other listings.
insert into public.listings(id,seller_id,status,is_demo,postal_code) values
 ('00000000-0000-4000-8000-000000000009',
  '10000000-0000-4000-8000-000000000001','available',true,'04001');

do $$
begin
  if (select postal_code from public.listings
      where id='00000000-0000-4000-8000-000000000009') <> '04001'
     or exists (
       select 1 from public.marketplace_alert_outbox
       where listing_id='00000000-0000-4000-8000-000000000009'
     ) then
    raise exception 'DEMO must retain explicit location and skip outbox';
  end if;
end $$;

-- A server-only import with no auth.uid retains its explicit location.
select set_config('request.jwt.claim.sub','',false);
insert into public.listings(id,seller_id,status,is_demo,postal_code) values
 ('00000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001','available',false,'04001');

do $$
begin
  if (select postal_code from public.listings
      where id='00000000-0000-4000-8000-000000000010') <> '04001' then
    raise exception 'Authorized service import should retain its published postal code';
  end if;
end $$;

select 'PASS: CP snapshot protects original listing, valid centroids, DEMO and server imports' as result;
