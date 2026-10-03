drop index if exists public.payment_intents_offer_idx;

create index if not exists automation_runs_triggered_by_idx
  on public.automation_runs(triggered_by);
create index if not exists autopilot_recommendations_resolved_by_idx
  on public.autopilot_recommendations(resolved_by);
create index if not exists business_metrics_snapshots_business_id_idx
  on public.business_metrics_snapshots(business_id);
create index if not exists conversation_outcome_feedback_user_id_idx
  on public.conversation_outcome_feedback(user_id);
create index if not exists course_materials_created_by_idx
  on public.course_materials(created_by);
create index if not exists demand_requests_confirmed_agreement_id_idx
  on public.demand_requests(confirmed_agreement_id);
create index if not exists demand_requests_conversation_id_idx
  on public.demand_requests(conversation_id);
create index if not exists demand_requests_matched_listing_id_idx
  on public.demand_requests(matched_listing_id);
create index if not exists inventory_expansion_events_target_listing_id_idx
  on public.inventory_expansion_events(target_listing_id);
create index if not exists listing_boosts_user_id_idx
  on public.listing_boosts(user_id);
create index if not exists listing_offer_events_actor_id_idx
  on public.listing_offer_events(actor_id);
create index if not exists listing_packs_seller_id_idx
  on public.listing_packs(seller_id);
create index if not exists referrals_referrer_id_idx
  on public.referrals(referrer_id);
create index if not exists reports_resolved_by_idx
  on public.reports(resolved_by);
create index if not exists school_admins_user_id_idx
  on public.school_admins(user_id);
create index if not exists school_codes_school_id_idx
  on public.school_codes(school_id);
create index if not exists seo_programmatic_pages_reviewed_by_idx
  on public.seo_programmatic_pages(reviewed_by);
create index if not exists transaction_issues_conversation_id_idx
  on public.transaction_issues(conversation_id);
create index if not exists transaction_issues_listing_id_idx
  on public.transaction_issues(listing_id);
create index if not exists transaction_velocity_events_conversation_id_idx
  on public.transaction_velocity_events(conversation_id);
create index if not exists transaction_velocity_events_payment_intent_id_idx
  on public.transaction_velocity_events(payment_intent_id);
create index if not exists user_follows_following_id_idx
  on public.user_follows(following_id);

do $$
declare
  p record;
  stmt text;
  new_qual text;
  new_check text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (tablename, policyname) in (
        ('user_follows','Users can follow'),
        ('user_follows','Users can unfollow'),
        ('listing_boosts','Users can create own boosts'),
        ('course_materials','Authenticated users can create course materials'),
        ('course_materials','Creators can update own course materials'),
        ('inventory_expansion_events','Users can insert own inventory expansion events'),
        ('inventory_expansion_events','Users can read own inventory expansion events'),
        ('inventory_expansion_events','Super admins can read inventory expansion events'),
        ('business_metrics_snapshots','Businesses can read own metric snapshots'),
        ('business_metrics_snapshots','Businesses can insert own metric snapshots'),
        ('listing_packs','Users can manage own packs'),
        ('referrals','Users manage own referrals'),
        ('seller_publish_templates','Users can delete own publish templates'),
        ('seller_publish_templates','Users can read own publish templates'),
        ('seller_publish_templates','Users can create own publish templates'),
        ('seller_publish_templates','Users can update own publish templates'),
        ('seller_velocity_events','Users can insert own velocity events'),
        ('seller_velocity_events','Super admins can read seller velocity events'),
        ('seo_programmatic_pages','Super admins can manage seo pages'),
        ('automation_runs','Super admins can read automation runs'),
        ('automation_runs','Super admins can insert automation runs'),
        ('automation_runs','Super admins can update automation runs'),
        ('autopilot_recommendations','Super admins can manage autopilot recommendations'),
        ('conversion_nudges','Users can read own conversion nudges'),
        ('conversion_nudges','Super admins can manage conversion nudges'),
        ('conversion_nudges','Users can update own conversion nudges'),
        ('transaction_velocity_events','Users can read own transaction velocity events'),
        ('transaction_velocity_events','Users can update own transaction velocity events'),
        ('transaction_velocity_events','Super admins can manage transaction velocity events')
      )
  loop
    new_qual := case
      when p.qual is null then null
      else replace(p.qual, 'auth.uid()', '(select auth.uid())')
    end;
    new_check := case
      when p.with_check is null then null
      else replace(p.with_check, 'auth.uid()', '(select auth.uid())')
    end;

    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if new_qual is not null then
      stmt := stmt || ' using (' || new_qual || ')';
    end if;
    if new_check is not null then
      stmt := stmt || ' with check (' || new_check || ')';
    end if;

    execute stmt;
  end loop;
end
$$;
