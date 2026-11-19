# WETUDY — Bloque fotografías y Storage: rollout transaccional previo al piloto

Fecha: 19-11-2026. Rama/PR: #748. **ESTADO: NO CERRADO. SQL NO APLICADO.**

## Evidencia de inspección real
- Supabase Education Marketplace, PostgreSQL 17.6.
- 35 objetos existentes en listing-photos y chat-attachments (no borrar ni transformar).
- storage.objects con RLS vigente, dos políticas INSERT heredadas que permiten subida directa de imágenes.
- photo_upload_claims y claim_photo_upload_slot(uuid) aún ausentes.
- La PR #748 añade conversión y re-encode independiente en servidor, validación estricta de sesión/destino, límites y cuotas, EXIF/GPS eliminado, rollback servidor fail-closed y nueva subida optimizada para listado, borrador y chat. PDF/Word conserva ruta de documento.
- CI: contratos críticos, privacidad adjuntos y PostgreSQL 17 aislado de cuota/políticas. Vercel preview READY en commit observado antes de este documento.

## Secuencia exigida — autorización SQL separada
1. **Preflight de lectura:** RLS vigente en storage.objects; constatar exactamente las políticas INSERT, estado de cuota, buckets, roles y número de objetos. Comprobar que no hay migración anterior.
2. **Aplicar primero la cuota** con transacción, lock_timeout, statement_timeout, operación de DDL autorizada por separado. Fuente exacta `docs/pilot/sql/p0_photo_upload_claim_quota_review_only_20261119.sql`. Comprobar RLS, ACL de tabla/secuencia, service_role EXECUTE y prohibiciones para anon/authenticated. **No cambiar políticas ni objetos existentes.**
3. **Fusionar PR #748** solamente con CI verde y commit exacto. Verificar CI en main y Vercel producción READY del mismo SHA. Comprobar por HTTPS que el endpoint existe y sin sesión responde 401 (sin subir archivos).
4. **Aplicar solo después la política restrictiva de Storage:** `docs/pilot/sql/p0_photo_server_only_storage_policies_review_only_20261119.sql`. Postflight: lista de políticas INSERT debe negar fotos de browser en listing-photos y chat-attachments, pero permitir PDF/Word de miembros de conversación; preservar SELECT/DELETE, buckets, objetos y metadata. No habilitar ningún usuario real ni piloto.
5. Verificar que los archivos antiguos siguen visibles, que `listing_drafts`, `listings.photos` y `listing_photos` no se han modificado. Ejecutar solamente pruebas sintéticas en PG17; QA con familias reales se traslada al piloto.
6. Actualizar maestro y continuidad. Marcar cerrado **técnicamente antes del piloto** solo cuando se hayan superado ambas migraciones y CI/Vercel en el SHA publicado.

## No hacer
- No ejecutar el SQL automáticamente desde esta rama. No fusionar #236/#238/#239 (ramas apiladas antiguas).
- No revocar subidas directas antes de que el servidor esté listo; rompería el marketplace.
- No marcar este bloque cerrado mientras la RPC de cuota y las políticas no estén instaladas.
- No enviar correos, subir fotografías reales de alumnos ni abrir piloto.

## Fallos y rollback
- Si la cuota falla antes del merge: detener; operación DDL transaccional revierte su propia ejecución. No se ha tocado Storage.
- Si el despliegue de código falla después de aplicar cuota: no cambiar políticas INSERT; hacer rollback de despliegue conforme a Vercel y no invocar el nuevo endpoint.
- Si la política Storage falla: rollback de su propia transacción; no borrar objetos ni alterar permisos de lectura. Las políticas legadas deben restaurarse solo mediante SQL explícito revisado; reabrir subidas directas se considera incidente de privacidad.
- Nunca desinstalar ni revocar una protección si hay evidencias de referencia o un resultado de Storage incierto. Registrar cualquier discrepancia para conciliación.
