# WETUDY — Conservar evidencia ACL cifrada en las copias PostgreSQL

**11 de noviembre de 2026 · P0 #375 · Implementación en GitHub; no migración productiva.**

## Hallazgo y alcance

El backup cifrado de PostgreSQL de WETUDY ya existía, pero la orden `pg_dump --no-owner --no-acl` **excluye las sentencias GRANT/REVOKE**. No sirve por sí sola para reconstruir privilegios de las familias. Esto es especialmente relevante ahora que se han preparado las PR #405 y #408 para revocar permisos `TRUNCATE`, `REFERENCES`, `TRIGGER` y `MAINTAIN` en once tablas.

A partir de la siguiente ejecución del workflow `wetudy-encrypted-db-backup.yml`, se guarda junto al dump una **fotografía estrictamente de metadatos de permisos** para 11 tablas, dos roles y ocho privilegios (176 combinaciones). Se obtiene con `scripts/pilot-acl-json-snapshot-readonly.sql`, que usa una transacción `READ ONLY` y `pg_class` / `aclexplode` / `has_table_privilege`. No lee filas de usuarios ni mensajes.

El script `scripts/pilot-backup-acl-snapshot-validate.py` **falla si hay menos/más registros, un rol ajeno, duplicados o campos inesperados**. La fotografía JSON se cifra con el mismo secreto y parámetros de cifrado que el respaldo principal (AES-256-CBC/PBKDF2 200.000 iteraciones). Se comprueba un descifrado local y se calcula SHA256 de ambos archivos cifrados. La fotografía en claro y el dump en claro se eliminan antes de publicar el artefacto de GitHub.

## Recuperación y compatibilidad

El ensayo `scripts/pilot-db-restore-drill.sh` detecta si el artefacto contiene la fotografía cifrada. Si la tiene, comprueba checksum (mediante el manifiesto existente), la descifra **solo en el runner efímero**, valida que el JSON corresponde al alcance esperado y **no reproduce concesiones**. Las copias históricas creadas antes de la mejora siguen siendo recuperables para el subconjunto de directorio; se señalan como **LEGACY** y no se consideran fuentes suficientes para reconstruir grants.

La nueva fotografía de ACL es **evidencia de permisos**, no una restauración operativa de roles, esquemas, Auth, Storage, funciones, pagos o transacciones. Solo cubre 11 tablas, no las 79 del inventario. Tampoco reemplaza las capturas ACL tomadas inmediatamente antes y después de cada migración.

## Seguridad y límites

- No se añaden secretos ni servicios de pago: se reutiliza el secreto existente en GitHub Actions y el proyecto PostgreSQL.
- El nuevo archivo de ACL es **cifrado**; el artefacto solo debe contener `wetudy.dump.enc`, `wetudy-acl-snapshot.json.enc` y `SHA256SUMS.txt`. Nunca publicar los JSON sin cifrar, las credenciales o el resultado de consultas con grants en logs.
- Un checksum SHA256 empaquetado junto al archivo **no es una prueba de autenticidad independiente**; no debe presentarse como certificación criptográfica total.
- No descargar copias ni aplicar migraciones reales fuera de los ensayos aprobados. No activar los avisos ni abrir colegios. Los seis anuncios DEMO se conservan.
- Si una nueva copia no incluye el sobre ACL cifrado o el JSON no valida, el flujo de creación debe fallar; el ensayo del respaldo antiguo mantiene compatibilidad, pero debe indicar la limitación.

**Próximo requisito real:** ejecutar una nueva copia cifrada con el workflow modificado, recuperar el artefacto nuevo en runner aislado y confirmar que la evidencia ACL puede descifrarse. La última copia anterior conocida, artefacto #13810495727, **no tiene** esta nueva evidencia y expira el 17/11/2026. El ensayo de copia parcial no prueba restauración íntegra.
