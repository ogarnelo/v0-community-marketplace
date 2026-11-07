-- Wetudy FANPA federation foundation.
-- All three tables are service-only; federations never query people directly.
CREATE TABLE IF NOT EXISTS public.federations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 160),
  is_active boolean NOT NULL DEFAULT true,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.federation_schools (
  federation_id uuid NOT NULL REFERENCES public.federations(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (federation_id,school_id)
);

CREATE TABLE IF NOT EXISTS public.federation_admins (
  federation_id uuid NOT NULL REFERENCES public.federations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (federation_id,user_id)
);

CREATE INDEX IF NOT EXISTS federation_admins_user_idx ON public.federation_admins(user_id);
CREATE INDEX IF NOT EXISTS federation_schools_school_idx ON public.federation_schools(school_id);

ALTER TABLE public.federations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.federations, public.federation_schools, public.federation_admins
  FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.federations, public.federation_schools, public.federation_admins
  TO service_role;

-- Role names are separate from the old "student/parent" profile user_type.
-- Scope FANPA authority to federation_admins membership, NOT super_admin.
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('super_admin','school_admin','fanpa_admin'));

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_scope_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_scope_check
  CHECK ((role IN ('super_admin','fanpa_admin') AND school_id IS NULL)
      OR (role = 'school_admin' AND school_id IS NOT NULL));
