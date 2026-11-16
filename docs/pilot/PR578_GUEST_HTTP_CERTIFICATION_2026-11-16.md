# PR578 — Certificación independiente de HTTP 401 de visitante (solo lectura)

16/11/2026. Se añade `scripts/pilot-guest-http-smoke.mjs` y 11 pruebas locales de su lógica. El script hace únicamente tres solicitudes GET **sin cookies, sin Authorization y sin cuerpo**:

1. `/api/marketplace/my-school`.
2. `/api/marketplace/listing-draft`.
3. `/api/messages/conversation-summary?conversation_id=11111111-1111-4111-8111-111111111111`.

**Criterio:** HTTP 401, JSON privado `{error: string}` y cabecera `Cache-Control: private, no-store` en cada ruta. Si un middleware de Vercel devuelve HTML, redirección o el cliente sufre un fallo de red, el resultado es **INCONCLUSO**, no éxito ni un fallo de negocio verificado.

**Ejecución segura en el Mac del responsable, cuando proceda:**
```bash
node scripts/pilot-guest-http-smoke.mjs https://www.wetudy.com
```
Requiere el repositorio actualizado con esta PR y Node 22 (sin dependencias nuevas). Devuelve exit 0 solo si 3/3 OK; exit 1 si no se certifica; 2 si origen inválido. No escribe datos, no inicia sesión ni consume correo; no se ejecuta automáticamente contra producción en CI.

**Estado previo verificado:** `/my-school` = HTTP 401 externo desde Mac (16/11). Las otras dos rutas siguen sin evidencia externa; estos tests del script no cuentan como certificación real.

**NO-GO** de piloto hasta DR integral PostgreSQL/Auth/Storage, E2E con sesiones reales autorizadas y 3/3 actas AMPA. No aplica el índice UNIQUE parcial PR570 ni toca backups.
