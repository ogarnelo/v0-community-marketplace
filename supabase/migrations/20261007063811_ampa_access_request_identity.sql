alter table public.school_registration_requests
  add column if not exists organization_name text,
  add column if not exists contact_name text,
  add column if not exists contact_role text,
  add column if not exists organization_url text;

comment on column public.school_registration_requests.organization_name is
  'Nombre de la AMPA/AFA, asociación o entidad que solicita el acceso.';
comment on column public.school_registration_requests.contact_name is
  'Persona responsable de la solicitud para verificación manual.';
comment on column public.school_registration_requests.contact_role is
  'Cargo o función de la persona de contacto dentro de la entidad.';
comment on column public.school_registration_requests.organization_url is
  'Web o perfil social oficial usado como apoyo a la verificación manual.';
