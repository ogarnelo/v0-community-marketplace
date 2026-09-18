import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("auth form passes Turnstile tokens to Supabase Auth", () => {
  const authForm = read("components/auth/auth-form.tsx");

  assert.match(authForm, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(authForm, /DEFAULT_TURNSTILE_SITE_KEY/);
  assert.match(authForm, /0x4AAAAAAE69ijg1KI5Aks-p/);
  assert.match(authForm, /signInWithPassword\([\s\S]*captchaToken/);
  assert.match(authForm, /resetPasswordForEmail\([\s\S]*captchaToken/);
  assert.match(authForm, /signUp\([\s\S]*captchaToken/);
  assert.match(authForm, /Completa la verificación de seguridad/);
  assert.match(authForm, /resetCaptcha\(\)/);
});

test("Turnstile widget uses Cloudflare's explicit browser challenge", () => {
  const widget = read("components/auth/turnstile-widget.tsx");

  assert.match(widget, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(widget, /window\.turnstile\.render/);
  assert.match(widget, /action: "auth"/);
  assert.match(widget, /expired-callback/);
  assert.match(widget, /error-callback/);
});

test("signup clearly explains email confirmation and spam folder", () => {
  const authForm = read("components/auth/auth-form.tsx");

  assert.match(authForm, /email de confirmación/);
  assert.match(authForm, /activar tu cuenta/);
  assert.match(authForm, /Spam o Correo no deseado/);
  assert.match(authForm, /data\.user\?\.id && data\.session/);
});

test("new-user trigger persists split names before email confirmation", () => {
  const migration = read("supabase/migrations/20260917215000_sync_profile_names_on_signup.sql");

  assert.match(migration, /first_name/);
  assert.match(migration, /last_name/);
  assert.match(migration, /raw_user_meta_data ->> 'first_name'/);
  assert.match(migration, /raw_user_meta_data ->> 'last_name'/);
});


test("auth errors are translated and confirmation-email failures explain that signup did not complete", () => {
  const authForm = read("components/auth/auth-form.tsx");
  const messages = read("lib/auth/error-messages.ts");

  assert.match(authForm, /getAuthErrorMessage\(e, "signup"\)/);
  assert.match(authForm, /getAuthErrorMessage\(e, "login"\)/);
  assert.match(authForm, /getAuthErrorMessage\(e, "forgot"\)/);

  assert.match(messages, /email_address_not_authorized/);
  assert.match(messages, /error sending confirmation email/);
  assert.match(messages, /la cuenta no se ha creado/);
  assert.match(messages, /Spam o Correo no deseado/);
});


test("login exposes a safe confirmation-email resend flow", () => {
  const authForm = read("components/auth/auth-form.tsx");

  assert.match(authForm, /type AuthMode = "login" \| "signup" \| "forgot" \| "resend"/);
  assert.match(authForm, /supabase\.auth\.resend\(\{/);
  assert.match(authForm, /type: "signup"/);
  assert.match(authForm, /emailRedirectTo: callbackUrl\.toString\(\)/);
  assert.match(authForm, /Reenviar email de activación/);
  assert.match(authForm, /Spam o Correo no deseado/);
  assert.match(authForm, /Si existe una cuenta pendiente de activar/);
});


test("password recovery returns through the auth callback and exposes a password update form", () => {
  const authForm = read("components/auth/auth-form.tsx");
  const updateForm = read("components/auth/update-password-form.tsx");
  const updatePage = read("app/auth/update-password/page.tsx");

  assert.match(authForm, /recoveryCallbackUrl\.searchParams\.set\("next", "\/auth\/update-password"\)/);
  assert.match(authForm, /resetPasswordForEmail\([\s\S]*recoveryCallbackUrl\.toString\(\)/);
  assert.match(updateForm, /supabase\.auth\.updateUser\(\{ password \}\)/);
  assert.match(updateForm, /Las contraseñas no coinciden/);
  assert.match(updatePage, /robots:[\s\S]*index: false/);
});

test("auth redirects reject protocol-relative and backslash paths", () => {
  const safeNext = read("lib/auth/safe-next.ts");
  const authForm = read("components/auth/auth-form.tsx");
  const callback = read("app/auth/callback/route.ts");

  assert.match(safeNext, /value\.startsWith\("\/\/"\)/);
  assert.match(safeNext, /value\.includes\("\\\\"\)/);
  assert.match(authForm, /getSafeInternalPath\(searchParams\.get\("next"\)\)/);
  assert.match(callback, /getSafeInternalPath\(requestUrl\.searchParams\.get\("next"\)\)/);
  assert.match(callback, /auth_error=invalid_link/);
});


test("new Wetudy signups fail closed if email confirmation is bypassed", () => {
  const authForm = read("components/auth/auth-form.tsx");
  const welcomeRoute = read("app/api/emails/welcome/route.ts");

  assert.match(authForm, /wetudy_email_confirmation_required: true/);
  assert.match(authForm, /requiresWetudyEmailConfirmation/);
  assert.match(authForm, /!data\.user\?\.confirmation_sent_at/);
  assert.match(authForm, /await supabase\.auth\.signOut\(\)/);
  assert.match(authForm, /Wetudy requiere verificar el email antes de iniciar sesión/);

  assert.match(welcomeRoute, /wetudy_email_confirmation_required/);
  assert.match(welcomeRoute, /email_not_verified/);
  assert.match(welcomeRoute, /!user\.confirmation_sent_at/);
});


test("production auth callbacks use the canonical Wetudy origin", () => {
  const authForm = read("components/auth/auth-form.tsx");
  const publicOrigin = read("lib/auth/public-origin.ts");

  assert.match(publicOrigin, /https:\/\/www\.wetudy\.com/);
  assert.match(publicOrigin, /hostname === "wetudy\.com"/);
  assert.match(publicOrigin, /hostname === "www\.wetudy\.com"/);
  assert.match(authForm, /new URL\("\/auth\/callback", getAuthPublicOrigin\(\)\)/);
});

test("signup requires at least eight password characters and avoids claiming duplicate accounts were created", () => {
  const authForm = read("components/auth/auth-form.tsx");

  assert.match(authForm, /password\.length < 8/);
  assert.match(authForm, /La contraseña debe tener al menos 8 caracteres/);
  assert.match(authForm, /minLength=\{mode === "signup" \? 8 : undefined\}/);
  assert.match(authForm, /Si este email es nuevo en Wetudy/);
  assert.match(authForm, /Si ya tenías una cuenta, inicia sesión o usa Recuperar contraseña/);
  assert.doesNotMatch(authForm, /Cuenta creada\. Te hemos enviado un email de confirmación/);
});


test("auth callback trusts the user returned by the code exchange instead of rereading cookies", () => {
  const callback = read("app/auth/callback/route.ts");

  assert.match(callback, /data: exchangeData/);
  assert.match(callback, /exchangeData\.user \|\| exchangeData\.session\?\.user/);
  assert.doesNotMatch(callback, /data: \{ user \}[\s\S]*supabase\.auth\.getUser\(\)/);
});
