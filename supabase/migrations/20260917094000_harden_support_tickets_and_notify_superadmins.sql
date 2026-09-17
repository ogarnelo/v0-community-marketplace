-- Route support tickets through the authenticated server API instead of allowing
-- direct browser/REST inserts. This blocks anonymous ticket spam and prevents a
-- signed-in client from forging another identity in the ticket payload.
drop policy if exists support_tickets_insert_public on public.support_tickets;

create index if not exists support_tickets_user_created_at_idx
  on public.support_tickets (user_id, created_at desc)
  where user_id is not null;

-- Every successful support ticket creates an in-app notification for each
-- super admin. The trigger runs with the function owner's privileges because
-- normal clients intentionally have no INSERT policy on notifications.
create or replace function public.notify_superadmins_on_support_ticket()
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
    'support_ticket_created',
    'Nuevo ticket de soporte',
    'Nueva consulta de ' || left(new.name, 80) || '.',
    '/admin/super',
    jsonb_build_object(
      'support_ticket_id', new.id,
      'sender_user_id', new.user_id
    )
  from public.user_roles ur
  where ur.role = 'super_admin';

  return new;
end;
$$;

revoke all on function public.notify_superadmins_on_support_ticket() from public;
revoke all on function public.notify_superadmins_on_support_ticket() from anon;
revoke all on function public.notify_superadmins_on_support_ticket() from authenticated;

drop trigger if exists support_ticket_notify_superadmins on public.support_tickets;
create trigger support_ticket_notify_superadmins
after insert on public.support_tickets
for each row
execute function public.notify_superadmins_on_support_ticket();
