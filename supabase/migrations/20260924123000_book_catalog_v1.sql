-- ISBN catalog V1. Additive and backwards compatible.

create table if not exists public.book_editions (
  id uuid primary key default gen_random_uuid(),
  canonical_isbn text not null unique,
  isbn_10 text,
  isbn_13 text,
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  publisher text,
  publication_date text,
  language text,
  cover_url text,
  provider text not null,
  provider_id text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.book_editions enable row level security;

revoke insert, update, delete on table public.book_editions from anon, authenticated;
grant select on table public.book_editions to authenticated;

drop policy if exists book_editions_select_authenticated on public.book_editions;
create policy book_editions_select_authenticated
  on public.book_editions
  for select
  to authenticated
  using (true);

create index if not exists book_editions_provider_idx
  on public.book_editions (provider, provider_id);

alter table public.listings
  add column if not exists book_edition_id uuid references public.book_editions(id) on delete set null;

create index if not exists listings_book_edition_id_idx
  on public.listings (book_edition_id)
  where book_edition_id is not null;

alter table public.course_materials
  add column if not exists book_edition_id uuid references public.book_editions(id) on delete set null;

create index if not exists course_materials_book_edition_id_idx
  on public.course_materials (book_edition_id)
  where book_edition_id is not null;
