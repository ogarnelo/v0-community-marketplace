# Wetudy por WhatsApp — piloto de vinculación (PR aislado)

Objetivo del journey: el usuario se registra en Wetudy, vincula opcionalmente WhatsApp mediante un mensaje con token de un solo uso y después podrá crear anuncios enviando fotografías. **Esta rama implementa únicamente el primer tramo: vinculación y desvinculación, no publicación desde WhatsApp.**

## Seguridad y alcance

- Nada se habilita sin `WHATSAPP_PILOT_ENABLED=true`, lista de usuarios piloto y variables Meta completas.
- Solicitud de vinculación desde sesión Supabase validada y email confirmado. Token criptográfico de 32 bytes, SHA-256 en base de datos, máximo 10 minutos, consumo de un solo uso. La app no se autentica por el número de teléfono escrito en el perfil.
- El webhook verifica `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`, además del identificador del número configurado. Sin firma correcta no toca la base de datos.
- Vinculación requiere que el dueño de la cuenta pulse `Vincular` e inicie el mensaje desde su WhatsApp. El identificador del remitente lo determina Meta.
- Un WhatsApp solo puede vincularse a una cuenta; para cambiarlo se debe desvincular la anterior. Los tokens se anulan tras el primer consumo.
- No se guardan fotos ni conversaciones de WhatsApp y no se crean anuncios en este PR. La futura creación de anuncios requerirá confirmación explícita y utilizará el mismo modelo de datos de Wetudy, sin autorización para inventar precio, estado, centro o estudiante.
- La migración SQL de esta rama no se ha aplicado a ningún entorno. Vercel Preview puede compilar sin las variables; la página del piloto devolverá 404 y el webhook estará deshabilitado. No tocar producción.

## Flujo que implementa esta rama

1. Usuario piloto accede a `/account/whatsapp`, lee consentimiento y selecciona `Generar enlace seguro`.
2. Se crea petición privada de vinculación y se genera un enlace `wa.me` con texto `VINCULAR WETUDY <token>`.
3. El usuario envía ese mensaje a Wetudy; Meta lo entrega al webhook `/api/webhooks/whatsapp`.
4. El webhook verifica la firma, revisa token y remitente, crea la vinculación y responde con confirmación.
5. El usuario puede consultar su estado de vinculación y desvincularse desde Wetudy.

## Configuración necesaria solo para entorno de pruebas

- Configurar Meta Business Platform / WhatsApp Cloud API, usando el número de prueba para comenzar, con webhook verificado (GET token) y mensajes entrantes (POST).
- En Vercel Preview, nunca en Production por defecto: `WHATSAPP_PILOT_ENABLED=true`, `WHATSAPP_PILOT_ALLOWED_USER_IDS=<UUID usuario de prueba>`, `WHATSAPP_BUSINESS_NUMBER=<número internacional solo dígitos>`, `WHATSAPP_PHONE_NUMBER_ID=<id numérico Meta>`, `WHATSAPP_VERIFY_TOKEN=<secreto aleatorio>`, `WHATSAPP_APP_SECRET=<app secret Meta>`, `WHATSAPP_ACCESS_TOKEN=<token cloud API>`.
- Aplicar migración `supabase/migrations/20261101130000_whatsapp_account_link_pilot.sql` **solo en una base de datos de pruebas aislada**, tras autorización explícita y comprobación de coste. No aplicar automáticamente en el Supabase de producción.
- Con base de datos aislada será necesario configurar también autenticación de prueba y sus credenciales en Preview (nunca reutilizar datos o sesiones reales para experimentar). 
- No usar esta rama para permitir el login desde cualquier número, ni para automatizar publicaciones. Configurar límites de gasto y supervisión antes de activar mensajes de salida.

## Próximo desarrollo (no implementado)

Añadir estados transaccionales del asistente: foto(s) -> sugerencias (IA económica / ISBN) -> campos pendientes -> revisión -> confirmación -> publicación con idempotencia, limitación por usuario y auditoría. Reutilizar la lógica de `feat/wetudy-easy-ai-assisted-listing` (PR #231) después de integrar y revisar ambas ramas. Preservar el contexto de estudiantes solo cuando el artículo necesite ese dato. Añadir permisos, retención limitada, canales de ayuda y métricas: contactos iniciados, enlaces completados, publicaciones finalizadas, coste por anuncio y desistimientos.

Meta limita las respuestas libres a una ventana de 24 horas desde el último mensaje recibido; fuera de ella solo se pueden usar plantillas aprobadas. Los mensajes de servicio pueden generar coste según tarifas vigentes.
