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

## Costes y límites

No se añade proveedor, extensión ni servicio de pago. El coste marginal antes de activar el worker es una inserción indexada por publicación y un pequeño volumen de almacenamiento en Supabase. El workflow de prueba usa PostgreSQL 17 en el runner de GitHub Actions, **no la base de datos real**. Los minutos de CI sí forman parte del consumo de GitHub.

El modelo por anuncio es válido para un piloto pequeño, pero **el matching todavía procesa todos los destinatarios de un anuncio dentro de una petición síncrona**. A gran escala requerirá paginar también el estado de procesamiento de cada destinatario y recuperar parcialmente el progreso, además de conocer los límites y costes de cron del plan Vercel. No activar este worker asumiendo que ya resuelve esa escalabilidad.

## Invariantes de producción

No activar centros, no crear familias/cuentas reales de prueba, conservar los seis anuncios DEMO y la estética actual. Mantener `WETUDY_ALERT_OUTBOX_ENABLED` desactivada y sin cron registrado hasta QA autorizada.
