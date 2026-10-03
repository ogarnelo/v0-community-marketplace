create index if not exists transactional_email_recipient_health_user_id_idx
  on public.transactional_email_recipient_health(user_id)
  where user_id is not null;
