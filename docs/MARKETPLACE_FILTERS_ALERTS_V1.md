# Marketplace filters + saved search CTA

This iteration improves `/marketplace` filters while keeping the MVP lightweight.

## Added

- Price range slider with two dots.
- Distance slider with 1, 5, 10, 30, 50, 100, 200 and +200 km.
- Publication date checkboxes: today, last 7 days and last 30 days.
- Empty-state CTA: `Avísame si aparece`.

## Distance behavior

The distance filter uses the viewer profile `postal_code` as an approximate base location and each listing `postal_code` as the approximate listing zone.

No exact address is stored or shown by this UI.

Current implementation uses postal-code prefix coordinates as a no-cost approximation. Listings without enough postal-code data are not hidden, so early marketplace supply is not accidentally removed.

## Scope guardrails

- No paid map provider.
- No autocomplete.
- No checkout.
- No Stripe, Correos or Apple Pay in the visible flow.
- No exchange flow.

The delivery and payment continue to be agreed directly between the parties.
