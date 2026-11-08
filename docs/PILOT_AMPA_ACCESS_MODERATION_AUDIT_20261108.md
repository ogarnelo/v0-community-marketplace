# Wetudy — Seguridad AMPA: roles, enlaces QR y resolución de incidencias
Revisión: 8 de noviembre de 2026 · Seguimiento principal: GitHub issue #245

## Situación real de producción (sin alterar datos)
- Proyecto Supabase Wetudy: `jpsljmakoscqevssimtk`. Hay **un centro operativo de demostración** CEIP Monteverde (`is_test=true`), con **un rol `school_admin`** y **un `super_admin`**. El directorio nacional informativo de **34.845 colegios no crea comunidades ni roles**.
- `school_access_codes`: RLS muestra el código únicamente a superadministradores y al `school_admin` vinculado a ese centro; el resto de usuarios no pueden enumerar códigos.
- Consultas reales de solo lectura con un usuario normal y un administrador del centro de pruebas ya confirmaron la separación. Sin un segundo centro real activo no puede afirmarse que esté probado el aislamiento E2E de dos AMPA en producción.
- Las rutas `app/api/school/impact-report`, `share-qr`, `send-impact-report` y `report-subscription` comprueban autenticación y obtienen el centro administrable del rol del usuario. `app/admin/school/page.tsx` limita los recursos de administración por `effectiveSchoolId`.
- La vista de reportes del centro solo muestra reportes sobre **sus propios anuncios**; la resolución de incidencias mediante `/api/admin/reports/status` está reservada a `super_admin`.

## Comprobación aislada con dos centros falsos
`scripts/pilot-two-school-isolation.sh` y `.github/workflows/pilot-two-school-isolation.yml` ejecutan en PostgreSQL 17 descartable:
- Administrador A: ve exactamente su propio código y rol, **no** el código/rol de B ni la cuenta superadministradora.
- Administrador B: ve su propio código, no el de A.
- Familiar normal: no puede ver códigos ni roles administrativos.
- Superadministrador: ve ambos centros.
- Un administrador de centro no puede otorgarse `super_admin` por INSERT (política RLS).
- Las políticas RLS sintéticas reflejan las expresiones de la migración real `20260920111500_profile_privacy_hardening.sql`; tests de contrato comprueban la correspondencia de predicados.

**Alcance:** valida reglas de autorización SQL con datos ficticios; aún queda un ensayo de interfaz con dos AMPA reales autorizadas y prueba de acceso/revocación con sesión de usuario.

## QR y alta de familias: definición funcional pendiente
Los QR incluyen **URL y UUID del centro** para abrir `/onboarding/join-school`; el alta está abierta a usuarios autenticados y puede hacerse también desde la búsqueda de centros. Esto está previsto en `__tests__/launch/school-share-link-qr.test.mjs`, no constituye por sí solo un bypass del diseño actual.

**No deben presentarse estos QR como enlaces de acceso privados, de un solo uso ni como comprobación de pertenencia a un AMPA.** El código de centro sirve para localizar una comunidad, pero el flujo actual acepta también una incorporación sin código. Antes de la difusión por las tres AMPA hay que decidir si se permite comunidad abierta o se requiere aprobación/validación de pertenencia. Esta revisión **no cambia esa política**.

**Mejora aplicada:** `app/api/school/share-qr/route.ts` toma el dominio de `getAuthPublicOrigin()` (**https://www.wetudy.com**) y no del Host de la petición. Evita incorporar accidentalmente un dominio externo a un QR oficial.

## Resolución de incidencias: prueba SQL aislada
`scripts/pilot-report-resolution-sandbox.sh` carga la definición de `server_update_report_status(uuid,uuid,text,text)` desde la migración real `20260923223000_report_resolution_feedback.sql` y usa casos falsos en una segunda base PostgreSQL 17 descartable:
- `school_admin` no puede cerrar reportes.
- Estado no admitido se rechaza, sin notificaciones ni escrituras colaterales.
- Resolver la primera incidencia no confirma el acuerdo mientras queda otra incidencia abierta.
- Resolver/descartar la última incidencia restituye estado `confirmed` del acuerdo y genera notificación a su denunciante.
- Quedan registrados los eventos de auditoría y notas de resolución para los tres casos ficticios.

**Alcance:** solo prueba SQL. Falta UI E2E con superadministrador ficticio, verificación de visibilidad de notas, emails, reintentos y reversión bajo condiciones de concurrencia. No crear reportes ficticios en producción.

## Reglas de costes y retención
- Sin nuevos proyectos de Supabase ni gasto recurrente; pruebas en contenedor de GitHub Actions.
- Conservar los **seis anuncios DEMO**, fotografías y la operación E2E hasta lanzamiento del piloto, conforme a la decisión del fundador.
- No activar automáticamente centros nacionales ni indexarlos.
- El respaldo cifrado conjunto DB+Storage ya superó una recuperación parcial de directorio + 35 objetos en runner, **no** una recuperación integral funcional de Auth/Storage API.

## Pendientes de GO para 3 AMPA
1. Decisión explícita sobre comunidades abiertas o miembros verificados, y copy de invitación coherente.
2. Validación E2E de acceso QR y revocación con cuentas y centros de prueba autorizados.
3. Moderación de punta a punta en entorno aislado con interfaz, superadmin y reporter.
4. Privacidad y consentimiento de familias, con especial atención a menores, fotos y notificaciones.
5. Comprobación de recuperación completa de Auth, acuerdos, mensajes y Storage API en entorno aislado.
