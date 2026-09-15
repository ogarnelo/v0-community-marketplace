# Payments and shipping sandbox v1

## Goal

Study path B in parallel with product work without changing the user-facing MVP.

Wetudy stays as:

> Wetudy facilitates contact and keeps the conversation/agreement history. Delivery and payment are agreed directly between the parties.

This branch only adds an internal sandbox foundation for Stripe Connect and shipping research.

## Current dependency state

`package.json` already includes:

- `stripe`
- `@stripe/stripe-js`
- `@stripe/react-stripe-js`

No new payment dependency is needed for the first sandbox planning step.

## Sandbox endpoint

`POST /api/admin/sandbox/payment-shipping`

Admin only. Records a planned sandbox run in `payment_shipping_sandbox_runs` and returns a structured plan.

Supported scenarios:

- `stripe_connect_onboarding`
- `protected_payment_hold`
- `protected_payment_release`
- `protected_payment_refund`
- `correos_label_quote`
- `shipping_aggregator_quote`

## Env placeholders

Stripe:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `ENABLE_PAYMENT_SANDBOX`

Shipping:

- `SHIPPING_SANDBOX_PROVIDER`
- `CORREOS_SANDBOX_CLIENT_ID`
- `CORREOS_SANDBOX_CLIENT_SECRET`
- `ENABLE_SHIPPING_SANDBOX`

## Decision checklist

Before exposing any payment/shipping feature to users:

- Decide Stripe Connect account type.
- Define fees, refunds, chargebacks and payout timing.
- Define support ownership for disputes.
- Decide whether to use Correos direct or an aggregator first.
- Define what happens if the package is lost, damaged or different from the description.
- Review legal wording before using buyer protection or guarantee language.

## Out of scope

- No public checkout.
- No Apple Pay button.
- No card collection.
- No Stripe webhook activation.
- No Correos label creation.
- No buyer protection copy visible to users.
