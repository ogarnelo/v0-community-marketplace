# PR592 — Revisión cerrada de preflight y candidata SQL del P0 #591

Fecha: 16/11/2026. NO se aplicó DDL ni DML en Supabase. Esta PR crea exclusivamente dos archivos fuera de `supabase/migrations` y ocho controles estáticos de seguridad.

## Evidencia contrastada con producción (SELECT-only)

- `pg_policies`: `Users can create donation requests`, INSERT TO public, `WITH CHECK ((SELECT auth.uid())=requester_id)`. No comprueba contexto escolar, tipo de anuncio ni estado aprobado.
- Tabla `donation_requests`: campos `listing_id`, `requester_id`, `school_id`, `assigned_to_requester_id`, `approved_by_admin_id` anulables; `status` text default `pending`.
- Tabla `listings`: `listing_type` text NOT NULL, `status` y `school_id` anulables. `listing_type` es el atributo prioritario para el negocio, con `type` como fallback en código antiguo.
- FK `donation_requests.school_id` permite NULL; los anuncios sin colegio, previstos por el negocio, deben seguir funcionando.
- No existe UNIQUE sobre `listing_id WHERE status='approved'` (distinto del índice PR570, que queda bloqueado por separado).
- Contadores de SELECT de producción: 0 solicitudes; por tanto cero discordancias y duplicados de aprobados. Ningún usuario ni anuncio real usado en pruebas.

## Archivos

- `scripts/p0_donation_rls_preflight_read_only.sql`: solo SELECT en transacción READ ONLY para capturar propietarios, permisos, políticas, índice/constraints, anomalías agregadas sin exponer datos personales.
- `scripts/p0_donation_rls_remediation_review_only.sql`: **CANDIDATO NO AUTORIZADO** fuera de migrations. Preflight que aborta por deriva, índice UNIQUE parcial, ALTER POLICY conservando datos/mínimos privilegios, postflight. La creación del índice puede bloquear escrituras; valorar concurrencia con operadores.
- `__tests__/launch/pilot-donation-rls-review-contract.test.mjs`: ocho contratos que impiden proponer SQL fuera del alcance y verifican que preflight se mantenga read-only.

## Dependencias antes de ejecutar en producción

1. Confirmar RLS de `listings` permitiendo SELECT del anuncio `available` a un autenticado. Comprobar que la expresión `EXISTS` evalúa con el invocador y no requiere SECURITY DEFINER.
2. Ensayar política e índice en PostgreSQL aislado con dos usuarios/colegios, anuncios reales simulados y carreras entre dos solicitudes distintas.
3. Validar caso de colegio NULL, estado reasignado y reglas de adquisición/aceptación de AMPA. Comprobar inexistencia de datos inconsistentes.
4. Solicitar **autorización SQL específica** para política e índice, separada de PR533/534; preparar rollback y postflight basados en la política original.
5. No usar esta PR como prueba de E2E real, DR conjunto o aceptación AMPA. No se puede abrir el piloto con este cambio pendiente.

No autoriza tocar PR570, permisos default de supabase_admin ni los respaldos. PILOTO NO-GO.
