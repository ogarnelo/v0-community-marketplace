# Private Commerce Connect v3 — 22/09/2026

## Estado

Esta versión continúa siendo **privada y no pública**.

El flujo público de Wetudy no cambia:

> La entrega y el pago se acuerdan directamente entre las partes.

`ENABLE_LEGACY_COMMERCE` debe permanecer en `false`.

El acceso al checkout privado y al onboarding Connect exige:

- `ENABLE_PRIVATE_COMMERCE_PREVIEW=true`;
- usuario autenticado;
- Super Admin o email incluido en `PRIVATE_COMMERCE_TESTER_EMAILS`;
- claves Stripe exclusivamente de test (`sk_test_` / `pk_test_`).

## Stripe Connect

Para esta fase se usa la API estable de Connected Accounts con cuentas Express y Account Links alojados por Stripe.

No se hace depender la beta de Accounts v2 porque su disponibilidad puede depender del acceso/preview habilitado en la cuenta Stripe. La persistencia de Wetudy queda desacoplada del tipo de API para poder migrar más adelante.

Cada vendedor tester puede crear una cuenta Connect test desde:

- `/account/commerce-preview`

La ruta no está enlazada desde la navegación pública.

La creación de cuenta es explícita al pulsar la acción de onboarding; consultar la página no crea recursos Stripe.

Persistimos únicamente:

- ID de cuenta Stripe;
- estado de onboarding;
- capabilities relevantes;
- requisitos pendientes;
- flags de payouts/transfers.

No almacenamos datos KYC bancarios o de identidad: los recoge Stripe.

## Modelo de fondos del preview

Se mantiene la arquitectura de **separate charges and transfers**:

1. comprador paga a la cuenta plataforma en Stripe test; durante esta beta Checkout se limita a tarjeta para evitar liberar fondos sobre métodos asíncronos aún no validados;
2. Wetudy registra el pago;
3. para envío, se completa el flujo logístico;
4. el comprador confirma entrega;
5. Super Admin libera manualmente el neto del vendedor desde Commerce Lab;
6. la transferencia usa el cargo Stripe como `source_transaction`;
7. no existe liberación automática.

La sesión crea el PaymentIntent con un `transfer_group` estable por oferta. La transferencia es idempotente por `payment_intent_id` y por idempotency key de Stripe.

## Refund / reversal

El lab permite un refund completo de prueba.

Si el dinero ya fue transferido al vendedor:

1. se crea primero una reversión de la transferencia;
2. después se crea el refund del PaymentIntent;
3. se actualizan estados internos;
4. envíos aún no despachados se cancelan.

No se implementan refunds parciales todavía.

## Logística

Sendcloud real sigue detrás de:

`ENABLE_PRIVATE_COMMERCE_SENDCLOUD_LABELS=true`

Por defecto se mantiene apagado y el lab permite simular etiquetas sin coste.

La liberación de fondos de operaciones con envío exige estado `delivered`.

## Qué sigue bloqueado

- comercio público;
- claves Stripe live en el preview;
- payout/liberación automática;
- refunds parciales;
- chargeback/dispute automation;
- webhooks Connect de requisitos/capabilities;
- cotización Sendcloud v3 real;
- devoluciones;
- seguro/pérdida/daño;
- decisión económica final de buyer fee;
- decisión jurídica/fiscal final sobre quién es merchant/business of record;
- activación de vendedores profesionales.

## Requisito previo a publicación

Antes de hacer este sistema público habrá que revisar como mínimo:

- modelo contractual plataforma/comprador/vendedor;
- PSD2/Stripe Connect y responsabilidades de la plataforma;
- fiscalidad y reporting aplicable;
- DAC7 cuando corresponda;
- consumo y condición particular/profesional del vendedor;
- política de buyer protection;
- reembolsos, chargebacks y fraude;
- términos de envío, pérdidas y devoluciones;
- precios reales y márgenes logísticos;
- identidad legal definitiva del prestador.

Esta fase técnica no decide ninguno de esos puntos: permite probar el flujo con dinero y cuentas **test** sin exponerlo al público.
