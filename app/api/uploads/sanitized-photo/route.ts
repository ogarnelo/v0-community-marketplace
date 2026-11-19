import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { normalizePhoto } from "@/lib/marketplace/server-photo-sanitizer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Vercel Functions have a 4.5 MB total request-body limit; allow margin for multipart encoding.
const MAX_SOURCE_BYTES = 4 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);


export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: "No se pudo verificar la sesión." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file");
    const destination = String(formData.get("destination") || "").trim();
    const resourceId = String(formData.get("resourceId") || "").trim();

    if (!(file instanceof File) || !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Solo se admiten imágenes JPG, PNG y WEBP." }, { status: 400 });
    }
    if (!file.size || file.size > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "La fotografía supera 4 MB para el envío. Vuelve a seleccionarla." }, { status: 413 });
    }
    if (!["draft", "listing", "chat"].includes(destination)) {
      return NextResponse.json({ error: "Destino de imagen no permitido." }, { status: 400 });
    }
    if (destination !== "draft" && !UUID_RE.test(resourceId)) {
      return NextResponse.json({ error: "Identificador del anuncio o conversación no válido." }, { status: 400 });
    }

    const admin = createAdminClient();
    if (destination === "listing") {
      const { data: listing, error } = await admin.from("listings")
        .select("seller_id").eq("id", resourceId).maybeSingle();
      if (error) throw error;
      if (!listing || listing.seller_id !== user.id) {
        return NextResponse.json({ error: "No tienes permisos sobre este anuncio." }, { status: 403 });
      }
    }
    if (destination === "chat") {
      const { data: conversation, error } = await admin.from("conversations")
        .select("buyer_id,seller_id").eq("id", resourceId).maybeSingle();
      if (error) throw error;
      if (!conversation || (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)) {
        return NextResponse.json({ error: "No participas en esa conversación." }, { status: 403 });
      }
    }

    // Reserve a per-account upload slot atomically before decoding pixels.
    // The RPC is executable by service_role only, never by browser clients.
    const { data: mayUpload, error: quotaError } = await admin.rpc(
      "claim_photo_upload_slot",
      { p_user_id: user.id }
    );
    if (quotaError) throw quotaError;
    if (!mayUpload) {
      return NextResponse.json(
        { error: "Has alcanzado el límite de fotografías. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    let optimized: Awaited<ReturnType<typeof normalizePhoto>>;
    try {
      optimized = await normalizePhoto(Buffer.from(await file.arrayBuffer()));
    } catch (imageError) {
      return NextResponse.json({
        error: "No se pudo procesar la imagen. Comprueba que sea JPG, PNG o WEBP.",
      }, { status: 422 });
    }

    const bucket = destination === "chat" ? "chat-attachments" : "listing-photos";
    const filename = `${randomUUID()}.${optimized.extension}`;
    const path = destination === "draft"
      ? `${user.id}/drafts/current/${filename}`
      : destination === "chat"
        ? `${resourceId}/${user.id}/${filename}`
        : `${user.id}/${resourceId}/${filename}`;

    const { error: uploadError } = await admin.storage.from(bucket)
      .upload(path, optimized.bytes, { contentType: optimized.contentType, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const publicUrl = destination === "chat"
      ? null
      : admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({
      ok: true,
      path,
      publicUrl,
      name: filename,
      contentType: optimized.contentType,
      size: optimized.bytes.byteLength,
      sourceBytes: optimized.sourceBytes,
    });
  } catch (error) {
    // Never log raw Storage/provider diagnostics containing user identifiers.
    console.error("server_photo_upload_failed");
    return NextResponse.json({ error: "No se pudo subir la fotografía." }, { status: 500 });
  }
}


// Roll back ONLY sanitized uploads belonging to the authenticated caller,
// never an existing listing or draft reference. No generic Storage delete API.
const PHOTO_OBJECT = /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(drafts\/current|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab][0-9a-f]{12})\.(jpg|webp)$/i;

export async function DELETE(request: Request) {
  const privateHeaders = { "Cache-Control": "private, no-store" };
  try {
    const supabase = await createClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: "No se pudo verificar la sesión." },
      { status: 503, headers: privateHeaders });
    const user = data?.user;
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." },
      { status: 401, headers: privateHeaders });
    const body = await request.json().catch(() => null);
    if (!Array.isArray(body?.paths) || body.paths.length < 1 || body.paths.length > 8 ||
        body.paths.some((path: unknown) => typeof path !== "string" ||
          !PHOTO_OBJECT.test(path) || PHOTO_OBJECT.exec(path)?.[1] !== user.id)) {
      return NextResponse.json({ error: "Rutas de fotografía no válidas." },
        { status: 400, headers: privateHeaders });
    }
    const admin = createAdminClient();
    const store = admin.storage.from("listing-photos");
    // Conservative: any unreadable reference prevents deletion of all paths.
    for (const path of body.paths as string[]) {
      const segments = PHOTO_OBJECT.exec(path);
      if (!segments) return NextResponse.json({ error: "Ruta no válida." },
        { status: 400, headers: privateHeaders });
      if (segments[2] !== "drafts/current") {
        const { data: listing, error } = await admin.from("listings")
          .select("seller_id").eq("id", segments[2]).maybeSingle();
        if (error || !listing || listing.seller_id !== user.id)
          return NextResponse.json({ error: "No se pudo verificar la propiedad." },
            { status: 403, headers: privateHeaders });
      }
      const url = store.getPublicUrl(path).data?.publicUrl;
      if (!url) return NextResponse.json({ error: "Fotografía no verificable." },
        { status: 503, headers: privateHeaders });
      const checks = await Promise.all([
        admin.from("listings").select("id").contains("photos", [url]).limit(1).maybeSingle(),
        admin.from("listing_photos").select("id").eq("url", url).limit(1).maybeSingle(),
        admin.from("listing_drafts").select("id").contains("photos", [{ url }]).limit(1).maybeSingle(),
        admin.from("listing_drafts").select("id").contains("photos", [{ path }]).limit(1).maybeSingle(),
      ]);
      if (checks.some(r => r.error || r.data))
        return NextResponse.json({ error: "La fotografía está en uso o no se puede verificar." },
          { status: 409, headers: privateHeaders });
    }
    const { error: removeError } = await store.remove([...new Set(body.paths as string[])]);
    if (removeError) return NextResponse.json({ error: "No se pudo completar la limpieza." },
      { status: 503, headers: privateHeaders });
    return NextResponse.json({ ok: true, cleaned: body.paths.length },
      { headers: privateHeaders });
  } catch {
    console.error("server_photo_cleanup_failed");
    return NextResponse.json({ error: "No se pudo completar la limpieza." },
      { status: 503, headers: privateHeaders });
  }
}
