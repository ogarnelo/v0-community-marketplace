# Stripe webhook build hotfix v1

## Problema

El build fallaba al recopilar datos de `/api/stripe/webhook` porque el cliente de Stripe se estaba creando durante la evaluación del módulo sin `STRIPE_SECRET_KEY` disponible:

```txt
Error: Neither apiKey nor config.authenticator provided
Failed to collect page data for /api/stripe/webhook
```

## Solución

Este hotfix reemplaza `app/api/stripe/webhook/route.ts` por una versión segura para MVP:

- No crea Stripe en module scope.
- Crea el cliente Stripe de forma lazy dentro del handler.
- Si faltan `STRIPE_SECRET_KEY` o `STRIPE_WEBHOOK_SECRET`, responde `503` en runtime.
- Mantiene la ruta compilable aunque el MVP no use pagos.
- No toca Supabase.
- No activa pagos ni checkout.

## Aplicación

```bash
npm run test:contracts
npm run build
```
