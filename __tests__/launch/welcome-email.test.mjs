import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const authForm = fs.readFileSync("components/auth/auth-form.tsx", "utf8");
const route = fs.readFileSync("app/api/emails/welcome/route.ts", "utf8");
const transactional = fs.readFileSync("lib/emails/transactional.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260913190000_add_welcome_email_tracking.sql", "utf8");

describe("welcome email MVP contract", () => {
  it("adds a server route for authenticated welcome emails", () => {
    assert.match(route, /export async function POST/);
    assert.match(route, /supabase\.auth\.getUser\(\)/);
    assert.match(route, /No autorizado/);
    assert.match(route, /sendWelcomeEmail/);
    assert.match(route, /user\.email_confirmed_at/);
  });

  it("does not expose arbitrary recipient sending from the client", () => {
    assert.doesNotMatch(route, /request\.json\(\)/);
    assert.match(route, /user\.email/);
  });

  it("tracks welcome delivery to avoid duplicate emails", () => {
    assert.match(route, /welcome_email_sent_at/);
    assert.match(migration, /add column if not exists welcome_email_sent_at timestamptz/);
  });

  it("triggers welcome email after signup and login without blocking auth permanently", () => {
    assert.match(authForm, /triggerWelcomeEmail/);
    assert.match(authForm, /\/api\/emails\/welcome/);
    assert.match(authForm, /console\.warn\("No se pudo solicitar el email de bienvenida"/);
  });

  it("welcome copy matches MVP positioning", () => {
    assert.match(transactional, /Bienvenido\/a a Wetudy/);
    assert.match(transactional, /Wetudy facilita el contacto, el chat y el historial del acuerdo/);
    assert.doesNotMatch(transactional, /fuera de Wetudy/i);
  });
});
