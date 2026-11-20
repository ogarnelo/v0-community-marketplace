-- REVIEW ONLY. Never apply automatically to the live Supabase project.
-- This file deliberately lives outside supabase/migrations.
-- Test with the dedicated isolated PostgreSQL 17 GitHub workflow.
-- No amendments to public.user_roles or existing policies/grants.
BEGIN;

CREATE TABLE public.fanpa_federations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 160),
  is_active boolean NOT NULL DEFAULT false,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fanpa_administrators (
  federation_id uuid NOT NULL REFERENCES public.fanpa_federations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (federation_id, user_id)
);
CREATE INDEX fanpa_administrators_user_lookup
  ON public.fanpa_administrators(user_id, federation_id)
  WHERE active = true;

CREATE TABLE public.fanpa_represented_schools (
  federation_id uuid NOT NULL REFERENCES public.fanpa_federations(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (federation_id, school_id)
);
CREATE INDEX fanpa_represented_schools_school_lookup
  ON public.fanpa_represented_schools(school_id, federation_id)
  WHERE active = true;

ALTER TABLE public.fanpa_federations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fanpa_administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fanpa_represented_schools ENABLE ROW LEVEL SECURITY;

-- No client policies; role grants form a second independent boundary.
REVOKE ALL ON TABLE
  public.fanpa_federations,
  public.fanpa_administrators,
  public.fanpa_represented_schools
  FROM PUBLIC, anon, authenticated;

-- Server-only reads and configuration writes, always behind a separate
-- authenticated, scoped server API. The browser must never receive this role.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.fanpa_federations,
  public.fanpa_administrators,
  public.fanpa_represented_schools
  TO service_role;

COMMIT;
