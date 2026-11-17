# WETUDY — Esquema propuesto de representación AMPA/FAMPA/CEAPA (solo revisión)

**No autorizado ni aplicado.** Archivo candidato: `scripts/p0_federation_representation_schema_review_only.sql`. No se coloca bajo `supabase/migrations`, no se invoca desde CI ni Vercel y no crea cuentas ni relaciones reales.

Separa seis conceptos/relaciones de forma auditable:

1. Organización federativa: `federation_reporting_organizations`, kind federación o confederación, verificable/revocable.
2. Entidad AMPA jurídica: `federation_reporting_associations`, independiente de la tabla `schools`.
3. `federation_reporting_association_schools`: vínculo AMPA-colegio con vigencia y autoridad que verifica.
4. `federation_reporting_org_associations`: la federación representa formalmente una AMPA durante una ventana temporal.
5. `federation_reporting_org_hierarchy`: relación verificada de CEAPA/confederación con federaciones. El SQL restringe autoenlaces pero los ciclos y conflictos multi-padre se verifican en código, en la PR #646.
6. `federation_reporting_memberships`: usuario vinculado a entidad federativa, solo `report_viewer`, con verificación y revocación. No se añade ese rol a `public.user_roles`, que continúa limitado a los administradores operativos.

**Protección de base de datos**: todas las tablas nuevas propuestas tienen RLS habilitada y ninguna política cliente; tras crearlas se retiran explícitamente los permisos de `PUBLIC`, `anon` y `authenticated` dentro de la misma transacción. Esto es especialmente importante porque siguen 16 permisos FUTUROS para tablas de `supabase_admin`. No afecta los grants de tablas ya existentes ni aplica `ALTER DEFAULT PRIVILEGES`.

**No equivale a un endpoint funcionando**. Falta un adaptador servidor auditado que lea las relaciones con permisos legales, verifique que ambos extremos están activos, componga el alcance y agregue los KPI de todos los colegios autorizados. Los endpoints federativos no deberán aceptar una lista de colegios enviada por el cliente, ni exponer filas de `auth.users`, `profiles`, anuncios, mensajes, pagos o informes de moderación. El límite de 10 miembros por colegio introducido en #645 es PROVISIONAL y requiere revisión jurídica y pruebas de diferenciado entre periodos y filtros.

Antes de considerar SQL en producción: revisión jurídica del modelo, posible representación de varias AMPAs para un colegio, política de vigencia y exclusividad de representantes, restauración/rollback verificado en PostgreSQL 17 desechable, RLS + grants postflight, y autorización explícita de un despliegue atómico. La creación de tablas de relaciones por sí sola no concede accesos.

Se mantiene **NO-GO** del piloto general y de reporting federativo real.
