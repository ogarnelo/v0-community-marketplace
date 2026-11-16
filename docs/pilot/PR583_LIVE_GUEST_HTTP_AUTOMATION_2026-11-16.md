# PR583 · Revalidación GitHub Actions de las tres rutas privadas de invitado

16/11/2026. Se publica un workflow ligero y reproducible: `.github/workflows/pilot-live-guest-http-contract.yml`.

**Disparadores:** ejecución manual `workflow_dispatch` y `push` sobre `main` únicamente cuando cambie una de las tres rutas protegidas, el comprobador o el workflow. No se activa en cada PR ni en cada commit de desarrollo. Usa Node22 de GitHub Actions, sin instalar paquetes ni necesitar Node.js en el Mac del fundador. Sin secretos, sin Supabase, sin credenciales, sin escrituras en producción. El workflow queda restringido a `contents: read` y checkout sin credenciales persistentes.

El script de PR578 envía GET sin cookies a `https://www.wetudy.com` para `/api/marketplace/my-school`, `/api/marketplace/listing-draft`, `/api/messages/conversation-summary`. **Solo aprueba** si 3/3 devuelven HTTP 401, JSON únicamente con `error` y Cache-Control private/no-store. Devuelve error para fallos y estado INCONCLUSO ante HTML, redirección o corte de red; se genera el resumen incluso en fallo. **La prueba es del dominio productivo en ese instante, no de la rama de PR ni de las sesiones autorizadas**. No sustituye pruebas E2E, DR ni actas AMPA.

A fecha 16/11, el fundador ya obtuvo evidencia externa 3/3 con curl, registrada en PR578: https://github.com/ogarnelo/v0-community-marketplace/pull/578#issuecomment-6922653676 . La ejecución automática GitHub no se declarará completada hasta ver el run de Actions y su conclusión.

**Cinco pruebas de contrato de workflow** conectadas a `test:pilot-security`. Sin cambios de RLS, políticas, backups ni apertura del piloto general. PR570 continúa review-only.
