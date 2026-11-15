# WETUDY — Tres gates P0 adicionales en CI (15/11/2026)

**Alcance:** QA exclusivamente. Sin acceso a producción, sin main, sin datos de usuarios ni correos de menores. Los tests Python corren con código fuente local del runner de GitHub Actions.

## #447 — Marketplace feed de lectura elevada
El endpoint `app/api/marketplace/feed/route.ts` utiliza `createAdminClient()` (service role) con consultas `listings` y `profiles`. Se ha verificado por inspección que responde con `postalCode:null`, utiliza distancia aproximada calculada en el servidor, obtiene el CP del perfil de usuario autenticado para radio, y aplica filtro `status='available'` al consultar los anuncios. Los tests de contrato detectan regresiones evidentes de selección indiscriminada o cambios de esas líneas. **Limitación:** contrato estático, NO sustituye HTTP E2E, PostgREST, auditoría de fotos ni análisis de otras rutas. El campo `sellerId` permanece deliberadamente en `MarketplaceListing`: su legitimidad como identificador público debe revisarse en la auditoría de datos.

## #245 — Manifiestos AMPA no pueden usar evidencias ficticias
El evaluador local `scripts/pilot-three-ampa-release-evidence-gate.py` ya exigía tres AMPA, ocho casos por AMPA, gates P0 y revisión humana. Ahora bloquea referencias de evidencia que empiecen por `private:synthetic-`, `private:fixture-`, `private:demo-`, `private:test-`, `private:ci-` o `private:sample-`, incluso si todos los flags dicen PASS. Es una protección contra falsos positivos, no prueba que referencias diferentes sean auténticas. Todas las actas reales deben permanecer privadas y pasar revisión manual; 0/3 AMPA aceptadas hasta evidencia.

## #455 — Sin falso GO por restauración parcial
Nuevo test de `scripts/pilot-dr-scope-audit.py` confirma inventario 79 tablas públicas y demuestra que la restauración sintética parcial no certifica DB + ACL + GoTrue/Auth + Storage; el comando `--require-full-coverage` debe devolver código 2 (NO-GO). El ensayo del ZIP local todavía no tiene PASS para las dos políticas archivadas, ni el runtime real Auth/Storage está certificado.

## Criterio release
Los tres contratos deben aprobarse en GitHub antes de considerar pasos de implementación. La apertura 26/11/2026 continúa condicionada a #447, #455, pruebas E2E y aceptación real de las tres AMPA. No usar estas pruebas como permiso de despliegue.