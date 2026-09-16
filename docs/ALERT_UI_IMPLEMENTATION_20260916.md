# Alert UI implementation — 2026-09-16

The marketplace empty state now exposes the saved-search backend to users.

## UX

When search/filter intent produces no results, users see:

1. `Avísame si aparece`
2. `Limpiar filtros`
3. `Publicar anuncio`

## Behavior

- Authenticated users save a demand signal through `/api/marketplace/saved-searches`.
- Anonymous users are prompted to sign in or create an account.
- Success state says `Búsqueda guardada`.
- Copy is explicit that emails are not sent yet.

## Scope guardrails

This does not add:

- email notifications,
- push notifications,
- checkout,
- Stripe,
- Correos,
- map/autocomplete,
- exchange/intercambio.
