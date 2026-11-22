-- WETUDY R3 A-025/A-026 — SQL CANDIDATE REVIEW ONLY, NOT INSTALLED.
-- Exact production pg_get_functiondef source, scoped changes, tested PG17.
-- DO NOT APPLY WITHOUT NEW EXPLICIT OWNER AUTHORIZATION and pre/postflight.
-- Multiple conversations/partial negotiations remain allowed.
-- PRIVATE BUY-NOW RESERVATION PROVENANCE GAP REMAINS OUT OF SCOPE.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $preflight$
BEGIN
 IF to_regprocedure('public.server_confirm_agreement(uuid,uuid)') IS NULL
 OR to_regprocedure('public.server_cancel_agreement(uuid,uuid,text)') IS NULL
 OR to_regclass('public.agreements') IS NULL
 OR to_regclass('public.listings') IS NULL
 OR to_regclass('public.listing_offers') IS NULL
 OR to_regclass('public.donation_requests') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid='public.agreements'::regclass AND c.relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid='public.listings'::regclass AND c.relrowsecurity)
 OR EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN
   ('public.server_confirm_agreement(uuid,uuid)'::regprocedure,
    'public.server_cancel_agreement(uuid,uuid,text)'::regprocedure) AND p.prosecdef)
 THEN RAISE EXCEPTION 'NO_GO_A025_A026_SCHEMA_DRIFT'; END IF;
 IF EXISTS(SELECT 1 FROM
    (SELECT listing_id FROM public.agreements WHERE status='confirmed'
     GROUP BY listing_id HAVING COUNT(*)>1) t)
 THEN RAISE EXCEPTION 'NO_GO_A025_DUPLICATE_CONFIRMED'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.server_confirm_agreement(p_actor_id uuid, p_agreement_id uuid)
 RETURNS agreements
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
  v_is_confirmed boolean;
  v_listing_status text;
begin
  if p_actor_id is null then raise exception 'Actor required'; end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then raise exception 'Agreement not found'; end if;
  if p_actor_id <> v_agreement.buyer_id and p_actor_id <> v_agreement.seller_id then raise exception 'Not allowed'; end if;
  if v_agreement.status = 'confirmed' then return v_agreement; end if;
  if v_agreement.status in ('cancelled', 'disputed') then raise exception 'Agreement cannot be confirmed in its current state'; end if;

  -- A-025: serialize the same listing across distinct conversations.
  -- Multiple proposals remain legal, but a listing closes only once.
  select l.status into v_listing_status
    from public.listings l
    where l.id=v_agreement.listing_id for update;
  if not found or v_listing_status not in ('available','reserved') then
    raise exception 'Listing no longer accepts agreement confirmation';
  end if;
  if exists (
      select 1 from public.agreements a
       where a.listing_id=v_agreement.listing_id
         and a.id<>v_agreement.id and a.status='confirmed'
    ) or exists (
      select 1 from public.listing_offers o
       where o.listing_id=v_agreement.listing_id and o.status='accepted'
    ) or exists (
      select 1 from public.donation_requests d
       where d.listing_id=v_agreement.listing_id
         and d.status in ('approved','completed')
    ) then
    raise exception 'Listing already allocated outside this agreement';
  end if;

  if p_actor_id = v_agreement.buyer_id then
    if v_agreement.buyer_confirmed_at is not null then return v_agreement; end if;
    v_agreement.buyer_confirmed_at := v_now;
  else
    if v_agreement.seller_confirmed_at is not null then return v_agreement; end if;
    v_agreement.seller_confirmed_at := v_now;
  end if;

  v_is_confirmed :=
    v_agreement.buyer_confirmed_at is not null
    and v_agreement.seller_confirmed_at is not null;

  update public.agreements
  set buyer_confirmed_at = v_agreement.buyer_confirmed_at,
      seller_confirmed_at = v_agreement.seller_confirmed_at,
      confirmed_at = case when v_is_confirmed then coalesce(confirmed_at, v_now) else confirmed_at end,
      status = case
        when v_is_confirmed then 'confirmed'
        when v_agreement.buyer_confirmed_at is not null then 'buyer_confirmed'
        else 'seller_confirmed'
      end,
      updated_at = v_now
  where id = p_agreement_id
  returning * into v_agreement;

  if v_is_confirmed then
    update public.listings
    set status = case
          when v_agreement.agreement_type = 'donation' then 'archived'
          else 'sold'
        end,
        updated_at = v_now
    where id = v_agreement.listing_id
      and status in ('available', 'reserved');
    if not found then
      raise exception 'Listing no longer accepts agreement confirmation';
    end if;
  end if;

  insert into public.agreement_events (agreement_id, actor_id, event_type, metadata)
  values (
    v_agreement.id,
    p_actor_id,
    case when v_is_confirmed then 'agreement_confirmed' else 'agreement_part_confirmed' end,
    jsonb_build_object(
      'role',
      case when p_actor_id = v_agreement.buyer_id then 'buyer' else 'seller' end
    )
  );

  if v_agreement.conversation_id is not null then
    insert into public.messages (conversation_id, sender_id, body)
    values (
      v_agreement.conversation_id,
      p_actor_id,
      case
        when v_is_confirmed
          then 'Perfecto, acepto. Ya podemos concretar la entrega por aquí.'
        else
          'Perfecto, acepto.'
      end
    );
  end if;

  return v_agreement;
end;
$function$

CREATE OR REPLACE FUNCTION public.server_cancel_agreement(p_actor_id uuid, p_agreement_id uuid, p_note text DEFAULT NULL::text)
 RETURNS agreements
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
  v_actor_was_confirmed boolean;
  v_listing_status text;
begin
  if p_actor_id is null then raise exception 'Actor required'; end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then raise exception 'Agreement not found'; end if;
  if p_actor_id <> v_agreement.buyer_id and p_actor_id <> v_agreement.seller_id then raise exception 'Not allowed'; end if;
  if v_agreement.status = 'cancelled' then return v_agreement; end if;
  if v_agreement.status = 'confirmed' then raise exception 'Confirmed agreements cannot be cancelled'; end if;
  if v_agreement.status = 'disputed' then raise exception 'Disputed agreements cannot be cancelled'; end if;

  -- A-026: acquire listing lock before reading competing reservations.
  select l.status into v_listing_status
    from public.listings l
   where l.id=v_agreement.listing_id for update;
  if not found then
    raise exception 'Listing not found for agreement cancellation';
  end if;

  v_actor_was_confirmed := case
    when p_actor_id = v_agreement.buyer_id then v_agreement.buyer_confirmed_at is not null
    else v_agreement.seller_confirmed_at is not null
  end;

  update public.agreements
  set status = 'cancelled',
      cancelled_at = v_now,
      updated_at = v_now
  where id = p_agreement_id
  returning * into v_agreement;

  -- Do not release a reservation still claimed by another live agreement
  -- or an already accepted offer / approved donation. This is NOT a general
  -- provenance solution for the short gap inside the private buy-now flow.
  if v_listing_status='reserved'
     and not exists (
       select 1 from public.agreements a
        where a.listing_id=v_agreement.listing_id
          and a.id<>v_agreement.id
          and a.status in ('proposed','buyer_confirmed','seller_confirmed','confirmed','disputed')
     )
     and not exists (
       select 1 from public.listing_offers o
        where o.listing_id=v_agreement.listing_id and o.status='accepted'
     )
     and not exists (
       select 1 from public.donation_requests d
        where d.listing_id=v_agreement.listing_id
          and d.status in ('approved','completed')
     ) then
      update public.listings
         set status='available', updated_at=v_now
       where id=v_agreement.listing_id and status='reserved';
  end if;

  insert into public.agreement_events (agreement_id, actor_id, event_type, note)
  values (v_agreement.id, p_actor_id, 'agreement_cancelled', v_note);

  if v_agreement.conversation_id is not null then
    insert into public.messages (conversation_id, sender_id, body)
    values (
      v_agreement.conversation_id,
      p_actor_id,
      case
        when v_actor_was_confirmed then 'He retirado mi propuesta.'
        else 'Gracias, pero prefiero no seguir con esta propuesta.'
      end
    );
  end if;

  return v_agreement;
end;
$function$

DO $postflight$
DECLARE c oid:=to_regprocedure('public.server_confirm_agreement(uuid,uuid)')::oid;
        x oid:=to_regprocedure('public.server_cancel_agreement(uuid,uuid,text)')::oid;
BEGIN
 IF c IS NULL OR x IS NULL
 OR has_function_privilege('anon',c,'EXECUTE')
 OR has_function_privilege('authenticated',c,'EXECUTE')
 OR NOT has_function_privilege('service_role',c,'EXECUTE')
 OR has_function_privilege('anon',x,'EXECUTE')
 OR has_function_privilege('authenticated',x,'EXECUTE')
 OR NOT has_function_privilege('service_role',x,'EXECUTE')
 OR EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid IN(c,x) AND p.prosecdef)
 THEN RAISE EXCEPTION 'NO_GO_A025_A026_ACL_DRIFT'; END IF;
END $postflight$;
COMMIT;
-- Rollback only after NEW OWNER APPROVAL: restore original definitions
-- from saved pg_get_functiondef with one transaction, verifying ACL/RLS.
-- Do not drop indexes, change table grants or touch production fixtures.
