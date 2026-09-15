# Educational search and saved alerts v1

## Scope

This iteration strengthens Wetudy against book-first competitors without introducing checkout, shipping, maps or exchange.

It adds the backend foundation for saved searches so a user can later press an action such as **Avísame si aparece** when a book or material is not available.

## Product intent

- Treat ISBN, title, editorial, subject, course and category as educational search intent.
- Capture zero-result demand as a product signal.
- Let users explicitly save demand instead of only recording anonymous marketplace search events.
- Keep the current MVP promise: Wetudy facilitates contact and history; delivery and payment are agreed directly between the parties.

## New data model

`public.saved_searches` stores:

- `user_id`
- `query`
- `isbn_query`
- `category`
- `grade_level`
- `listing_type`
- `condition`
- `only_my_community`
- `school_id`
- `results_count`
- `source_path`
- `notifications_enabled`
- `last_notified_at`

The table uses RLS so users can only manage their own saved searches. Super admins can read demand for platform analysis.

## New API

`POST /api/marketplace/saved-searches`

Body example:

```json
{
  "query": "lengua santillana",
  "isbnQuery": "978846...",
  "category": "Libros de texto",
  "gradeLevel": "1º Bachillerato",
  "resultsCount": 0,
  "onlyMyCommunity": true,
  "sourcePath": "/marketplace"
}
```

Response:

```json
{ "ok": true, "savedSearchId": "..." }
```

## Next UI step

Add a visible button in marketplace empty states:

> Avísame si aparece

It should call the endpoint and later connect to email/push notifications.

## Out of scope

- No automatic email sending yet.
- No push notifications yet.
- No paid maps/autocomplete.
- No Stripe, Correos, checkout or buyer protection.
