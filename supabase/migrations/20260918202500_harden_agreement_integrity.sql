-- Harden the active MVP agreement state machine and moderation trail.
-- Core agreement mutations are executed atomically by service-role-only RPCs.

alter table public.reports
  add column if not exists agreement_id uuid references public.agreements(id) on delete cascade;

create index if not exists reports_agreement_id_idx
  on public.reports (agreement_id)
  where agreement_id is not null;

drop constraint if exists reports_target_check on public.reports;
drop constraint if exists reports_target_type_check on public.reports;

alter table public.reports
  add constraint reports_target_type_check
  check (target_type in ('listing', 'conversation', 'agreement'));

alter table public.reports
  add constraint reports_target_check
  check (
    (
      target_type = 'listing'
      and listing_id is not null
      and conversation_id is null
      and agreement_id is null
    )
    or
    (
      target_type = 'conversation'
      and conversation_id is not null
      and listing_id is null
      and agreement_id is null
    )
    or
    (
      target_type = 'agreement'
      and agreement_id is not null
    )
  );

create unique index if not exists agreements_one_open_per_conversation_idx
  on public.agreements (conversation_id)
  where conversation_id is not null
    and status in ('proposed', 'buyer_confirmed', 'seller_confirmed', 'confirmed', 'disputed');

create unique index if not exists reports_agreement_reporter_unique_idx
  on public.reports (agreement_id, reporter_id)
  where target_type = 'agreement' and agreement_id is not null;

-- Direct browser mutations are not part of the MVP contract. Reads remain
-- available through RLS; writes go through authenticated server endpoints.
revoke insert, update, delete, truncate, references, trigger
  on public.agreements from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.agreement_events from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.agreement_reviews from anon, authenticated;

drop policy if exists agreements_insert_participants on public.agreements;
drop policy if exists agreements_update_participants_limited on public.agreements;
drop policy if exists agreement_events_insert_participants on public.agreement_events;
drop policy if exists agreement_reviews_insert_confirmed_participants on public.agreement_reviews;
drop policy if exists agreement_reviews_update_own on public.agreement_reviews;

-- Conversation reports must come from an actual participant. Listing reports
-- remain available to any signed-in user. Agreement incidents use the server RPC.
drop policy if exists reports_insert_authenticated on public.reports;
create policy reports_insert_authenticated
on public.reports
for insert
to authenticated
with check (
  reporter_id = (select auth.uid())
  and (
    target_type = 'listing'
    or (
      target_type = 'conversation'
      and exists (
        select 1
        from public.conversations c
        where c.id = reports.conversation_id
          and (
            c.buyer_id = (select auth.uid())
            or c.seller_id = (select auth.uid())
          )
      )
    )
  )
);

-- Old browser-callable SECURITY DEFINER mutation functions are kept only for
-- service-role maintenance. Production UI no longer calls them.
revoke execute on function public.confirm_agreement(uuid) from public, anon, authenticated;
revoke execute on function public.cancel_agreement(uuid, text) from public, anon, authenticated;
revoke execute on function public.dispute_agreement(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_agreement(uuid) to service_role;
grant execute on function public.cancel_agreement(uuid, text) to service_role;
grant execute on function public.dispute_agreement(uuid, text) to service_role;

create or replace function public.server_propose_agreement(
  p_actor_id uuid,
  p_conversation_id uuid,
  p_note text default null
)
returns public.agreements
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_conversation public.conversations%rowtype;
  v_listing public.listings%rowtype;
  v_agreement public.agreements%rowtype;
  v_status text;
  v_type text;
  v_now timestamptz := now();
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if p_actor_id is null then
    raise exception 'Actor required';
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'Conversation not found';
  end if;

  if p_actor_id <> v_conversation.buyer_id and p_actor_id <> v_conversation.seller_id then
    raise exception 'Not allowed';
  end if;

  select *
  into v_listing
  from public.listings
  where id = v_conversation.listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_listing.seller_id <> v_conversation.seller_id then
    raise exception 'Conversation seller mismatch';
  end if;

  if v_listing.status not in ('available', 'reserved') then
    raise exception 'Listing does not accept new agreements';
  end if;

  select *
  into v_agreement
  from public.agreements
  where conversation_id = p_conversation_id
    and status in ('proposed', 'buyer_confirmed', 'seller_confirmed', 'confirmed', 'disputed')
  order by created_at desc
  limit 1;

  if found then
    return v_agreement;
  end if;

  v_type := case
    when v_listing.listing_type = 'donation' or v_listing.type = 'donation' then 'donation'
    else 'sale'
  end;

  v_status := case
    when p_actor_id = v_conversation.buyer_id then 'buyer_confirmed'
    else 'seller_confirmed'
  end;

  insert into public.agreements (
    listing_id,
    conversation_id,
    buyer_id,
    seller_id,
    school_id,
    agreement_type,
    status,
    amount,
    handoff_note,
    buyer_confirmed_at,
    seller_confirmed_at,
    created_at,
    updated_at
  )
  values (
    v_listing.id,
    v_conversation.id,
    v_conversation.buyer_id,
    v_conversation.seller_id,
    v_listing.school_id,
    v_type,
    v_status,
    case when v_type = 'sale' then v_listing.price else null end,
    v_note,
    case when p_actor_id = v_conversation.buyer_id then v_now else null end,
    case when p_actor_id = v_conversation.seller_id then v_now else null end,
    v_now,
    v_now
  )
  returning * into v_agreement;

  update public.listings
  set status = 'reserved',
      updated_at = v_now
  where id = v_listing.id
    and status = 'available';

  insert into public.agreement_events (
    agreement_id,
    actor_id,
    event_type,
    note,
    metadata
  )
  values (
    v_agreement.id,
    p_actor_id,
    'agreement_proposed',
    v_note,
    jsonb_build_object('source', 'chat')
  );

  insert into public.messages (conversation_id, sender_id, body)
  values (
    v_conversation.id,
    p_actor_id,
    case
      when v_type = 'donation'
        then 'He propuesto confirmar esta donación. Falta la confirmación de la otra parte.'
      else 'He propuesto confirmar este acuerdo. Falta la confirmación de la otra parte.'
    end
  );

  return v_agreement;
end;
$$;

create or replace function public.server_confirm_agreement(
  p_actor_id uuid,
  p_agreement_id uuid
)
returns public.agreements
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
  v_is_confirmed boolean;
begin
  if p_actor_id is null then
    raise exception 'Actor required';
  end if;

  select *
  into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception 'Agreement not found';
  end if;

  if p_actor_id <> v_agreement.buyer_id and p_actor_id <> v_agreement.seller_id then
    raise exception 'Not allowed';
  end if;

  if v_agreement.status = 'confirmed' then
    return v_agreement;
  end if;

  if v_agreement.status in ('cancelled', 'disputed') then
    raise exception 'Agreement cannot be confirmed in its current state';
  end if;

  if p_actor_id = v_agreement.buyer_id then
    if v_agreement.buyer_confirmed_at is not null then
      return v_agreement;
    end if;
    v_agreement.buyer_confirmed_at := v_now;
  else
    if v_agreement.seller_confirmed_at is not null then
      return v_agreement;
    end if;
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

  insert into public.agreement_events (
    agreement_id,
    actor_id,
    event_type,
    metadata
  )
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
          then 'Acuerdo confirmado por ambas partes. Ya podéis valorar la experiencia.'
        else 'He confirmado mi parte del acuerdo. Falta la confirmación de la otra persona.'
      end
    );
  end if;

  return v_agreement;
end;
$$;

create or replace function public.server_cancel_agreement(
  p_actor_id uuid,
  p_agreement_id uuid,
  p_note text default null
)
returns public.agreements
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if p_actor_id is null then
    raise exception 'Actor required';
  end if;

  select *
  into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception 'Agreement not found';
  end if;

  if p_actor_id <> v_agreement.buyer_id and p_actor_id <> v_agreement.seller_id then
    raise exception 'Not allowed';
  end if;

  if v_agreement.status = 'cancelled' then
    return v_agreement;
  end if;

  if v_agreement.status = 'confirmed' then
    raise exception 'Confirmed agreements cannot be cancelled';
  end if;

  if v_agreement.status = 'disputed' then
    raise exception 'Disputed agreements cannot be cancelled';
  end if;

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

  insert into public.agreement_events (
    agreement_id,
    actor_id,
    event_type,
    note
  )
  values (
    v_agreement.id,
    p_actor_id,
    'agreement_cancelled',
    v_note
  );

  if v_agreement.conversation_id is not null then
    insert into public.messages (conversation_id, sender_id, body)
    values (
      v_agreement.conversation_id,
      p_actor_id,
      'El acuerdo se ha cancelado. El anuncio puede volver a estar disponible.'
    );
  end if;

  return v_agreement;
end;
$$;

create or replace function public.server_dispute_agreement(
  p_actor_id uuid,
  p_agreement_id uuid,
  p_note text default null
)
returns public.agreements
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_agreement public.agreements%rowtype;
  v_now timestamptz := now();
  v_note text := coalesce(
    nullif(left(trim(coalesce(p_note, '')), 1000), ''),
    'Incidencia abierta desde el acuerdo.'
  );
begin
  if p_actor_id is null then
    raise exception 'Actor required';
  end if;

  select *
  into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception 'Agreement not found';
  end if;

  if p_actor_id <> v_agreement.buyer_id and p_actor_id <> v_agreement.seller_id then
    raise exception 'Not allowed';
  end if;

  if v_agreement.status = 'disputed' then
    return v_agreement;
  end if;

  if v_agreement.status <> 'confirmed' then
    raise exception 'Only confirmed agreements can open an agreement incident';
  end if;

  update public.agreements
  set status = 'disputed',
      disputed_at = v_now,
      updated_at = v_now
  where id = p_agreement_id
  returning * into v_agreement;

  insert into public.agreement_events (
    agreement_id,
    actor_id,
    event_type,
    note
  )
  values (
    v_agreement.id,
    p_actor_id,
    'agreement_disputed',
    v_note
  );

  insert into public.reports (
    reporter_id,
    target_type,
    agreement_id,
    listing_id,
    conversation_id,
    reason,
    details,
    status
  )
  values (
    p_actor_id,
    'agreement',
    v_agreement.id,
    v_agreement.listing_id,
    v_agreement.conversation_id,
    'agreement_dispute',
    v_note,
    'open'
  );

  if v_agreement.conversation_id is not null then
    insert into public.messages (conversation_id, sender_id, body)
    values (
      v_agreement.conversation_id,
      p_actor_id,
      'Se ha abierto una incidencia sobre este acuerdo. Wetudy conservará el historial para revisión.'
    );
  end if;

  return v_agreement;
end;
$$;

revoke execute on function public.server_propose_agreement(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.server_confirm_agreement(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.server_cancel_agreement(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.server_dispute_agreement(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.server_propose_agreement(uuid, uuid, text) to service_role;
grant execute on function public.server_confirm_agreement(uuid, uuid) to service_role;
grant execute on function public.server_cancel_agreement(uuid, uuid, text) to service_role;
grant execute on function public.server_dispute_agreement(uuid, uuid, text) to service_role;
