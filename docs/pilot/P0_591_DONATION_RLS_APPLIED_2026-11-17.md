# WETUDY — P0 #591 aplicado en Supabase, 17/11/2026

## Autorización y alcance

El responsable autorizó explícitamente aplicar **la migración de donaciones #591** en el contexto de la continuidad PR618. Aplicación en proyecto Supabase **Education Marketplace**, id `jpsljmakoscqevssimtk`. Se usó la candidata del repositorio `scripts/p0_donation_rls_remediation_review_only.sql`, SHA de blob `436be47ee0395c7de8e1f9fd0324db87d6ca7392`. Se añadieron exclusivamente `SET LOCAL lock_timeout = '5s'` y `SET LOCAL statement_timeout = '30s'` al bloque transaccional.

El nombre de migración confirmado en el historial de Supabase es **`20261117102847_p0_591_donation_insert_rls_unique_20261117`**. Resultado `apply_migration: success=true`.

## Preflight real (SELECT-only)

- PostgreSQL 17.6.1.063, proyecto ACTIVE_HEALTHY, ejecutor `postgres`, propietario de ambas tablas y RLS ON.
- Política original INSERT exactamente `Users can create donation requests`, roles `{public}`, with_check `(( SELECT auth.uid() AS uid) = requester_id)`.
- Los usuarios autenticados podían INSERT; para `listings` existía política SELECT que expone estado `available`.
- 0 filas `donation_requests`, 0 aprobadas, 0 pendientes inconsistentes, 0 anuncios con aprobaciones duplicadas, 0 discordancias school_id, 0 solicitudes referidas a anuncios no-donation; había un anuncio disponible de tipo donation.
- El índice nuevo no existía; se contrastaron columnas `status`, `listing_type`, `school_id`, `requester_id`, `approved_by_admin_id`, `assigned_to_requester_id` y FK.

## Aplicación y postflight real

La candidata contiene `BEGIN`, validación de deriva y datos mediante `DO`, `CREATE UNIQUE INDEX`, `ALTER POLICY`, chequeo postflight y `COMMIT`. Éxito confirmado.

- Política INSERT existente ahora `TO authenticated` con nuevo `WITH CHECK` que exige `auth.uid() = requester_id`, `listing_id IS NOT NULL`, `status='pending'`, campos de aprobación nulos y `EXISTS listings` disponible de tipo donation, no vendido por el solicitante y con `school_id` coincidente (incluido NULL).
- Índice `donation_requests_one_approved_per_listing_idx` UNIQUE con `indisvalid=true`, `indisready=true`, índice parcial sobre `listing_id` cuando `status='approved' AND listing_id IS NOT NULL`.
- Política SELECT original y RLS intactas; los 8 grants por ambos roles `anon` y `authenticated` (SELECT, INSERT, UPDATE, DELETE) no han variado; la política INSERT nueva ya no incluye `anon` aunque conserve GRANT SQL.
- Conteos posteriores: 0 `donation_requests`, 0 `approved`, 0 duplicados.
- Los 16 privilegios predeterminados sobre *futuras* tablas de `supabase_admin` se han vuelto a observar, siguen pendientes y **no se han tocado**. No confundirlos con grants actuales de tablas existentes.

## Trazabilidad

- Issue #591: https://github.com/ogarnelo/v0-community-marketplace/issues/591#issuecomment-6945482260
- Pruebas PG17 desechable y concurrencia: PR595 y PR597, ensayos anteriores a la aplicación (no pruebas E2E productivas).
- No se han enviado emails, creado usuarios, tocado Storage, obtenido backups, cobrado, ni abierto piloto.

## Puerta restante

La **remediación SQL está aplicada y auditada**, pero queda pendiente E2E con identidades autorizadas en Data API, prueba permitida y denegaciones cruzadas de dos colegios, revisión de convivencia con servicios administrativos, recuperación integral, las tres actas AMPA y GO final del responsable. La issue #591 puede permanecer OPEN hasta esos controles. Otros P0, en particular #606, siguen OPEN. **Piloto NO-GO**.
