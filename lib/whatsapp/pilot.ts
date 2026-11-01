import { createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
const WHATSAPP_ID_PATTERN = /^[0-9]{8,20}$/;

export function isWhatsappPilotEnabled() {
  return process.env.WHATSAPP_PILOT_ENABLED === "true";
}

export function isWhatsappPilotUserAllowed(userId: string) {
  const allowed = (process.env.WHATSAPP_PILOT_ALLOWED_USER_IDS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return ID_PATTERN.test(userId) && allowed.includes(userId.toLowerCase());
}

export function isWhatsappPilotConfigured() {
  return (
    isWhatsappPilotEnabled() &&
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
