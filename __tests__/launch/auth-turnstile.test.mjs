import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("auth form passes Turnstile tokens to Supabase Auth", () => {
  const authForm = read("components/auth/auth-form.tsx");

  assert.match(authForm, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
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
