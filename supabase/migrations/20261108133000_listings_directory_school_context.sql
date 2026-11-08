-- Keep a national-directory association distinct from membership in an active Wetudy community.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS directory_school_code text
  REFERENCES public.school_directory(official_code) ON DELETE SET NULL;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_one_school_reference_chk
  CHECK (school_id IS NULL OR directory_school_code IS NULL);

CREATE INDEX IF NOT EXISTS listings_directory_school_status_idx
  ON public.listings (directory_school_code, status)
  WHERE directory_school_code IS NOT NULL;

COMMENT ON COLUMN public.listings.directory_school_code IS
  'Informational reference to a national school: no activation, affiliation, roles, or school community rights.';
