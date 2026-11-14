# WETUDY — macOS Big Sur 11.4 / Intel: descifrado offline con Python

**Fecha:** 14/11/2026. **NO-GO de recuperación integral permanece.** Este procedimiento no realiza operaciones sobre Supabase, no necesita Docker/Pro, no actualiza macOS ni instala Postgres.

## Hechos verificados por el fundador
- MacBook Pro Intel `x86_64`, macOS 11.4, 16 GB.
- Python 3.14.6 / Git / LibreSSL 2.8.3 (no admite opciones visibles PBKDF2 de los scripts antiguos).
- `~/WETUDY/wetudy-dr` clonado desde QA.
- `~/WETUDY/.venv` contiene `cryptography==48.0.1`, import comprobado.
- ZIP guardados en `$HOME/Downloads/wetudy-encrypted-postgres-backup.zip` y `wetudy-encrypted-storage-backup.zip`.
- Preflight real confirmado `PASS_BACKUP_PREFLIGHT: DB verified 2 ... Storage verified 1`; `ACL_ENVELOPE_PRESENT: True`. No repetirlo ni descargar ZIP de nuevo.
- El siguiente ensayo necesita contraseña **solo en Terminal local**; jamás pegarla en chats o incidencias.

## Preparación de código QA actualizado

```bash
cd ~/WETUDY/wetudy-dr
git pull --ff-only
test -f scripts/pilot-founder-macos-offline-drill.py
~/WETUDY/.venv/bin/python -c "import cryptography; print(cryptography.__version__)"
```

**No escribir** la contraseña en comandos ni como argumento. Usar el intérprete explícito del entorno privado; no ejecutar `python3` del sistema para este ensayo.

## Descifrado, Storage y ACL en scratch privado

```bash
cd ~/WETUDY/wetudy-dr
~/WETUDY/.venv/bin/python scripts/pilot-founder-macos-offline-drill.py \
  --database-zip "$HOME/Downloads/wetudy-encrypted-postgres-backup.zip" \
  --storage-zip "$HOME/Downloads/wetudy-encrypted-storage-backup.zip" \
  --confirm-decrypt-locally
```

El programa pide `Local encryption password (not shared):` (entrada oculta). Repite SHA256 cifrado y no descifra si no coinciden. Descifra OpenSSL Salted__ AES-256-CBC PBKDF2-HMAC-SHA256 200000 iteraciones; comprueba cabecera `PGDMP`, valida **cada objeto Storage** usando verificador existente y valida el JSON de permisos ACL (176 entradas, 11 tablas y roles/grants) si está presente. Se elimina scratch al terminar, incluso tras error manejado. No imprime PII, rutas ni contraseñas.

**Resultado esperado:** `PASS_MAC_OFFLINE_DRILL`, `postgres_custom_dump_header: True`, `storage_object_hashes: True`, `acl_snapshot_validated: True`. En caso de `NO_GO_MAC_OFFLINE_DRILL`, parar y reportar solo clase de error (nunca ruta ni clave).

**Advertencia importante:** No se ejecuta `pg_restore --list` ni se restaura una DB. Cabecera PGDMP solo prueba que es un dump custom con encabezado reconocible; **NO valida el catálogo interno completo, datos Auth ni restaurabilidad**. Validación ACL no equivale a replay efectivo de permisos. Storage es validación offline de objetos, no APIs. Tampoco se acredita RTO/RPO.

## Siguientes puertas
1. Herramienta local compatible para `pg_restore --list`, sin actualizar macOS ni Docker.
2. Preparar postgres aislado para restauración real de tablas, Auth, RLS y ACL, con validación rigurosa y ninguna conexión productiva.
3. Validación Storage API y test de aplicación autorizados.
4. 3 actas AMPA (actualmente 0/3); privacidad productiva #447 sin autorización.
5. La salida de este script **no autoriza** GO ni modificar `main`.

No añadir archivos descifrados al repo ni a backups sincronizados. Conservar ZIP originales intactos.
