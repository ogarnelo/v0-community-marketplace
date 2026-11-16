# PR585 · Seguridad de seis APIs del ciclo de acuerdos

16 noviembre 2026: `POST /api/agreements/{propose,confirm,counter,cancel,dispute,review}`.

No aceptar identidad residual ante error de `getUser`. Sesión ausente => 401, caída Auth => 503, excepción inesperada => 500, siempre `Cache-Control: private, no-store`. No se crea cliente con service role ni se invocan RPC de cambio de estado sin sesión verificada. Los errores internos se sustituyen por mensajes públicos constantes; los errores reconocidos de negocio `403/404/409` de los RPC se mantienen.

En `review`, error SQL leyendo acuerdo o revisión previa => **503** (no falso 404 / 409). Se conserva exclusión de reputación para acuerdos DEMO.

**54 tests runtime**: 36 de Auth, seis validaciones previas, seis accesos con usuario verificado y rechazo de titularidad / ausencia, cinco excepciones SQL de RPC y uno de lectura en valoración. Las pruebas usan mocks sin crear acuerdos, enviar correos ni interactuar con datos reales. Apilado sobre PR584, fusionar primero #584. Sin migraciones. Piloto NO-GO.
