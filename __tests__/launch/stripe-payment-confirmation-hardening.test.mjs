import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/actions/stripe.ts", "utf8");

test("Stripe confirmation fails closed and persists a valid status", () => {
  assert.match(source, /No se pudo verificar el pago con Stripe/);
  assert.doesNotMatch(source, /confiamos en el estado local/);
  assert.match(source, /session\.payment_status !== 'paid'/);
  assert.match(source, /session\.metadata\?\.offer_id !== offerId/);
  assert.match(source, /session\.metadata\?\.buyer_id !== user\.id/);
  assert.match(source, /session\.amount_total !== Math\.round\(expectedTotal \* 100\)/);
  assert.match(source, /status: 'succeeded'/);
  assert.doesNotMatch(source, /status: 'paid'/);
  assert.match(source, /if \(paymentUpdateError\)/);
});

test("session polling is scoped to the authenticated buyer", () => {
  assert.match(source, /export async function checkSessionStatus/);
  assert.match(source, /const \{ data: \{ user \} \} = await supabase\.auth\.getUser\(\)/);
  assert.match(source, /\.eq\('buyer_id', user\.id\)/);
  assert.match(source, /\.contains\('metadata', \{ stripe_checkout_session_id: sessionId \}\)/);
  assert.match(source, /No puedes consultar esta sesión de pago/);
});
