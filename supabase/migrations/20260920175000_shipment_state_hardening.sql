-- One shipment per paid operation keeps webhook retries idempotent.
create unique index if not exists shipments_payment_intent_id_unique_idx
  on public.shipments(payment_intent_id)
  where payment_intent_id is not null;
