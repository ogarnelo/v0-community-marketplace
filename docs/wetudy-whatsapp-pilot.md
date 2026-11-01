# Wetudy por WhatsApp — piloto de vinculación (PR aislado)

La ruta `/demo/wetudy-whatsapp` ofrece una **simulación interactiva** sin necesidad de iniciar sesión, accesible solo desde Vercel Preview: las fotos se previsualizan localmente y no se envía ningún dato ni se crea ningún anuncio. Esta demo no sustituye una prueba real de Meta Cloud API.\n\nObjetivo del journey: el usuario se registra en Wetudy, vincula opcionalmente WhatsApp mediante un mensaje con token de un solo uso y después podrá crear anuncios enviando fotografías. **Esta rama ya contiene el flujo completo bajo flags privados, sin activar:** vinculación, análisis de foto, preguntas, revisión, confirmación explícita y publicación. No está conectado a Meta ni probado con mensajes reales; no está listo para producción.

## Seguridad y alcance

- Nada se habilita sin `WHATSAPP_PILOT_ENABLED=true`, lista de usuarios piloto y variables Meta completas.
- Solicitud de vinculación desde sesión Supabase validada y email confirmado. Token criptográfico de 32 bytes, SHA-256 en base de datos, máximo 10 minutos, consumo de un solo uso. La app no se autentica por el número de teléfono escrito en el perfil.
- El webhook verifica `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`, además del identificador del número configurado. Sin firma correcta no toca la base de datos.
- Vinculación requiere que el dueño de la cuenta pulse `Vincular` e inicie el mensaje desde su WhatsApp. El identificador del remitente lo determina Meta.
- Un WhatsApp solo puede vincularse a una cuenta; para cambiarlo se debe desvincular la anterior. Los tokens se anulan tras el primer consumo.
- La publicación guiada solo se activa adicionalmente con \`WHATSAPP_PUBLISH_ENABLED=true\` y \`WHATSAPP_AI_ENABLED=true\`, además de \`OPENAI_API_KEY\`. Las fotografías se almacenan temporalmente en un bucket **privado** y el anuncio se crea únicamente cuando la familia responde con la palabra exacta \`PUBLICAR\`. Por defecto, no se guardan fotos, no se llama a la IA y no se crean anuncios.
- La migración SQL de esta rama no se ha aplicado a ningún entorno. Vercel Preview puede compilar sin las variables; la página del piloto devolverá 404 y el webhook estará deshabilitado. No tocar producción.

## Flujo que implementa esta rama

1. Usuario piloto accede a `/account/whatsapp`, lee consentimiento y selecciona `Generar enlace seguro`.
2. Se crea petición privada de vinculación y se genera un enlace `wa.me` con texto `VINCULAR WETUDY <token>`.
3. El usuario envía ese mensaje a Wetudy; Meta lo entrega al webhook `/api/webhooks/whatsapp`.
4. El webhook verifica la firma, revisa token y remitente, crea la vinculación y responde con confirmación.
5. El usuario puede consultar su estado de vinculación y desvincularse desde Wetudy.

## Configuración necesaria solo para entorno de pruebas

- Configurar Meta Business Platform / WhatsApp Cloud API, usando el número de prueba para comenzar, con webhook verificado (GET token) y mensajes entrantes (POST). Puede especificarse `WHATSAPP_GRAPH_VERSION` (por defecto `v24.0`) según versión admitida por la App.\n- **Vercel Preview está protegido por autenticación.** Meta no puede usar un enlace temporal de navegador basado en cookies para hacer POST al webhook. Para pruebas reales, usar un túnel seguro a un entorno local aislado o un mecanismo de bypass autorizado que no exponga otros servicios. No desproteger el proyecto ni abrir producción por el piloto.
- En Vercel Preview, nunca en Production por defecto: `WHATSAPP_PILOT_ENABLED=true`, `WHATSAPP_PILOT_ALLOWED_USER_IDS=<UUID usuario de prueba>`, `WHATSAPP_BUSINESS_NUMBER=<número internacional solo dígitos>`, `WHATSAPP_PHONE_NUMBER_ID=<id numérico Meta>`, `WHATSAPP_VERIFY_TOKEN=<secreto aleatorio>`, `WHATSAPP_APP_SECRET=<app secret Meta>`, `WHATSAPP_ACCESS_TOKEN=<token cloud API>`.
- Aplicar migración `supabase/migrations/20261101130000_whatsapp_account_link_pilot.sql` **solo en una base de datos de pruebas aislada**, tras autorización explícita y comprobación de coste. No aplicar automáticamente en el Supabase de producción.
- Con base de datos aislada será necesario configurar también autenticación de prueba y sus credenciales en Preview (nunca reutilizar datos o sesiones reales para experimentar). 
- No usar esta rama para permitir el login desde cualquier número, ni para automatizar publicaciones. Configurar límites de gasto y supervisión antes de activar mensajes de salida.

## Publicación guiada implementada, pero desactivada\n\n1. Un usuario ya vinculado envía una foto JPG/PNG/WEBP (hasta 3 MB). El webhook firmado de Meta identifica el \`wa_id\`, exige usuario en allowlist y mensaje reciente.\n2. Se reserva atomicamente el ID de mensaje para evitar duplicados y una de las 5 llamadas máximas diarias de IA por cuenta (100 globales entre usuarios).\n3. La foto se descarga desde la URL temporal de Meta, validando protocolo/host/formato/tamaño; GPT-5.6 Luna propone título, descripción, categoría y curso sin suponer el estado ni el precio.\n4. La foto se guarda de forma temporal en el bucket privado \`whatsapp-draft-photos\`. El bot confirma el título y pregunta estado, venta o donación, precio cuando corresponda y curso para libros.\n5. El usuario revisa la ficha y confirma escribiendo \`PUBLICAR\`. El backend comprueba reglas y escribe en las mismas tablas \`listings\` / \`listing_photos\` que el formulario web. El UUID por borrador reduce duplicados de reintentos.\n6. \`CANCELAR\` descarta; \`EDITAR\` permite corregir título y seguir el flujo. La fotografía privada se elimina al publicar, cancelar o reemplazar el borrador.\n\n**NO se ha ejecutado ninguna migración, se ha registrado ningún webhook ni se ha enviado contenido a OpenAI o Meta.**\n\nVariables adicionales SOLO de Preview: \`WHATSAPP_PUBLISH_ENABLED=true\`, \`WHATSAPP_AI_ENABLED=true\`, \`OPENAI_API_KEY\`, \`OPENAI_LISTING_MODEL=gpt-5.6-luna\`, \`WHATSAPP_CLEANUP_SECRET\` (mínimo 32 caracteres). Nunca usar la service role key ni la base de datos de producción para ensayos.\n\nLa migración \`supabase/migrations/20261101141000_whatsapp_guided_listing_pilot.sql\` crea estado de conversación y deduplicación privados, bucket privado y cuotas. **No está aplicada.**\n\n### Retención, fallos y requisitos pendientes\n\n- La ruta protegida \`POST /api/cron/whatsapp-draft-cleanup\` permite eliminar fotografías de borradores abandonados después de 24 horas y metadatos antiguos. **No está programada automáticamente**: será imprescindible configurar un ejecutor autenticado y verificar sus ejecuciones antes de probar con familias reales.\n- Los mensajes salientes pueden fallar después de completar el estado. Para un piloto más amplio hace falta una cola/reintentos de mensajes salientes y monitorización, sin duplicar anuncios.\n- Los webhooks procesan actualmente una foto cada vez con un tiempo acotado, pero Meta puede reintentar si la ejecución excede su ventana de respuesta. Es necesario probar latencia de punta a punta y valorar cola asíncrona antes de abrir a más usuarios.\n- El PR #231 contiene una mejora separada del formulario web. Esta rama replica únicamente la llamada barata de análisis y no necesita fusionar el PR #231 para compilar. Antes de integrar ambas opciones debemos unificar módulos, métricas y políticas de costes.\n- Debemos validar consentimiento, política de privacidad y retención de WhatsApp, así como limitación de usuarios de prueba de Meta y obligaciones empresariales antes del uso abierto.\n\n## Próximo desarrollo (no implementado)

Completar configuración aislada de Meta y Supabase, probar con fotos reales, añadir envío fiable/reintentos de respuestas, automatizar limpieza, integrar métricas de conversión y costes, validar RGPD y unificar la capa de IA con PR #231. Incorporar consultas guiadas sobre ISBN y detalles del centro solo cuando sean necesarios y verificables. Preparar pruebas de extremo a extremo antes de cualquier despliegue público.

Meta limita las respuestas libres a una ventana de 24 horas desde el último mensaje recibido; fuera de ella solo se pueden usar plantillas aprobadas. Los mensajes de servicio pueden generar coste según tarifas vigentes.

## Datos por categoría: paridad con el formulario web (2026-11-01)

La IA sugiere **título, descripción, categoría, curso y detalles verificables**. Antes de publicar el bot exige confirmar la categoría y el título, revisar la **descripción de al menos 40 caracteres**, indicar el **estado real**, decidir **venta o donación** y, para venta, **precio > 0**. El precio original es opcional. Una foto real es obligatoria.

| Categoría | Detalles opcionales de la ficha | Obligación adicional |
|---|---|---|
| Libros de texto | ISBN válido, asignatura, editorial, autor, formato, idioma | Curso confirmado |
| Lectura y literatura | ISBN válido, autor, editorial, formato, idioma | Curso confirmado |
| Uniformes | Tipo de prenda, talla, temporada | Ninguna |
| Material escolar | Tipo de material | Ninguna |
| Tecnología y calculadoras | Tipo de dispositivo, marca, modelo | Ninguna |
| Mochilas y estuches | Tipo de artículo, marca | Ninguna |
| Música, deporte, universitario y otros | Detalles en la descripción | Ninguna |

Para cada campo opcional el usuario puede responder SI cuando hay una sugerencia, introducir un valor distinto, OMITIR o OMITIR TODO para saltar el resto. Los valores de los selectores siguen el formulario web. No se fuerza estudiante/curso en artículos transversales como mochilas.

Se comprueba ISBN cuando se proporciona; se rechazan predicciones no verificables. El resumen incluye los detalles y se guardan en `listings` (`isbn`, `subject`, `publisher`, `author`, `format`, `language`, `specific_type`, `size_label`, `season`, `brand`, `model`, `original_price`).

La demo visual `/demo/wetudy-whatsapp` deja cambiar de categoría para ver cómo cambian los campos. Utiliza **ejemplos fijos**, no análisis real de la foto elegida. La conversación real se ejecutará con mensajes individuales cuando se configure Meta y una base de pruebas aislada.
