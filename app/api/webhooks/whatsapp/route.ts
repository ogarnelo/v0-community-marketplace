import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWhatsappPublishMessage } from "@/lib/whatsapp/inbound-listings";
import {
  hashWhatsappLinkToken,
  isValidLinkMessage,
  isValidWhatsappId,
  isWhatsappPilotConfigured,
  verifyWhatsappSignature,
} from "@/lib/whatsapp/pilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_WEBHOOK_BYTES = 128 * 1024;

export async function GET(request: Request) {
  if (!isWhatsappPilotConfigured()) return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  if (
    query.get("hub.mode") !== "subscribe" ||
    query.get("hub.verify_token") !== process.env.WHATSAPP_VERIFY_TOKEN
  ) return new Response(null, { status: 403 });

  const challenge = query.get("hub.challenge");
  if (!challenge || challenge.length > 256) return new Response(null, { status: 400 });
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

async function replyToLinkSuccess(to: string) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const configuredVersion = process.env.WHATSAPP_GRAPH_VERSION || "v24.0";
  const version = /^v\d+\.\d+$/.test(configuredVersion) ? configuredVersion : "v24.0";
  if (!phoneId || !token) return;
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body: "Hemos reconocido tu WhatsApp. Para completar la vinculación, vuelve a tu cuenta de Wetudy y confirma los últimos cuatro dígitos de tu número. Todavía no está vinculado." },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.error("WhatsApp pilot: could not deliver linking confirmation");
  } catch {
    console.error("WhatsApp pilot: linking confirmation request failed");
  }
}

export async function POST(request: Request) {
  if (!isWhatsappPilotConfigured()) return new Response(null, { status: 404 });
  const declaredSize = Number(request.headers.get("content-length") || "0");
  if (declaredSize > MAX_WEBHOOK_BYTES) return new Response(null, { status: 413 });

  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.byteLength > MAX_WEBHOOK_BYTES) return new Response(null, { status: 413 });
  if (!verifyWhatsappSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response(null, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw.toString("utf8")); } catch {
    return new Response(null, { status: 400 });
  }
  if (event?.object !== "whatsapp_business_account") return new Response(null, { status: 200 });

  const admin = createAdminClient();
  for (const entry of (Array.isArray(event.entry) ? event.entry : []).slice(0, 5)) {
    for (const change of (Array.isArray(entry?.changes) ? entry.changes : []).slice(0, 5)) {
      const value = change?.value;
      if (value?.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
      for (const message of (Array.isArray(value.messages) ? value.messages : []).slice(0, 10)) {
        const sender = message?.from;
        const body = message?.type === "text" ? message?.text?.body : null;
        if (!isValidWhatsappId(sender)) continue;

        if (isValidLinkMessage(body)) {
          const token = body.trim().slice("VINCULAR WETUDY ".length);
          const { data, error } = await admin.rpc("link_whatsapp_account_from_token", {
            p_token_hash: hashWhatsappLinkToken(token),
            p_wa_id: sender,
          });
          if (error) {
            console.error("WhatsApp pilot: atomic link operation failed");
            return new Response(null, { status: 503 });
          }
          if (data === "pending_confirmation") await replyToLinkSuccess(sender);
          continue;
        }

        try {
          const outcome = await processWhatsappPublishMessage(message);
          if (outcome === "busy") return new Response(null, { status: 503 });
        } catch {
          console.error("WhatsApp pilot: inbound publishing step failed");
          return new Response(null, { status: 503 });
        }
      }
    }
  }
  // Messages from unlinked numbers are ignored; the optional publishing flow is gated.
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
