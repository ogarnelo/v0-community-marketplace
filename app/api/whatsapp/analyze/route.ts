import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginPost, isWhatsappPilotConfigured, isWhatsappPilotUserAllowed } from "@/lib/whatsapp/pilot";
import { startWhatsappListing } from "@/lib/whatsapp/conversation";
import { suggestWhatsappListing, type WhatsappPhoto } from "@/lib/whatsapp/vision-and-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const MAX_BYTES = 3 * 1024 * 1024;
const noStore = { "Cache-Control": "no-store" };
const errorResponse = (status: number, error: string) => NextResponse.json({ error }, { status, headers: noStore });

export async function POST(request: Request) {
  if (!isWhatsappPilotConfigured() ||
      process.env.WHATSAPP_PUBLISH_ENABLED !== "true" ||
      process.env.WHATSAPP_AI_ENABLED !== "true" ||
      !process.env.OPENAI_API_KEY ||
      process.env.VERCEL_ENV !== "preview") return errorResponse(404, "No disponible");
  if (!isSameOriginPost(request)) return errorResponse(403, "Origen no permitido.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return errorResponse(415, "Formato de petición no admitido.");
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BYTES + 32_000) return errorResponse(413, "Fotografía demasiado grande.");

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !user.email_confirmed_at || !isWhatsappPilotUserAllowed(user.id)) {
    return errorResponse(403, "Inicia sesión en la cuenta vinculada al WhatsApp.");
  }
  const admin = createAdminClient();
  const { data: linked, error: linkError } = await admin
    .from("whatsapp_account_links").select("user_id")
    .eq("user_id", user.id).maybeSingle();
  if (linkError || !linked) return errorResponse(403, "WhatsApp no vinculado.");

  const data = await request.formData().catch(() => null);
  const draftId = data?.get("draftId");
  const privacyConfirmed = data?.get("privacyConfirmed");
  const file = data?.get("photo");
  if (typeof draftId !== "string" || !UUID.test(draftId) ||
      privacyConfirmed !== "yes" ||
      !(file instanceof File) ||
      file.type !== "image/jpeg" || file.size < 100 || file.size > MAX_BYTES) {
    return errorResponse(400, "Revisa y confirma la fotografía antes de continuar.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff ||
      bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return errorResponse(415, "El fichero no es una fotografía JPEG válida.");
  }

  const leaseId = randomUUID();
  const { data: claim, error: claimError } = await admin.rpc("claim_whatsapp_form", {
    p_user_id: user.id, p_listing_id: draftId, p_lease_id: leaseId,
  });
  if (claimError || claim !== "claimed") {
    return errorResponse(claim === "busy" ? 409 : 404,
      claim === "busy" ? "La foto ya se está analizando." : "Borrador no disponible.");
  }

  try {
    const { data: session, error: sessionError } = await admin
      .from("whatsapp_listing_sessions")
      .select("step,payload,draft_photo_path,updated_at")
      .eq("user_id", user.id).eq("lease_id", leaseId).maybeSingle();
    if (sessionError || !session || session.step !== "review_photo" ||
        session.payload?.listingId !== draftId ||
        typeof session.draft_photo_path !== "string" ||
        !session.draft_photo_path.startsWith(`${user.id}/`) ||
        Date.now() - new Date(session.updated_at).getTime() > 24 * 3600_000) {
      return errorResponse(404, "Borrador o revisión no disponibles.");
    }

    // Limit paid provider calls only after the owner approves the cleaned image.
    const { data: allowed, error: quotaError } = await admin.rpc("reserve_whatsapp_ai_request", {
      p_user_id: user.id,
    });
    if (quotaError || allowed !== true) {
      return errorResponse(429, "Has llegado al límite de análisis del piloto.");
    }

    // The server only sends this re-encoded, user-reviewed image to OpenAI.
    // Raw Meta bytes never enter the OpenAI request.
    const sanitized: WhatsappPhoto = { bytes, mime: "image/jpeg", extension: "jpg" };
    const suggestion = await suggestWhatsappListing(sanitized);
    const safePath = `${user.id}/${draftId}-revisada.jpg`;
    const { error: uploadError } = await admin.storage
      .from("whatsapp-draft-photos")
      .upload(safePath, bytes, { contentType: "image/jpeg", upsert: true });
    if (uploadError) return errorResponse(503, "No se pudo guardar la foto revisada.");

    // Register original for deletion BEFORE committing the state transition.
    // If cleanup fails, the scheduler can still remove these bytes.
    const { error: queueError } = await admin
      .from("whatsapp_pending_deletions")
      .upsert({ user_id: user.id, photo_path: session.draft_photo_path },
              { onConflict: "photo_path" });
    if (queueError) {
      await admin.storage.from("whatsapp-draft-photos").remove([safePath]);
      return errorResponse(503, "No se pudo registrar la eliminación segura de la fotografía.");
    }
    const prepared = startWhatsappListing(draftId, safePath, suggestion);
    const { data: complete, error: completeError } = await admin.rpc("complete_whatsapp_form", {
      p_user_id: user.id,
      p_listing_id: draftId,
      p_lease_id: leaseId,
      p_action: "analyze",
      p_payload: prepared.state.payload,
      p_photo_path: safePath,
    });
    if (completeError || complete !== true) {
      // Keep raw original and drop any newly prepared safe media on failure.
      await admin.storage.from("whatsapp-draft-photos").remove([safePath]);
      await admin.from("whatsapp_pending_deletions").delete()
        .eq("photo_path", session.draft_photo_path).eq("user_id", user.id);
      return errorResponse(409, "La revisión ha caducado. Vuelve a abrir el enlace.");
    }

    // Remove the original WhatsApp photo once a sanitized copy was committed.
    const { error: removalError } = await admin.storage
      .from("whatsapp-draft-photos").remove([session.draft_photo_path]);
    if (removalError) {
      console.error("WhatsApp privacy: original photo deletion deferred to private retention queue");
    } else {
      await admin.from("whatsapp_pending_deletions").delete()
        .eq("photo_path", session.draft_photo_path).eq("user_id", user.id);
    }

    return NextResponse.json({ step: "form", draft: prepared.state.payload }, { headers: noStore });
  } catch {
    console.error("WhatsApp privacy: private image analysis could not complete");
    return errorResponse(503, "No se pudo analizar la fotografía. Comprueba la imagen y vuelve a intentarlo.");
  } finally {
    await admin.rpc("release_whatsapp_form", {
      p_user_id: user.id, p_lease_id: leaseId,
    }).catch(() => undefined);
  }
}
