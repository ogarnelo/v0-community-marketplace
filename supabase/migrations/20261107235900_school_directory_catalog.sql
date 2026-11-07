-- Independent informational catalog of educational centres.
-- This table does NOT grant school membership, AMPA rights, access codes,
-- FANPA roles, or imply any institutional partnership.
-- Do not import/enable the supplied 1,624 records until the owner approves.
CREATE TABLE IF NOT EXISTS public.school_directory (
  official_code text PRIMARY KEY
    CHECK (official_code ~ '^[0-9]{8}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) >= 2),
  school_type text NOT NULL,
  category text NOT NULL,
  address text,
  municipality text NOT NULL,
  province text NOT NULL
    CHECK (province IN ('A Coruña','Lugo','Ourense','Pontevedra')),
  postal_code text NOT NULL
    CHECK (postal_code ~ '^[0-9]{5}$'),
  latitude numeric(9,6),
  longitude numeric(9,6),
  source_name text NOT NULL,
  -- Manual only. Never auto-link by matching names, addresses or postcode.
  linked_school_id uuid UNIQUE REFERENCES public.schools(id)
    ON DELETE SET NULL,
  -- Inserting a catalog entry does not publish it.
  is_listed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_text text GENERATED ALWAYS AS (
    lower(name || ' ' || municipality || ' ' || official_code)
  ) STORED,
  CONSTRAINT school_directory_coordinates_pair CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude BETWEEN 41 AND 45 AND longitude BETWEEN -10 AND -6)
  )
);

CREATE INDEX IF NOT EXISTS school_directory_public_province_name_idx
  ON public.school_directory (province, name)
  WHERE is_listed = true;
CREATE INDEX IF NOT EXISTS school_directory_public_category_idx
  ON public.school_directory (category)
  WHERE is_listed = true;

ALTER TABLE public.school_directory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.school_directory TO service_role;

COMMENT ON TABLE public.school_directory IS
  'Informational, unactivated catalog. Never use entries as school membership or claim of AMPA participation.';
COMMENT ON COLUMN public.school_directory.is_listed IS
  'Explicit publication approval required; independent of public.schools.is_active.';
COMMENT ON COLUMN public.school_directory.linked_school_id IS
  'Only manually verified operational school association; never infer from name.';
