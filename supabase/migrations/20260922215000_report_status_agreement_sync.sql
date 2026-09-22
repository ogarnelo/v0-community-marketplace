-- Keep moderation report status and agreement incident state in sync.
-- This function is only callable by service_role; the authenticated actor is
-- still verified as a super admin inside the function.

create or replace function public.server_update_report_status(
  p_actor_id uuid,
  p_report_id uuid,
  p_status text
)
returns public.reports
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_report public.reports%rowtype;
  v_other_active integer := 0;
  v_now timestamptz := now();
begin
  if p_actor_id is null then
    raise exception 'Actor required';
  end if;

  if p_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'Invalid report status';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_actor_id
      and ur.role = 'super_admin'
  ) then
    raise exception 'Not allowed';
  end if;

  select *
  into v_report
  from public.reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Report not found';
  end if;

  update public.reports
  set status = p_status
  where id = p_report_id
  returning * into v_report;

  if v_report.target_type = 'agreement' and v_report.agreement_id is not null then
    if p_status in ('open', 'reviewing') then
      update public.agreements
      set status = 'disputed',
          disputed_at = coalesce(disputed_at, v_now),
          updated_at = v_now
      where id = v_report.agreement_id
        and status in ('confirmed', 'disputed');
    else
      select count(*)
      into v_other_active
      from public.reports r
      where r.target_type = 'agreement'
        and r.agreement_id = v_report.agreement_id
        and r.id <> v_report.id
        and r.status in ('open', 'reviewing');

      if v_other_active = 0 then
        update public.agreements
        set status = 'confirmed',
            updated_at = v_now
        where id = v_report.agreement_id
          and status = 'disputed';
      end if;
    end if;

    insert into public.agreement_events (
      agreement_id,
      actor_id,
      event_type,
      metadata
    )
    values (
      v_report.agreement_id,
      p_actor_id,
      'agreement_incident_status_changed',
      jsonb_build_object(
        'report_id', v_report.id,
        'report_status', p_status
      )
    );
  end if;

  return v_report;
end;
$$;

revoke execute on function public.server_update_report_status(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.server_update_report_status(uuid, uuid, text)
  to service_role;
