-- Exact production pre-migration function rollback snapshot (2026-11-08).
-- ORIGINAL_MD5 aa1f4fd03fe04f7fc3626151d40ad3f6
-- Restore ONLY after deliberate operator-approved incident response. Do not apply automatically.
CREATE OR REPLACE FUNCTION public.server_update_report_status(p_actor_id uuid, p_report_id uuid, p_status text, p_resolution_note text)
 RETURNS reports
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;
REVOKE ALL ON FUNCTION public.server_update_report_status(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server_update_report_status(uuid,uuid,text,text) TO service_role;
