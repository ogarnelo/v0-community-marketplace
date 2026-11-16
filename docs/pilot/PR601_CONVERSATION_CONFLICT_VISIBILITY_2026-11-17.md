# PR601 · Conversaciones únicas y visibilidad comprobada — 17/11/2026

**Hecho de base observado mediante SELECT-only:** `public.conversations` tiene `conversations_listing_buyer_seller_idx`, índice UNIQUE por `listing_id,buyer_id,seller_id`. `hidden_conversations` contiene `user_id`, `conversation_id`, `hidden_at`.

El servicio `getOrCreateConversation` retornaba error en un INSERT concurrente (23505) aunque la otra petición hubiera creado correctamente el chat. Ahora, en esa colisión, relee exclusivamente la misma terna y reutiliza el ID real sin duplicar analítica. Si no existe fila o la relectura falla, devuelve error público sin volcar SQL.

El servicio antes ignoraba el `error` del DELETE en `hidden_conversations`. Si fallaba, una conversación que acababa de recibir un evento podía seguir oculta. Ahora ese error se comprueba y el flujo padre, que ya fue reforzado en PR593/596/598/599, reporta conciliación de los efectos parciales en lugar de éxito silencioso. `touchConversation` también comprueba error y fila afectada.

**Pruebas:** casos runtime sintéticos de reuso, INSERT, carrera UNIQUE, fallos de lecturas, desocultación, touch y contrato del código, sin tablas, mensajes o usuarios reales. La función analítica sigue siendo best-effort. Sin migraciones, GRANT, RLS, pagos ni apertura del piloto.

**Limitación:** estas pruebas no sustituyen E2E con usuarios autenticados ni garantizan transacción atómica entre chat/evento/aviso. Sigue NO-GO.
