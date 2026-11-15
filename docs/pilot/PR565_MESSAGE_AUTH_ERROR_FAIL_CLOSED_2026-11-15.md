# WETUDY — PR565 · Fallos de Auth no autorizan consultas privadas de conversaciones

15/11/2026. Dos endpoints de chat: `POST /api/messages/send` y `GET /api/messages/conversation-summary`.

## Hallazgo
Ambas rutas desestructuraban `user` de `supabase.auth.getUser()` sin comprobar su propiedad `error`. Si Auth fallaba pero una dependencia devolvía datos de usuario obsoletos, podían continuar hasta crear un cliente `service_role` tras verificar RLS en un momento en que la identidad no estaba establecida correctamente.

## Cambio
Comprobar `authError` explícitamente antes de consultar conversaciones, mensajes, perfiles o instanciar el cliente privilegiado; devolver HTTP 503 privado `Cache-Control: private,no-store` si falla Auth. Una ausencia normal de sesión conserva 401. Los mensajes del proveedor no salen en la respuesta.

## Pruebas
Seis pruebas ejecutan los dos handlers TypeScript reales con datos y Auth sintéticos: error Auth con usuario obsoleto => 503, sin usuario => 401, excepción inesperada Auth => respuesta privada y sin consultas. Ninguna prueba utiliza conversaciones o correos reales; las pruebas no sustituyen el E2E autenticado real.

RLS y grants sin cambios. AMPA 0/3, DR integral pendiente, respaldos previstos para 17/11, NO-GO de apertura.
