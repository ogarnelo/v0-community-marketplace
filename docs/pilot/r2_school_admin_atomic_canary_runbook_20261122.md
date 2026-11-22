# R2 — Activación controlada de la concesión atómica de administrador escolar

**Estado (22-11-2026):** migración SQL `20261122132030_r2_school_admin_atomic_grant_pr798` instalada y verificada; implementación de la PR #797 desplegada; interruptor global **OFF**. No activar el piloto general ni utilizar datos reales para pruebas.

## Doble puerta de activación

Para utilizar la RPC atómica son necesarias **las dos condiciones** en el servidor:

1. `WETUDY_R2_SCHOOL_ADMIN_ATOMIC_GRANT_ENABLED=true`.
2. `WETUDY_R2_SCHOOL_ADMIN_ATOMIC_GRANT_CANARY_USER_IDS` debe contener explícitamente el UUID Auth exacto del usuario de pruebas (lista de UUIDs separada por comas).

Sin ambas condiciones, el flujo anterior sigue funcionando. Nunca usar valores comodín, ni añadir identificadores de usuarios reales sin consentimiento y plan de ensayo. La lista se compara en el servidor, no se transmite a navegador ni se registra en logs. La RPC restringe `EXECUTE` a `service_role`.

**Importante:** el interruptor global por sí solo no habilita ningún usuario. El modo canary no implica que un colegio ficticio esté exento de autorización ni que se deban crear permisos reales automáticamente.

## Comprobaciones antes de un ensayo

- Comprobar Vercel producción `READY` en el commit que incluye el doble gate.
- Verificar RPC presente, `SECURITY INVOKER`, `anon/authenticated` sin EXECUTE, `service_role` con EXECUTE.
- Verificar recuentos agregados de usuarios, perfiles, roles y colegios y que no existan mismatches.
- Acordar usuario y colegio de pruebas sintéticos y el procedimiento de limpieza. **No crear registros ni activar el interruptor sin autorización adicional explícita.**
- Verificar el mecanismo de invitación, envío de correo y permisos contra el usuario de pruebas; no enviar emails reales a terceros.
- Comprobar que el resto de usuarios siguen usando la ruta original, sin cambios en privilegios.

## Pruebas de aceptación y regreso

El ensayo positivo debe confirmar exactamente un `school_admin` vinculado al colegio, `profiles.school_id` correcto, idempotencia en segundo intento, rechazo del colegio inactivo y de un segundo colegio distinto, y ausencia de permisos cruzados. Ante fallo SQL, **no** continuar con escrituras legacy ni afirmar éxito. Registrar solo evidencias agregadas/no identificativas.

**Reversión del cambio de comportamiento:** retirar el UUID del canary o establecer el interruptor global en `false` y desplegar la configuración. Esto vuelve al flujo legacy, **no revierte permisos concedidos**. La eliminación de datos ficticios debe hacerse con un plan separado. No hacer rollback de la migración sin motivo de seguridad y aprobación independiente.

**Pendientes ajenos a este subbloque:** reconciliación PostgreSQL ↔ Supabase Auth (dos sistemas, sin transacción distribuida) y activación de la baja atómica de estudiantes. #787 requiere atestaciones externas. Piloto general **NO-GO**.
