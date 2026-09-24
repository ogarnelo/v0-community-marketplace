-- Keep Demand B1 state/action checks aligned with the manual activation flow.
-- Additive only: all legacy values remain valid.

alter table public.demand_campaigns
  drop constraint if exists demand_campaigns_status_check;

alter table public.demand_campaigns
  add constraint demand_campaigns_status_check
  check (
    status = any (
      array[
        'suggested'::text,
        'active'::text,
        'done'::text,
        'dismissed'::text,
        'new'::text,
        'offer_search'::text,
        'sellers_contacted'::text,
        'supply_generated'::text,
        'satisfied'::text,
        'closed'::text
      ]
    )
  );

alter table public.demand_opportunity_actions
  drop constraint if exists demand_opportunity_actions_type_check;

alter table public.demand_opportunity_actions
  add constraint demand_opportunity_actions_type_check
  check (
    action_type = any (
      array[
        'viewed'::text,
        'publish_clicked'::text,
        'business_contact_clicked'::text,
        'saved_for_later'::text,
        'dismissed'::text,
        'campaign_created'::text,
        'supplier_outreach'::text,
        'seller_contacted'::text
      ]
    )
  );
