# MVP welcome email v1

## Contexto

Durante la prueba real con `wetudytest@gmail.com` no llegó ningún email de bienvenida propio de Wetudy.

El registro sí usaba Supabase Auth, pero el producto no tenía un flujo de bienvenida con Resend. Solo existían emails transaccionales heredados de pagos.

## Decisión

Añadir un email de bienvenida de Wetudy separado del email de confirmación de Supabase Auth.

El email de bienvenida debe explicar:

- qué puede hacer el usuario ahora;
- cómo vincular su centro;
- cómo buscar material;
- cómo publicar anuncios con foto;
- que Wetudy facilita contacto, chat e historial del acuerdo;
- enlace al marketplace;
- enlace a ayuda.

## Seguridad

El endpoint `/api/emails/welcome` no acepta un destinatario arbitrario en el body.

Lee el usuario autenticado con Supabase SSR y envía el email solo a `user.email`.

Esto evita convertir el endpoint en un relay abierto de emails.

## Antiduplicado

Se añade `profiles.welcome_email_sent_at`.

Si ya existe fecha, el endpoint responde `skipped: true` y no reenvía.

## Configuración necesaria

En Vercel deben estar configuradas:

```txt
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_APP_URL
SUPABASE_SERVICE_ROLE_KEY
```

Si falta Resend o remitente, el endpoint responde `skipped: true` con `email_not_configured` y no rompe el registro.

## Validación

```bash
npm run test:contracts
npm run build
```

Prueba manual recomendada:

1. Crear una cuenta test nueva.
2. Confirmar/login si aplica.
3. Revisar que llega `Bienvenido/a a Wetudy`.
4. Revisar en Supabase que `profiles.welcome_email_sent_at` queda informado.
5. Cerrar sesión y volver a iniciar: no debería reenviarse.
