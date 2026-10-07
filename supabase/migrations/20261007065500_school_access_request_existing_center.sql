alter table public.school_registration_requests
  add column if not exists requested_school_id uuid references public.schools(id) on delete set null;

create index if not exists school_registration_requests_requested_school_id_idx
  on public.school_registration_requests(requested_school_id)
  where requested_school_id is not null;

create or replace function public.server_approve_school_registration_request(
  request_id uuid,
  reviewer_id uuid
)
returns table(school_id uuid, access_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  req public.school_registration_requests%rowtype;
  created_school_id uuid;
  created_access_code text;
begin
  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = reviewer_id
      and ur.role = 'super_admin'
  ) then
    raise exception 'No autorizado para aprobar solicitudes de centros.';
  end if;

  select *
  into req
  from public.school_registration_requests
  where id = request_id
  for update;

  if not found then
    raise exception 'La solicitud indicada no existe.';
  end if;

  if req.status = 'approved' and req.approved_school_id is not null then
    select sac.code
    into created_access_code
    from public.school_access_codes sac
    where sac.school_id = req.approved_school_id
      and sac.is_active = true
    order by sac.created_at desc
    limit 1;

    if created_access_code is null then
      created_access_code := public.generate_school_access_code();
      insert into public.school_access_codes (school_id, code, is_active, created_by)
      values (req.approved_school_id, created_access_code, true, reviewer_id);
    end if;

    return query select req.approved_school_id, created_access_code;
    return;
  end if;

  if req.status = 'rejected' then
    raise exception 'La solicitud ya fue rechazada y no puede aprobarse sin revisión manual.';
  end if;

  if req.requested_school_id is not null then
    select s.id
    into created_school_id
    from public.schools s
    where s.id = req.requested_school_id
      and coalesce(s.is_active, true) = true;

    if created_school_id is null then
      raise exception 'El centro solicitado no existe o no está activo.';
    end if;
  else
    insert into public.schools (
      name,
      school_type,
      address,
      postal_code,
      city,
      region
    )
    values (
      req.school_name,
      req.school_type,
      req.address,
      req.postal_code,
      req.city,
      req.region
    )
    returning id into created_school_id;
  end if;

  select sac.code
  into created_access_code
  from public.school_access_codes sac
  where sac.school_id = created_school_id
    and sac.is_active = true
  order by sac.created_at desc
  limit 1;

  if created_access_code is null then
    created_access_code := public.generate_school_access_code();
    insert into public.school_access_codes (school_id, code, is_active, created_by)
    values (created_school_id, created_access_code, true, reviewer_id);
  end if;

  update public.school_registration_requests
  set status = 'approved',
      approved_school_id = created_school_id,
      reviewed_at = now(),
      reviewed_by = reviewer_id
  where id = req.id;

  return query select created_school_id, created_access_code;
end;
$$;

revoke all on function public.server_approve_school_registration_request(uuid, uuid) from public;
revoke all on function public.server_approve_school_registration_request(uuid, uuid) from anon;
revoke all on function public.server_approve_school_registration_request(uuid, uuid) from authenticated;
grant execute on function public.server_approve_school_registration_request(uuid, uuid) to service_role;
