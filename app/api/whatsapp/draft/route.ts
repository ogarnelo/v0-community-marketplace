import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginPost, isWhatsappPilotConfigured, isWhatsappPilotUserAllowed } from "@/lib/whatsapp/pilot";
import { normalizeWhatsappForm } from "@/lib/whatsapp/form";
import { publishWhatsappConfirmedListing } from "@/lib/whatsapp/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const draftIdPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

function pilotReady() {
  return isWhatsappPilotConfigured() &&
    process.env.WHATSAPP_PUBLISH_ENABLED === "true" &&
    process.env.WHATSAPP_AI_ENABLED === "true" &&
    process.env.VERCEL_ENV === "preview";
}

function failed(status: number, error: string, fields?: Record<string, string>) {
  return NextResponse.json({ error, ...(fields ? { fields } : {}) }, { status, headers: noStore });
}

async function authorizedOwner() {
  if (!pilotReady()) return { status: 404 as const };
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { status: 401 as const };
  if (!user.email_confirmed_at || !isWhatsappPilotUserAllowed(user.id)) return { status: 404 as const };
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin
    .from("whatsapp_account_links").select("user_id").eq("user_id", user.id).maybeSingle();
  if (linkError) return { status: 503 as const };
  if (!link) return { status: 403 as const };
  return { user, admin };
}

async function findDraft(admin: ReturnType<typeof createAdminClient>, userId: string, draftId: string) {
  const { data: session, error } = await admin
    .from("whatsapp_listing_sessions")
    .select("step,payload,draft_photo_path,updated_at,in_flight_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { error: "No se pudo consultar el borrador." };
  if (!session || !["review_photo", "form"].includes(session.step) ||
      session.payload?.listingId !== draftId ||
      typeof session.draft_photo_path !== "string" ||
      !session.draft_photo_path.startsWith(`${userId}/`)) return { error: "Borrador no disponible." };
  if (Date.now() - new Date(session.updated_at).getTime() > 24 * 60 * 60_000) {
    return { error: "Este borrador ha caducado. Envía otra fotografía desde WhatsApp." };
  }
  if (session.in_flight_until && new Date(session.in_flight_until).getTime() > Date.now()) {
    return { error: "El borrador se está procesando. Vuelve a intentarlo." };
  }
  return { session };
}

export async function GET(request: Request) {
  const owner = await authorizedOwner();
  if (!("user" in owner) || !owner.user || !("admin" in owner) || !owner.admin) {
    return failed(owner.status || 404, "Inicia sesión con la cuenta de Wetudy vinculada al WhatsApp.");
  }
  const draftId = new URL(request.url).searchParams.get("draft") || "";
  if (!draftIdPattern.test(draftId)) return failed(400, "Identificador de borrador incorrecto.");
  const result = await findDraft(owner.admin, owner.user.id, draftId);
  if (!result.session) return failed(404, result.error || "Borrador no disponible.");
  return NextResponse.json({
    step: result.session.step,
    draft: result.session.payload,
    // This photo is served by a same-origin authenticated endpoint, not via
    // a bearer-style signed storage URL that could leak from browser history.
    photoUrl: `/api/whatsapp/photo?draft=${draftId}`,
  }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!isSameOriginPost(request)) return failed(403, "Petición no permitida.");
  if (Number(request.headers.get("content-length") || 0) > 16000) {
    return failed(413, "El formulario es demasiado grande.");
  }
  const owner = await authorizedOwner();
  if (!("user" in owner) || !owner.user || !("admin" in owner) || !owner.admin) {
    return failed(owner.status || 404, "Inicia sesión con tu cuenta Wetudy vinculada.");
  }
  const body = await request.json().catch(() => null);
  const draftId = typeof body?.draftId === "string" ? body.draftId : "";
  if (!draftIdPattern.test(draftId) ||
      !["save", "publish"].includes(body?.action) ||
      !body?.draft || typeof body.draft !== "object" || Array.isArray(body.draft)) {
    return failed(400, "Formulario inválido.");
  }
  const found = await findDraft(owner.admin, owner.user.id, draftId);
  if (!found.session) return failed(404, found.error || "Borrador no disponible.");

  const leaseId = randomUUID();
  const { data: claim, error: claimError } = await owner.admin.rpc("claim_whatsapp_form", {
    p_user_id: owner.user.id,
    p_listing_id: draftId,
    p_lease_id: leaseId,
  });
  if (claimError) return failed(503, "No se pudo bloquear el borrador.");
  if (claim === "already_published") {
    return body.action === "publish"
      ? NextResponse.json({
          published: true,
          listingId: draftId,
          url: `/marketplace/listing/${draftId}`,
        }, { headers: noStore })
      : failed(409, "Este anuncio ya está publicado.");
  }
  if (claim !== "claimed") {
    return failed(claim === "busy" ? 409 : 404,
      claim === "busy" ? "El borrador se está procesando. Espera y vuelve a intentarlo." :
      "El borrador ya no está disponible.");
  }

  try {
    const { data: current, error: currentError } = await owner.admin
      .from("whatsapp_listing_sessions")
      .select("step,draft_photo_path,payload")
      .eq("user_id", owner.user.id).eq("lease_id", leaseId)
      .eq("step", "form").maybeSingle();
    if (currentError || !current || current.step !== "form" || current.payload?.listingId !== draftId) {
      return failed(409, "El borrador ha cambiado. Recarga la página.");
    }
    const photoPath = current.draft_photo_path as string | null;
    const { draft, errors } = normalizeWhatsappForm(body.draft, draftId, photoPath);
    if (body.action === "publish" && Object.keys(errors).length > 0) {
      return failed(422, "Completa los campos obligatorios.", errors);
    }

    if (body.action === "publish") {
      // The user explicitly pressed Confirmar y publicar. All remote writes
      // happen under a per-user SQL lease; retry uses the stable listing UUID.
      const listingId = await publishWhatsappConfirmedListing(
        owner.user.id, draft, photoPath
      ).catch(() => null);
      if (!listingId) return failed(503, "No se pudo publicar. Revisa y vuelve a intentarlo.");

      const { data: completed, error: completeError } = await owner.admin.rpc("complete_whatsapp_form", {
        p_user_id: owner.user.id,
        p_listing_id: draftId,
        p_lease_id: leaseId,
        p_action: "publish",
        p_payload: { listingId },
      });
      if (completeError || completed !== true) {
        return failed(409, "El anuncio puede estar publicado. Comprueba tu cuenta antes de reintentar.");
      }
      if (photoPath) {
        const { error: removalError } = await owner.admin.storage
          .from("whatsapp-draft-photos").remove([photoPath]);
        if (removalError) console.error("WhatsApp form: could not remove private draft photo");
      }
      return NextResponse.json({
        published: true,
        listingId,
        url: `/marketplace/listing/${listingId}`,
      }, { headers: noStore });
    }

    // An incomplete draft is allowed; only the final publish requires all
    // obligatory fields to be valid.
    const { data: saved, error: saveError } = await owner.admin.rpc("complete_whatsapp_form", {
      p_user_id: owner.user.id,
      p_listing_id: draftId,
      p_lease_id: leaseId,
      p_action: "save",
      p_payload: draft,
    });
    if (saveError || saved !== true) return failed(409, "No se pudo guardar. Vuelve a intentarlo.");
    return NextResponse.json({ saved: true, draft }, { headers: noStore });
  } finally {
    // If a validation or external service fails, the next attempt is free to retry.
    await owner.admin.rpc("release_whatsapp_form", {
      p_user_id: owner.user.id,
      p_lease_id: leaseId,
    }).catch(() => undefined);
  }
}