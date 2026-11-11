# WETUDY — Distinguir recuperación parcial y ACL realmente verificadas

11/11/2026 · P0 #375 · Sin aplicar SQL en producción.

## Cambio

Un backup anterior a la PR #412 se generó con `pg_dump --no-acl` y no guarda las concesiones SQL. El gate que prueba un backup cifrado exacto (#411) podía dar PASS a la **recuperación parcial**, pero no distinguía si ese mismo backup contenía una fotografía de ACL cifrada. Eso puede confundir una condición necesaria para futuras revocaciones de permisos.

Ahora, el workflow de recuperación:
- Sigue publicando `wetudy-partial-restore-proof-db-<id>` solamente después del ensayo PostgreSQL parcial y la comprobación Storage.
- Publica un **segundo** testigo, `wetudy-acl-verified-proof-db-<id>`, únicamente si se descifró y validó la fotografía de **176 privilegios de 11 tablas**, en el mismo run y sin publicar esos privilegios.
- El gate de metadatos `pilot-alert-encrypted-backup-freshness.py` devuelve `acl_snapshot_verified: true/false` por separado. Solo lo activa si ambos testigos pertenecen al **mismo backup y ejecución exitosa**. También devuelve siempre `full_disaster_recovery_certified: false`.

## Ejemplos de decisión

- Backup legado con recuperación parcial verificada: `ready=true`, `acl_snapshot_verified=false`. **No autoriza aplicar migraciones basadas en restauración de permisos**.
- Backup nuevo con testigos válidos: `ready=true`, `acl_snapshot_verified=true`, pero `full_disaster_recovery_certified=false`. **Sigue sin autorizar por sí solo** cambios en Auth, Storage o los 7 SQL pendientes.
- Si el testigo ACL procede de otro backup, otra rama o un run distinto, o aparece antes de completar el restore, **se ignora**.

Este control es un cambio en CI y metadatos, no un cambio en la base de datos. No crea usuarios, no envía correo ni activa escuelas.

La siguiente copia nueva todavía requiere la ejecución autorizada del workflow `Wetudy encrypted database backup`, que es manual; el actual backup legado vence el 17/11/2026 a las 22:40 UTC. Mantener P0 #375 abierta hasta recuperación integral y prueba funcional E2E.
