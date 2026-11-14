# WETUDY · Recuperación local del fundador (Supabase Free)

**Actualizado:** 14-11-2026. **Entorno:** equipo privado del fundador, SIN conexiones de recuperación a producción. **Estado:** NO-GO hasta prueba completa de DB + Auth + Storage.

## Lo que ya sabemos
- Los **dos ZIP cifrados y las claves ya están en el equipo del fundador**. No volver a descargar, ni subir a chats, a GitHub o a servicios web.
- El fundador necesita ayuda para instalar/iniciar Docker y PostgreSQL.
- No hay una réplica Supabase Pro de ensayo. Esta prueba usa Docker Desktop/local y PostgreSQL 17 sin conexión de red.
- El inventario Storage observado el 14/11/2026 (solo lectura): 33 objetos/996306 bytes en `listing-photos`, 2/735338 en `chat-attachments`. No hay garantía de que los ZIP tengan la misma fecha.
- Los scripts existentes restauran parcialmente una tabla pública y verifican Storage; **no están certificados** Auth/GoTrue, APIs ni recuperación completa.

## Preparación sin secretos
1. Tener instalados Python 3.10+, Git, Docker Desktop (Windows/Mac) o Docker Engine (Linux). En Windows usar **WSL2/Ubuntu** con Docker Desktop integrado.
2. Abrir Terminal (Mac/Linux) o Ubuntu/WSL (Windows). Encender Docker Desktop.
3. Obtener **esta rama QA**, no `main`:
   ```bash
   git clone --single-branch --branch integration/pilot-anon-privacy-20261114 https://github.com/ogarnelo/v0-community-marketplace.git wetudy-dr
   cd wetudy-dr
   ```
   Si el repo privado solicita autorización, utilizar la autenticación normal de GitHub. No pegar tokens en chat.
4. Comprobar herramientas **sin acceder a ZIP ni claves**:
   ```bash
   python3 scripts/pilot-founder-local-drill.py --doctor
   ```
   Deben aparecer `python3: OK`, `openssl: OK`, `docker: OK`, `DOCKER_ENGINE: READY`. Si Docker no está listo, iniciar Docker Desktop; no continuar con el descifrado.

## Etapa 1: validar ambos ZIP sin introducir contraseña
Localizar el ZIP de PostgreSQL (contiene cifrado `wetudy.dump.enc`) y el ZIP de Storage (contiene `wetudy-storage.tar.gz.enc`). **No abrirlos ni moverlos a servicios de terceros**.

```bash
python3 scripts/pilot-founder-local-backup-preflight.py \
  --database-zip "/RUTA/PRIVADA/DB.zip" \
  --storage-zip "/RUTA/PRIVADA/STORAGE.zip"
```
En Windows/WSL, una ruta habitual es `/mnt/c/Users/TU_USUARIO/Downloads/...` (sustituirla por la ruta real). **No hace falta enviarnos esas rutas**.

La herramienta comprueba manifiestos SHA256, cabeceras del cifrado OpenSSL, miembros permitidos y ausencia de enlaces ZIP sospechosos. No requiere credenciales ni conecta a la red. Solo muestra recuentos, sin nombres de usuarios ni ficheros privados. `ACL_ENVELOPE_PRESENT: False` significa que ese backup no incluye la captura adicional ACL y **bloquea** afirmar recuperación de privilegios.

## Etapa 2: descifrar y verificar localmente (con aprobación del propio fundador)
**Ejecutar solo en un ordenador de confianza** y con espacio libre para el dump descifrado, el tar de Storage y Docker. Mantener la sesión privada; evitar copias de directorios temporales en carpetas sincronizadas con la nube.

```bash
python3 scripts/pilot-founder-local-drill.py \
  --database-zip "/RUTA/PRIVADA/DB.zip" \
  --storage-zip "/RUTA/PRIVADA/STORAGE.zip" \
  --confirm-decrypt-locally
```

La contraseña se introduce **únicamente en la terminal local**, sin argumentos ni registro en Git. El programa vuelve a verificar ambos SHA256, crea directorios temporales privados, descifra con OpenSSL, valida cada SHA256 del tar Storage y ejecuta **solo `pg_restore --list`** mediante PostgreSQL 17 en Docker con `--network none` y montaje de solo lectura. Elimina los archivos temporales al finalizar. No escribe ni restaura ningún dato en producción y no inicia una base local con usuarios reales en esta fase.

**Interpretación:** `PASS` solo valida descifrado, integridad local de Storage y legibilidad del catálogo PostgreSQL. `auth_users_data_toc` y `auth_identities_data_toc` indican si hay secciones de Auth en el TOC; no prueban que GoTrue funcione. Un valor `False` obliga a revisar estrategia DR (no crear otra copia automáticamente).

## Etapa 3: restauración integral y certificado (todavía pendiente)
- Preparar un contenedor PostgreSQL 17 aislado para restauración real de DB, RLS y ACL con backups, roles y extensiones requeridos; **sin montar producción y sin exponer puerto**.
- Validar de forma local el conteo y funcionalidad de Auth/GoTrue y políticas, secretos necesarios, sin exportar PII a CI ni a este chat.
- Restaurar objetos Storage en un servicio de prueba local compatible y verificar lecturas autenticadas reales, no solo hashes en disco.
- Documentar fecha de corte, coherencia entre respaldos, resultado, RPO/RTO, incidentes y procedimiento de limpieza.
- No aplicar cambios productivos de RLS/ACL hasta que existan pruebas suficientes y autorización **específica** del fundador.

## Qué puedes responder en el chat (datos no sensibles)
Compartir únicamente una línea como:
`DOCTOR: READY | PREFLIGHT: PASS | ACL: true/false | LOCAL DRILL: PASS/NO_GO | Auth TOC: true/false`.
**Nunca** compartir ZIP, contraseñas, JWT, dumps, correos de usuarios, nombres privados o rutas locales.

## Bloqueos
- **#455 DR:** NO-GO hasta restauración completa y operativa.
- **#447 privacidad:** SQL preparado en QA, pero pendiente autorización/plan de reversión.
- **#245 piloto:** no hay ninguna AMPA confirmada; captación y pruebas humanas pendientes.
- **#438 release:** PR principal sigue abierta, `main` sin cambios.
