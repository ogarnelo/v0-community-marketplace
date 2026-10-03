drop index if exists public.notifications_event_key_uidx;

create unique index notifications_event_key_uidx
  on public.notifications(event_key);
