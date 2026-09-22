-- Make public agreement chat copy direct and human.
-- No payment/checkout behavior is enabled here.

create or replace function public.server_propose_agreement(
  p_actor_id uuid,
  p_conversation_id uuid,
  p_note text default null,
  p_amount numeric default null
)
returns public.agreements
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_conversation public.conversations%rowtype;
  v_listing public.listings%rowtype;
  v_agreement public.agreements%rowtype;
  v_status text;
  v_type text;
  v_now timestamptz := now();
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
  v_amount numeric;
begin
  if p_actor_id is null then raise exception 'Actor required'; end if;

  select * into v_conversation
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found then raise exception 'Conversation not found'; end if;
  if p_actor_id <> v_conversation.buyer_id and p_actor_id <> v_conversation.seller_id then
    raise exception 'Not allowed';
  end if;

  select * into v_listing
  from public.listings
  where id = v_conversation.listing_id
  for update;

  if not found then raise exception 'Listing not found'; end if;
  if v_listing.seller_id <> v_conversation.seller_id then raise exception 'Conversation seller mismatch'; end if;
  if v_listing.status not in ('available', 'reserved') then raise exception 'Listing does not accept new agreements'; end if;

  select * into v_agreement
  from public.agreements
  where conversation_id = p_conversation_id
    and status in ('proposed', 'buyer_confirmed', 'seller_confirmed', 'confirmed', 'disputed')
  order by created_at desc
  limit 1;

  if found then return v_agreement; end if;

  v_type := case
    when v_listing.listing_type = 'donation' or v_listing.type = 'donation' then 'donation'
    else 'sale'
  end;

  if v_type = 'sale' then
    v_amount := coalesce(p_amount, v_listing.price);
    if v_amount is null or v_amount <= 0 then
      raise exception 'Agreement amount must be positive';
    end if;
  else
    v_amount := null;
  end if;

  v_status := case
    when p_actor_id = v_conversation.buyer_id then 'buyer_confirmed'
    else 'seller_confirmed'
  end;

  insert into public.agreements (
    listing_id, conversation_id, buyer_id, seller_id, school_id,
    agreement_type, status, amount, handoff_note,
    buyer_confirmed_at, seller_confirmed_at, created_at, updated_at
  )
  values (
    v_listing.id, v_conversation.id, v_conversation.buyer_id, v_conversation.seller_id,
    v_listing.school_id, v_type, v_status, v_amount, v_note,
    case when p_actor_id = v_conversation.buyer_id then v_now else null end,
    case when p_actor_id = v_conversation.seller_id then v_now else null end,
    v_now, v_now
  )
  returning * into v_agreement;

  update public.listings
  set status = 'reserved', updated_at = v_now
  where id = v_listing.id and status = 'available';

  insert into public.agreement_events (agreement_id, actor_id, event_type, note, metadata)
  values (
    v_agreement.id,
    p_actor_id,
    'agreement_proposed',
    v_note,
    jsonb_build_object('source', 'chat', 'amount', v_amount)
  );

  insert into public.messages (conversation_id, sender_id, body)
  values (
    v_conversation.id,
    p_actor_id,
    case
      when v_type = 'donation' and p_actor_id = v_conversation.buyer_id
        then 'Me interesa esta donación. ¿Te parece bien que me la quede?'
      when v_type = 'donation'
        then 'Me gustaría darte este artículo. ¿Te parece bien?'
      when p_actor_id = v_conversation.buyer_id
        then 'Te ofrezco ' || replace(to_char(v_amount, 'FM999999990.00'), '.', ',') || ' €. ¿Te parece bien?'
      else
        'Te propongo ' || replace(to_char(v_amount, 'FM999999990.00'), '.', ',') || ' €. ¿Te parece bien?'
    end
  );

  return v_agreement;
end;
$function$;

create or replace function public.server_counter_agreement(
  p_actor_id uuid,
  p_agreement_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.agreements
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if p_actor_id is null then raise exception 'Actor required'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Agreement amount must be positive'; end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then raise exception 'Agreement not found'; end if;
  if p_actor_id <> v_agreement.buyer_id and p_actor_id <> v_agreement.seller_id then raise exception 'Not allowed'; end if;
  if v_agreement.agreement_type <> 'sale' then raise exception 'Donation agreements do not accept amounts'; end if;
  if v_agreement.status in ('confirmed', 'cancelled', 'disputed') then raise exception 'Agreement cannot be countered in its current state'; end if;

  update public.agreements
  set amount = p_amount,
      handoff_note = coalesce(v_note, handoff_note),
      buyer_confirmed_at = case when p_actor_id = buyer_id then v_now else null end,
      seller_confirmed_at = case when p_actor_id = seller_id then v_now else null end,
      confirmed_at = null,
      status = case when p_actor_id = buyer_id then 'buyer_confirmed' else 'seller_confirmed' end,
      updated_at = v_now
  where id = p_agreement_id
  returning * into v_agreement;

  insert into public.agreement_events (agreement_id, actor_id, event_type, note, metadata)
  values (
    v_agreement.id,
    p_actor_id,
    'agreement_countered',
    v_note,
    jsonb_build_object('source', 'chat', 'amount', p_amount)
  );

  if v_agreement.conversation_id is not null then
    insert into public.messages (conversation_id, sender_id, body)
    values (
      v_agreement.conversation_id,
      p_actor_id,
      case
        when p_actor_id = v_agreement.buyer_id
          then 'Puedo ofrecerte ' || replace(to_char(p_amount, 'FM999999990.00'), '.', ',') || ' €. ¿Te parece bien?'
        else
          'Te lo puedo dejar en ' || replace(to_char(p_amount, 'FM999999990.00'), '.', ',') || ' €. ¿Te parece bien?'
      end
    );
  end if;

  return v_agreement;
end;
$function$;

create or replace function public.server_confirm_agreement(
  p_actor_id uuid,
  p_agreement_id uuid
)
returns public.agreements
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
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

create or replace function public.server_cancel_agreement(
  p_actor_id uuid,
  p_agreement_id uuid,
  p_note text default null
)
returns public.agreements
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
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

revoke all on function public.server_propose_agreement(uuid, uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.server_counter_agreement(uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.server_confirm_agreement(uuid, uuid) from public, anon, authenticated;
revoke all on function public.server_cancel_agreement(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.server_propose_agreement(uuid, uuid, text, numeric) to service_role;
grant execute on function public.server_counter_agreement(uuid, uuid, numeric, text) to service_role;
grant execute on function public.server_confirm_agreement(uuid, uuid) to service_role;
grant execute on function public.server_cancel_agreement(uuid, uuid, text) to service_role;
