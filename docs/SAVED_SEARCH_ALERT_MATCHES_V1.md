# Saved search alert matches

This PR prepares real matches for `Avísame si aparece`.

## Behavior

When a new listing is created, Wetudy can compare it against saved searches and create one match per search/listing pair.

The first production-safe step is to persist matches in `saved_search_matches` with a unique `(saved_search_id, listing_id)` constraint to avoid duplicates.

## Matching rules

A listing can match by:

- text query in title/description/ISBN
- ISBN
- category
- course/grade level
- listing type
- condition
- community, when `only_my_community` is enabled

## Email guardrail

`emailed_at` exists so the next step can send at most one email per saved search/listing match.

## Scope

- No bulk marketing.
- No checkout.
- No payment or shipping flow.
- No promise of perfect matching.
