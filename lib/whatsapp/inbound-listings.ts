import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  advanceWhatsappListing, startWhatsappListing,
  type WhatsappDraft, type WhatsappState, type WhatsappStep,
} from "@/lib/whatsapp/conversation";
import { downloadWhatsappPhoto, sendWhatsappPilotMessage, suggestWhatsappListing } from "@/lib/whatsapp/vision-and-meta";
import { publishWhatsappConfirmedListing } from "@/lib/whatsapp/publish";
import { isWhatsappPilotUserAllowed } from "@/lib/whatsapp/pilot";

type IncomingMessage = {
  id?: unknown;
  from?: unknown;
  timestamp?: unknown;
  type?: unknown;
  text?: { body?: unknown };
  image?: { id?: unknown };
};

function publishEnabled() {
  return process.env.WHATSAPP_PUBLISH_ENABLED === "true" &&
    process.env.WHATSAPP_AI_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY) &&
    process.env.VERCEL_ENV === "preview";
}

function extractState(value: any): WhatsappState {
  const steps: WhatsappStep[] = ["idle", "title", "description", "condition", "intent", "price", "grade", "review", "published"];
  const payload = value?.payload && typeof value.payload === "object" && !Array.isArray(value.payload)
    ? value.payload as WhatsappDraft : {};
  return {
    step: steps.includes(value?.step) ? value.step : "idle",
    payload,
    draftPhotoPath: typeof value?.draft_photo_path === "string" ? value.draft_photo_path : null,
  };
}

async function discardPhoto(path: string | null) {
  if (!path) return;
  const { error } = await createAdminClient().storage.from("whatsapp-draft-photos").remove([path]);
  if (error) console.error("WhatsApp pilot: could not clean private draft photo");
}

export async function processWhatsappPublishMessage(message: IncomingMessage): Promise<"ignored" | "handled" | "busy"> {
  if (!publishEnabled()) return "ignored";

  const sender = message.from;
  const messageId = message.id;
  if (typeof sender !== "string" || !/^[0-9]{8,20}$/.test(sender) ||
      typeof messageId !== "string" || !/^wamid\.[A-Za-z0-9_.+\/=-]{6,240}$/.test(messageId)) {
    return "ignored";
  }

  // Reject delayed messages: never send freeform messages outside the user-initiated 24-hour window.
  const timestamp = Number(message.timestamp);
  if (!Number.isFinite(timestamp) ||
      timestamp * 1000 < Date.now() - 23 * 3600_000 ||
      timestamp * 1000 > Date.now() + 120_000) return "ignored";

  const admin = createAdminClient();
  const { data: linked, error: linkedError } = await admin
    .from("whatsapp_account_links").select("user_id").eq("wa_id", sender).maybeSingle();
  if (linkedError) throw new Error("WhatsApp link lookup failed");
  const userId = linked?.user_id;
  if (!userId || !isWhatsappPilotUserAllowed(userId)) return "ignored";

  const leaseId = randomUUID();
  const { data: claim, error: claimError } = await admin.rpc("claim_whatsapp_incoming", {
    p_user_id: userId, p_message_id: messageId, p_lease_id: leaseId,
  });
  if (claimError) throw new Error("WhatsApp inbound reservation failed");
  if (claim === "duplicate") return "handled";
  if (claim === "busy") return "busy";
  if (claim !== "claimed") return "ignored";

  let oldPhotoToDiscard: string | null = null;
  let reply = "";
  try {
    const { data: session, error: sessionError } = await admin
      .from("whatsapp_listing_sessions")
      .select("step,payload,draft_photo_path,last_message_at")
      .eq("user_id", userId).single();
    if (sessionError || !session) throw new Error("WhatsApp draft lookup failed");

    let state = extractState(session);
    const stale = Date.now() - new Date(session.last_message_at).getTime() > 24 * 3600_000;
    if (stale) {
      oldPhotoToDiscard = state.draftPhotoPath;
      state = { step: "idle", payload: {}, draftPhotoPath: null };
    }

    if (message.type === "image" && typeof message.image?.id === "string") {
      const { data: reserved, error: quotaError } = await admin.rpc("reserve_whatsapp_ai_request", {
        p_user_id: userId,
      });
      if (quotaError) throw new Error("WhatsApp IA quota failed");
      if (reserved !== true) {
        reply = "Has alcanzado el límite de 5 análisis de fotos por día del piloto. Puedes intentarlo mañana.";
      } else {
        // Meta media ID is not a URL and cannot choose an arbitrary server.
        const photo = await downloadWhatsappPhoto(message.image.id);
        const suggestion = await suggestWhatsappListing(photo);
        const hashedMessageId = createHash("sha256").update(messageId).digest("hex");
        const privatePath = `${userId}/${hashedMessageId}.${photo.extension}`;
        const { error: uploadError } = await admin.storage.from("whatsapp-draft-photos")
          .upload(privatePath, photo.bytes, { contentType: photo.mime, upsert: true });
        if (uploadError) throw new Error("Could not store private WhatsApp draft photo");
        if (!oldPhotoToDiscard) oldPhotoToDiscard = state.draftPhotoPath;
        const next = startWhatsappListing(randomUUID(), privatePath, suggestion);
        state = next.state;
        reply = next.response;
      }
    } else if (message.type === "text" && typeof message.text?.body === "string") {
      const next = advanceWhatsappListing(state, message.text.body);
      if (next.publish) {
        // The only publish path: an explicit, verified 'PUBLICAR' reply in review state.
        const publishedId = await publishWhatsappConfirmedListing(
          userId, state.payload, state.draftPhotoPath
        );
        oldPhotoToDiscard = state.draftPhotoPath;
        state = { step: "published", payload: { listingId: publishedId }, draftPhotoPath: null };
        const previewOrigin = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "https://www.wetudy.com";
        reply = `✅ Anuncio publicado tras tu confirmación. Puedes verlo en ${previewOrigin}/marketplace/listing/${publishedId}\n\nEnvíame otra foto para publicar más material.`;
      } else {
        state = next.state;
        reply = next.response;
        if (next.cleanup) oldPhotoToDiscard = session.draft_photo_path;
      }
    } else {
      reply = "En este piloto puedo preparar anuncios con una fotografía y tus respuestas de texto. Envíame una foto JPG o PNG.";
    }

    const { data: completed, error: completionError } = await admin.rpc("complete_whatsapp_incoming", {
      p_user_id: userId,
      p_message_id: messageId,
      p_lease_id: leaseId,
      p_step: state.step,
      p_payload: state.payload,
      p_photo_path: state.draftPhotoPath,
    });
    if (completionError || completed !== true) throw new Error("Could not save WhatsApp draft transition");

    if (oldPhotoToDiscard && oldPhotoToDiscard !== state.draftPhotoPath) {
      await discardPhoto(oldPhotoToDiscard);
    }
    // Do not revert a completed state if the outbound message fails.
    try {
      await sendWhatsappPilotMessage(sender, reply);
    } catch {
      console.error("WhatsApp pilot: outbound answer failed after state commit");
    }
    return "handled";
  } finally {
    await admin.rpc("release_whatsapp_incoming", {
      p_user_id: userId, p_lease_id: leaseId,
    }).catch(() => undefined);
  }
}
