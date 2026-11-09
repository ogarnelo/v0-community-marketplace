-- WETUDY: manual READ-ONLY weekly pilot radar.
-- Deliberately ONLY aggregated metrics, no user emails, names or object keys.
-- Run with Supabase SQL Editor SELECT mode; never connect to other projects.
-- Gate status is informational, not authority to activate schools.
WITH school_metrics AS (
 SELECT count(*) FILTER (WHERE is_active IS TRUE AND is_test IS FALSE)::int AS real_active,
        count(*) FILTER (WHERE is_active IS TRUE AND is_test IS TRUE)::int AS qa_active
 FROM public.schools
), listing_metrics AS (
 SELECT count(*)::int AS total,
        count(*) FILTER (WHERE is_demo IS TRUE)::int AS demo,
        count(*) FILTER (WHERE is_demo IS TRUE AND status = 'available')::int AS demo_available,
        count(*) FILTER (WHERE is_demo IS TRUE AND status = 'reserved')::int AS demo_reserved,
        count(*) FILTER (WHERE is_demo IS TRUE AND status = 'sold')::int AS demo_sold
 FROM public.listings
), storage_metrics AS (
 SELECT coalesce(jsonb_object_agg(bucket_id,jsonb_build_object(
            'objects',objects,'bytes_declared',bytes_declared)),'{}'::jsonb) AS buckets
 FROM (
   SELECT bucket_id, count(*)::int AS objects,
          coalesce(sum(CASE WHEN metadata->>'size' ~ '^[0-9]+$'
                            THEN (metadata->>'size')::bigint ELSE 0 END),0)::bigint AS bytes_declared
   FROM storage.objects
   WHERE bucket_id IN ('listing-photos','chat-attachments')
   GROUP BY bucket_id
 ) x
), profile_metrics AS (
 SELECT count(*) FILTER (WHERE school_id IS NOT NULL)::int AS linked,
        count(*) FILTER (WHERE school_id IS NOT NULL AND
          NOT EXISTS(SELECT 1 FROM public.schools s
                     WHERE s.id=p.school_id AND s.is_active IS TRUE))::int AS invalid_school
 FROM public.profiles p
), guard_status AS (
 SELECT EXISTS(
    SELECT 1 FROM pg_trigger tr
    JOIN pg_class c ON c.oid=tr.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='profiles' AND NOT tr.tgisinternal
      AND tr.tgenabled IN ('O','A') AND tr.tgname='active_profile_school_guard'
 ) AS school_assignment_guard_present
)
SELECT (now() AT TIME ZONE 'UTC') AS checked_at_utc,
       pg_database_size(current_database())::bigint AS postgres_bytes,
       pg_total_relation_size('public.school_directory')::bigint AS directory_bytes,
       (SELECT count(*)::int FROM public.school_directory) AS directory_centres,
       (SELECT count(*)::int FROM auth.users) AS auth_users_total,
       (SELECT count(*)::int FROM public.account_students WHERE active IS TRUE) AS active_students,
       s.real_active AS real_schools_active,
       s.qa_active AS qa_schools_active,
       l.total AS listings_total,
       l.demo AS demo_total,
       l.demo_available,
       l.demo_reserved,
       l.demo_sold,
       p.linked AS profiles_linked,
       p.invalid_school AS profiles_linked_to_nonactive_school,
       g.school_assignment_guard_present,
       st.buckets AS storage_bucket_aggregates
FROM school_metrics s
CROSS JOIN listing_metrics l
CROSS JOIN profile_metrics p
CROSS JOIN guard_status g
CROSS JOIN storage_metrics st;
