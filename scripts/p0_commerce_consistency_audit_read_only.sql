-- WETUDY #606 · observational reconciliation; no DDL, DML, PII, or mutations.
-- Run with an operator's read-only SQL rights. Snapshot aggregate counts only.
-- A reserved sale may legitimately be linked to agreements rather than listing_offers.
BEGIN READ ONLY;

SELECT
  (SELECT count(*) FROM public.listings WHERE listing_type = 'sale' AND status = 'reserved') AS reserved_sales,
  (SELECT count(*) FROM public.listing_offers WHERE status = 'accepted') AS accepted_offers,
  (SELECT count(*) FROM public.payment_intents) AS payment_intents,
  (SELECT count(*) FROM public.agreements WHERE status IN ('buyer_confirmed','confirmed')) AS active_or_closed_agreements,
  (SELECT count(*) FROM public.listings l
     WHERE l.listing_type = 'sale' AND l.status = 'reserved'
       AND NOT EXISTS (
         SELECT 1 FROM public.listing_offers o
         WHERE o.listing_id = l.id AND o.status = 'accepted'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.agreements a
         WHERE a.listing_id = l.id
       )
  ) AS reserved_without_offer_or_agreement,
  (SELECT count(*) FROM (
      SELECT listing_id FROM public.listing_offers
      WHERE status = 'accepted' AND listing_id IS NOT NULL
      GROUP BY listing_id HAVING count(*) > 1
  ) duplicate_offers) AS listings_with_multiple_accepted_offers,
  (SELECT count(*) FROM public.listing_offers o
      JOIN public.listings l ON l.id = o.listing_id
      WHERE o.status = 'accepted' AND l.status = 'available'
  ) AS accepted_offer_on_available_listing,
  (SELECT count(*) FROM public.payment_intents pi
      LEFT JOIN public.listing_offers o ON o.id = pi.offer_id
      WHERE pi.offer_id IS NOT NULL AND o.id IS NULL
  ) AS payment_intents_with_missing_offer,
  (SELECT count(*) FROM public.payment_intents pi
      JOIN public.listing_offers o ON o.id = pi.offer_id
      WHERE pi.listing_id IS DISTINCT FROM o.listing_id
  ) AS payment_offer_listing_mismatch;

COMMIT;
