import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createWhatsappLinkToken,
  hashWhatsappLinkToken,
  isSameOriginPost,
  isWhatsappPilotConfigured,
  isWhatsappPilotEnabled,
  isWhatsappPilotUserAllowed,
} from "@/lib/whatsapp/pilot";

export const dynamic = "force-dynamic";

async function requirePilotUser(allowUnlink = false) {
  if (!isWhatsappPilotEnabled()) return { error: "not_found" as const, status: 404 };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" as const, status: 401 };
  if (!user.email_confirmed_at) return { error: "email_not_confirmed" as const, status: 403 };
  if (!allowUnlink && !isWhatsappPilotUserAllowed(user.id)) {
    return { error: "not_found" as const, status: 404 };
  }
  return { user };
}

function failure(status: number) {
  const message = status === 401
    ? "Inicia sesión para continuar."
    : status === 403
      ? "Debes confirmar tu email."
      : status === 404
        ? "Función no disponible."
        : "No se pudo procesar la solicitud.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const result = await requirePilotUser();
  if (!("user" in result) || !result.user) return failure(result.status ?? 404);
  if (!isWhatsappPilotConfigured()) return failure(503);

  const { data, error } = await createAdminClient()
    .from("whatsapp_account_links")
    .select("linked_at")
    .eq("user_id", result.user.id)
    .maybeSingle();

  if (error) {
    console.error("WhatsApp pilot: error reading link status");
    return failure(503);
  }
  return NextResponse.json(
    { linked: Boolean(data), linkedAt: data?.linked_at || null },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return failure(403);
  const result = await requirePilotUser();
  if (!("user" in result) || !result.user) return failure(result.status ?? 404);
  if (!isWhatsappPilotConfigured()) return failure(503);

  const body = await request.json().catch(() => null);
  if (body?.consent !== true) return failure(400);
  const admin = createAdminClient();

  const { data: existingLink, error: linkError } = await admin
    .from("whatsapp_account_links")
    .select("linked_at")
    .eq("user_id", result.user.id)
    .maybeSingle();
  if (linkError) return failure(503);
  if (existingLink) return NextResponse.json(
    { linked: true, linkedAt: existingLink.linked_at },
    { headers: { "Cache-Control": "no-store" } }
  );

  const { data: pending, error: pendingError } = await admin
    .from("whatsapp_link_requests")
    .select("created_at, consumed_at")
    .eq("user_id", result.user.id)
    .maybeSingle();
  if (pendingError) return failure(503);
  // A hard one-minute cooldown protects the authenticated endpoint from spam
  // and repeated token generation.
  if (pending && Date.now() - new Date(pending.created_at).getTime() < 60_000) {
    return NextResponse.json(
      { error: "Espera un minuto antes de generar otro enlace." },
      { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }
    );
  }

  const token = createWhatsappLinkToken();
  const now = Date.now();
  const { error } = await admin
    .from("whatsapp_link_requests")
    .upsert({
      user_id: result.user.id,
      token_hash: hashWhatsappLinkToken(token),
      expires_at: new Date(now + 10 * 60_000).toISOString(),
      created_at: new Date(now).toISOString(),
      consumed_at: null,
    }, { onConflict: "user_id" });
  if (error) {
    console.error("WhatsApp pilot: error creating link request");
    return failure(503);
  }

  const message = `VINCULAR WETUDY ${token}`;
  const number = process.env.WHATSAPP_BUSINESS_NUMBER!;
  return NextResponse.json(
    { linked: false, url: `https://wa.me/${number}?text=${encodeURIComponent(message)}`, expiresInSeconds: 600 },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(request: Request) {
  if (!isSameOriginPost(request)) return failure(403);
  // Unlink is permitted even if a pilot account is no longer on the allowlist.
  const result = await requirePilotUser(true);
  if (!("user" in result) || !result.user) return failure(result.status ?? 404);

  const admin = createAdminClient();
  const { error: linkError } = await admin
    .from("whatsapp_account_links")
    .delete().eq("user_id", result.user.id);
  if (linkError) return failure(503);

  const { error: tokenError } = await admin
    .from("whatsapp_link_requests")
    .delete().eq("user_id", result.user.id);
  if (tokenError) return failure(503);

  return NextResponse.json({ linked: false }, { headers: { "Cache-Control": "no-store" } });
}
