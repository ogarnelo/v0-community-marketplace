# Piloto Wetudy — Auditoría de permisos y recuperabilidad (8 noviembre 2026)

## Alcance y límites
Revisión de código principal, PostgreSQL/RLS y metadatos de Storage de **Wetudy**, proyecto Supabase `jpsljmakoscqevssimtk`. No se modificó ninguna cuenta, comunidad AMPA, colegio nacional, dato de ensayo ni archivo durante la auditoría.

## Autorización de comunidades AMPA
- En producción, `user_roles` tiene RLS: el usuario puede leer sus propios roles; `is_superadmin()` puede leer y gestionar roles. Los usuarios sin rol superadmin no pueden otorgarse privilegios mediante la API.
- `school_access_codes` tiene RLS: lectura permitida a superadmin o al `school_admin` vinculado a ese mismo `school_id`. Aunque existe un código activo del único colegio de prueba, no se divulga por RLS a familias normales.
- Verificación de solo lectura con un JWT simulado de la cuenta compradora de prueba, `SET LOCAL ROLE authenticated` y `ROLLBACK`: roles `school_admin` visibles **0**, códigos visibles **0**; comunidad de ensayo activa visible en `schools` **1** (el directorio de 34.845 centros es independiente). No se creó ninguna comunidad real.
- Las rutas de superadministración comprobadas (`toggle-school-active`, `delete-school`) exigen rol `super_admin`. La generación de QR `share-qr` exige `school_admin` con `school_id`. El QR no confirma, por sí solo, que una familia tenga acceso: la autorización debe aplicarse al unirse al colegio.
- **Pendiente:** E2E funcional real con un rol AMPA autorizado para comprobar alcance por centro, alta con QR/código, revocación y moderación delegada. NO crear ni asignar roles sobre las cuentas reales para probarlo sin un entorno/usuario expresamente controlado.

## Privacidad de chats y notificaciones
En transacciones `BEGIN READ ONLY` con `SET LOCAL ROLE authenticated` y JWT sub simulado:
- Comprador y vendedor de la prueba ven 1 conversación y 4 mensajes.
- Comprador ve 0 notificaciones del vendedor; vendedor ve las 2 propias.
- Usuario externo simulado ve 0 conversaciones, 0 mensajes y 0 notificaciones del vendedor.
- Revisión de grants: `conversations` ya permite UPDATE autenticado solo en `updated_at`; `messages` solo en `read_at`. Las notificaciones permitían UPDATE autenticado de todos sus campos **aunque RLS impedía editar filas ajenas**.
- Migración propuesta `20261108190000_notifications_read_at_only.sql`: REVOKE UPDATE a `authenticated` y GRANT UPDATE exclusivamente sobre `read_at`. El frontend y los endpoints de acuse de lectura solo actualizan ese campo, conservando SELECT RLS y escritura de backend.
- **Validación post-migración obligatoria:** `has_column_privilege('authenticated', 'public.notifications','read_at','UPDATE') = true`; todas las demás columnas = false; prueba de lectura de notificaciones para comprador/vendedor; suite CI y estado de despliegue Vercel.

## Moderación de disputas
- La ruta de disputa ya rechaza acuerdos de anuncios DEMO antes de invocar el RPC, evitando tickets ficticios y cambios de estado reales.
- La función `server_dispute_agreement` produce escrituras reales (estado `disputed`, eventos, caso `reports.open`, mensaje). No ejecutar el ciclo de incidencias sobre el acuerdo de prueba en producción.
- **Pendiente importante:** prueba completa creación/revisión/resolución con entorno aislado y moderador de prueba; verificación de límites escuela/superadmin. No afirmar E2E aprobada por contar con tests estáticos.

## Recuperabilidad y costes de Storage
- Backup cifrado de PostgreSQL mediante `.github/workflows/wetudy-encrypted-db-backup.yml`: `pg_dump -Fc`, `pg_restore --list`, cifrado AES-256-CBC + PBKDF2, descifrado de comprobación y artefacto privado con retención de **7 días**.
- Última copia confirmada tras ensayo de compra: artefacto privado `13618275942` (~1,94 MB), de **08/11/2026 12:54 UTC**, caduca **15/11/2026**. **No se ha restaurado en una segunda base de datos.** No divulgar contraseña ni URL del servidor en documentación.
- Storage real `storage.objects`: bucket `listing-photos`, **33 archivos / 996.306 bytes (0,95 MiB)**; bucket `chat-attachments`, **2 archivos / 735.338 bytes (0,70 MiB)**. Total **35 archivos y 1.731.644 bytes (aprox. 1,65 MiB)**.
- **La copia PostgreSQL no incluye los binarios de Storage.** Un restablecimiento solo desde ese dump recuperaría registros de archivos pero no las imágenes y adjuntos correspondientes.
- Un respaldo íntegro deberá conservar **dump cifrado + copia cifrada de los binarios de ambos buckets + manifiesto de rutas, tamaño y hash**, y probar una restauración de ambas partes en almacenamiento de prueba. No se dispone de una instancia aislada de Supabase autorizada por el fundador; evitar crear proyectos con coste o escribir en la instancia original para restaurar.
- Para evitar pérdida de datos y costes, se recomienda habilitar copias cifradas de Storage con credencial de servicio gestionada como secreto de Actions **solo después de una revisión de permisos y prueba sin subir contenido en claro**. No se ha configurado ni ejecutado todavía.

## Estado de lanzamiento y conservación
- **Decisión explícita del fundador:** conservar los **6 anuncios DEMO** con evidencia asociada hasta abrir el piloto de las 3 AMPA. No borrar fotografías, acuerdos, mensajes, valoraciones ni cuentas. Las demos están excluidas de anuncios/ventas reales.
- Datos operativos observados: 11 cuentas confirmadas y 22 eventos de búsqueda (no equivalen a usuarios/actividad orgánicos); 0 anuncios comerciales reales, 0 acuerdos comerciales reales y 0 EUR de volumen real. Directorio 34.845 colegios sin activación SEO/AMPA.
- Riesgo pendiente Supabase Security Advisor: protección frente a contraseñas filtradas desactivada. Evaluar viabilidad en plan actual y activación antes de la entrada de familias reales. Las alertas `rls_enabled_no_policy` en directorio e informes privados corresponden a tablas intencionalmente cerradas; revisar antes de cambiar.
- **Próximas puertas GO/NO-GO:** comprobación permisos AMPA en entorno controlado, restauración de datos + Storage, privacidad/RGPD, resolución de moderación, protección Auth, pruebas de invitación QR/código y apoyo a las tres AMPA. Mantener issue #245 como seguimiento principal.

_Análisis de seguridad focalizado; no equivale a un pentest._
