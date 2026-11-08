-- Optional educational reference to a school in the national information directory.
-- Never treat a directory selection as membership in an active Wetudy school.
ALTER TABLE public.account_students
  ADD COLUMN IF NOT EXISTS directory_school_code text
    REFERENCES public.school_directory(official_code) ON DELETE SET NULL;

ALTER TABLE public.account_students
  ADD CONSTRAINT account_students_one_school_reference_chk
  CHECK (school_id IS NULL OR directory_school_code IS NULL);

CREATE INDEX IF NOT EXISTS account_students_directory_school_code_idx
  ON public.account_students (directory_school_code)
  WHERE active = true AND directory_school_code IS NOT NULL;

COMMENT ON COLUMN public.account_students.directory_school_code IS
  'Selected informative school from national directory. Not proof of affiliation, admission or community membership; never grants roles or active school access.';
