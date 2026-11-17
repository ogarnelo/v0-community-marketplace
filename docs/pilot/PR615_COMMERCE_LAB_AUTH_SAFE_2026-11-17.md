# PR615 — Comercio laboratorio: auth fuerte y errores privados

17/11/2026. Refuerzo preventivo de `refund`, `release-transfer`, `simulate-label` del laboratorio **privado**. No se activó, reembolsó, transfirió, simuló ni accedió a credenciales reales.

**Hallazgo:** los tres handlers confiaban en `getUser().data.user` ignorando `authError` y los fallos de consulta de `user_roles`. Los dos endpoints de Stripe llamaban `assertStripeTestMode` antes de comprobar sesión, devolvían errores internos de proveedores y no ponían no-store. `simulate-label` ignoraba errores de lectura de envío/pago y de inserción del evento.

**Cambio:** helper `requireCommerceLabSuperAdmin` exige sesión sin error y rol de base con lectura correcta: 401 ausencia, 503 Auth/rol indisponible, 403 no superadmin. Los tres handlers comprueban la autorización antes de cualquier cliente privilegiado y, en reembolso/transferencia, antes de siquiera comprobar claves Stripe. Respuestas privadas y genéricas. El error de la actualización simulada diferencia 409 carrera y 503 SQL; los fallos de evento después de actualizar devuelven 503 de conciliación. Se verifica el evento de transferencia luego de registrar Stripe (no ignorar su fallo).

**Riesgo residual:** hay side effects reales de Stripe test en estos flujos si se activan; controles de idempotencia y conciliación global financiera todavía NO-GO (#606). Los contratos son con mocks y el feature gate permanece igual. No SQL, no llamadas a Stripe.