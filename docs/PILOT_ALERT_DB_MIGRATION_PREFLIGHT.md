# WETUDY — Verificación previa a migraciones de correos (P0 #375)

Fecha: 10/11/2026. **Esta fase no aplica migraciones de producción.** El script `scripts/pilot-marketplace-alert-production-preflight.sql` es solo lectura; inicia una transacción `READ ONLY`, consulta presencia de funciones/tablas, estados agregados, restricción de estado, RLS y recuento DEMO.

## Estado observado en Education Marketplace

Consulta autenticada y read-only del proyecto Supabase correspondiente:
- PostgreSQL 17.6; tabla `marketplace_alert_outbox` existe.
- **Seis** anuncios DEMO; **cero** trabajos outbox y cero bloqueados para revisión.
- `marketplace_alert_email_intents`, `marketplace_alert_email_prepare_v1` y `marketplace_alert_hold_for_review_v1` **no existen** todavía. La restricción outbox solo contempla pending, processing, completed y failed.
- Las dos banderas de recuperación no estaban configuradas en Vercel durante la revisión anterior. Volver a revisar sus **nombres** sin descifrar secretos antes del despliegue.
- No se consultaron emails ni códigos postales de familias; no se crearon cuentas, centros, avisos ni correos.

## Asesores Supabase (consulta sin modificaciones)

Seguridad: `auth_leaked_password_protection` advierte que el control de contraseñas filtradas está desactivado. Revisión recomendada: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

También aparecen tablas con RLS habilitado y sin políticas, entre ellas `marketplace_alert_outbox`; **no conceder políticas públicas** para eliminar el aviso si su uso previsto es exclusivamente mediante service_role.

Rendimiento: `saved_searches_directory_school_code_fkey` figura sin índice de cobertura. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys. No crear un índice ni eliminar los calificados como sin uso sin medir carga, tamaño y bloqueo de DDL.

## Puertas antes de aplicar las migraciones de #377 y #382

1. Validar copia de seguridad, política PITR y recuperación; revisar el orden, existencia y checksum de las migraciones mediante la herramienta oficial. No improvisar cambios SQL parciales en producción.
2. Comprobar roles, RLS, constraints existentes, las dependencias de la tabla outbox y la ausencia de trabajos en curso. Obtener la salida del preflight inmediatamente antes y después.
3. Aplicar la migración de intenciones **antes** de la de cuarentena, en una ventana coordinada, con asesor de seguridad posterior. SQL no debe consultar PII ni activar worker.
4. Comprobar funciones/privilegios service_role, ausencia de acceso a anon/authenticated, y que los seis DEMO permanezcan idénticos. No marcar las migraciones completadas solo por existir los archivos en GitHub.
5. Mantener **ambas** banderas de envío sin configurar, y sin Vercel cron. No activar hasta conciliación operativa, E2E autorizada, rollback y costes medidos.

## Rollback y costes

Un rollback de aplicación NO revierte automáticamente una migración. Para una tabla de intenciones activa, eliminarla podría destruir evidencia de envíos ambiguos; nunca borrar registros de conciliación como salida rápida. Ante problemas, mantener el worker OFF, conservar filas y revertir solo código con seguridad; diseñar una reversión de esquema después de revisar dependencias y los datos presentes.

Este script y sus comprobaciones no tienen coste de correo; **no se han inspeccionado facturas ni medido costes incrementales reales**. La incidencia #375 permanece P0.
