# Threat model v1 — pagos y envíos

Fecha: 20/09/2026

## Estado

Esta fase está en preparación y **no está activada para usuarios**. El flujo visible de Wetudy sigue detrás de `ENABLE_LEGACY_COMMERCE`.

Este documento define los controles mínimos que deben mantenerse y los bloqueos que deben resolverse antes de habilitar pagos o envíos reales.

## Activos a proteger

- Dinero del comprador.
- Derecho del vendedor a cobrar.
- Identidad de comprador y vendedor.
- Dirección, teléfono y demás datos logísticos.
- Integridad de ofertas, importes, pagos, reembolsos y estados de envío.
- Webhooks y credenciales de Stripe/Sendcloud.
- Historial de auditoría de pagos y envíos.
- Disponibilidad del marketplace y prevención de dobles cobros/dobles envíos.

## Fronteras de confianza

1. Navegador del usuario: no confiable. IDs, importes, estados, URLs de tracking y metadata deben revalidarse server-side.
2. Next.js server/API: frontera de autorización de usuario y ownership.
3. Supabase: fuente de verdad de actores, ofertas, pagos, envíos y eventos.
4. Stripe: fuente externa de verdad sobre el pago.
5. Sendcloud: proveedor externo de logística; solo debe recibir los datos mínimos necesarios.
6. Webhooks externos: no confiar sin firma/identidad de proveedor e idempotencia.

## Amenazas y controles actuales

### Suplantación / acceso a operaciones ajenas

Riesgo: consultar o modificar un pago, checkout o envío de otro usuario.

Controles:
- `payment_intents`, `payment_events`, `shipments` y `shipment_events`: clientes autenticados tienen solo SELECT y RLS por buyer/seller.
- Escrituras de commerce pasan por rutas server-side con `service_role`.
- Confirmación y polling Stripe validan comprador autenticado y ownership de la sesión.
- Crear etiqueta exige que el usuario sea el vendedor del shipment.
- Confirmar entrega exige que el usuario sea el comprador.

Bloqueo de activación:
- Mantener pruebas E2E negativas de buyer/seller cruzados antes de habilitar el feature flag.

### Manipulación de importes

Riesgo: cliente altera precio, buyer fee, envío o total.

Controles:
- Precio aceptado se lee server-side desde la oferta.
- Pricing se calcula server-side.
- La sesión Stripe contiene metadata de offer/listing/buyer/seller.
- Confirmación y webhook comparan el total de Stripe con `total_buyer_amount` almacenado.

Bloqueo de activación:
- E2E de manipulación de parámetros y redondeos.
- Decidir y documentar fiscalidad/comisiones definitivas antes de dinero real.

### Pago falso o confirmación fail-open

Riesgo: marcar una operación como pagada sin confirmación del proveedor.

Controles:
- `confirmPaymentComplete` falla cerrado si Stripe no puede verificarse.
- Solo acepta `session.payment_status = paid`.
- Estado interno persistido: `succeeded`.
- Webhook valida firma Stripe y es la vía principal preparada para cambios de estado.

### Replay, reintentos y eventos fuera de orden

Riesgo: Stripe reenvía un evento, se cobra/procesa dos veces o un evento antiguo degrada el estado.

Controles:
- `payment_events.provider_event_id` tiene índice único parcial.
- Duplicados del webhook se tratan de forma idempotente.
- Un pago `succeeded` no se degrada por eventos posteriores no exitosos.
- Un shipment por `payment_intent_id` mediante índice único.

Bloqueo de activación:
- Probar replays reales con Stripe CLI/sandbox.
- Añadir idempotency key al crear Checkout Session para evitar sesiones duplicadas ante reintentos del cliente.

### Envíos antes de pago / saltos de estado

Riesgo: generar etiqueta o cerrar entrega sin pago confirmado o saltando estados.

Controles:
- Shipment se crea solo tras pago `succeeded` y solo si `delivery_method=shipping`.
- Crear etiqueta exige payment `succeeded`.
- Estados de DB y UI están alineados: `draft`, `quoted`, `label_pending`, `label_ready`, `in_transit`, `delivered`, `failed`, `cancelled`.
- Confirmar entrega requiere `in_transit` y actualización optimista.

Bloqueo de activación:
- Definir transición de despacho: automático por proveedor vs. confirmación manual.
- Validar callbacks/webhooks de Sendcloud o estrategia equivalente.
- E2E de transiciones inválidas.

### Exposición de PII logística

Riesgo: dirección/teléfono visibles para terceros o accesibles por Data API.

Controles:
- Datos de perfil privados restringidos por RLS.
- Lecturas cruzadas necesarias se realizan server-side.
- Ruta de etiqueta usa datos de envío server-side y solo después de validar actor/pago.

Bloqueo de activación:
- Confirmar minimización de campos enviados a proveedor.
- Definir retención/borrado y reflejarlo en Privacidad con revisión jurídica.

### URLs de tracking y contenido externo

Riesgo: URL arbitraria usada para phishing o redirecciones inseguras.

Bloqueo de activación:
- Validar esquema HTTPS y, cuando el proveedor sea automático, preferir URLs devueltas por el proveedor.
- Decidir si los envíos manuales permiten tracking de cualquier transportista.

### Webhook/secretos

Riesgo: webhook forjado o secretos expuestos.

Controles:
- Firma Stripe obligatoria.
- Secretos solo server-side.
- Feature gate deshabilita toda la superficie visible actual.

Bloqueo de activación:
- Confirmar secretos separados sandbox/production y rotación.
- Configurar endpoint Stripe de producción únicamente cuando se active la fase.

## Riesgos de negocio/compliance que el código no resuelve

### Pago al vendedor

La base actual calcula `seller_net_amount`, pero esto **no equivale a un payout real al vendedor**.

Antes de aceptar dinero real hay que decidir la arquitectura económica:
- Stripe Connect u otra solución marketplace;
- quién es merchant of record;
- onboarding/KYC de vendedores si aplica;
- cuándo se captura/libera el dinero;
- comisiones, impuestos y tratamiento de reembolsos.

Este punto es bloqueo de producto/legal y no debe inferirse desde el código existente.

### Reembolsos, disputas y chargebacks

Los estados de DB contemplan `refunded`, pero no existe todavía un lifecycle completo y probado para:
- refund total/parcial;
- pago fallido posterior;
- chargeback/disputa Stripe;
- cancelación de envío vinculada;
- reversión o ajuste del payout del vendedor.

No activar pagos reales hasta definirlos y probarlos.

## Checklist de activación

- [x] Commerce invisible tras feature gate.
- [x] Ownership/RLS/grants mínimos.
- [x] Confirmación Stripe fail-closed.
- [x] Webhook Stripe firmado e idempotente.
- [x] Estados internos alineados con constraints.
- [x] Shipment único por pago y creación solo tras `succeeded`.
- [x] Etiqueta solo tras pago confirmado.
- [x] Entrega solo desde `in_transit`.
- [ ] Idempotency key en creación de Stripe Checkout Session.
- [ ] Definir despacho manual vs. proveedor y callbacks de logística.
- [ ] Validar tracking URL.
- [ ] Definir Connect/merchant-of-record/payout.
- [ ] Definir refunds/disputes/chargebacks.
- [ ] CSP compatible con Stripe, Turnstile y proveedor logístico.
- [ ] E2E sandbox: éxito, fallo, retry, replay, async payment, actor incorrecto, importe manipulado y transiciones inválidas.
- [ ] Revisión legal/privacidad del flujo de dinero y datos logísticos.
