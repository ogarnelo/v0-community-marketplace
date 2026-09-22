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

Para esta fase privada se mantiene la implementación existente de Connected Accounts v1 con cuentas Express y Account Links alojados por Stripe.

La documentación actual de Stripe marca los tipos de cuenta legacy de Accounts v1, incluido Express, como deprecados para plataformas Connect nuevas. Por eso esta elección se considera **transitoria para el laboratorio privado**, no una decisión de producción. Antes de activar comercio real hay que decidir y validar la migración a Accounts v2/configuraciones actuales o justificar explícitamente la continuidad de la integración existente. La persistencia de Wetudy permanece desacoplada para facilitar esa revisión.

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

La sesión crea el PaymentIntent con un `transfer_group` estable por oferta. La transferencia reutiliza el `transfer_group` del PaymentIntent, es única por `payment_intent_id` en Supabase y usa idempotency key de Stripe. Antes de crear una transferencia, el backend reconcilia las transferencias ya existentes en Stripe; así también se cubre el caso "Stripe tuvo éxito pero falló el write en Supabase" y los reintentos posteriores a la ventana de retención de una idempotency key.

## Modelo económico técnico del sandbox

Los importes de esta beta son provisionales y **no son precios finales**.

El modelo distingue actualmente:

- importe del artículo: `payment_intents.amount`;
- buyer fee: `payment_intents.buyer_fee_amount`;
- importe de envío cobrado al comprador: `payment_intents.shipping_amount`;
- total pagado por el comprador: `payment_intents.metadata.total_buyer_amount`;
- neto previsto del vendedor: `payment_intents.seller_net_amount`;
- platform fee: `payment_intents.platform_fee_amount` (en el sandbox actual coincide con el buyer fee);
- transferencia al vendedor: `commerce_transfers.amount`;
- refund al comprador: `commerce_refunds.amount`, guardando el importe real devuelto por Stripe.

Queda **sin modelar como campo económico independiente** el coste logístico real del transportista. `shipping_amount` es lo que se cobra al comprador, no el coste real de Sendcloud/carrier. También queda pendiente separar explícitamente las comisiones de procesamiento Stripe de la comisión de plataforma. Ambos puntos deben resolverse antes de fijar precios/márgenes reales.

## Refund / reversal

El lab permite un refund completo de prueba.

Si el dinero ya fue transferido al vendedor:

1. se crea primero una reversión de la transferencia;
2. después se crea el refund del PaymentIntent;
3. se actualizan estados internos;
4. envíos aún no despachados se cancelan.

No se implementan refunds parciales todavía. El backend exige que Stripe, Supabase y el cargo coincidan en importe/moneda, rechaza estados con refunds parciales ajenos, reconcilia refunds ya creados en Stripe antes de crear otro y detecta reversals parciales como estado que requiere revisión manual.

## Logística

Sendcloud real sigue detrás de:

`ENABLE_PRIVATE_COMMERCE_SENDCLOUD_LABELS=true`

Por defecto se mantiene apagado y el lab permite simular etiquetas sin coste.

La liberación de fondos de operaciones con envío exige estado `delivered`.

## Runbook E2E Stripe test

Antes de iniciar una prueba extremo a extremo, Commerce Lab debe mostrar:

- comercio público desactivado;
- preview privado activado;
- Stripe en modo test;
- secreto de webhook configurado;
- creación real de etiquetas Sendcloud desactivada.

No se deben usar claves live ni habilitar `ENABLE_LEGACY_COMMERCE`. Para logística, la prueba usa etiqueta simulada y no genera costes reales.

### Preparación

1. Usar dos cuentas privadas autorizadas: comprador tester y vendedor tester.
2. El vendedor abre `/account/commerce-preview`, inicia el onboarding alojado por Stripe y completa los datos de prueba.
3. Al volver a Wetudy, actualizar el estado Connect hasta que la cuenta esté preparada para transferencias test.
4. Crear o reutilizar una oferta privada aceptada entre comprador y vendedor.
5. Verificar que el endpoint Stripe usado por esta beta pertenece al entorno test/sandbox y que los eventos recibidos tienen `livemode=false`.

La integración sincroniza el estado del vendedor directamente contra Stripe al cargar la página y antes de liberar fondos. Además, el webhook procesa `account.updated` únicamente para cuentas ya registradas en la beta privada, con `livemode=false`, y actualiza capabilities/requisitos sin persistir KYC ni datos bancarios. El endpoint Stripe de test debe estar suscrito a ese evento para recibir actualizaciones proactivas.

### Flujo A — pago, envío y transferencia

1. comprador inicia Checkout privado desde una oferta aceptada;
2. paga con un método de prueba de Stripe;
3. el webhook firmado actualiza el pago hasta `succeeded`;
4. si la entrega es con envío, se usa exclusivamente la simulación de etiqueta;
5. el shipment progresa hasta `delivered`;
6. Super Admin abre `/admin/super/commerce-lab`;
7. libera manualmente el neto del vendedor;
8. verificar que Stripe creó una única transferencia test y que Supabase refleja el mismo importe, moneda y estado.

### Flujo B — refund antes de transferir

Con una operación nueva:

1. completar pago test;
2. no liberar fondos al vendedor;
3. ejecutar `Refund test` desde Commerce Lab;
4. verificar refund completo en Stripe test;
5. verificar `commerce_refunds` y `payment_intents.status=refunded`;
6. si el shipment todavía no se despachó, verificar que queda cancelado.

### Flujo C — transferencia, reversal y refund

Con otra operación nueva:

1. completar pago test;
2. completar entrega si aplica;
3. liberar manualmente la transferencia;
4. ejecutar `Refund test`;
5. verificar que Stripe hace primero una reversión completa de la transferencia y después el refund completo;
6. verificar que Supabase refleja transferencia `reversed`, refund `succeeded` y pago `refunded`.

Si Stripe contiene un refund ajeno/parcial o una reversión parcial, el backend bloquea la operación automática y exige reconciliación manual.

### Validaciones posteriores

Después de cada recorrido comprobar:

- no existe más de una transferencia por `payment_intent_id`;
- no existe más de un refund Wetudy por `payment_intent_id`;
- Stripe y Supabase coinciden en estado, moneda e importe;
- el Commerce Lab no muestra acciones incompatibles con el estado actual;
- `ENABLE_PRIVATE_COMMERCE_SENDCLOUD_LABELS` continúa en `false`;
- el flujo público y su copy permanecen sin cambios.

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
