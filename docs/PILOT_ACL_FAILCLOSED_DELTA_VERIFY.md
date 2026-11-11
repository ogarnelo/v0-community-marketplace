# WETUDY — Validación obligatoria de cambios ACL por fase (sin tocar producción)

**11 de noviembre de 2026 · Incidencia P0 #375.**

Se ha añadido `scripts/pilot-acl-delta-verify.mjs` para comparar dos fotografías de las concesiones SQL: una tomada **antes** y otra **después** de la migración de permisos. Se ha ejecutado también la consulta de generación de fotografías `scripts/pilot-acl-json-snapshot-readonly.sql` contra Supabase (solo lectura), confirmando que entrega correctamente metadatos JSON de las 11 tablas, dos roles y ocho permisos, **176 filas**. No contiene datos de familias.

### Procedimiento (para una futura ventana autorizada)

1. Antes de migrar, generar y guardar una fotografía privada (NO subirla a Git ni incluirla en artefactos públicos): `psql -X -A -t -v ON_ERROR_STOP=1 -f scripts/pilot-acl-json-snapshot-readonly.sql`. La salida contiene una línea de JSON entre las marcas de transacción de psql; guardar únicamente la línea que empieza por `[` en el fichero `before.json`. No usar el servicio de producción como sistema de archivos para este propósito.
2. Confirmar frescura de respaldo cifrado, evidencia de restauración con el alcance exigido y procedimiento de rollback. La disponibilidad de un archivo de backup o un TOC completo no certifican recuperación integral.
3. En la primera fase, aplicar solamente la migración de PR #405 (tres tablas). Generar `after-three.json` y verificar `node scripts/pilot-acl-delta-verify.mjs before.json after-three.json three`.
4. Si se aprueba la segunda fase, capturar de nuevo una fotografía antes de aplicarla y confirmar que corresponde a esa misma instalación; comparar con la fotografía **original anterior a ambas fases** para `eleven`: `node scripts/pilot-acl-delta-verify.mjs before.json after-eleven.json eleven`.
5. Bloquear activación o cambios adicionales ante cualquier `BLOCKED`, dato faltante o cambio a privilegios DML, roles, concedentes o `GRANT OPTION`. La comparación solo da PASS si los 11 × 2 × 8 registros están presentes y los 4 permisos no-RLS quedan inactivos en cada tabla objetivo, sin alterar el resto.

### Limitaciones

- El script **nunca ejecuta SQL**, nunca se conecta a Supabase y no aplica migraciones ni reconstruye permisos.
- La salida JSON de ACL no incluye datos personales, pero aun así es información de seguridad operativa y debe conservarse fuera de repositorios públicos.
- Los permisos efectivos pueden heredarse; por eso no es suficiente con que desaparezca un grant directo.
- La comparación comprueba cambios de grants, no prueba por sí sola que las rutas API, RLS y Auth siguen funcionando, ni certifica recuperación de Storage/GoTrue.
- El libro del piloto conserva el bloqueo de 93 migraciones ya aplicadas y **7 pendientes** en GitHub (cinco alertas y dos de permisos). Las banderas siguen apagadas.

La fotografía de antes debe ser reproducible, asociada al commit exacto, al proyecto Supabase correcto y a la ventana autorizada. No inferir rollback de valores no registrados.
