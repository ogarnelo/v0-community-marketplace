# MVP event emails

This PR adds the email templates/helpers for transactional MVP events.

## Events covered

- First message received about a listing.
- Agreement proposed.
- Agreement confirmed.

## Copy rules

- The emails bring the user back to Wetudy.
- The emails say: `Responde en Wetudy para acordar los detalles por chat.`
- The emails keep the MVP line: `La entrega y el pago se acuerdan directamente entre las partes.`

## Guardrails

- No checkout.
- No payment claim.
- No shipping claim.
- No Correos, Stripe or Apple Pay mention.
- No marketing campaign yet.

## Delivery

These helpers use the existing Resend environment variables:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`
