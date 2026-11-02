# Wetudy AI por WhatsApp — piloto aislado

> **Estado: PR #232 en borrador, sin fusionar ni activar.** Estas instrucciones sustituyen a todos los flujos de conversación y revisiones de fotografía descartados. Ninguna migración ha sido aplicada a la base de datos de producción.

## Experiencia aprobada por Wetudy

1. La familia inicia sesión en Wetudy, vincula voluntariamente WhatsApp mediante un código temporal enviado desde ese número y confirma sus **cuatro últimos dígitos** dentro de Wetudy.
2. Tras la información clara sobre el tratamiento mediante **Wetudy AI**, envía una fotografía JPG, PNG o WEBP al número de WhatsApp de Wetudy.
3. El webhook valida la firma de Meta y el número vinculado. **Solo una foto inicia el análisis de IA**, con un límite de 3 MB, 5 solicitudes por familia/día y 100 globales/día. El texto arbitrario del chat no se envía al modelo. La IA propone únicamente campos estructurados; nunca decide precio, estado, venta/donación ni permisos.
4. Wetudy contesta con **un único mensaje** y un enlace al formulario móvil privado, precompletado con los datos que pudo reconocer. Si el proveedor de IA falla, conserva la foto como borrador y muestra el formulario vacío para que la familia pueda terminarlo.
5. El formulario permite corregir todos los campos. Es obligatorio aportar fotografía, categoría, título, descripción, estado, venta/donación, precio si es venta y curso en libros de texto o literatura. Los filtros específicos de cada categoría, el precio original y el curso en otras categorías son opcionales.
6. **Solo el botón «Confirmar y publicar» del formulario autenticado puede publicar en la cuenta propietaria.** No hay comandos de chat para publicar, mensajes de confirmación por cada filtro, ni revisión obligatoria adicional de la fotografía. El formulario recomienda comprobar la imagen antes de hacerla pública. `CANCELAR` desde WhatsApp descarta el borrador.

La demo `/demo/wetudy-whatsapp` tiene **valores predefinidos**: no analiza fotos, no envía mensajes a Meta, no llama a Wetudy AI ni publica anuncios.

## Controles y limitaciones

- **Entorno:** solo Vercel Preview, usuario en `WHATSAPP_PILOT_ALLOWED_USER_IDS`, WhatsApp firmado y vinculado. El código exige un **proyecto Supabase distinto al productivo**, verificado mediante `WHATSAPP_PILOT_SUPABASE_PROJECT_REF` y `NEXT_PUBLIC_SUPABASE_URL`.
- **Cuenta:** vínculo por token aleatorio de 32 bytes y SHA-256, duración máxima de 10 minutos, consumo de un solo uso, confirmación posterior del número desde sesión Wetudy y un único usuario por número.
- **Datos:** fotografías de borrador en bucket privado, URLs de imagen a través de endpoint autenticado ligado al propietario, caducidad de borrador a las 24 horas; limpieza mediante endpoint autenticado `/api/cron/whatsapp-draft-cleanup`, **pendiente de programar y probar**.
- **Publicación:** las RPC de Supabase bloquean operaciones simultáneas, verifican el borrador y permiten la operación solo con `service_role` en servidor. Identificador UUID estable para reintentos. La validación de los campos y la autorización siempre se hacen del lado del servidor.
- **IA:** el proveedor recibe la foto original cuando la familia envía una imagen a un WhatsApp vinculado, tras la información y aceptación en la vinculación. No se usa para responder preguntas generales ni tiene acceso directo a las cuentas o a SQL. En la experiencia visible se presenta como **Wetudy AI**; la documentación legal debe identificar adecuadamente al proveedor real y el tratamiento asociado.
- **Privacidad:** el usuario debe tener derecho a compartir el contenido; esa obligación no elimina las responsabilidades de Wetudy por el tratamiento de datos y las solicitudes de retirada. No hay redacción obligatoria de fotos ni revisión extra entre la foto y el formulario. Antes de abrirlo a familias, revisar los textos legales y las obligaciones específicas cuando aparezcan menores.

## Preparación del ensayo real — aún pendiente

**Sin usar proyectos productivos ni contratar servicios sin autorización:**

1. Disponer de un **Supabase aislado** para el piloto; confirmar su ID antes de introducir credenciales. No reutilizar `Education Marketplace` ni `VM Copilot` sin comprobación explícita.
2. Solo en ese proyecto de pruebas, y tras autorización: ejecutar **en este orden** las migraciones no aplicadas `20261101130000_whatsapp_account_link_pilot.sql` (vinculación) y `20261101141000_whatsapp_guided_listing_pilot.sql` (borradores). La migración de vinculación se reparó tras detectar una definición duplicada y una restricción SQL rota.
3. Preparar Meta WhatsApp Cloud API con número de prueba, token y secreto de aplicación, ID del número y webhook firmado. Atención: el webhook requiere una URL pública verificable; una Preview protegida con contraseña/cookies puede bloquear a Meta.
4. Configurar exclusivamente en Preview los flags y secretos: `WHATSAPP_PILOT_ENABLED`, `WHATSAPP_PUBLISH_ENABLED`, `WHATSAPP_AI_ENABLED`, `WHATSAPP_PILOT_ALLOWED_USER_IDS`, `WHATSAPP_PILOT_SUPABASE_PROJECT_REF`, `WHATSAPP_PRODUCTION_SUPABASE_PROJECT_REF`, `WHATSAPP_BUSINESS_NUMBER`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `OPENAI_API_KEY` y `WHATSAPP_CLEANUP_SECRET`. **No copiar tokens ni secretos en chats, commits o documentación.**
5. Hacer pruebas E2E con dos cuentas ficticias: vínculo/cambio de número, foto de libro y calculadora, IA no disponible, campo obligatorio vacío, donación/venta, rechazo de URLs privadas ajenas, clic doble, reintento, cancelación, limpieza y sesiones caducadas. Usar objetos sin datos personales.
6. Verificar coste, retención, comportamiento de Meta en el navegador integrado, bloqueo de producción y política de privacidad antes de invitar a familias.

## Verificación disponible

- Compilación y pruebas automatizadas en Vercel Preview, incluidas pruebas de propietario A/B simulado, CSRF, formulario y validaciones.
- Comprobación estática adicional de que la migración de vínculo contiene exactamente una definición de cada tabla y RPC y conserva ambas restricciones. **No sustituye ejecutar PostgreSQL en una base de pruebas.**
- No hay pruebas de webhook Meta real, IA con credenciales reales, datos reales ni migraciones aplicadas.

**Regla de lanzamiento:** mientras falte Supabase aislado, webhook de Meta de prueba, pruebas E2E o revisión legal, el PR debe seguir en borrador y **Wetudy producción no se modifica**.
