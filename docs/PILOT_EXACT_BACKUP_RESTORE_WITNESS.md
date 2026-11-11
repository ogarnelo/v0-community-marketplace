# WETUDY — Vincular recuperación parcial al artefacto cifrado exacto

**11 de noviembre de 2026 · Incidencia P0 #375.**

## Problema corregido

El gate anterior comprobaba que existía una copia cifrada reciente y que algún workflow de restauración parcial había terminado después. No podía demostrar que ese ensayo hubiera restaurado **esa copia exacta**. Por ejemplo, si se hubiera generado otra copia entre ambos procesos, las fechas podían dar una impresión de correlación inexistente.

## Nueva evidencia de restauración

1. `scripts/pilot-db-restore-drill.sh` obtiene un artefacto cifrado concreto de GitHub y registra su identificador como output del paso local, **después** de completar su ensayo PostgreSQL de directorio.
2. Solo si también termina correctamente el ensayo de Storage, el workflow `pilot-combined-encrypted-recovery.yml` crea un **artefacto de testigo sin información privada** llamado `wetudy-partial-restore-proof-db-<backup_artifact_id>`. No contiene el backup ni sus contraseñas. Su procedencia se vincula automáticamente por GitHub al `workflow_run.id` que lo creó.
3. El workflow `pilot-alert-backup-readiness.yml` obtiene metadatos de testigos desde GitHub, sin descargarlos, y requiere que el nombre corresponda al ID del **backup cifrado que se está validando**, que el testigo sea posterior a la copia y que su ejecución origen sea el workflow oficial de recuperación en `main`, concluido con éxito.
4. Si falta testigo, los IDs no coinciden, la ejecución es ajena/fallida o la copia ha caducado, se devuelve `no_restore_witness_for_exact_backup` y se bloquea la señal de disponibilidad. Tras acabar el ensayo, un evento `workflow_run completed` vuelve a comprobar automáticamente los metadatos.

La lectura de metadatos no demuestra criptográficamente la integridad del repositorio o la ejecución, pero elimina el falso positivo originado por la simple ordenación temporal de copias y ensayos.

## Qué se sigue SIN certificar

El ensayo real se limita a restauración parcial del directorio escolar y comprobación de Storage ya existente. La presencia de entradas TOC de 79 tablas tampoco demuestra que todas las filas, RLS, Auth/GoTrue, objetos Storage y pagos se puedan reconstruir y usar conjuntamente. **No considerar el backup apto para migración integral por superar solo este gate.**

A fecha 11/11, la copia anterior (#13810495727, de 10/11) expira 17/11. Para obtener el nuevo testigo, el workflow debe ejecutar de nuevo ambos ensayos sobre una copia vigente; un resultado anterior a la PR no aporta ese testigo. El gate podría quedar inicialmente rojo hasta completarse ese ensayo de forma natural.

## Límites operativos

No se aplica DDL o DML a Supabase real, no se descargan copias fuera del runner existente, no se usan cuentas de familias para QA y no se habilitan workers, cron o Resend. Mantener #375 abierta y las siete migraciones sin aplicar.
