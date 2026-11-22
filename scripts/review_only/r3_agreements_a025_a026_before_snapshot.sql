-- WETUDY R3 A-025/A-026: BASELINE SNAPSHOT FOR ROLLBACK / PG17 FIXTURE.
-- LIVE SOURCE of the two RPCs, captured READ ONLY on 22 NOV 2026.
-- NOT AN AUTOMATIC MIGRATION. Never run over an actively deployed patch.
-- A rollback must be expressly authorized and preceded by consumer/RLS/ACL
-- snapshot; restore both RPCs atomically and verify service-only grants.
-- Original confirm prosrc md5: 64b5cff657441f2c31f12ab1f62fa80e
-- Original cancel prosrc md5: f883d0dc3abe694ee62946e51971f11b
BEGIN;
CREATE OR REPLACE FUNCTION public.server_confirm_agreement(p_actor_id uuid, p_agreement_id uuid)
 RETURNS agreements
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
  v_is_confirmed boolean;
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
$function$;
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

  update public.listings
  set status = 'available',
      updated_at = v_now
  where id = v_agreement.listing_id
    and status = 'reserved';

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
$function$;
REVOKE EXECUTE ON FUNCTION public.server_confirm_agreement(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.server_cancel_agreement(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.server_confirm_agreement(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.server_cancel_agreement(uuid,uuid,text) TO service_role;
COMMIT;
