# WETUDY — recuperación del historial de migraciones de fotografías

**20 de noviembre de 2026 — conciliación del esquema aplicado, sin volver a ejecutar SQL.**

## Lo verificado en Supabase (solo lectura)

El historial `supabase_migrations.schema_migrations` de Education Marketplace contiene las migraciones ya aplicadas:

| Versión | Nombre | Objeto |
| --- | --- | --- |
| 20261119165430 | `p0_photo_upload_claim_quota_20261119` | Quota atómica, RLS, servicio |
| 20261119194748 | `p0_photo_server_only_storage_policies_20261119` | Cierre de subidas directas de fotos y conservación de documentos chat |

Los textos incluidos en `supabase/migrations/` se han tomado **sin modificaciones funcionales** de la columna `statements` del historial de producción. Coinciden con las versiones efectivamente aplicadas, no con los borradores SQL menos completos de la PR histórica #236 o los archivos de revisión bajo `docs/pilot/sql`.

## Comprobaciones de producción sin escrituras

- `storage.objects`: RLS habilitada.
- Solo una política `INSERT`: **conversation participants may upload documents only**, para participantes y extensiones PDF/DOC/DOCX con MIME controlado.
- Políticas antiguas de inserción de imágenes en listado/chat: **ausentes**.
- La política `SELECT` de documentos y fotografías privadas de chat para participantes **persiste**.
- `claim_photo_upload_slot(uuid)`: `EXECUTE` para `service_role`, denegado para `anon` y `authenticated`.
- El servidor conserva la ruta `/api/uploads/sanitized-photo` con autenticación, autorización de recurso, saneamiento de imágenes, cuota atómica y rollback protegido.

La tabla `storage.buckets` aún admite varios tipos MIME, pero **eso no concede por sí solo escritura al navegador**: RLS limita las rutas. Las fotos se almacenan por la ruta de servidor autorizada.

## Operación / continuidad

1. **NO aplicar estas migraciones una segunda vez.** Están registradas por sus versiones exactas en el historial remoto. La migración Storage tiene preflight transaccional que espera las políticas antiguas y debe fallar al reejecutarla sobre el estado actual.
2. Los SQL son evidencia de recuperación y auditoría. Para una restauración en base vacía, aplicar ordenadamente el esquema previo, la cuota y después Storage, con ensayos aislados y sin identidades reales.
3. La PR antigua #236 se cerró como sustituida sin fusionarla. Los tests actuales y los ensayos PG17 de cuota y Storage están en `main`.
4. La auditoría no autoriza cambios de políticas, grants, flags, fotografías ni apertura del piloto. El ensayo funcional multicuenta pendiente sigue diferido al piloto.

**Ref. seguimiento:** issue #767 y PR de reconciliación posterior a #785.
