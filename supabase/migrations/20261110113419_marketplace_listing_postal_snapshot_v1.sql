-- Freeze the selling location of each new authenticated listing at publish
-- time. The marketplace already prefers listings.postal_code over changes to
-- the seller's current profile, but the web publish form omits this column.
-- Only authenticated user inserts are normalized here. Service-role imports
-- retain their explicit location; all existing listings and six DEMO remain
-- unchanged. Only recognized Spanish centroid zones are stored.
create or replace function wetudy_internal.marketplace_listing_postal_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  publishing_user uuid := auth.uid();
  verified_postal_code text;
begin
  if publishing_user is null or new.is_demo is true then
    return new;
  end if;

  select nullif(btrim(p.postal_code), '')
    into verified_postal_code
  from public.profiles as p
  where p.id = publishing_user
  limit 1;

  if verified_postal_code ~ '^(0[1-9]|[1-4][0-9]|5[0-2])[0-9]{3}$'
     and exists (
       select 1 from public.marketplace_postal_centroids as c
       where c.postal_code = verified_postal_code
     ) then
    -- Discard user-supplied values: only the authenticated publisher's
    -- profile is authoritative for the initial listing zone.
    new.postal_code := verified_postal_code;
  else
    -- A missing/unsupported code must not be confused with a known zone.
    new.postal_code := null;
  end if;

  return new;
end;
$$;

revoke all on function wetudy_internal.marketplace_listing_postal_snapshot_v1()
  from public, anon, authenticated;

drop trigger if exists marketplace_listing_postal_snapshot_before_insert_v1
  on public.listings;
create trigger marketplace_listing_postal_snapshot_before_insert_v1
  before insert on public.listings
  for each row execute function
    wetudy_internal.marketplace_listing_postal_snapshot_v1();
