# PR24 validation checklist

## Build

```bash
npm run test:contracts
npm run build
```

## Manual validation

1. Confirmar que `profiles.welcome_email_sent_at` existe en Supabase.
2. Confirmar que `RESEND_API_KEY` y `RESEND_FROM_EMAIL` existen en Vercel production.
3. Crear una cuenta test nueva o iniciar sesión con una cuenta sin `welcome_email_sent_at`.
4. Confirmar que llega el email `Bienvenido/a a Wetudy`.
5. Confirmar que `profiles.welcome_email_sent_at` queda informado.
6. Volver a iniciar sesión y confirmar que no se reenvía.

## Notas

El endpoint está diseñado para no bloquear registro/login si falta Resend, pero en ese caso no saldrá ningún email.
