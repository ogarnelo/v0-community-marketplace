-- Applied in Supabase Education Marketplace as migration 20261120110541.
-- Approved 2026-11-20: install only inactive service-owned FANPA representation.
-- Identical DDL/ACL to docs/pilot/sql/fanpa_service_only_representation_review_20261120.sql.
DO $preflight$
BEGIN
 IF to_regclass('public.fanpa_federations') IS NOT NULL
 OR to_regclass('public.fanpa_administrators') IS NOT NULL
 OR to_regclass('public.fanpa_represented_schools') IS NOT NULL
 THEN RAISE EXCEPTION 'FANPA migration requires empty target tables'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND conname='user_roles_role_check')
 OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND conname='user_roles_scope_check')
 THEN RAISE EXCEPTION 'Existing role constraints unavailable'; END IF;
END $preflight$;

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
