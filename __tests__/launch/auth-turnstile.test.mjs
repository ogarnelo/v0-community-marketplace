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
