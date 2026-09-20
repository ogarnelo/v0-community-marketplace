-- Stripe can retry webhook deliveries. Keep provider event IDs unique so
-- payment event history is idempotent across retries.
create unique index if not exists payment_events_provider_event_id_unique_idx
  on public.payment_events(provider_event_id)
  where provider_event_id is not null;
