-- WETUDY FEDERATED REPORTING — DDL CANDIDATE REVIEW ONLY.
-- DO NOT RUN on Supabase production or via a migration runner without NEW
-- explicit permission, a local PG17 test, verified rollback and legal review.
-- 6 tables in public; RLS enabled with NO client policies; explicit client
-- REVOKE in the same transaction protects against existing default grants.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.federation_reporting_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL CHECK (char_length(trim(legal_name)) BETWEEN 2 AND 200),
  kind text NOT NULL CHECK (kind IN ('federation','confederation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.federation_reporting_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL CHECK (char_length(trim(legal_name)) BETWEEN 2 AND 200),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.federation_reporting_association_schools (
  association_id uuid NOT NULL REFERENCES public.federation_reporting_associations(id),
  school_id uuid NOT NULL REFERENCES public.schools(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','revoked')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (association_id,school_id),
  CONSTRAINT federation_association_school_window CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE public.federation_reporting_org_associations (
  organization_id uuid NOT NULL REFERENCES public.federation_reporting_organizations(id),
  association_id uuid NOT NULL REFERENCES public.federation_reporting_associations(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','revoked')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (organization_id,association_id),
  CONSTRAINT federation_org_association_window CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE public.federation_reporting_org_hierarchy (
  parent_id uuid NOT NULL REFERENCES public.federation_reporting_organizations(id),
  child_id uuid NOT NULL REFERENCES public.federation_reporting_organizations(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','revoked')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (parent_id,child_id),
  CONSTRAINT federation_org_not_self CHECK (parent_id <> child_id),
  CONSTRAINT federation_org_hierarchy_window CHECK (valid_until IS NULL OR valid_until > valid_from)
);

CREATE TABLE public.federation_reporting_memberships (
  organization_id uuid NOT NULL REFERENCES public.federation_reporting_organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  role text NOT NULL DEFAULT 'report_viewer' CHECK (role='report_viewer'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  verified_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id)
);

ALTER TABLE public.federation_reporting_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_reporting_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_reporting_association_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_reporting_org_associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_reporting_org_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.federation_reporting_memberships ENABLE ROW LEVEL SECURITY;

-- Explicit revocation, regardless of future-table default ACL of the creating
-- role. Existing public listings, schools and roles are never changed.
REVOKE ALL ON TABLE
  public.federation_reporting_organizations,
  public.federation_reporting_associations,
  public.federation_reporting_association_schools,
  public.federation_reporting_org_associations,
  public.federation_reporting_org_hierarchy,
  public.federation_reporting_memberships
FROM PUBLIC, anon, authenticated;

-- No access for federation members via PostgREST. A future trusted server-side
-- adapter must resolve memberships, representation, hierarchy and active schools.
-- No SECURITY DEFINER routines, policies or client grants are introduced.
DO $postflight$
DECLARE missing_count integer; public_grants integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM (VALUES
    ('federation_reporting_organizations'),
    ('federation_reporting_associations'),
    ('federation_reporting_association_schools'),
    ('federation_reporting_org_associations'),
    ('federation_reporting_org_hierarchy'),
    ('federation_reporting_memberships')
  ) names(tab)
  LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||names.tab)
  WHERE c.oid IS NULL OR c.relrowsecurity IS DISTINCT FROM true;
  IF missing_count <> 0 THEN RAISE EXCEPTION 'NO_GO_FEDERATION_RLS_MISSING'; END IF;
  SELECT count(*) INTO public_grants
  FROM information_schema.role_table_grants
  WHERE table_schema='public'
    AND table_name LIKE 'federation_reporting_%'
    AND grantee IN ('anon','authenticated','PUBLIC');
  IF public_grants<>0 THEN RAISE EXCEPTION 'NO_GO_FEDERATION_PUBLIC_GRANTS'; END IF;
END $postflight$;
COMMIT;
-- ROLLBACK DESIGN: independently review and drop ONLY these SIX tables
-- after verifying no production relations or data depend on them.
