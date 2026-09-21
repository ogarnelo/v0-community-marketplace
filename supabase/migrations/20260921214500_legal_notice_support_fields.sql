-- Extend the existing server-gated support workflow with a dedicated
-- DSA-style illegal-content notice record without exposing browser inserts.

alter table public.support_tickets
  alter column name drop not null,
  alter column email drop not null;

alter table public.support_tickets
  add column if not exists kind text not null default 'support',
  add column if not exists content_url text,
  add column if not exists good_faith boolean not null default false,
  add column if not exists identity_omitted boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.support_tickets'::regclass
      and conname = 'support_tickets_kind_allowed'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_kind_allowed
      check (kind in ('support', 'illegal_content_notice'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.support_tickets'::regclass
      and conname = 'support_tickets_illegal_notice_requirements'
  ) then
    alter table public.support_tickets
      add constraint support_tickets_illegal_notice_requirements
      check (
        kind <> 'illegal_content_notice'
        or (
          content_url is not null
          and good_faith = true
          and (
            identity_omitted = true
            or (name is not null and email is not null)
          )
        )
      );
  end if;
end
$$;

create index if not exists support_tickets_kind_status_created_at_idx
  on public.support_tickets (kind, status, created_at desc);
