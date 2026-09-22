# Private Commerce Preview v2 — 22/09/2026

## Estado

Esta fase **no es pública**. El flujo normal de Wetudy continúa siendo:

> La entrega y el pago se acuerdan directamente entre las partes.

El preview sirve para construir y probar pagos/logística sin activar checkout para usuarios normales ni mover dinero real.

## Acceso

El acceso de usuario exige:

- `ENABLE_PRIVATE_COMMERCE_PREVIEW=true`;
- usuario autenticado;
- ser `super_admin` o tener el email incluido en `PRIVATE_COMMERCE_TESTER_EMAILS`.

El comercio público sigue dependiendo exclusivamente de `ENABLE_LEGACY_COMMERCE=true`, que debe permanecer desactivado.

El panel interno está en:

- `/admin/super/commerce-lab`

y solo es accesible por Super Admin.

## Stripe

Durante el preview privado se exige explícitamente:

- `STRIPE_SECRET_KEY` con prefijo `sk_test_`;
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` con prefijo `pk_test_`;
- `STRIPE_WEBHOOK_SECRET` de un endpoint test.

Si el comercio público está desactivado y se configuran claves live, el código falla cerrado.

Los webhooks Stripe con `livemode=true` se rechazan en el preview privado.

### Arquitectura objetivo

Para el marketplace se adopta como dirección técnica provisional:

1. el comprador paga a la plataforma mediante Stripe;
2. Wetudy conserva el estado del pago y la operación;
3. el vendedor tiene una cuenta conectada Stripe;
4. el dinero se transfiere al vendedor cuando se cumple la condición de liberación;
5. la transferencia es un evento separado del cobro.

Esto corresponde al patrón **separate charges and transfers** de Stripe Connect y permite desacoplar cobro y liberación.

No se implementa payout real en este PR. Antes hay que completar onboarding/KYC de cuentas conectadas, modelo legal/económico, refunds/disputes y política de liberación.

## Logística

La integración actual de Sendcloud se mantiene para creación de etiquetas, pero el preview privado **no crea etiquetas reales por defecto**.

Para permitir explícitamente una llamada real a Sendcloud deben cumplirse ambas condiciones:

- credenciales Sendcloud configuradas;
- `ENABLE_PRIVATE_COMMERCE_SENDCLOUD_LABELS=true`.

Mientras ese flag siga desactivado, Commerce Lab permite **simular una etiqueta**:

`draft/quoted/label_pending -> label_ready`

La simulación:

- no llama a Sendcloud;
- no genera coste;
- exige que el pago Stripe test esté en `succeeded`;
- marca el proveedor como `sandbox`;
- registra un evento `sandbox_label_ready`.

Después se puede probar el flujo UI:

`label_ready -> in_transit -> delivered`

La transición a `in_transit` exige estado `label_ready`. Las URLs manuales de tracking, si existen, deben ser HTTPS.

## Tarifas

Los importes actuales de envío y fee son **provisionales de sandbox**. No deben considerarse precios finales.

La integración Sendcloud actual usa API v2 para creación de parcels/labels. Las tarifas live actuales de Sendcloud están disponibles mediante API v3; por tanto antes de activar logística pública hay que sustituir los importes fijos por cotización real o por una tabla comercial validada.

## Stripe Connect test

El preview incorpora onboarding de vendedor con Stripe Connect **Accounts v2** y configuración `recipient`.

Wetudy conserva únicamente:

- ID técnico de la cuenta conectada;
- estado de onboarding;
- si la capability de transferencias está activa;
- nombres de requisitos pendientes y motivo de restricción.

Los datos KYC y documentos se recogen y conservan en Stripe.

La arquitectura del lab usa **separate charges and transfers**: el cobro del comprador permanece separado de la transferencia al vendedor.

La liberación test es deliberadamente manual desde Commerce Lab y solo se habilita cuando:

1. el pago interno está `succeeded`;
2. la operación usa envío;
3. el envío está `delivered`;
4. Stripe confirma que la cuenta recipient puede recibir transferencias.

La transferencia usa el cargo del Checkout Session como `source_transaction` y una clave de idempotencia estable por pago. No existe liberación automática ni payout live.

## No incluido todavía

- Activación pública del onboarding Connect.
- Liberación automática al vendedor.
- Política comercial definitiva de retención/liberación.
- Refund total/parcial.
- Disputas/chargebacks.
- Reversión de transferencia.
- Cotización real Sendcloud v3.
- Webhook de estados Sendcloud.
- Devoluciones.
- Seguro/compensación por pérdida o daño.
- Revisión jurídica/fiscal del flujo final.
- Activación pública.

## Variables del preview

```
ENABLE_LEGACY_COMMERCE=false
ENABLE_PRIVATE_COMMERCE_PREVIEW=true
PRIVATE_COMMERCE_TESTER_EMAILS=email1@example.com,email2@example.com

STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

ENABLE_PRIVATE_COMMERCE_SENDCLOUD_LABELS=false
SENDCLOUD_PUBLIC_KEY=...
SENDCLOUD_SECRET_KEY=...
```

## Criterio para avanzar a Connect

## Estado del bloque Connect

- [x] Persistencia mínima y segura de cuenta conectada por vendedor.
- [x] Onboarding test con Stripe Connect Accounts v2 / recipient.
- [x] Sincronización de requisitos y capability de transferencias.
- [x] Tabla separada de transferencias.
- [x] Liberación test manual e idempotente tras entrega.
- [ ] Refund/reversal test.
- [ ] Disputas/chargebacks.
- [ ] Regla definitiva de liberación y soporte operativo.
- [ ] Revisión jurídica/fiscal antes de activación pública.
