-- DISPOSABLE POSTGIS 17 FIXTURE — NEVER execute against Supabase/production.
-- The CI caller refuses any non-loopback DATABASE_URL before running this file.
-- 6000 synthetic listings and 750 synthetic sellers; zero real school/family data.
create schema if not exists extensions;
-- Docker-PostGIS initialises its extension in public; move it only inside this
-- throwaway CI database so the production migrations work unchanged.
drop extension if exists postgis cascade;
create extension postgis with schema extensions;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table public.profiles (
  id uuid primary key,
  postal_code text
);
create table public.listings (
  id uuid primary key,
  seller_id uuid,
  user_id uuid,
  postal_code text,
  status text,
  title text,
  description text,
  category text,
  grade_level text,
  type text,
  condition text,
  isbn text,
  author text,
  publisher text,
  format text,
  language text,
  subject text,
  specific_type text,
  size_label text,
  brand text,
  model text,
  season text,
  price numeric,
  original_price numeric,
  estimated_retail_price numeric,
  created_at timestamptz
);
create index listings_fixture_status_created_idx
  on public.listings(status, created_at desc);
create index listings_fixture_seller_idx on public.listings(seller_id);

insert into public.profiles (id,postal_code)
select md5('wetudy-ci-seller-'||n::text)::uuid,
  case when n % 67=0 then null else
    (array['28001','28010','28901','08001','04001','15001','41001','46001'])[((n-1)%8)+1] end
from generate_series(1,750) n;

insert into public.listings(
  id, seller_id, user_id, postal_code, status,
  title, description, category, grade_level, type, condition,
  isbn, author, publisher, format, language, subject, specific_type,
  size_label, brand, model, season, price, original_price,
  estimated_retail_price, created_at
)
select
  md5('wetudy-ci-listing-'||n::text)::uuid,
  md5('wetudy-ci-seller-'||(((n-1)%750)+1)::text)::uuid,
  null::uuid,
  case when n%3=0 then null else
    (array['28001','28010','28901','08001','04001','15001','41001','46001'])[((n-1)%8)+1] end,
  case when n%19=0 then 'sold' else 'available' end,
  case when n%4=0 then 'Libro de texto' else 'Polo uniforme' end || ' muestra CI ' || n,
  'Anuncio sintético exclusivo del banco de pruebas desechable',
  (array['Uniformes','Libros','Mochilas','Material escolar'])[((n-1)%4)+1],
  case when n%2=0 then 'Primaria' else 'ESO' end,
  case when n%10=0 then 'donation' else 'sale' end,
  case when n%2=0 then 'used' else 'new' end,
  lpad((9780000000000::bigint+n)::text,13,'0'),
  'Autor ficticio', 'Editorial de test', 'Papel', 'es',
  'Educación', 'Prueba', 'Talla estándar', 'Sin marca',
  'Modelo sintético', 'Invierno',
  (n%49)::numeric,
  ((n%49)+18)::numeric,
  ((n%49)+25)::numeric,
  timestamp with time zone '2026-11-09 00:00:00+00' - (n * interval '1 minute')
from generate_series(1,6000) n;

analyze public.profiles;
analyze public.listings;

do $$
declare
  available_count integer;
  unknown_count integer;
begin
  select count(*) into available_count
  from public.listings where status = 'available';
  if available_count < 5000 then
    raise exception 'Fixture must contain >5000 available listings: %', available_count;
  end if;
  select count(*) into unknown_count
  from public.listings l
  left join public.profiles p on p.id=l.seller_id
  where l.status='available' and coalesce(p.postal_code,l.postal_code) is null;
  if unknown_count < 1 then
    raise exception 'Fixture must contain listings of unknown location';
  end if;
  raise notice 'Disposable CI fixture: % available, % missing postcode',available_count,unknown_count;
end $$;
