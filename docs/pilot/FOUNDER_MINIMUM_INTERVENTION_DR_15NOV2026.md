# WETUDY — Consolidar intervención del fundador y reducir repeticiones
15 noviembre 2026 | #455 | QA SOLO | producción sin cambios

### Resultado real
Fundador ejecutó 10/10 tests unitarios PASS; después el script devolvió `NO_GO_MAC_ARCHIVED_RLS_REPLAY: ValueError`, `SAFE_FAILURE_CODE: LOCAL_PREREQUISITES`. Antes llegó hasta `POLICY_PREDICATE_REVIEW` con los mismos ZIP, lo que demuestra que el sistema ya extraía las definiciones archivadas pero no las ha aplicado.

### Diagnóstico técnico
`LOCAL_PREREQUISITES` se originaba en un `if` que agrupaba tres situaciones: ausencia del binario `psql`, contraseña del ZIP vacía o contraseña de PostgreSQL vacía. Dado que Mac ya ejecutó psql, el binario es muy probablemente correcto; una entrada vacía accidental en un prompt oculto es una explicación posible, pero NO está confirmada.

### Cambio
El script ahora diferencia `LOCAL_PSQL_BINARY_MISSING`, `EMPTY_SECRET_LOCAL`, `EMPTY_SECRET_BACKUP` y admite un único reintento de contraseña vacía sin hacer volver a ejecutar todo el diagnóstico. No muestra ni envía contraseñas. No amplía allowlist de políticas ni modifica controles de localhost. Tests sintéticos se incorporan al workflow offline de GitHub.

### Próximo gate (una sola intervención, no otro ciclo por cada error)
Antes de ejecutar algo nuevo, ejecutar todo el suite sintético en CI cuando esté disponible y mantener backup íntegro. El fundador puede actualizar y ejecutar UNA vez el script; si devuelve POLICY_PREDICATE_SHAPE_* no volver a ejecutar sin revisión de semántica; clasificaciones son pistas, NO son autorización para restaurar. Nunca pegar SQL privado, contraseñas, datos reales, ni forzar permisos.

Comando solo cuando se haya confirmado QA:
```bash
cd "$HOME/WETUDY/wetudy-dr" && git pull --ff-only
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-archived-rls-replay.py \
  --database-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy storage-NUEVO.zip" \
  --storage-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy postgres-NUEVO.zip" \
  --confirm-replay-local-synthetic-only
```

### Criterios de cierre 26/11/2026
No aceptar GO por pasar tests unitarios ni por extraer TOC. Se necesita evidencia de recuperación real DB/Auth/Storage, políticas RLS efectivas y privacidad, RTO/RPO y tres pilotos AMPA. Sin ello NO-GO. Usar decisiones de alcance (piloto condicionado vs lanzamiento completo) en lugar de prometer entrega en fecha.

No modificar main ni desplegar sin aprobación explícita.