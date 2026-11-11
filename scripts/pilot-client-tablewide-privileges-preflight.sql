-- P0 #375 | read-only public-role table-wide privilege gate.
BEGIN TRANSACTION READ ONLY;
DO $wetudy$
DECLARE
  t text;
  r text;
  perm text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'saved_searches','saved_search_matches','user_marketplace_preferences'
  ] LOOP
    IF to_regclass('public.'||t) IS NULL THEN
      RAISE EXCEPTION 'P0 expected pilot table missing: %',t;
    END IF;
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      FOREACH perm IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
        IF has_table_privilege(r,'public.'||t,perm) THEN
          RAISE EXCEPTION 'P0 non-RLS table privilege still enabled for %.%: %',r,t,perm;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $wetudy$;
COMMIT;
SELECT 'PASS: no client table-wide TRUNCATE/REFERENCES/TRIGGER/MAINTAIN grants' AS status;
