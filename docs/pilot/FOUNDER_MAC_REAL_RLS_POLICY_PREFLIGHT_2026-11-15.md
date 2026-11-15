# WETUDY — Preflight RLS real de backup macOS, sin aplicar SQL
15/11/2026. Issue #455 sigue NO-GO. Sólo QA.

Pruebas previas verificadas: PASS_MAC_OFFLINE_DRILL, PASS_MAC_PG17_TOC (79 public, 27 Auth, 10 Storage), Postgres.app 17.12 localhost con SCRAM y FileVault. Base local vacía wetudy_dr_local_20261115; login rol limitado, CREATE/ROLLBACK sintético confirmado.

## Descargar script QA
cd ~/WETUDY/wetudy-dr
git pull --ff-only
test -f scripts/pilot-founder-macos-real-rls-policy-preflight.py && echo REAL_POLICY_PREFLIGHT_OK

## Inspección no destructiva de dos políticas de backup
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-real-rls-policy-preflight.py \
  --database-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy storage-NUEVO.zip" \
  --storage-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy postgres-NUEVO.zip" \
  --confirm-local-policy-inspection

NOTA: ZIPs de PostgreSQL y Storage siguen renombrados al revés localmente: estas rutas se verificaron con preflight PASS. Introducir contraseña en prompt oculto, nunca compartir.

El script revalida ZIPs SHA256, descifra dump sólo a carpeta temporal privada chmod 0700, extrae TOC, selecciona exactamente las políticas archivadas saved_search_matches_select_own y saved_search_matches_delete_own, ejecuta pg_restore --schema-only --use-list --file local para renderizar SQL temporal. Sólo inspecciona dos CREATE POLICY y ausencia de DML de tabla, no imprime SQL y borra scratch. Nunca ejecuta SQL, no conecta DB, no toca producción. PASS_MAC_REAL_RLS_POLICY_PREFLIGHT solo significa DDL recuperable. Si falla, NO_GO_MAC_REAL_RLS_POLICY_PREFLIGHT y detenerse.

La siguiente fase (NO ejecutar todavía) es aplicar políticas revisadas en una transacción local reversible con roles y filas ficticias; ninguna restauración de datos reales. No equivaler a Auth runtime ni Storage API, ACL replay o RTO/RPO certificados.