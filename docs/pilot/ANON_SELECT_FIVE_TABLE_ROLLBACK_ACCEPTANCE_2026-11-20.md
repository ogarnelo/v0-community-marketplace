# WETUDY — ensayo de reversión de las cinco tablas (solo entorno local)

**Fecha:** 20 de noviembre de 2026 · **Seguimiento:** [#767](https://github.com/ogarnelo/v0-community-marketplace/issues/767) · **PR:** [#787](https://github.com/ogarnelo/v0-community-marketplace/pull/787)

**Estado:** validación técnica en curso. **Aprobación independiente y propietario de producción: PENDIENTES.** Piloto **NO-GO**. Esta nota NO es una autorización de cambio ni contiene un script aplicable a un proyecto Supabase alojado.

## Qué revocación se está ensayando

Se prueba exclusivamente retirar `SELECT` del rol de base de datos `anon` sobre `public.agreements`, `public.demand_requests`, `public.profiles`, `public.saved_searches` y `public.schools`. No se modifican políticas RLS, privilegios de `authenticated` o `service_role`, vistas, publicaciones Realtime ni el esquema de producción. La propuesta de SQL ya existente está protegida por el nombre de base de datos ficticia `wetudy_pilot_anon_select_wave1`.

## ACL observadas en producción (consulta de catálogo SOLO LECTURA)

La inspección real de `pg_class.relacl`, `pg_attribute.attacl`, `pg_policies` y `pg_roles` el 20/11/2026 encontró lo siguiente. **No se ha ejecutado ninguna sentencia de escritura ni cambiado un permiso en el proyecto alojado.** Son permisos de tabla completos, no una autorización para que el invitado pueda operar con filas.

| Tabla | Permisos directos actuales de `anon` | RLS | Políticas para `anon` / `PUBLIC` | ACL por columna |
|---|---|---|---|---|
| `agreements` | `SELECT`, `MAINTAIN` | Activo | Ninguna | Ninguna |
| `demand_requests` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Activo | Ninguna | Ninguna |
| `profiles` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Activo | Ninguna | Ninguna |
| `saved_searches` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Activo | Ninguna | Ninguna |
| `schools` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Activo | Ninguna | Ninguna |

`anon` es rol NOLOGIN y sin BYPASSRLS. Las políticas RLS existentes no autorizan operaciones de fila anónimas mediante `anon`. **Sin embargo, RLS no gobierna todas las operaciones de mantenimiento**, por lo que el `MAINTAIN` de `agreements` exige una revisión de alcance y conectividad/roles separada del cambio de `SELECT`. Los permisos de escritura heredados tampoco deben confundirse con permisos efectivos para insertar/actualizar filas; el riesgo reaparece si alguien altera las políticas RLS o las membresías más adelante.

**Requisito de reversión:** al actuar únicamente sobre cinco `SELECT`, los otros privilegios `INSERT`, `UPDATE`, `DELETE`, `MAINTAIN` y los de `authenticated`/`service_role` deben permanecer **idénticos** antes, después y durante la restauración. Por ello el ensayo PG17/PostgREST utiliza ahora el mismo perfil de ACL observado y una huella de las ocho operaciones principales. También intenta un `POST` anónimo en cada fase para verificar que RLS lo rechaza con `42501` y no crea filas ficticias. **No se propone ni autoriza ampliar el alcance de esta PR a revocaciones DML/MAINTAIN reales**: cualquier remediación adicional necesita inventario y revisión independiente dentro del mismo bloque de privacidad.

## Prueba reproducible de tres fases

1. **Antes**: en una base PostgreSQL 17 desechable con datos artificiales se conservan cinco `GRANT SELECT` para `anon`, RLS activo y ninguna política de lectura anónima. Se captura una matriz de 15 combinaciones (cinco tablas por tres roles), para cada una `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER` y `MAINTAIN`, más el estado RLS. PostgREST debe contestar HTTP 200 con `[]` para invitados; compradores autenticados reciben exclusivamente su propia fila; la vista ficticia `security_invoker=true` devuelve `[]` al invitado. El script compensatorio debe **rechazar una ejecución prematura** sin cambiar la matriz.
2. **Después de retirar el permiso local**: exclusivamente en esa base se ejecuta `scripts/pilot-anon-select-wave1-local-only.sql`. La matriz solo puede variar en los cinco valores `anon SELECT`. Las cinco rutas REST anónimas y la vista invocadora pasan a error PostgreSQL `42501` (HTTP 401/403); las sesiones autenticadas siguen aisladas. Se verifica que RLS continúa activo.
3. **Restauración local**: `scripts/pilot-anon-select-rollback-local-only.sql`, que también exige nombre de base ficticia, permisos intermedios exactos, RLS y ausencia de políticas anónimas, concede únicamente los cinco `SELECT` de prueba. La matriz completa de privilegios y RLS debe ser idéntica a la original; la vista y las cinco rutas anónimas vuelven a **HTTP 200 y `[]`**, nunca a mostrar filas privadas. En paralelo, la prueba real Next.js + Chromium + Supabase CLI repite las tres fases manteniendo las mismas sesiones de comprador, vendedor y tercero, el invitado, la página `/account/saved-searches`, `/api/schools/public` y `/api/marketplace/feed`: las respuestas SSR públicas/privadas autorizadas deben ser idénticas antes, durante y después.

Los tests fallan si la revocación altera permisos de escritura, el acceso de `authenticated`/`service_role`, la propiedad de datos, los códigos de respuesta esperados, el aislamiento entre usuarios o el alcance exacto del rollback.

**Realtime:** en el servidor local `supabase/realtime:v2.148.3`, el comprador y el vendedor ficticios deben recibir una actualización WAL real en cada uno de los tres estados (`before`, `after`, `restored`); invitado y tercero no deben recibir datos de acuerdo en ninguna fase. Se requiere completar la migración tenant antes de suscribirse. Esto no sustituye pruebas de terceros.

**Límite:** son fixtures sintéticos mínimos, no un clon completo de la política RLS, los grants heredados, permisos por columna, hooks, versión exacta de PostgREST ni aplicaciones de clientes externos. `GRANT SELECT TO anon` no reproduce necesariamente todos los ACL originales en un proyecto con personalizaciones; por eso **no puede copiarse la compensación local como procedimiento de rollback productivo**.

## Atestación necesaria antes de CERRAR el bloque global

El responsable técnico de la base y un revisor de seguridad independiente deben validar por escrito —con enlaces a evidencia revisable, no con un simple checkbox— lo siguiente:

- Identificación de todos los consumidores externos, dormidos, móviles, automatizaciones, vistas y RPC. Confirmación específica sobre `public.demand_opportunities_30d`: su consulta anónima puede cambiar de 200/`[]` a error `42501`. Aceptación documentada por cada propietario.
- Inventario **real de catálogo antes del cambio**, de solo lectura, con `relacl` y ACL por columnas, grants por `PUBLIC`, herencia/membresías de roles, RLS y políticas, dependencias de vistas `security_invoker`, funciones `SECURITY DEFINER`, y pertenencia/identidad Realtime. Cualquier desviación respecto al entorno local exige diseño de rollback específico. **No almacenar secretos, tokens, identificadores personales ni exportar filas.**
- Decisión explícita de **quién ordenaría** la reversión, con qué señal verificable (p. ej., errores de acceso nuevos, ruptura en una integración atestada, ausencia de eventos autorizados o fallo de una ruta crítica), qué evidencia se recopila, quién observa las sesiones privadas y cómo se confirma el resultado sin abrir RLS.
- Ensayo aprobado con clientes externos representativos en un entorno no productivo con equivalencia técnica suficiente; comprobación de que la reversión no añade ni retira otros permisos y de que el comportamiento de la API se restaura. Estimar tiempo real de restauración en ese entorno y fijar una ventana/umbral aceptado por el propietario, sin extrapolar tiempos de CI.
- En un procedimiento aprobado futuro, la reversión se realizará desde el **snapshot real de grants autorizado**, nunca como `GRANT ALL` o restauración ciega. Requiere una segunda autorización diferenciada para aplicar SQL, plan de comunicación y una ventana controlada. Ningún test de esta PR constituye esa autorización.

**Estado de firma:** `database_owner_review_of_production_rollback = false` e `independent_security_review = false` en `ANON_FIVE_TABLE_CONSUMER_ATTESTATION_2026-11-20.json`. No marcar `REVIEW_READY` mientras falten responsables, aceptaciones, pruebas o independencia del revisor.

**Evidencia técnica:** script PostgreSQL/PostgREST `scripts/pilot-anon-select-postgrest-pg17.py`; script compensatorio protegido `scripts/pilot-anon-select-rollback-local-only.sql`; navegador `scripts/pilot-anon-select-next-browser-local-e2e.cjs`; controles estáticos asociados en `__tests__/launch/`. Los resultados CI deben citarse por commit exacto en #767 cuando estén concluidos.
