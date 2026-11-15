# WETUDY — Diagnóstico granular LOCAL_TARGET_GATE — 15/11/2026

Fundador ejecutó 7 pruebas unitarias OK; prueba real del replay RLS dio NO_GO_MAC_ARCHIVED_RLS_REPLAY: ValueError y SAFE_FAILURE_CODE: LOCAL_TARGET_GATE. No se han aplicado políticas reales. No se modifica producción.

La causa concreta aún no está confirmada. El gate exige 10 condiciones exactas, incluidas DB, rol sin superuser, localhost, listen_addresses, rol authenticated NOLOGIN y permiso SET, 0 tablas, auth ausente y tabla objetivo ausente.

Este cambio mantiene íntegro el fail-closed y añade etiquetas específicas, sin devolver valores del servidor ni contenido de SQL/ZIP/password. LOCAL_TARGET_GATE_DATABASE, _ROLE, _NON_SUPERUSER, _LOOPBACK, _LOCAL_LISTEN, _ROLE_SET, _AUTH_NOLOGIN, _EMPTY_TABLES, _AUTH_ABSENT, _TARGET_ABSENT. Si ninguna coincide la causa sería de otra categoría.

## En el Mac
```bash
cd "$HOME/WETUDY/wetudy-dr"
git pull --ff-only
~/WETUDY/.venv/bin/python -m unittest scripts/test_pilot_founder_macos_archived_rls_replay.py -v
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-archived-rls-replay.py \
  --database-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy storage-NUEVO.zip" \
  --storage-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy postgres-NUEVO.zip" \
  --confirm-replay-local-synthetic-only
```

El segundo comando requiere contraseña del rol local y del backup en prompts ocultos. Sólo comunicar NO_GO y SAFE_FAILURE_CODE. No saltar controles; revisar condición fallida por lectura local segura antes de modificar configuración.

Punto de seguridad: SQL real del respaldo todavía no aplicado, Auth/Storage runtime y DR integral NO-GO, #455 sigue abierto.