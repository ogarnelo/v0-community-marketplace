-- Independent informational catalog of educational centres.
-- This table does NOT grant school membership, AMPA rights, access codes,
-- FANPA roles, or imply any institutional partnership.
-- Do not import/enable the supplied 34,845 records until the owner approves.
CREATE TABLE IF NOT EXISTS public.school_directory (
  official_code text PRIMARY KEY
    CHECK (official_code ~ '^[0-9]{8}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) >= 2),
  school_type text NOT NULL,
  category text NOT NULL,
  address text,
  municipality text NOT NULL,
  province text NOT NULL CHECK (char_length(btrim(province)) >= 2),
  autonomous_community text NOT NULL CHECK (char_length(btrim(autonomous_community)) >= 3),
  postal_code text NOT NULL
    CHECK (postal_code ~ '^[0-9]{5}$'),
  latitude numeric(9,6),
  longitude numeric(9,6),
  source_name text NOT NULL,
  review_status text NOT NULL DEFAULT 'pendiente_verificacion_vigencia',
  -- Manual only. Never auto-link by matching names, addresses or postcode.
  linked_school_id uuid UNIQUE REFERENCES public.schools(id)
    ON DELETE SET NULL,
  -- Inserting a catalog entry does not publish it.
  is_listed boolean NOT NULL DEFAULT false,
  -- Indexing is a separate manual editorial approval, never granted by import.
  -- A page is indexable only when also linked to a verified active community.
  seo_indexable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_text text GENERATED ALWAYS AS (
    lower(name || ' ' || municipality || ' ' || postal_code || ' ' || official_code)
  ) STORED,
  CONSTRAINT school_directory_coordinates_pair CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude BETWEEN 27 AND 45 AND longitude BETWEEN -19 AND 5)
  )
);

CREATE INDEX IF NOT EXISTS school_directory_public_province_name_idx
  ON public.school_directory (autonomous_community, province, name)
  WHERE is_listed = true;
CREATE INDEX IF NOT EXISTS school_directory_public_zip_idx
  ON public.school_directory (postal_code)
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

COMMENT ON COLUMN public.school_directory.seo_indexable IS
  'Manual SEO approval. Application additionally requires a verified linked school; not automatically indexed on import.';
