# WETUDY — Diagnóstico privado del NO-GO RLS archivado (15/11/2026)

Fundador comprobó seis tests unitarios OK en Mac Intel Big Sur con PR #503, pero el ensayo real de ZIP cifrados acabó en NO_GO_MAC_ARCHIVED_RLS_REPLAY: ValueError. NO existe todavía PASS del replay de las dos políticas archivadas; producción intacta, recuperación #455 NO-GO.

La nueva etiqueta SAFE_FAILURE_CODE corresponde a códigos fijos sin imprimir excepciones de terceros, SQL del backup, passwords ni datos. Los códigos incluyen LOCAL_TARGET_GATE, POLICY_SQL_SHAPE, POLICY_PREDICATE_REVIEW, LOCAL_SQL_EXECUTION, RLS_ASSERTION y UNCLASSIFIED. El allowlist de dos políticas NO se amplía.

### Actualizar en Mac y comprobar
cd "$HOME/WETUDY/wetudy-dr"
git pull --ff-only
~/WETUDY/.venv/bin/python -m unittest scripts/test_pilot_founder_macos_archived_rls_replay.py -v
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-archived-rls-replay.py \
  --database-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy storage-NUEVO.zip" \
  --storage-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy postgres-NUEVO.zip" \
  --confirm-replay-local-synthetic-only

En Terminal introducir contraseña local del rol y después la del ZIP en prompts ocultos. Si vuelve a fallar, compartir SOLO NO_GO y SAFE_FAILURE_CODE; no compartir SQL, contraseñas ni dump.

LOCAL_TARGET_GATE: configuración, rol no-superusuario, nombre BD, localhost y base vacía. Revisar con SELECT únicamente.
POLICY_SQL_SHAPE / POLICY_PREDICATE_REVIEW: DDL archivado no coincide con allowlist. No relajar controles sin revisar SQL privado.
LOCAL_SQL_EXECUTION / RLS_ASSERTION: consulta o aislamiento sintético falló, revisar antes de reintentar.
UNCLASSIFIED: diagnóstico insuficiente, no imprimir excepción arbitraria.

Sin certificado DR: recuperación DB/Auth/Storage/API, ACL y RTO/RPO siguen pendientes.