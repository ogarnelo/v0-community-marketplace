-- WETUDY P0 RESTRICTED 48-TABLE CLIENT ACL PROPOSAL, REVIEW ONLY.
-- 2026-11-15: derived from SELECT-only production catalog, no family rows read.
-- DO NOT APPLY without explicit authorization to expand past listings.
-- RLS does NOT protect TRUNCATE; grants are a separate security boundary.
-- This covers existing tables only; inspect DEFAULT ACL separately (postgres and supabase_admin).
BEGIN;
DO $preflight$
DECLARE n int; unexpected text;
BEGIN
 SELECT count(*) INTO n FROM pg_class
 WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p');
 IF n<>79 THEN
  RAISE EXCEPTION 'NO_GO_PUBLIC_ACL: expected 79 public tables, found %',n;
 END IF;
 SELECT string_agg(c.relname,',') INTO unexpected
 FROM pg_class c
 WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p')
   AND (has_table_privilege('anon',c.oid,'TRUNCATE')
        OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))
   AND c.relname NOT IN (
    'automation_runs',
    'autopilot_recommendations',
    'book_editions',
    'business_metrics_snapshots',
    'conversion_nudges',
    'course_materials',
    'demand_campaigns',
    'demand_events',
    'demand_match_notifications',
    'demand_opportunity_actions',
    'demand_requests',
    'donation_request_events',
    'donation_requests',
    'favorites',
    'hidden_conversations',
    'inventory_expansion_events',
    'listing_boosts',
    'listing_drafts',
    'listing_offer_events',
    'listing_offers',
    'listing_packs',
    'listing_photos',
    'listing_signals',
    'listing_views',
    'marketplace_events',
    'marketplace_search_events',
    'moderation_flags',
    'notifications',
    'payment_shipping_sandbox_runs',
    'profiles',
    'referrals',
    'reviews',
    'saved_search_matches',
    'saved_searches',
    'school_access_codes',
    'school_admins',
    'school_codes',
    'school_registration_requests',
    'schools',
    'seller_publish_templates',
    'seller_velocity_events',
    'seo_programmatic_pages',
    'support_tickets',
    'transaction_reviews',
    'transaction_velocity_events',
    'user_follows',
    'user_marketplace_preferences',
    'user_roles'
   );
 IF unexpected IS NOT NULL THEN
  RAISE EXCEPTION 'NO_GO_PUBLIC_ACL: unexpected table grants: %',unexpected;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_class
  WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p')
  AND NOT relrowsecurity) THEN
  RAISE EXCEPTION 'NO_GO_PUBLIC_ACL: some public tables lack RLS';
 END IF;
END
$preflight$;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLE
  public.automation_runs,
  public.autopilot_recommendations,
  public.book_editions,
  public.business_metrics_snapshots,
  public.conversion_nudges,
  public.course_materials,
  public.demand_campaigns,
  public.demand_events,
  public.demand_match_notifications,
  public.demand_opportunity_actions,
  public.demand_requests,
  public.donation_request_events,
  public.donation_requests,
  public.favorites,
  public.hidden_conversations,
  public.inventory_expansion_events,
  public.listing_boosts,
  public.listing_drafts,
  public.listing_offer_events,
  public.listing_offers,
  public.listing_packs,
  public.listing_photos,
  public.listing_signals,
  public.listing_views,
  public.marketplace_events,
  public.marketplace_search_events,
  public.moderation_flags,
  public.notifications,
  public.payment_shipping_sandbox_runs,
  public.profiles,
  public.referrals,
  public.reviews,
  public.saved_search_matches,
  public.saved_searches,
  public.school_access_codes,
  public.school_admins,
  public.school_codes,
  public.school_registration_requests,
  public.schools,
  public.seller_publish_templates,
  public.seller_velocity_events,
  public.seo_programmatic_pages,
  public.support_tickets,
  public.transaction_reviews,
  public.transaction_velocity_events,
  public.user_follows,
  public.user_marketplace_preferences,
  public.user_roles
FROM anon, authenticated;
DO $postflight$
DECLARE c record; role_name text; p text;
BEGIN
 FOR c IN SELECT oid,relname FROM pg_class
  WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p')
 LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   FOREACH p IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
    IF has_table_privilege(role_name,c.oid,p) THEN
     RAISE EXCEPTION 'NO_GO_PUBLIC_ACL: remaining %.% %',c.relname,role_name,p;
    END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 IF has_table_privilege('anon','public.listings','SELECT')
 OR NOT has_table_privilege('authenticated','public.listings','UPDATE')
 OR NOT has_column_privilege('authenticated','public.listings','postal_code','UPDATE')
 OR NOT has_table_privilege('service_role','public.listings','SELECT') THEN
  RAISE EXCEPTION 'NO_GO_PUBLIC_ACL: listings commerce permissions drifted';
 END IF;
END
$postflight$;
COMMIT;
