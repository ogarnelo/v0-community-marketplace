alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.profiles.welcome_email_sent_at is
  'Timestamp set when the Wetudy welcome email has been sent to the user.';
