# WETUDY — Replay RLS archivado real con datos sintéticos y rollback (Mac Intel)
15/11/2026 | issue #455 | QA únicamente | **NO equivale a restauración completa**

## Situación ya validada por el fundador
- macOS Big Sur 11.4, Postgres.app 17.12, FileVault ON, solo localhost.
- Seis reglas HBA SCRAM-256 activas y password incorrecta rechazada.
- Base local `wetudy_dr_local_20261115` sin tablas, rol `wetudy_dr_restore` NO superusuario.
- Rol `authenticated` NOLOGIN, con SET permitido desde rol de restore.
- Preflight backup cifrado PASS; pg_restore TOC 79/79 public, 27/27 Auth, 10/10 Storage.
- Dos `CREATE POLICY` RLS reales pudieron extraerse del ZIP nuevo con `PASS_MAC_REAL_RLS_POLICY_PREFLIGHT`.
- RLS sintético local con dos familias PASS (visibilidad y bloqueo borrado ajeno), ROLLBACK correcto.

## Qué aporta esta tanda
Script `scripts/pilot-founder-macos-archived-rls-replay.py`: obliga destino codificado `127.0.0.1:5432/wetudy_dr_local_20261115` y rol limitado `wetudy_dr_restore`; exige DB sin tablas y auth schema ausente, authenticated NOLOGIN y permiso SET; vuelve a verificar ZIPs antes de descifrar. Extrae únicamente dos políticas RLS `saved_search_matches_select_own` y `saved_search_matches_delete_own` con `pg_restore --list/--use-list --file`. Rechaza DDL cuyos predicados no sean estrictamente `user_id = auth.uid()` o inverso (con SELECT y paréntesis opcionales), o cuya orden, rol, tabla o nombre difieran. No ejecuta ninguna otra sentencia del dump.

En una **sola sesión y transacción** crea Auth simulado, tabla y dos filas ficticias, aplica las sentencias CREATE POLICY archivadas ya revisadas, verifica RLS con rol `authenticated`: SELECT por dueño, rechazo de SELECT/DELETE cruzado, DELETE permitido al dueño, ausencia de claim y JWT vacío DENY; termina en ROLLBACK y comprueba que no quedaron esquema ni tabla. No hay COMMIT ni filas de backup restauradas. Si el SQL archivado evoluciona, el script falla cerrado y requerirá nueva revisión. No forzar ignorando fallo.

### Ejecución en el Mac (solo después de pruebas CI verdes)
```bash
cd "$HOME/WETUDY/wetudy-dr"
git pull --ff-only
test -f scripts/pilot-founder-macos-archived-rls-replay.py && echo ARCHIVED_RLS_SCRIPT_OK
~/WETUDY/.venv/bin/python -m unittest scripts/test_pilot_founder_macos_archived_rls_replay.py -v
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-archived-rls-replay.py \
  --database-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy storage-NUEVO.zip" \
  --storage-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy postgres-NUEVO.zip" \
  --confirm-replay-local-synthetic-only
```

Los ZIP locales están **renombrados al revés** y los argumentos anteriores están verificados. Introducir **primero la contraseña del rol PostgreSQL** y **después la nueva contraseña del backup**, siempre en prompts ocultos. No pegar contraseñas ni SQL/TOC privados en chat/GitHub. NO ejecutar manualmente SQL del dump.

PASS esperado: `PASS_MAC_ARCHIVED_RLS_REPLAY`, `real_archived_rls_policies_executed: 2`, `synthetic_family_isolation: True`, `synthetic_both_owner_deletes: True`, `synthetic_missing_jwt_denied: True`, `rollback_verified: True`, `real_backup_rows_restored: False`, `production_modified: False`, `full_disaster_recovery_certified: False`.

En fallo `NO_GO_MAC_ARCHIVED_RLS_REPLAY: ValueError` no repetir ni cambiar los predicados para que pasen; inspeccionar el motivo con metodología de SQL privado sin exponer su contenido. Como objetivo principal hay preservar fail-closed.

## Estado NO-GO posterior
Un PASS demuestra aplicación real de **dos** políticas RLS archivadas sobre filas sintéticas en PostgreSQL 17, no replay completo de ACL, roles Supabase/GoTrue, datos Auth, Storage API, blobs, servicios externos ni tiempo RTO/RPO. #455, #447 y #245 siguen bloqueando salida. No merge main ni despliegue.