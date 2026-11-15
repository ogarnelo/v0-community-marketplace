# WETUDY | Dos gates de apertura: #447 DML y #245 AMPA — 15 NOV 2026

Este cambio es exclusivamente QA / SQL review-only. Ningún DDL en Supabase, ninguna modificación de main o Vercel.

## #447 — ACL de anuncios
PR #509 demostró en PostgreSQL 17 sintético que la propuesta actual revoca SELECT de anon, pero deja UPDATE de anon tal como estaba. No hay demostración de que anon pueda actualizar filas reales: RLS actual no ofrece política UPDATE para anon, y GRANT aislado no basta. No obstante, revocar DML es defensa en profundidad y reduce superficie futura.

Se añade **una propuesta separada** `scripts/pilot-anon-listings-dml-revoke-review-only.sql`: `REVOKE INSERT, UPDATE, DELETE ON TABLE public.listings FROM anon`. Conserva INSERT/UPDATE para authenticated, incluyendo postal_code, y SELECT para service_role. La ejecución se prueba ÚNICAMENTE en fixture PostgreSQL 17 efímero con `scripts/pilot-ci-privacy-grants-after-dml-assert.sql`, después de la revocación SELECT ya propuesta. Es un gate sintético; no garantiza que todos los lectores, RPC o clientes de producción sigan funcionando. No desplegar hasta completar matriz E2E y autorizar explícitamente.

## #245 — Evidencia 3 AMPA
`scripts/pilot-three-ampa-release-evidence-gate.py` lee un JSON local privado y exige: 3 gates P0 aprobados (privacy_447, disaster_recovery_455, authenticated_e2e_245), 3 AMPA distintas con aprobación, y 8 criterios por AMPA: turnstile_email, family_isolation, school_approval, listing_postal_radius, chat_agreement, moderation_email, mobile_smoke, cleanup. Requiere referencias privadas opacas distintas. No acepta campos extra como correos, datos de menores ni IDs reales. No resuelve URLs ni hace acciones externas.

Los tests CI usan referencias ficticias. Que todos los indicadores de un manifiesto sean true **solo indica que se han declarado listos**, y NO constituye evidencia verificada ni firma de publicación. El script imprime `READY_FOR_HUMAN_RELEASE_REVIEW` y `NOT_CERTIFIED`, nunca `GO_PRODUCTION`. Una persona autorizada debe comprobar cada acta en custodia privada.

## Estado y condiciones
- #447 NO-GO hasta permisos y E2E con CP, radio, feed, detalles y favoritos reales verificados, además de revisión privacidad.
- #455 NO-GO: no se ha restaurado con éxito DB/Auth/Storage completos desde la pareja de backups privados. CI PostgreSQL sintético no lo sustituye.
- #245 NO-GO: 0/3 AMPA confirmadas; no crear pruebas ficticias para rellenar el registro.
- 26/11/2026 es el objetivo de decisión condicionada, no una promesa de lanzamiento.
- No publicar contraseñas, backups descifrados, datos familiares o actas privadas en GitHub.

Fuentes: issues #447, #455, #245; PR #438; scripts/pilot-anon-listings-revoke-proposal.sql y docs/pilot/PILOT_THREE_AMPA_EXECUTION_PACK_2026-11-15.md.