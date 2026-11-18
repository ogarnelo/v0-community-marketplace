# P0 · Compra directa transaccional — candidato 18/11/2026

Estado: **REVIEW ONLY**. El archivo `scripts/p0_buy_now_atomic_candidate_review_only.sql` no es una migración ni está conectado a la ruta comercial. **No se autoriza su ejecución en Supabase**.

El candidato implementa una función PostgreSQL de una sola instrucción, que usa un bloqueo de fila `FOR UPDATE` del anuncio y realiza en su misma transacción la conversación (sin duplicarla), reserva, oferta aceptada con actor `NULL`, evento, mensaje V2 y registro local de intento de pago. Si falla cualquier inserción posterior, PostgreSQL revierte *todas* las escrituras de esa instrucción, evitando anuncios reservados sin oferta. Comprueba vendedor, importe, tipo venta, ausencia de ofertas aceptadas y validez de tarifa.

**Importante:** la función se define `SECURITY INVOKER`, sin ejecución para `anon/authenticated/PUBLIC` y con ejecución explícita para `service_role`; no lee ni valida JWT en SQL. El único futuro invocador debe ser una ruta autenticada y autorizada de servidor, tras revisión independiente de RLS, permisos, operaciones concurrentes y auditoría de pagos. No incluye cargo Stripe ni notificaciones externas, que deberán conciliarse fuera de la transacción.

**Bloqueos antes de implementar:** prueba PostgreSQL 17 con esquema equivalente (incluidas constraints, FK y triggers); rollback probado; duplicados de conversación; revisión de autorización e idempotencia; migración aprobada expresamente; integración en ruta detrás de gate; validación de datos reales sin crear cargos; reversibilidad. En particular, no activar el checkout ni el piloto por la existencia de este archivo.
