# Supabase Auth email templates for Wetudy

Wetudy uses Supabase SSR/PKCE in the browser. Email links must therefore use
`TokenHash` and the server-side `/auth/confirm` endpoint instead of relying on
`ConfirmationURL` + a PKCE code verifier stored in the browser that created the
request.

## Confirm signup

Subject:

`Confirma tu cuenta de Wetudy`

HTML:

```html
<h2>Confirma tu cuenta de Wetudy</h2>
<p>Para activar tu cuenta, confirma tu dirección de email.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding/join-school">
    Confirmar mi cuenta
  </a>
</p>
<p>Si tú no has creado esta cuenta, puedes ignorar este mensaje.</p>
```

## Reset password

Subject:

`Restablece tu contraseña de Wetudy`

HTML:

```html
<h2>Restablece tu contraseña de Wetudy</h2>
<p>Usa este enlace para elegir una nueva contraseña.</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/update-password">
    Crear nueva contraseña
  </a>
</p>
<p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
```

These templates avoid depending on a PKCE verifier stored in the browser that
originated the signup/recovery request. They also avoid one common source of
false "expired link" errors when the email is opened in another browser or mail
webview.
