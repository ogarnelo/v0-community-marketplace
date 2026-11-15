# WETUDY — Comprobación local del catálogo PostgreSQL 17 en macOS Big Sur

**Fecha:** 15/11/2026. **Objetivo limitado:** comprobar TOC en ZIP real sin montar una base de datos. Estado integral DR #455: **NO-GO**.

## Contexto ya confirmado
- macOS Big Sur 11.4, MacBook Pro Intel 16 GB. Sin Docker ni actualización macOS.
- PostgreSQL **17.12** de Postgres.app instalado en `/Applications/Postgres.app/Contents/Versions/17/bin/pg_restore`.
- Python 3.14.6, venv `~/WETUDY/.venv` con cryptography 48.0.1.
- ZIP nuevos validados (dos miembros cifrados DB, uno Storage), contraseña nueva válida.
- **PASS_MAC_OFFLINE_DRILL real**: PostgreSQL PGDMP, Storage SHA256, ACL snapshot TRUE; producción no modificada.
- Los nombres de los ZIP locales quedaron **intercambiados**. Usar las rutas probadas y no corregirlas por apariencia.

## Actualizar la rama QA
```bash
cd ~/WETUDY/wetudy-dr
git pull --ff-only
test -f scripts/pilot-founder-macos-pg17-toc.py && echo "TOC SCRIPT OK"
/Applications/Postgres.app/Contents/Versions/17/bin/pg_restore --version
```

## Ejecutar lectura temporal de catálogo (no restauración)

```bash
cd ~/WETUDY/wetudy-dr
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-pg17-toc.py \
  --database-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy storage-NUEVO.zip" \
  --storage-zip "$HOME/Desktop/WETUDY/backups-nuevos/wetudy postgres-NUEVO.zip" \
  --confirm-local-toc
```

Se solicita la contraseña localmente con eco oculto. El script valida de nuevo ambos ZIP SHA256, descifra **solo** PostgreSQL a un directorio temporal privado, verifica `PGDMP`, ejecuta `pg_restore --list` local de PostgreSQL 17.12 y procesa solo agregados del TOC, nunca imprime los nombres particulares del TOC ni registros. El dump temporal se borra al salir. No hay conexión a base de datos ni a Supabase y no se cambian permisos, tablas, servicios o producción. No guardar salida completa de `pg_restore --list` en chats, GitHub ni ubicaciones sincronizadas.

## Interpretar
- `PASS_MAC_PG17_TOC`: catálogo legible. **No significa que la base pueda restaurarse.**
- `public_79_tables_complete`: 79 tablas de referencia public tienen definiciones y secciones DATA. `False` = revisar cobertura y cambios de esquema.
- `auth_users_data_present`, `auth_identities_data_present`, `storage_objects_data_present`: presencia de secciones TABLE DATA. `False` = aún no hay evidencia completa en ese dump.
- `auth_toc_pairs` y `storage_toc_pairs`: cuántos de los tipos de tablas gestionadas conocidos tienen tanto definición como DATA, NO cuántos registros se restauraron.
- `NO_GO_MAC_PG17_TOC`: error, no repetir contraseñas ni generar backups hasta revisión.
- `full_database_restored: False`, `auth_runtime_verified: False`, `production_modified: False`: **sin restauración**.

El TOC puede omitir de forma esperable esquemas administrados de Supabase (Auth y Storage). Si faltan, **no afirmar DR certificado** y planificar respaldo/restauración soportados. RTO, RPO, app y GoTrue siguen pendientes.

## Después
Solo una vez cotejado TOC: diseñar restauración en base **local aislada** (sin exponer puertos ni usar credenciales productivas) y prueba de permisos RLS real. No ejecutar `pg_restore --dbname` sobre Supabase ni instalar/desplegar migraciones sin autorización expresa.
