# PR596 — No declarar sincronizada una conversación si UPDATE afecta cero filas

16/11/2026. Servicio `lib/services/donations.service.ts`, sin migraciones ni cambios de esquema.

El flujo del vendedor PR590 llamaba `touchConversation()` como mejor esfuerzo, cuyo error SQL podía ignorarse. Ahora usa UPDATE de `conversations.updated_at` con `select('id').maybeSingle()` y verifica tanto error como fila afectada. Lo mismo para la creación de solicitudes PR593, donde antes se inspeccionaba el error pero no el número de filas actualizadas. Un fallo => `DonationDecisionReconciliationError` / `DonationRequestReconciliationError` después de la decisión ya guardada, y el controlador existente responde 503 en vez de falso OK. No reintentar automáticamente ni duplicar eventos o mensajes.

Amplía las pruebas de la vía del vendedor con 4 escenarios (approve/reject × error o 0 filas) y la de creación con 1 escenario sin fila. Todos sintéticos, sin mensajes reales. Conserva los otros 28+17 contratos. RLS P0 #591 sigue review-only: no se aplica SQL ni se abre piloto.