-- Cover foreign keys used by active MVP flows and the preserved payment/shipping foundation.
create index if not exists donation_request_events_actor_id_idx
  on public.donation_request_events(actor_id);

create index if not exists school_impact_report_deliveries_user_id_idx
  on public.school_impact_report_deliveries(user_id);

create index if not exists school_impact_report_subscriptions_user_id_idx
  on public.school_impact_report_subscriptions(user_id);

create index if not exists payment_intents_conversation_id_idx
  on public.payment_intents(conversation_id);

create index if not exists payment_intents_school_id_idx
  on public.payment_intents(school_id);

create index if not exists shipments_conversation_id_idx
  on public.shipments(conversation_id);

create index if not exists shipments_payment_intent_id_idx
  on public.shipments(payment_intent_id);

create index if not exists payment_shipping_sandbox_runs_agreement_id_idx
  on public.payment_shipping_sandbox_runs(agreement_id);

create index if not exists payment_shipping_sandbox_runs_created_by_idx
  on public.payment_shipping_sandbox_runs(created_by);

create index if not exists payment_shipping_sandbox_runs_listing_id_idx
  on public.payment_shipping_sandbox_runs(listing_id);
