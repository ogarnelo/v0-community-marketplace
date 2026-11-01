import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const helper = read("lib/whatsapp/pilot.ts");
const api = read("app/api/whatsapp/link/route.ts");
const webhook = read("app/api/webhooks/whatsapp/route.ts");
const migration = read("supabase/migrations/20261101130000_whatsapp_account_link_pilot.sql");
const page = read("app/account/whatsapp/page.tsx");
const panel = read("components/account/whatsapp-link-panel.tsx");
const account = read("app/account/page.tsx");

test("WhatsApp pilot is explicitly gated and unavailable in production", () => {
  assert.match(helper, /WHATSAPP_PILOT_ENABLED === "true"/);
  assert.match(helper, /VERCEL_ENV === "preview"/);
  assert.match(helper, /WHATSAPP_PILOT_ALLOWED_USER_IDS/);
  assert.match(helper, /WHATSAPP_APP_SECRET/);
  assert.match(helper, /WHATSAPP_ACCESS_TOKEN/);
  assert.match(page, /if \(!isWhatsappPilotConfigured\(\)\) notFound\(\)/);
  assert.match(account, /isWhatsappPilotUserAllowed\(user\.id\)/);
});

test("Authenticated account owner explicitly opts in and can unlink", () => {
  assert.match(api, /supabase\.auth\.getUser\(\)/);
  assert.match(api, /user\.email_confirmed_at/);
  assert.match(api, /body\?\.consent !== true/);
  assert.match(api, /isSameOriginPost\(request\)/);
  assert.match(api, /async function requirePilotUser/);
  assert.match(api, /export async function DELETE/);
  assert.match(panel, /type="checkbox"/);
  assert.match(panel, /Desvincular WhatsApp/);
});

test("Provider-verified identity, 10 minute expiry, one-time hashed token and atomic RPC", () => {
  assert.match(helper, /randomBytes\(32\)/);
  assert.match(helper, /createHash\("sha256"\)/);
  assert.match(api, /10 \* 60_000/);
  assert.match(api, /60_000/);
  assert.match(webhook, /verifyWhatsappSignature\(raw/);
  assert.match(helper, /timingSafeEqual/);
  assert.match(webhook, /metadata\?\.phone_number_id !== process\.env\.WHATSAPP_PHONE_NUMBER_ID/);
  assert.match(webhook, /message\?\.from/);
  assert.match(webhook, /link_whatsapp_account_from_token/);
  assert.match(migration, /for update/);
  assert.match(migration, /consumed_at is null/);
  assert.match(migration, /grant execute on function public\.link_whatsapp_account_from_token[\s\S]*to service_role/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.whatsapp_account_links/);
});

test("WhatsApp pilot does not yet publish listings or receive images", () => {
  assert.doesNotMatch(webhook, /\.from\(["']listings["']\)|\.from\(["']listing_photos["']\)/);
  assert.doesNotMatch(api, /\.from\(["']listings["']\)/);
  assert.match(webhook, /processWhatsappPublishMessage\(message\)/);
  assert.match(page, /publicación asistida cuando esté disponible/);
});

test("Standalone journey demo is preview-only, simulated and never sends or publishes", () => {
  const demoRoute = read("app/demo/wetudy-whatsapp/page.tsx");
  const demoClient = read("components/whatsapp/whatsapp-journey-demo.tsx");
  assert.match(demoRoute, /process\.env\.VERCEL_ENV !== "preview"/);
  assert.match(demoRoute, /notFound\(\)/);
  assert.match(demoClient, /Simulación de experiencia/);
  assert.match(demoClient, /No se conecta a WhatsApp/);
  assert.match(demoClient, /URL\.createObjectURL\(picture\)/);
  assert.doesNotMatch(demoClient, /fetch\(|\.from\(["']listings["']\)/);
});

test("guided publication is explicit, limited, private and does not mutate production", () => {
  const flow = read("lib/whatsapp/conversation.ts");
  const runner = read("lib/whatsapp/inbound-listings.ts");
  const vision = read("lib/whatsapp/vision-and-meta.ts");
  const publisher = read("lib/whatsapp/publish.ts");
  const migration = read("supabase/migrations/20261101141000_whatsapp_guided_listing_pilot.sql");

  assert.match(runner, /WHATSAPP_PUBLISH_ENABLED === "true"/);
  assert.match(runner, /WHATSAPP_AI_ENABLED === "true"/);
  assert.match(runner, /VERCEL_ENV === "preview"/);
  assert.match(runner, /reserve_whatsapp_ai_request/);
  assert.match(runner, /claim_whatsapp_incoming/);
  assert.match(runner, /complete_whatsapp_incoming/);
  assert.match(runner, /release_whatsapp_incoming/);
  assert.match(runner, /processWhatsappPublishMessage/);
  assert.match(runner, /if \(next\.publish\)/);
  assert.match(flow, /upper !== "PUBLICAR"/);
  assert.match(flow, /isValidWhatsappDraft\(draft, state\.draftPhotoPath\)/);
  assert.match(flow, /state\.step === "review"/);
  assert.match(flow, /price > 0 && draft\.price <= 10000/);
  assert.match(publisher, /isValidWhatsappDraft\(draft, privatePath\)/);
  assert.match(publisher, /whatsapp-main/);
  assert.match(publisher, /"listing_photos"/);
  assert.match(migration, /whatsapp-draft-photos', false/);
  assert.match(migration, /whatsapp_ai_daily_usage/);
  assert.match(migration, /v_total >= 100/);
  assert.match(migration, /coalesce\(v_current,0\) >= 5/);
  assert.match(vision, /"gpt-5\.6-luna"/);
  assert.match(vision, /detail: "low"/);
  assert.match(vision, /store: false/);
  assert.match(vision, /redirect: "error"/);
  assert.match(vision, /MAX_PHOTO = 3 \* 1024 \* 1024/);
  assert.doesNotMatch(flow, /setPrice\(|setSelectedCondition\(/);
});
