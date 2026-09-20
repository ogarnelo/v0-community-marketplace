-- Keep legacy commerce readable only by signed-in owners through RLS.
-- All writes continue through audited server-side service_role routes.
revoke all on table public.payment_intents from anon;
revoke all on table public.payment_events from anon;
revoke all on table public.shipments from anon;
revoke all on table public.shipment_events from anon;
revoke all on table public.transaction_issues from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.payment_intents from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.payment_events from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.shipments from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.shipment_events from authenticated;

revoke delete, truncate, references, trigger
  on table public.transaction_issues from authenticated;
