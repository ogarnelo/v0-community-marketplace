-- Optimize active Demand Intelligence and moderation RLS without changing access semantics.
-- auth.uid() is evaluated once per statement rather than once per row.

alter policy "Super admins can manage demand campaigns"
on public.demand_campaigns
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
);

alter policy "Super admins can read demand events"
on public.demand_events
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
);

alter policy "Users can insert own demand events"
on public.demand_events
with check ((select auth.uid()) = user_id);

alter policy "Super admins can read opportunity actions"
on public.demand_opportunity_actions
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
);

alter policy "Users can insert own opportunity actions"
on public.demand_opportunity_actions
with check ((select auth.uid()) = actor_id);

alter policy "Super admins can read demand requests"
on public.demand_requests
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
);

alter policy "Super admins can update demand requests"
on public.demand_requests
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
);

alter policy "Users can insert own demand requests"
on public.demand_requests
with check ((select auth.uid()) = user_id);

alter policy "Users can read own demand requests"
on public.demand_requests
using ((select auth.uid()) = user_id);

alter policy "Super admins can manage moderation flags"
on public.moderation_flags
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'super_admin'
  )
);

-- Cover active foreign keys used by Demand Intelligence.
create index if not exists demand_campaigns_created_by_idx
  on public.demand_campaigns (created_by);

create index if not exists demand_events_user_id_idx
  on public.demand_events (user_id)
  where user_id is not null;

create index if not exists demand_events_school_id_idx
  on public.demand_events (school_id)
  where school_id is not null;

create index if not exists demand_requests_user_id_idx
  on public.demand_requests (user_id)
  where user_id is not null;

create index if not exists demand_requests_school_id_idx
  on public.demand_requests (school_id)
  where school_id is not null;
