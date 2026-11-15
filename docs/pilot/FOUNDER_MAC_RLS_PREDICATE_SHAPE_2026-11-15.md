# WETUDY — Diagnóstico de la forma del predicado RLS archivado (15/11/2026)

Evidencia real: Mac del fundador, 9 pruebas unitarias OK, `SAFE_FAILURE_CODE: POLICY_PREDICATE_REVIEW` al comprobar las políticas de backup cifrado. Esto confirma que el destino local y la extracción han superado el gate, pero NO ha habido ejecución del DDL archivado. #455 continúa NO-GO.

## Diagnóstico sin modificar seguridad
El predicado de la política real no coincide exactamente con `user_id=auth.uid()` o `auth.uid()=user_id`. Esta PR solo clasifica en una de cuatro categorías de forma: `POLICY_PREDICATE_SHAPE_SELECT_UID_ALIAS`, `POLICY_PREDICATE_SHAPE_SELECT_UID_OTHER`, `POLICY_PREDICATE_SHAPE_UID_OTHER`, `POLICY_PREDICATE_SHAPE_NO_UID_REFERENCE`. Nunca se imprime el SQL real, nombres de columnas adicionales, datos de familias, dump ni credenciales. No se amplía la allowlist de ejecución; cualquier discrepancia sigue provocando NO_GO.

## Ejecutar en Mac (solo tras CI verde)
```bash
cd "$HOME/WETUDY/wetudy-dr"
git pull --ff-only
~/WETUDY/.venv/bin/python -m unittest scripts/test_pilot_founder_macos_archived_rls_replay.py -v
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-archived-rls-replay.py \
  --database-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy storage-NUEVO.zip" \
  --storage-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy postgres-NUEVO.zip" \
  --confirm-replay-local-synthetic-only
```

Compartir únicamente NO_GO y SAFE_FAILURE_CODE. Si aparece POLICY_PREDICATE_SHAPE_SELECT_UID_ALIAS, requerirá revisar si el formato `SELECT auth.uid() AS uid` es semánticamente equivalente **antes** de autorizarlo en una nueva PR y probar con datos ficticios. Ningún cambio en main ni producción; recuperación DB/Auth/Storage sigue NO-GO.