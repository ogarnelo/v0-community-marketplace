-- WETUDY #591 · PREFLIGHT EXCLUSIVAMENTE SELECT · 16/11/2026
-- Esta secuencia NO cambia RLS, permisos, tablas, índices ni filas.
BEGIN READ ONLY;

SELECT current_user AS executor,
       has_table_privilege('authenticated', 'public.donation_requests', 'INSERT') AS authenticated_can_insert,
       has_table_privilege('anon', 'public.donation_requests', 'INSERT') AS anon_has_insert_grant,
       (SELECT relrowsecurity FROM pg_class WHERE oid='public.donation_requests'::regclass) AS rls_enabled;

SELECT policyname,cmd,roles::text AS policy_roles, qual AS using_expression,
       with_check AS insert_check
FROM pg_policies
WHERE schemaname='public' AND tablename='donation_requests'
ORDER BY cmd,policyname;

SELECT c.column_name,c.is_nullable,c.column_default,
       c.data_type FROM information_schema.columns c
WHERE c.table_schema='public'
 AND c.table_name IN ('donation_requests','listings')
 AND c.column_name IN ('id','listing_id','requester_id','school_id',
    'assigned_to_requester_id','approved_by_admin_id','status',
    'listing_type','type','seller_id')
ORDER BY c.table_name,c.ordinal_position;

SELECT indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename='donation_requests' ORDER BY indexname;

SELECT conname,contype,pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid='public.donation_requests'::regclass ORDER BY conname;

-- Solo agregados; sin extraer filas de usuarios ni documentos personales.
SELECT
 (SELECT count(*) FROM public.donation_requests) AS requests_total,
 (SELECT count(*) FROM public.donation_requests WHERE status='approved') AS approvals_total,
 (SELECT count(*) FROM public.donation_requests WHERE status<>'pending'
    AND approved_by_admin_id IS NULL) AS unusual_nonpending_without_reviewer,
 (SELECT count(*) FROM public.donation_requests dr JOIN public.listings l ON l.id=dr.listing_id
    WHERE dr.school_id IS DISTINCT FROM l.school_id) AS cross_school_mismatches,
 (SELECT count(*) FROM public.donation_requests dr JOIN public.listings l ON l.id=dr.listing_id
    WHERE l.listing_type IS DISTINCT FROM 'donation') AS non_donation_listing_requests,
 (SELECT count(*) FROM (
    SELECT listing_id FROM public.donation_requests
    WHERE status='approved' AND listing_id IS NOT NULL
    GROUP BY listing_id HAVING count(*)>1
 ) collisions) AS duplicate_approved_listings,
 (SELECT count(*) FROM public.donation_requests
    WHERE status='pending' AND
      (assigned_to_requester_id IS NOT NULL OR approved_by_admin_id IS NOT NULL)) AS pending_with_approval_fields;

COMMIT;
