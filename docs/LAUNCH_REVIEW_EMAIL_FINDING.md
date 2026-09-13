# Launch review: missing welcome email

## Hallazgo

Durante la creación de la cuenta test `wetudytest@gmail.com`, no llegó ningún email de bienvenida propio de Wetudy.

## Causa

El código de registro solo llamaba a Supabase Auth. No existía ningún envío de bienvenida con Resend.

## Solución MVP

- Añadir `sendWelcomeEmail` en `lib/emails/transactional.ts`.
- Añadir endpoint autenticado `/api/emails/welcome`.
- Dispararlo tras signup con sesión activa y tras login.
- Marcar `profiles.welcome_email_sent_at` para evitar duplicados.

## Pendiente operativo

Verificar que Vercel tiene configuradas:

```txt
RESEND_API_KEY
RESEND_FROM_EMAIL
NEXT_PUBLIC_APP_URL
```

Si falta alguna, el endpoint no rompe login/registro, pero devuelve `skipped: true`.
