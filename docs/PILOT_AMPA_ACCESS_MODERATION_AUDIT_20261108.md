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

## Decisión de producto — incorporación abierta aprobada por el fundador (08/11/2026)

**Decisión definitiva para el piloto de tres AMPA:** mantener la incorporación abierta a cualquier familia con cuenta autenticada. La familia puede **seleccionar un centro activo mediante QR, enlace directo o búsqueda**, sin código obligatorio ni validación previa por el AMPA. También puede continuar sin centro y cambiar o quitar la selección cuando quiera.

- La selección del centro es una **preferencia de contexto y descubrimiento**, **NO acredita** matrícula, pertenencia a la asociación, identidad ni autorización para administrar la comunidad.
- **Administradores de AMPA**: solo sus roles concedidos explícitamente en `user_roles` permiten ver datos administrativos y operar; la selección de centro por parte de la familia NO concede roles.
- **QR y códigos**: se distribuyen para facilitar acceso, **no son invitaciones privadas, de un solo uso o mecanismos de verificación**.
- **Directorio ministerial**: elegir uno de los 34.845 colegios informativos no lo activa como comunidad Wetudy, no lo indexa y no confiere permisos.
- **Mensajes públicos**: copy de alta, contexto educativo y pantalla de QR debe reflejar que no se verifica pertenencia. Se incorporan pruebas de regresión en `__tests__/launch/pilot-open-school-selection.test.mjs`.
- **Posterior al piloto**: valorar verificación adicional únicamente si la experiencia de las tres AMPA indica una necesidad real, con evaluación de privacidad y costes. No implantarla ahora sin una nueva decisión.

**Riesgo aceptado conscientemente:** un usuario autenticado puede seleccionar un centro aunque no pertenezca a él. Por tanto, las métricas de «familias del centro» deberán interpretarse como **usuarios que lo han seleccionado**, no como miembros verificados. Antes de difundir cifras a las AMPA, etiquetar correctamente este denominador y excluir cuentas DEMO.

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


## Auditoría del panel AMPA y minimización de datos — 8 noviembre 2026

**Riesgo identificado:** el servidor del panel de centro cargaba perfiles con nombres, cursos y tipos de usuario de toda la base y enviaba al componente cliente un array con todos los perfiles vinculados al centro, aunque el panel solo necesitaba mostrar `members.length`. Un administrador con acceso al panel podía inspeccionar esos datos en la respuesta serializada, pese a que la interfaz no mostraba sus nombres. Esa exposición era innecesaria con el modelo de incorporación abierto.

**Corrección:** el panel ahora envía exclusivamente `memberCount` (número agregado) y conserva el nombre únicamente de quienes tienen el rol explícito `school_admin` en ese centro. Para calcular la pertenencia autoseleccionada, la consulta de perfiles carga solo `id,school_id`, sin nombres, cursos ni tipo de usuario. Los datos que la AMPA debe tratar por una solicitud de donación siguen restringidos al procedimiento autorizado de donaciones, y deben auditarse separadamente. Los acuerdos dejan de llevar el identificador privado `agreement.id` en sus props para métricas.

**Terminología:** los KPI y el CSV del panel indican «Cuentas que seleccionaron el centro» y «no implica pertenencia verificada», de acuerdo con la decisión del fundador. No emplear las cifras como miembros certificados de la AMPA.

**Límites de la corrección:** se verificó el flujo de datos mediante tests de regresión y compilación, pero falta una inspección de red en navegador con cuenta AMPA autorizada para confirmar que ningún otro componente expone detalles innecesarios. Todavía hay consultas de contexto en servidor con `service_role`; analizar escalabilidad y filtrado server-side antes del crecimiento. No se cambió ninguna política RLS ni se crearon usuarios o escuelas.

**Riesgos de privacidad y menores aún pendientes:**
- El código de privacidad y términos fija cuentas propias de estudiante de 14 años o más y recomienda acompañamiento familiar; no prueba edad de forma documental y **no implica** que los menores de 14 estén verificados por medios técnicos.
- `docs/LEGAL_REVIEW_20260921.md` identifica **pendiente** la identidad legal definitiva del titular/responsable, revisión externa RGPD/menores, conservación de datos y proceso de solicitudes y brechas; no dar por listo el piloto para familias reales sin una decisión y revisión jurídica.
- Moderación de contenidos contra menores: existe canal público de denuncia, pero el procedimiento de comunicación de motivos de retirada/restricción no está automatizado. El ciclo E2E desde navegador/administrador sigue pendiente de entorno controlado.

## 8 de noviembre de 2026 — Segunda auditoría de privacidad y QR (PR #263)

**Hallazgo y mitigación técnica:** tras #262 el panel AMPA ya envía solo un contador de perfiles, pero el servidor seguía haciendo `service_role.from("reports")` sobre **todas las denuncias de anuncios** sin filtrar por centro, y luego eliminaba las de otros centros mediante JavaScript. Para reducir el acceso innecesario incluso dentro del servidor, la consulta de `reports` ahora se ejecuta **después** de obtener exclusivamente los anuncios del centro autorizado y se restringe a `listing_id IN (identificadores de esos anuncios)`. Si el centro no tiene anuncios, no consulta `reports`. Conserva el filtro final defensivo y la misma vista de incidencias para AMPA. **No altera RLS, cuentas, datos, ni la capacidad de superadmin de resolver denuncias.** Mantener una alerta de escalabilidad: las listas muy largas de anuncios requerirán una consulta SQL de agregación o un RPC autorizado, nunca recuperar globalmente todas las denuncias.

**QR y alta:** código revisado; el endpoint del QR requiere sesión y rol `school_admin`, su enlace se genera con dominio oficial de Wetudy, la búsqueda pública no expone códigos y solo presenta centros activos no test; QR directo puede abrir un centro activo de pruebas para usuarios autorizados. Las pruebas de contratos estáticos **no sustituyen** una ejecución real con navegador y sesiones de dos usuarios. La decisión del fundador es mantener selección de centro abierta y opcional, no verificada.

**Documentación legal para el piloto (bloqueo jurídico P0):** `app/terms/page.tsx` y `app/privacy/page.tsx` aún dicen que la identidad legal completa del prestador/responsable se incorporará más adelante. Confirmar con asesoría si el servicio operará inicialmente bajo persona física o entidad y publicar los datos exigibles **antes de abrir la inscripción a familias reales**. No crear nombres, NIF, domicilios ni textos jurídicos inventados en GitHub. Referencias oficiales: LSSI art. 10 (BOE), y LOPDGDD art. 7 / AEPD para los tratamientos de menores basados en consentimiento. La confirmación de 14+ en formulario no equivale a comprobación verificable de edad. También requieren revisión el procedimiento de derechos de personas menores, la política de retención y los flujos de reporte/moderación.

**Puerta GO del piloto:** mantener NO-GO para enrolamiento de tres AMPA hasta completar verificación jurídica identificativa, revisión de protección de menores y E2E autenticado QR/AMPA/soporte. No activar el directorio nacional ni alterar los seis DEMO por esta PR.

