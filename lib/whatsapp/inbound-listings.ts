import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsappDraft, WhatsappState } from "@/lib/whatsapp/conversation";
import { downloadWhatsappPhoto, sendWhatsappPilotMessage } from "@/lib/whatsapp/vision-and-meta";
import { isWhatsappPilotConfigured, isWhatsappPilotUserAllowed } from "@/lib/whatsapp/pilot";

type IncomingMessage = {
  id?: unknown;
  from?: unknown;
  timestamp?: unknown;
  type?: unknown;
  text?: { body?: unknown };
  image?: { id?: unknown };
};

function publishEnabled() {
  return isWhatsappPilotConfigured() &&
    process.env.WHATSAPP_PUBLISH_ENABLED === "true" &&
    process.env.VERCEL_ENV === "preview";
}

function extractState(session: any): WhatsappState {
  const step = session?.step;
  const valid = step === "idle" || step === "review_photo" ||
                step === "form" || step === "published";
  return {
    step: valid ? step : "idle",
    payload: session?.payload && typeof session.payload === "object" &&
      !Array.isArray(session.payload) ? session.payload as WhatsappDraft : {},
    draftPhotoPath: typeof session?.draft_photo_path === "string" ? session.draft_photo_path : null,
  };
}

async function discardPhoto(path: string | null) {
  if (!path) return;
  const { error } = await createAdminClient().storage
    .from("whatsapp-draft-photos").remove([path]);
  if (error) console.error("WhatsApp pilot: private photo cleanup failed");
}

export async function processWhatsappPublishMessage(
  message: IncomingMessage
): Promise<"ignored" | "handled" | "busy"> {
  if (!publishEnabled()) return "ignored";
  const sender = message.from;
  const messageId = message.id;
  if (typeof sender !== "string" || !/^[0-9]{8,20}$/.test(sender) ||
      typeof messageId !== "string" ||
      !/^wamid\.[A-Za-z0-9_.+\/=\-]{6,240}$/.test(messageId)) return "ignored";

  const timestamp = Number(message.timestamp);
  if (!Number.isFinite(timestamp) ||
      timestamp * 1000 < Date.now() - 23 * 3600_000 ||
      timestamp * 1000 > Date.now() + 120_000) return "ignored";

  const admin = createAdminClient();
  const { data: linked, error: lookupError } = await admin
    .from("whatsapp_account_links").select("user_id")
    .eq("wa_id", sender).maybeSingle();
  if (lookupError) throw new Error("WhatsApp identity lookup failed");
  const userId = linked?.user_id;
  if (!userId || !isWhatsappPilotUserAllowed(userId)) return "ignored";

  const leaseId = randomUUID();
  const { data: claim, error: claimError } = await admin.rpc("claim_whatsapp_incoming", {
    p_user_id: userId, p_message_id: messageId, p_lease_id: leaseId,
  });
  if (claimError) throw new Error("WhatsApp inbound claim failed");
  if (claim === "duplicate") return "handled";
  if (claim === "busy") return "busy";
  if (claim !== "claimed") return "ignored";

  let oldPhotoToDiscard: string | null = null;
  let uploadedPhotoToDiscardOnFailure: string | null = null;
  try {
    const { data: session, error: sessionError } = await admin
      .from("whatsapp_listing_sessions")
      .select("step,payload,draft_photo_path,last_message_at")
      .eq("user_id", userId).single();
    if (sessionError || !session) throw new Error("WhatsApp session lookup failed");

    let state = extractState(session);
    const stale = Date.now() - new Date(session.last_message_at).getTime() > 24 * 3600_000;
    if (stale) {
      oldPhotoToDiscard = state.draftPhotoPath;
      state = { step: "idle", payload: {}, draftPhotoPath: null };
    }

    let reply = "";
    if (message.type === "image" && typeof message.image?.id === "string") {
      // Critical privacy guarantee: original photo is never sent to OpenAI.
      const photo = await downloadWhatsappPhoto(message.image.id);
      const hash = createHash("sha256").update(messageId).digest("hex");
      const path = `${userId}/${hash}.${photo.extension}`;
      const { error: uploadError } = await admin.storage
        .from("whatsapp-draft-photos")
        .upload(path, photo.bytes, { contentType: photo.mime, upsert: true });
      if (uploadError) throw new Error("Private photo upload failed");
      uploadedPhotoToDiscardOnFailure = path;
      if (!oldPhotoToDiscard) oldPhotoToDiscard = state.draftPhotoPath;
      const listingId = randomUUID();
      state = { step: "review_photo", payload: { listingId }, draftPhotoPath: path };
      const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
      if (!origin) throw new Error("Preview origin is missing");
      reply = [
        "📸 Fotografía recibida.",
        "Por privacidad, revisa primero la imagen en Wetudy. Tapa nombres, rostros o etiquetas antes de continuar.",
        "La IA no recibirá la foto hasta que autorices el análisis de la imagen revisada.",
        `${origin}/account/whatsapp/draft?draft=${listingId}`,
        "Puedes responder CANCELAR para descartar.",
      ].join("\n");
    } else if (message.type === "text" && typeof message.text?.body === "string") {
      const command = message.text.body.trim().toLocaleUpperCase("es-ES");
      if (command === "CANCELAR") {
        oldPhotoToDiscard = state.draftPhotoPath;
        state = { step: "idle", payload: {}, draftPhotoPath: null };
        reply = "Borrador descartado. Envía otra foto cuando quieras.";
      } else if ((state.step === "review_photo" || state.step === "form") &&
                 state.payload.listingId) {
        const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
        reply = `Tu borrador es privado y se revisa en Wetudy: ${origin}/account/whatsapp/draft?draft=${state.payload.listingId}\nPara descartarlo responde CANCELAR.`;
      } else {
        reply = "Solo puedo ayudarte a preparar anuncios enviando fotos. No soy un chat general de IA.";
      }
    } else {
      reply = "Envíame una foto JPG, PNG o WEBP para crear un anuncio. Evita datos personales.";
    }

    const { data: completed, error: completionError } = await admin.rpc("complete_whatsapp_incoming", {
      p_user_id: userId,
      p_message_id: messageId,
      p_lease_id: leaseId,
      p_step: state.step,
      p_payload: state.payload,
      p_photo_path: state.draftPhotoPath,
    });
    if (completionError || completed !== true) {
      if (uploadedPhotoToDiscardOnFailure) await discardPhoto(uploadedPhotoToDiscardOnFailure);
      throw new Error("WhatsApp state transition failed");
    }
    uploadedPhotoToDiscardOnFailure = null;
    if (oldPhotoToDiscard && oldPhotoToDiscard !== state.draftPhotoPath) {
      await discardPhoto(oldPhotoToDiscard);
    }
    try { await sendWhatsappPilotMessage(sender, reply); }
    catch { console.error("WhatsApp pilot: outbound reply failed after commit"); }
    return "handled";
  } finally {
    await admin.rpc("release_whatsapp_incoming", {
      p_user_id: userId, p_lease_id: leaseId,
    }).catch(() => undefined);
  }
}
