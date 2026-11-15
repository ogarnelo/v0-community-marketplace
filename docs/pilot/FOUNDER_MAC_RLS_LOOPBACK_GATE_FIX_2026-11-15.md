# WETUDY — Fix loopback gate sin aflojar seguridad (15/11/2026)

Evidencia fundador Mac: 8/8 tests unitarios PASS; replay RLS archivado de backup nuevo dio `NO_GO_MAC_ARCHIVED_RLS_REPLAY: ValueError` y `SAFE_FAILURE_CODE: LOCAL_TARGET_GATE_LOOPBACK`. **No se aplicó ninguna política archivada**, #455 sigue NO-GO.

## Hipótesis y corrección segura
El script comparaba `SELECT 'server_addr=' || inet_server_addr()` como cadena literal `server_addr=127.0.0.1`. La representación textual de `inet` puede diferir de una cadena esperada y no constituye la mejor comprobación de red.
Ahora exige que `host(inet_server_addr()) = '127.0.0.1'` **y también** `host(inet_client_addr()) = '127.0.0.1'`. PostgreSQL evalúa booleano; el gate requiere exactamente `loopback=true`. Continúa exigido `listen_addresses=localhost`, destino explícito 127.0.0.1:5432, database wetudy_dr_local_20261115, rol wetudy_dr_restore no-superuser, DB sin tablas, Auth NOLOGIN y SET ROLE. Nunca se acepta un host remoto. Si falla sigue NO_GO.

## Ejecución macOS tras fusionar PR CI verde
```bash
cd "$HOME/WETUDY/wetudy-dr"
git pull --ff-only
~/WETUDY/.venv/bin/python -m unittest scripts/test_pilot_founder_macos_archived_rls_replay.py -v
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-archived-rls-replay.py \
  --database-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy storage-NUEVO.zip" \
  --storage-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy postgres-NUEVO.zip" \
  --confirm-replay-local-synthetic-only
```

En Terminal, contraseñas del rol y backup en prompts ocultos. Si falla, compartir solamente NO_GO y SAFE_FAILURE_CODE. No compartir SQL de políticas ni PII. No restaurar datos del backup. Esta PR no certifica recuperación DB/Auth/Storage ni modifica main/producción.