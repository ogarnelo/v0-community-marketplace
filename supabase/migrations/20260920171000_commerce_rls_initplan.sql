-- Preserve existing authorization semantics while avoiding per-row auth.uid() re-evaluation.
drop policy if exists payment_intents_select_owner on public.payment_intents;
create policy payment_intents_select_owner
on public.payment_intents
for select
to authenticated
using (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
);

drop policy if exists payment_events_select_owner on public.payment_events;
create policy payment_events_select_owner
on public.payment_events
for select
to authenticated
using (
  exists (
    select 1
    from public.payment_intents pi
    where pi.id = payment_events.payment_intent_id
      and (
        pi.buyer_id = (select auth.uid())
        or pi.seller_id = (select auth.uid())
      )
  )
);

drop policy if exists shipments_select_owner on public.shipments;
create policy shipments_select_owner
on public.shipments
for select
to authenticated
using (
  buyer_id = (select auth.uid())
  or seller_id = (select auth.uid())
);

drop policy if exists shipment_events_select_owner on public.shipment_events;
create policy shipment_events_select_owner
on public.shipment_events
for select
to authenticated
using (
  exists (
    select 1
    from public.shipments s
    where s.id = shipment_events.shipment_id
      and (
        s.buyer_id = (select auth.uid())
        or s.seller_id = (select auth.uid())
      )
  )
);

drop policy if exists "Participants can read transaction issues" on public.transaction_issues;
create policy "Participants can read transaction issues"
on public.transaction_issues
for select
to authenticated
using (
  (select auth.uid()) = opened_by
  or (select auth.uid()) = buyer_id
  or (select auth.uid()) = seller_id
);

drop policy if exists "Participants can create transaction issues" on public.transaction_issues;
create policy "Participants can create transaction issues"
on public.transaction_issues
for insert
to authenticated
with check (
  (select auth.uid()) = opened_by
  and (
    (select auth.uid()) = buyer_id
    or (select auth.uid()) = seller_id
  )
);

drop policy if exists "Issue opener can update own open issue" on public.transaction_issues;
create policy "Issue opener can update own open issue"
on public.transaction_issues
for update
to authenticated
using (
  (select auth.uid()) = opened_by
  and status in ('open', 'reviewing')
)
with check (
  (select auth.uid()) = opened_by
  and status in ('open', 'reviewing', 'closed')
);
