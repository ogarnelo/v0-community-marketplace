-- Add a user-visible moderation resolution and notify the reporter.
-- The new four-argument RPC is additive. The existing three-argument signature
-- remains as a compatibility wrapper for any in-flight deployment.

alter table public.reports
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

alter table public.reports
  drop constraint if exists reports_resolution_note_length_check;

alter table public.reports
  add constraint reports_resolution_note_length_check
  check (resolution_note is null or char_length(resolution_note) <= 1000);

create or replace function public.server_update_report_status(
  p_actor_id uuid,
  p_report_id uuid,
  p_status text,
  p_resolution_note text
)
returns public.reports
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_report public.reports%rowtype;
  v_other_active integer := 0;
  v_now timestamptz := now();
  v_resolution_note text := nullif(left(trim(coalesce(p_resolution_note, '')), 1000), '');
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
  set status = p_status,
      resolution_note = case
        when p_status in ('resolved', 'dismissed') then v_resolution_note
        else null
      end,
      resolved_at = case
        when p_status in ('resolved', 'dismissed') then v_now
        else null
      end,
      resolved_by = case
        when p_status in ('resolved', 'dismissed') then p_actor_id
        else null
      end
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
      note,
      metadata
    )
    values (
      v_report.agreement_id,
      p_actor_id,
      'agreement_incident_status_changed',
      case when p_status in ('resolved', 'dismissed') then v_resolution_note else null end,
      jsonb_build_object(
        'report_id', v_report.id,
        'report_status', p_status
      )
    );
  end if;

  if p_status in ('resolved', 'dismissed') then
    insert into public.notifications (
      user_id,
      kind,
      title,
      body,
      href,
      metadata
    )
    values (
      v_report.reporter_id,
      'moderation_report_resolved',
      case
        when p_status = 'resolved' then 'Incidencia resuelta'
        else 'Incidencia descartada'
      end,
      coalesce(
        v_resolution_note,
        case
          when p_status = 'resolved' then 'El equipo de Wetudy ha revisado y resuelto tu incidencia.'
          else 'El equipo de Wetudy ha revisado y descartado tu incidencia.'
        end
      ),
      '/account/activity#report-' || v_report.id::text,
      jsonb_build_object(
        'report_id', v_report.id,
        'report_status', p_status,
        'agreement_id', v_report.agreement_id
      )
    );
  end if;

  return v_report;
end;
$$;

create or replace function public.server_update_report_status(
  p_actor_id uuid,
  p_report_id uuid,
  p_status text
)
returns public.reports
language sql
set search_path = public, pg_temp
as $$
  select public.server_update_report_status(
    p_actor_id,
    p_report_id,
    p_status,
    null::text
  );
$$;

revoke execute on function public.server_update_report_status(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function public.server_update_report_status(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.server_update_report_status(uuid, uuid, text, text)
  to service_role;
grant execute on function public.server_update_report_status(uuid, uuid, text)
  to service_role;
