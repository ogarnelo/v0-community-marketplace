import { createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

const ID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const WHATSAPP_ID_PATTERN = /^[0-9]{8,20}$/;

export function isWhatsappPilotEnabled() {
  return (
    process.env.WHATSAPP_PILOT_ENABLED === "true" &&
    (process.env.VERCEL_ENV === "preview" ||
      (process.env.NODE_ENV === "development" && !process.env.VERCEL_ENV))
  );
}

export function isWhatsappPilotUserAllowed(userId: string) {
  const allowed = (process.env.WHATSAPP_PILOT_ALLOWED_USER_IDS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return ID_PATTERN.test(userId) && allowed.includes(userId.toLowerCase());
}

// Fail closed: a Preview deployment must explicitly use a distinct test
// Supabase project. This prevents accidental writes to Wetudy production even
// if the developer configures all Meta tokens in Preview.
export function isWhatsappPilotSandboxSafe() {
  const testRef = (process.env.WHATSAPP_PILOT_SUPABASE_PROJECT_REF || "").trim();
  const productionRef = (process.env.WHATSAPP_PRODUCTION_SUPABASE_PROJECT_REF || "jpsljmakoscqevssimtk").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!/^[a-z0-9]{20}$/.test(testRef) || !productionRef ||
      testRef === productionRef || !url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === `${testRef}.supabase.co`;
  } catch {
    return false;
  }
}

export function isWhatsappPilotConfigured() {
  return (
    isWhatsappPilotEnabled() &&
    isWhatsappPilotSandboxSafe() &&
    Boolean(
      process.env.WHATSAPP_BUSINESS_NUMBER?.match(WHATSAPP_ID_PATTERN) &&
      process.env.WHATSAPP_VERIFY_TOKEN &&
      process.env.WHATSAPP_APP_SECRET &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.match(WHATSAPP_ID_PATTERN) &&
      process.env.WHATSAPP_ACCESS_TOKEN
    )
  );
}

export function createWhatsappLinkToken() {
  return randomBytes(32).toString("base64url");
}

export function hashWhatsappLinkToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidWhatsappId(value: unknown): value is string {
  return typeof value === "string" && WHATSAPP_ID_PATTERN.test(value);
}

export function isValidLinkMessage(text: unknown): text is string {
  return typeof text === "string" && /^VINCULAR WETUDY [A-Za-z0-9_-]{43}$/.test(text.trim());
}

export function verifyWhatsappSignature(body: Buffer, supplied: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !supplied || !/^sha256=[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const received = supplied.slice(7).toLowerCase();
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export function isSameOriginPost(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
