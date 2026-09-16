# Postal code location UX

Wetudy uses the postal code as an approximate location signal for nearby marketplace results.

## Product behavior

- The user's profile postal code is the default base for distance filters.
- The listing postal code is the default approximate zone for the item.
- No exact address is required for marketplace discovery.
- Results without enough postal-code data should not be hidden by default while supply is still early.

## Copy

Use this wording near the profile/listing postal-code fields:

> Usamos el código postal para mostrar anuncios cercanos. No mostramos tu dirección exacta.

For public listing surfaces, prefer masked or approximate labels such as:

- Zona aproximada 28xxx
- Cerca de tu zona
- Distancia aproximada

## Guardrails

- No paid map provider.
- No autocomplete.
- No exact address display.
- No checkout, Stripe, Correos, Apple Pay or exchange flow.

La entrega y el pago se acuerdan directamente entre las partes.
