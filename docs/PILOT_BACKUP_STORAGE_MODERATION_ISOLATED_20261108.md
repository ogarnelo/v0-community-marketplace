# Wetudy — Copia recuperable y moderación aislada (8 de noviembre de 2026)

## Decisiones y entorno
- Conservar los seis anuncios DEMO con sus fotografías, mensajes, acuerdo y reseña hasta el lanzamiento del piloto. **No realizar ninguna limpieza.**
- No abrir colegios nacionales ni activar comunidades AMPA.
- No crear un proyecto adicional de Supabase, ni activar consumo de pago sin autorización.
- El directorio nacional y las cuentas controladas continúan intactos.

## 1. Estado actual del respaldo
- GitHub Actions `.github/workflows/wetudy-encrypted-db-backup.yml` crea un dump PostgreSQL cifrado AES-256-CBC/PBKDF2 y comprueba que pueda descifrarse y listarse con `pg_restore --list`.
- Copia posterior al ensayo: artefacto **13618275942** (08/11/2026), caduca **15/11/2026**. Descargar desde la ejecución de GitHub Actions; descargar y conservar de forma segura también la contraseña de descifrado (nunca junto al archivo).
- **No hay una restauración integral acreditada**, y PostgreSQL **no contiene los binarios** de los objetos de Supabase Storage. La copia tampoco permite reconstruir por sí misma credenciales y configuraciones externas de servicios.
- En Storage, según inventario SQL: `listing-photos` 33 objetos (~0,95 MiB) y `chat-attachments` 2 objetos (~0,70 MiB), total **35 objetos / ~1,65 MiB**.

## 2. Copia cifrada de Storage: preparada, no ejecutada sin secreto
Nuevo workflow manual `.github/workflows/wetudy-encrypted-storage-backup.yml`:
- Solo lectura. Enumera de forma recursiva ambos buckets mediante Supabase Storage API (incluidos objetos privados). Descarga cada archivo con permisos de servidor, comprueba su tamaño conocido, crea manifiesto con ruta, tamaño y SHA-256, y vuelve a verificar los hashes contra el disco.
- Crea `wetudy-storage.tar.gz`, cifra con OpenSSL AES-256-CBC/PBKDF2 (200.000 iteraciones), descifra para comprobación, verifica integridad, **borra el contenido en claro** del runner y solo adjunta `.enc` y su SHA-256 como artefacto de Actions con 7 días de retención.
- No contiene credenciales ni rutas privadas en logs. Solo funciona para el proyecto Wetudy identificado. Límite de seguridad por ejecución: 10.000 archivos y 512 MiB; revisar límites antes de crecer.
- El trabajo NO se ejecuta de forma automática: es `workflow_dispatch`, para evitar tráfico o costes inesperados y porque le falta una credencial en GitHub.

**Intervención del propietario necesaria para realizar el primer respaldo de Storage:**
1. En GitHub, repositorio `ogarnelo/v0-community-marketplace`, **Settings → Secrets and variables → Actions → New repository secret**.
2. Crear el secreto `WETUDY_STORAGE_BACKUP_SERVICE_ROLE_KEY` con la **clave secret/service-role del proyecto Supabase Wetudy únicamente**. Obtenerla desde **Supabase → proyecto Education Marketplace → Project Settings → API Keys**. **No pegar la clave en el chat, issues, commits ni documentos.** No usar las credenciales de otros proyectos.
3. Comprobar que sigue configurado `WETUDY_BACKUP_ENCRYPTION_PASSWORD`, el secreto existente para cifrar el respaldo PostgreSQL (no revelar su valor).
4. Lanzar manualmente `Wetudy encrypted Storage backup` desde la pestaña **Actions**, en `main`.
5. Si la ejecución termina en verde, descargar **`wetudy-encrypted-storage-backup`** y **`wetudy-encrypted-postgres-backup`** a una ubicación personal segura, y comprobar que existe también la contraseña de descifrado.
6. Registrar IDs de ejecución, tamaños y cobertura. **No afirmar recuperación completa** hasta restaurar ambos conjuntos en un destino aislado, con controles de permisos y prueba de abrir una imagen y un adjunto.

La clave service-role **puede eludir RLS**. Solo se utiliza en un secreto de GitHub Actions, nunca en una variable `NEXT_PUBLIC_*`, en navegador o en el chat. Rotar inmediatamente si se divulga.

## 3. Prueba de moderación aislada — SQL real en PostgreSQL descartable
Nuevo workflow `.github/workflows/pilot-moderation-sandbox.yml`:
- Se ejecuta en PR con cambios relevantes y también manualmente.
- Crea contenedor efímero **PostgreSQL 17** en el runner de GitHub (sin URL, cuentas, mensajes ni claves de producción).
- Carga *la definición real* de `public.server_dispute_agreement` desde la migración versionada `20260918202500_harden_agreement_integrity.sql`, con tablas mínimas sintéticas.
- Prueba: denegación de persona ajena; denegación en acuerdo pendiente; comprador de acuerdo confirmado; vendedor de acuerdo confirmado; aparición de un `reports.open`, evento y mensaje de sistema; ausencia de duplicados al repetir una disputa.
- Comprueba SQL y escritura de la función, **no** la interfaz Web, ni permisos reales de moderadores, ni resolución de tickets, ni envío de emails reales.
- Restricción en shell: **solo acepta hosts localhost/127.0.0.1/::1**; nunca debe conectarse a Supabase producción.

**Resultado de ejecución:** registrar aquí el ID de GitHub Actions tras ejecutarla (no considerarla superada antes de prueba verde).

## 4. Puertas pendientes antes del lanzamiento
- Copia de Storage ejecutada, descargada y verificada con contraseña privada.
- Restauración aislada de PostgreSQL **y** Storage, con prueba de acceso a archivos.
- Ensayo E2E Web de rol AMPA: QR/invitación, permisos de un colegio frente a otro, revocación y alcance de informes.
- Moderación de extremo a extremo: solicitud y resolución auténtica en entorno de prueba sin datos de familias.
- Comprobación de privacidad y cumplimiento, seguridad de contraseñas y comunicaciones a las tres AMPA.
- Separar cuentas y eventos de pruebas de métricas de usuarios y búsqueda orgánicos.

## Evidencias
- Seguimiento principal: issue GitHub #245.
- PR #247–#254: contexto nacional, flujo E2E y controles de datos DEMO y RLS.
- Referencia oficial: https://supabase.com/docs/guides/platform/backups y https://supabase.com/docs/reference/javascript/file-buckets-download
- Esta guía no contiene claves, datos personales ni contenido de chats.


## 5. Ensayo verificable de recuperación parcial de PostgreSQL

Se incorpora el workflow `.github/workflows/pilot-encrypted-db-restore-drill.yml`, ejecutado automáticamente **una sola vez al incorporarlo a `main`** y disponible luego bajo `workflow_dispatch`:

1. Sin conectarse a la base de datos de producción, recupera de GitHub Actions el **último artefacto cifrado y no caducado** `wetudy-encrypted-postgres-backup` (el que ya crea el workflow DB).
2. Comprueba SHA-256, descifra con el secreto existente `WETUDY_BACKUP_ENCRYPTION_PASSWORD` y valida la estructura `pg_restore --list`.
3. Inicia PostgreSQL 17 desechable en `127.0.0.1`; únicamente restaura la tabla de **centros escolares nacionales**, sin datos personales, chats, contraseñas ni acuerdos.
4. Comprueba que hay más de 30.000 colegios, que el código oficial `04602365` existe, y que ningún centro del directorio está listado, indexado ni vinculado.
5. Borra todos los archivos descifrados al finalizar el proceso en el runner.

**Este procedimiento confirma solo una restauración parcial y la lectura del artefacto realmente cifrado.** No demuestra una restauración completa de Auth, RLS, datos transaccionales ni binarios Storage.

**Posible bloqueo técnico:** si los archivos se han caducado (retención 7 días), hay que ejecutar de nuevo el workflow `Wetudy encrypted database backup` antes de repetir este ensayo. **Estado del workflow y run-ID:** se documentan en el issue #245 tras la ejecución.

**Costes:** no requiere otra instancia de Supabase. Consume una breve ejecución de GitHub Actions y el contenedor PostgreSQL del runner, sin pagos adicionales contratados.


## 6. Comprobación conjunta de recuperación offline de ambas copias cifradas

**Decisión del fundador:** el 08/11 confirmó que ha descargado el respaldo cifrado de Storage. Los seis anuncios DEMO y todas las evidencias se conservan.

Nuevo workflow `Wetudy combined encrypted backup recovery check` (`.github/workflows/pilot-combined-encrypted-recovery.yml`):

1. Obtiene el último artefacto **PostgreSQL cifrado** no caducado del repositorio, verifica SHA256, descifra en runner GitHub aislado y restaura **únicamente `school_directory`** en PostgreSQL 17 local, con su validación habitual. No restaura cuentas, chats, acuerdos ni datos privados en el servidor de prueba.
2. Obtiene el último artefacto **Storage cifrado** no caducado del repositorio, verifica SHA256 del `.enc` y descifra en el mismo runner. Un validador Python recrea **cada objeto** en una carpeta temporal privada, y comprueba tamaño y SHA256 conforme al manifiesto, pertenencia a `listing-photos` o `chat-attachments`, ausencia de rutas peligrosas, enlaces simbólicos o archivos extra.
3. El runner borra datos descifrados al terminar y **no sube archivos restaurados ni manifiestos de rutas privadas** a GitHub. Solo imprime recuentos, bytes y estado.
4. No requiere ninguna credencial Supabase: solo el secreto de cifrado **existente** `WETUDY_BACKUP_ENCRYPTION_PASSWORD` y lectura de artefactos Actions con el token de GitHub. No se conecta a ningún entorno Supabase ni genera consumo de base de datos adicional.
5. Se activa una vez tras la incorporación del workflow a `main` y está disponible para repetición manual. Los artefactos vencen a los 7 días, así que una ejecución posterior puede requerir nuevos respaldos.

**Criterio de éxito:** GitHub Actions indica `Success` para ambos pasos de recuperación; los logs reflejan recuento de colegios restaurados, archivos de ambos buckets recuperados, hashes verificados y ninguna ruta inválida.

**Interpretación:** demuestra que los **dos respaldos cifrados se pueden recuperar localmente**. No constituye una restauración integral y funcional del servicio Wetudy ni de Auth/RLS, ni la recreación del API Supabase Storage en un proyecto de recuperación. Esos ensayos completos siguen pendientes de infraestructura aislada y presupuesto autorizado.

**Registro de ejecución:** registrar ID y resultado en el issue #245 cuando exista ejecución exitosa; hasta entonces **pendiente**, incluso si el código y Critical Contracts están verdes.
