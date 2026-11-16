# WETUDY — PR569 · Fallos de Auth y caché del procesador de alertas

Fecha: 16/11/2026. Sin mutaciones SQL, sin mensajes o emails reales.

**Hallazgo en main tras PR568:** POST /api/marketplace/listings/match-saved-searches recibía Auth y permitía usar el objeto user incluso si getUser devolvía un error, mientras que la mayoría de sus respuestas no indicaban Cache-Control privado. El handler tiene dos entradas autorizadas distintas: propietario del anuncio autenticado y worker interno con ambas feature flags, CRON_SECRET válido y cabecera x-wetudy-alert-outbox: 1.

**Corrección:** los usuarios interactivos deben superar getUser sin error antes de instanciar el cliente privilegiado; error Auth => HTTP 503 no-cache; ausencia de sesión => HTTP 401. Para el worker firmado se omite la consulta innecesaria a Auth, sin debilitar la verificación de firma, flags, lease y etapa ya existentes. Un helper aplica Cache-Control: private,no-store a todas las respuestas normales y de error, incluso éxitos y avances del worker; el catch final sigue devolviendo mensaje fijo privado.

**Pruebas:** siete casos runtime sintéticos del handler real: usuario anónimo, Auth con user obsoleto y error, Auth que lanza excepción, worker firmado, bearer sin cabecera, UUID inválido y contrato de respuestas privadas. Se conservan las pruebas anteriores de alertas, outbox, idempotencia y fail-closed. No se interpretan como entregas reales de emails ni E2E con familias.

**Puerta de piloto:** NO-GO. Siguen 0/3 AMPA, E2E auténtico y DR integral pendientes. Gestión de respaldos del 17/11 conservada; no cambiar supabase_admin, ni MAINTAIN fuera de alcance.
