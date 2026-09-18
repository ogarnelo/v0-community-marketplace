-- Route report creation through the authenticated server endpoint.
-- Apply only after the matching application deployment is live.

create index if not exists reports_reporter_created_at_idx
  on public.reports (reporter_id, created_at desc);

create unique index if not exists reports_active_listing_reporter_unique_idx
  on public.reports (reporter_id, listing_id)
  where target_type = 'listing'
    and listing_id is not null
    and status in ('open', 'reviewing');

create unique index if not exists reports_active_conversation_reporter_unique_idx
  on public.reports (reporter_id, conversation_id)
  where target_type = 'conversation'
    and conversation_id is not null
    and status in ('open', 'reviewing');

drop policy if exists reports_insert_authenticated on public.reports;

revoke insert, delete, truncate, references, trigger
  on public.reports from anon, authenticated;
revoke select, update
  on public.reports from anon;

create or replace function public.notify_superadmins_on_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (
    user_id,
    kind,
    title,
    body,
    href,
    metadata
  )
  select
    ur.user_id,
    'moderation_report_created',
    case new.target_type
      when 'agreement' then 'Nueva incidencia de acuerdo'
      when 'conversation' then 'Nuevo reporte de chat'
      else 'Nuevo reporte de anuncio'
    end,
    case new.target_type
      when 'agreement' then 'Se ha abierto una incidencia sobre un acuerdo confirmado.'
      when 'conversation' then 'Un usuario ha reportado una conversación.'
      else 'Un usuario ha reportado un anuncio.'
    end,
    '/admin/super',
    jsonb_build_object(
      'report_id', new.id,
      'target_type', new.target_type,
      'listing_id', new.listing_id,
      'conversation_id', new.conversation_id,
      'agreement_id', new.agreement_id,
      'reporter_id', new.reporter_id
    )
  from public.user_roles ur
  where ur.role = 'super_admin';

  return new;
end;
$$;

revoke all on function public.notify_superadmins_on_report()
  from public, anon, authenticated;
grant execute on function public.notify_superadmins_on_report() to service_role;

drop trigger if exists report_notify_superadmins on public.reports;
create trigger report_notify_superadmins
after insert on public.reports
for each row
execute function public.notify_superadmins_on_report();
