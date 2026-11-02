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
  if (!session || session.step !== "form" ||
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
  const { data: signed, error: signingError } = await owner.admin.storage
    .from("whatsapp-draft-photos").createSignedUrl(result.session.draft_photo_path!, 300);
  if (signingError || !signed?.signedUrl) return failed(503, "No se pudo mostrar la fotografía.");
  return NextResponse.json({
    draft: result.session.payload,
    photoUrl: signed.signedUrl,
    expiresInSeconds: 300,
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

  const { draft, errors } = normalizeWhatsappForm(body.draft, draftId, found.session.draft_photo_path);
  if (body.action === "save") {
    // Save may be incomplete; invalid optional values are discarded by normalization.
    const { data: updated, error } = await owner.admin.from("whatsapp_listing_sessions")
      .update({ payload: draft, updated_at: new Date().toISOString() })
      .eq("user_id", owner.user.id).eq("step", "form")
      .eq("updated_at", found.session.updated_at)
      .select("user_id").maybeSingle();
    if (error || !updated) return failed(409, "El borrador cambió. Recarga para revisarlo.");
    return NextResponse.json({ saved: true }, { headers: noStore });
  }

  if (Object.keys(errors).length) return failed(422, "Completa los campos obligatorios.", errors);
  // Explicit button action is the only publication trigger for this form.
  const listingId = await publishWhatsappConfirmedListing(
    owner.user.id, draft, found.session.draft_photo_path
  ).catch(() => null);
  if (!listingId) return failed(503, "No se pudo publicar. Revisa y vuelve a intentarlo.");

  const { data: updated, error: updateError } = await owner.admin.from("whatsapp_listing_sessions")
    .update({
      step: "published", payload: { listingId },
      draft_photo_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", owner.user.id).eq("step", "form")
    .eq("updated_at", found.session.updated_at)
    .select("user_id").maybeSingle();
  if (updateError || !updated) {
    // The listing UUID is stable and publishWhatsappConfirmedListing is retry-safe.
    return failed(409, "El anuncio puede estar publicado; comprueba tu cuenta antes de reintentar.");
  }

  const { error: removalError } = await owner.admin.storage
    .from("whatsapp-draft-photos").remove([found.session.draft_photo_path!]);
  if (removalError) console.error("WhatsApp form: could not remove private draft photo");

  return NextResponse.json({
    published: true,
    listingId,
    url: `/marketplace/listing/${listingId}`,
  }, { headers: noStore });
}
