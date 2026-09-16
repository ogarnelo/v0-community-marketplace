# Direct database migration alignment — 2026-09-16

After merging the saved-search and payment/shipping sandbox work, production code required two database objects to exist before the new API endpoints could be used safely.

## Applied directly to Supabase production

Project: `jpsljmakoscqevssimtk`

### `saved_searches_v1_compat_columns`

The database already had an older `public.saved_searches` table with a different shape. Instead of dropping/recreating it, the production migration added the current columns expected by `POST /api/marketplace/saved-searches`:

- `isbn_query`
- `only_my_community`
- `school_id`
- `results_count`
- `source_path`
- `notifications_enabled`
- `updated_at`

It also refreshed indexes, RLS policies and `public.saved_search_demand_summary`.

### `payment_shipping_sandbox_v1`

Created `public.payment_shipping_sandbox_runs` with admin-only RLS for future technical tests around Stripe Connect, payment protection and shipping providers.

## Notes

The repository still contains the forward migration files added by the PRs. This note documents the production compatibility migration applied because production already had a previous `saved_searches` schema.
