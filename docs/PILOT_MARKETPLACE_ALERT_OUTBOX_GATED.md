# WETUDY — Cola persistente de avisos (piloto, no activada)

Actualizado: 10-11-2026. Estado previsto tras la PR: **captura transaccional activa, procesamiento programado desactivado**.

## Problema que evita

El formulario publica primero el anuncio y luego envía una petición de notificaciones. Si el navegador se cierra, cae la conexión o se agota una función antes de que la petición se complete, antes no quedaba un registro específico para reconciliarla.

La nueva tabla `marketplace_alert_outbox` guarda **solo un UUID de anuncio y metadatos técnicos de reintento** en la misma transacción que cada `INSERT listings` de un anuncio disponible no DEMO. No guarda direcciones, contenido de chats, emails, códigos postales ni perfiles. Es una fila pequeña por anuncio. Los seis DEMO anteriores no se tocan y los próximos anuncios marcados `is_demo=true` no entran en la cola.

La tabla tiene RLS activado y no concede permisos a `anon` o `authenticated`. El trigger usa una función `SECURITY DEFINER` alojada en un esquema interno privado, con `search_path` vacío y cuerpo estático. Dos RPC `SECURITY INVOKER` de uso exclusivo `service_role` permiten reclamar trabajos y confirmar su resultado.

## Cómo se protege contra fallos y duplicados

- Cada anuncio tiene `listing_id` como clave primaria en la cola: no se crea una segunda entrada al repetir el registro.
- La reclamación utiliza `FOR UPDATE SKIP LOCKED` para que dos procesos no reclamen simultáneamente el mismo intento.
- El trabajador obtiene un UUID de alquiler (`lease_token`); un proceso antiguo no puede marcar como completado un trabajo reclamado de nuevo.
- Si el intento falla, se aplica espera creciente de 2, 5 o 15 minutos, con **máximo cuatro intentos**. Se guarda solo un código de fallo sanitizado de hasta 64 caracteres.
- Los trabajos caducan a las **48 horas**: nunca deberían producir un aviso tardío cuando el piloto esté sin procesador durante días.
- Antes de notificar, el trabajador comprueba que el anuncio existe, está disponible, no es DEMO y que tiene al menos una foto.
- El matcher actual conserva la autorización del vendedor, el `UNIQUE(saved_search_id,listing_id)`, las notificaciones idempotentes y la clave de idempotencia del proveedor de email.
- La garantía no es todavía de entrega exactamente una vez: un proceso puede interrumpirse después de contactar a Resend y antes de confirmar el envío. Se mitigará con idempotencia del proveedor, pero requiere prueba E2E y telemetría real.

## Controles de activación deliberadamente pendientes

**NO está registrado en `vercel.json` ningún cron de avisos.** La ruta `GET /api/cron/marketplace-alert-outbox` exige `CRON_SECRET` y la variable de servidor `WETUDY_ALERT_OUTBOX_ENABLED=true`. Si la bandera no existe o no es `true`, devuelve 204 sin leer ni procesar datos.

Para activar más adelante, solo cuando lo autorice el piloto:

1. Validar una publicación con cuentas QA autorizadas, una búsqueda coincidente y otra fuera de colegio/radio, y comprobar exactamente a quién se envía una notificación y un email.
2. Verificar permisos del outbox, la migración de producción y los controles Postgres de los SQL de fixture ejecutados en CI. Comprobar que no se registran direcciones personales en fallos.
3. Medir en Vercel y Supabase la duración por anuncio, consultas necesarias y coste por volumen. El trabajador procesa deliberadamente **un solo anuncio por invocación**, no miles en un proceso sin límite.
4. Activar la variable **solo en el entorno autorizado** y añadir entonces la programación adecuada de Vercel, según el plan contratado y el volumen real. No se añade ningún cron nuevo durante esta PR.
5. Revisar estados `pending`, `processing`, `completed` y `failed`, caducidad, reintentos y coste por cada día del piloto.

Consulta de observación segura de la cola:

```sql
select state, count(*) as anuncios,
  count(*) filter(where expires_at <= now()) as caducados,
  max(attempts) as max_intentos
from public.marketplace_alert_outbox
group by state;
```

## Reanudación por destinatarios: preparada, pero todavía desactivada

El recuperador ahora atiende **hasta 12 notificaciones y 12 emails por
invocación**. Cuando quedan destinatarios pendientes, la ruta de coincidencias
responde `complete:false`; una RPC exclusiva del servicio libera el lease con
un token de protección y programa otra ejecución a partir de 15 segundos
después. El progreso se conserva con los campos ya existentes
`notified_at` y `emailed_at`, además del nuevo `email_skipped_at`.

Una dirección **suprimida** o una cuenta **sin correo** se registra como salto
terminal (`email_skip_reason=suppressed` o `recipient_missing`), **no como
un correo enviado**. Una respuesta de proveedor incompleta o un fallo de
Resend queda como error reintentable; la API devuelve 503 y el procesador no
marca la tarea como finalizada. Las notificaciones y emails mantienen claves
idempotentes, evitando repetir los avisos que sí se procesaron correctamente.

La reanudación de un lote exitoso **no consume** los cuatro intentos
reservados a fallos, pero cada trabajo conserva su fecha absoluta de caducidad
a las 48 horas. La RPC de reanudación no acepta tokens vencidos ni trabajos
finalizados. El flujo normal iniciado por el vendedor conserva su alcance
anterior; solo la recuperación firmada usa lotes acotados.

**Optimización de lectura de pendientes (PR #368):** el recuperador conserva
su límite de 12 notificaciones y 12 correos por invocación, pero cada fase
consulta **solo 13 resultados pendientes como máximo**: procesa 12 y
utiliza el 13.º como centinela para saber si queda trabajo. Si los primeros
grupos no tienen destinatarios pendientes, recorre los siguientes grupos de
hasta 150 IDs sin truncar la audiencia. El procesamiento del vendedor
mantiene la cobertura completa. Esto reduce lecturas repetidas de pendientes,
especialmente cuando hay muchos avisos por anuncio, pero **no** reduce a
12 la totalidad de familias que podrán recibir avisos: las demás se atienden
en continuaciones posteriores una vez activado el worker y tras superar QA.

**Limitación explícita:** en cada invocación todavía se vuelve a consultar
toda la lista de búsquedas guardadas para determinar las coincidencias del
anuncio. Antes de un volumen elevado deben persistirse por separado los
cursosres de exploración y optimizar las consultas repetidas. No interpretar
este cambio como garantía de entrega a miles de destinatarios dentro de un
SLA. Sigue pendiente la E2E real controlada con las cuentas QA del piloto.

## Descubrimiento reanudable por búsqueda (checkpoint de 200, NO activado)

La recuperación autorizada trabaja ahora en **dos fases** sin reutilizar las
búsquedas completas en cada continuación:

1. **Descubrimiento**: reclama el anuncio, comprueba foto y estado, y examina
   un máximo de **200 búsquedas guardadas activas por invocación**, ordenadas
   por ID. Incluye únicamente búsquedas creadas hasta la publicación del
   anuncio, para evitar alertas retroactivas por necesidades nuevas. Aplica
   los filtros existentes de contenido, ISBN, centro y código postal. Inserta
   las coincidencias con `onConflict` idempotente. **Solo después** avanza
   el cursor mediante `marketplace_alert_advance_discovery_v1`, que exige
   lease válido y coincide exactamente con el cursor anterior. Una
   interrupción entre inserción y cursor se recupera repitiendo la página,
   sin duplicar coincidencias.
2. **Entrega**: cuando el último lote, incluso vacío, queda marcado como
   `discovery_completed_at`, las siguientes ejecuciones **no vuelven a leer
   `saved_searches` para descubrir coincidencias**: leen directamente
   `saved_search_matches` para ese anuncio, de 13 en 13 por canal, y
   entregan como máximo 12 avisos por canal y ejecución. Los marcadores
   `notified_at`, `emailed_at` y `email_skipped_at` evitan repetir lo
   completado. La publicación normal iniciada por el vendedor conserva su
   comportamiento independiente.

Las dos etapas solo están disponibles con `CRON_SECRET`, la bandera
`WETUDY_ALERT_OUTBOX_ENABLED=true`, un identificador de lease UUID vigente
y la etapa correcta del estado almacenado. Los RPC son invocadores con
`service_role` exclusivo; el trigger de captura y los seis DEMO no cambian.
No hay cron nuevo. El nuevo cursor no contiene datos de personas, CP ni emails.

**Protección de preferencias posteriores al anuncio:** la migración
`saved_search_preference_stamp_v1` asigna `updated_at=now()` a cualquier
cambio de consentimiento, filtro, colegio o radio de una búsqueda guardada.
El descubrimiento solo incluye las creadas y no modificadas después de la
publicación; la entrega usa la relación con la búsqueda viva y exige
`notifications_enabled=true` y `updated_at <= listings.created_at` antes
de enviar **tanto notificaciones como emails**. La eliminación de una
búsqueda elimina los matches mediante la FK `ON DELETE CASCADE`.
Por tanto, apagar y reactivar la búsqueda posteriormente no debe rescatar
avisos de anuncios anteriores. Esto no toca búsquedas existentes ni cambia
el comportamiento del envío inmediato iniciado por el vendedor.

**Pendiente antes de activar:** E2E autorizada de cambios/pausas o eliminación
de búsquedas guardadas mientras hay una entrega pendiente, para evitar enviar
avisos obsoletos si una familia modifica su preferencia. También habrá que
comprobar con carga real el número máximo de páginas por ventana de 48 horas.
Hasta superar estas validaciones, el recuperador debe seguir **desactivado**.

## Observabilidad de cola sin activar envíos

La función `public.marketplace_alert_outbox_health_v1()` devuelve exclusivamente
**recuentos operativos** (`total`, `pending`, `processing`, `completed`,
`failed`, `due`, `overdue_leases`, `expired_unfinished`,
`oldest_unfinished_minutes`, `max_attempts`). No devuelve identificadores de
anuncio, correos ni códigos postales. Solo `service_role` puede ejecutarla.

Se consulta una sola vez dentro del **cron de salud del email ya existente**
(`/api/cron/email-health`, autorizado mediante `CRON_SECRET`), sin cron nuevo.
Si falla la consulta de esta función, el cron de email normal continúa:
el campo `marketplaceAlertOutbox.available` queda `false`.
Cuando el worker sigue desactivado, los trabajos caducados no producen avisos
ni advertencias de logs adicionales; se muestran como contadores únicamente
en la respuesta interna autorizada. Si más adelante se activa el worker, las
incidencias `failed/overdueLeases/expiredUnfinished` generan una advertencia
con **solo números**, sin datos personales.

La función es `SECURITY INVOKER`, y el SQL de PostgreSQL 17 en CI verifica
que `anon` y `authenticated` no pueden ejecutarla. Las métricas requieren
escaneo/agrupación de la tabla en un solo query diario. En un crecimiento
significativo se revisará su tiempo de consulta antes de ampliar frecuencia.

## Validación del radio en el momento de entrega

Una necesidad guardada con radio sigue dependiendo del código postal **actual**
del destinatario, aunque su búsqueda no cambie. Por ejemplo: si se encontró
un anuncio cercano a Madrid pero la familia cambia su perfil a Barcelona
antes de procesar el correo, enviar ese aviso sería incorrecto.

Para el worker (que permanece apagado hasta QA), **cada lote de hasta 12**
notificaciones y correos comprueba nuevamente las distancias aproximadas
mediante los centroides postales ya existentes y la zona postal actual del
destinatario. No realiza una nueva búsqueda global ni añade geocodificación.
Los avisos fuera de radio o con ubicación desconocida quedan marcados en
`saved_search_matches.invalidated_at` con razón técnica fija
`radius_changed`, sin almacenar el CP ni datos de la familia. El marcador
es terminal para **ambos canales**: una fila invalidada ya no entra en
las consultas pendientes de notificaciones ni de correo.

La revisión de `saved_searches.notifications_enabled` y `updated_at`
sigue protegiendo a quienes pausaron o editaron una búsqueda desde la
publicación del anuncio. El marcado de invalidación es adicional a ese
control y solo modifica coincidencias que todavía no se han comunicado.

**Limitación y QA pendiente:** una familia podría modificar su CP durante
los milisegundos entre la validación y la llamada al proveedor de correo.
Este control reduce los avisos obsoletos, pero no promete una transacción
atómica sobre el perfil y Resend. También deben validarse cambios de vínculos
de colegio del directorio antes de activar el recuperador. No se envían
emails reales ni se activa el worker mediante esta modificación.

## Revalidación de vínculos escolares en entrega diferida (PR #372)

El directorio nacional puede asociar un centro a una comunidad operacional
de Wetudy o cambiar ese vínculo después de que se descubra un anuncio.
Antes de **cada lote de 12 notificaciones y 12 emails** del recuperador se
comprueba nuevamente la pertenencia escolar de las coincidencias marcadas
`only_my_community`. Se reutilizan exactamente las reglas de
`savedSearchMatchesListing`: el código oficial del directorio es prioritario,
los IDs escolares operacionales solo se comparan directamente cuando no hay
un código oficial, y los vínculos entre ambos se consultan a
`school_directory.linked_school_id` en ese instante.

No se consulta el directorio para una búsqueda global sin escuela, ni se
vuelve a recorrer todo el catálogo de búsquedas: solo se solicitan los
códigos oficiales presentes en la página actual de destinatarios. Cuando
ha desaparecido o cambiado un vínculo necesario, la coincidencia se
invalida terminalmente mediante `invalidated_at` y el código técnico
`school_link_changed`, sin guardar el colegio, CP o usuario en el motivo.
Queda fuera de los pendientes de **notificación interna y email**.

La validación escolar se efectúa **antes de la comprobación del radio**, para
no cargar perfiles postales de coincidencias escolares descartadas. Continúan
vigentes los controles de consentimiento y revisión de búsquedas guardadas,
la exclusión de DEMO y la reanudación por cursores de 200 y envíos de 12.

**Límite:** como el colegio, el perfil y la entrega externa no comparten una
transacción atómica, un cambio simultáneo tras la consulta no puede eliminar
por completo la carrera. Además, un aviso enviado anteriormente no puede
retraerse. La comprobación end-to-end con dos cuentas QA autorizadas sigue
siendo obligatoria antes de activar el procesador. No se habilita el cron
ni la variable `WETUDY_ALERT_OUTBOX_ENABLED`.

## Costes y límites

No se añade proveedor, extensión ni servicio de pago. El coste marginal antes de activar el worker es una inserción indexada por publicación y un pequeño volumen de almacenamiento en Supabase. El workflow de prueba usa PostgreSQL 17 en el runner de GitHub Actions, **no la base de datos real**. Los minutos de CI sí forman parte del consumo de GitHub.

El modelo por anuncio es válido para un piloto pequeño, pero **el matching todavía procesa todos los destinatarios de un anuncio dentro de una petición síncrona**. A gran escala requerirá paginar también el estado de procesamiento de cada destinatario y recuperar parcialmente el progreso, además de conocer los límites y costes de cron del plan Vercel. No activar este worker asumiendo que ya resuelve esa escalabilidad.

## Invariantes de producción

No activar centros, no crear familias/cuentas reales de prueba, conservar los seis anuncios DEMO y la estética actual. Mantener `WETUDY_ALERT_OUTBOX_ENABLED` desactivada y sin cron registrado hasta QA autorizada.
