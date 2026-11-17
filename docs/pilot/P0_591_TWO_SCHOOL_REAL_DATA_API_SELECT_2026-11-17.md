# WETUDY P0 #591 — E2E real SELECT RLS, dos colegios

**Alcance**: script opt-in de GET contra Supabase Data API con dos tokens **personales legítimos** en dos centros diferentes y dos solicitudes reales de prueba previamente creadas. Valida la identidad en Auth, visibilidad de la solicitud propia y ausencia de la solicitud del otro colegio. Sin escrituras, sin credenciales almacenadas, sin proveedores falsos en el ensayo real.

**Precondición en producción a 17/11/2026: NO CUMPLIDA.** Supabase contiene **un colegio y cero registros en donation_requests**. Por ello **NO** afirmar que el E2E real está aprobado. Los tests de GitHub son mocks sobre la semántica del runner, no ensayos contra datos productivos.

## Operativa controlada

1. Tras la autorización operativa y creación legítima de dos colegios/cuentas y una solicitud **por cuenta** (las solicitudes deberán ser insertadas por el procedimiento autorizado por separado), disponer en la sesión local de variables: WETUDY_E2E_SUPABASE_URL, WETUDY_E2E_ANON_KEY, WETUDY_E2E_JWT_A, WETUDY_E2E_JWT_B, WETUDY_E2E_USER_A, WETUDY_E2E_USER_B, WETUDY_E2E_SCHOOL_A, WETUDY_E2E_SCHOOL_B, WETUDY_E2E_REQUEST_A, WETUDY_E2E_REQUEST_B.
2. Usar dos JWT de **usuarios reales diferentes**, nunca service_role. No pegar claves ni JWT en GitHub, documentos, capturas o ChatGPT.
3. Ejecutar localmente `node scripts/p0_donation_two_school_data_api_read_only.mjs`. Si faltan datos, no hay visibilidad propia, la sesión no corresponde al usuario o se expone otro colegio: sale con código 1 (NO-GO) y error genérico.
4. Solo si resulta `{"ok":true,"check":"SELECT_RLS_TWO_SCHOOLS","pairs":2,"writeOperations":0}` queda verificada **SELECT** en dos colegios. NO significa INSERT RLS, aprobación, simultaneidad, chat, Storage o piloto GO.

El inserto de solicitud inválida, especialmente cross-school, requiere pruebas de rechazo separadas **con permiso explícito para realizar DML de prueba** y limpieza; no se realizan en este script.

## Seguridad

El runner no usa `service_role`, no almacena tokens y solo ejecuta GET. Las variables de shell con JWT son material sensible; manejarlas en una sesión local segura y eliminar su exposición posterior. Una respuesta HTTP GET no prueba que otras tablas queden aisladas.
