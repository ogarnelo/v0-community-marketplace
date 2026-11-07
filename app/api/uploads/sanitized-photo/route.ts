import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_STORED_BYTES = 5 * 1024 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function normalizePhoto(bytes: Buffer): Promise<Buffer> {
  // Always decode and re-encode pixels in the trusted server. No EXIF, GPS,
  // comments or original filenames are preserved in the encoded JPEG.
  const image = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000, animated: false });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height ||
      !["jpeg", "png", "webp"].includes(metadata.format || "")) {
    throw new Error("La imagen no tiene un formato válido.");
  }
  for (const config of [
    { maxSide: 2400, quality: 82 },
    { maxSide: 1800, quality: 74 },
    { maxSide: 1400, quality: 66 },
  ]) {
    const normalized = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000, animated: false })
      .rotate()
      .resize({ width: config.maxSide, height: config.maxSide, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: config.quality, mozjpeg: true })
      .toBuffer();
    if (normalized.byteLength <= MAX_STORED_BYTES) return normalized;
  }
  throw new Error("La fotografía supera 5 MB incluso después de optimizarla.");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file");
    const destination = String(formData.get("destination") || "").trim();
    const resourceId = String(formData.get("resourceId") || "").trim();

    if (!(file instanceof File) || !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Solo se admiten imágenes JPG, PNG y WEBP." }, { status: 400 });
    }
    if (!file.size || file.size > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "La imagen original no puede superar 20 MB." }, { status: 413 });
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

    let bytes: Buffer;
    try {
      bytes = await normalizePhoto(Buffer.from(await file.arrayBuffer()));
    } catch (imageError) {
      return NextResponse.json({
        error: imageError instanceof Error ? imageError.message : "No se pudo procesar la imagen.",
      }, { status: 422 });
    }

    const bucket = destination === "chat" ? "chat-attachments" : "listing-photos";
    const filename = `${randomUUID()}.jpg`;
    const path = destination === "draft"
      ? `${user.id}/drafts/current/${filename}`
      : destination === "chat"
        ? `${resourceId}/${user.id}/${filename}`
        : `${user.id}/${resourceId}/${filename}`;

    const { error: uploadError } = await admin.storage.from(bucket)
      .upload(path, bytes, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;

    const publicUrl = destination === "chat"
      ? null
      : admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return NextResponse.json({
      ok: true,
      path,
      publicUrl,
      name: filename,
      contentType: "image/jpeg",
      size: bytes.byteLength,
    });
  } catch (error) {
    console.error("No se pudo almacenar la imagen saneada", error);
    return NextResponse.json({ error: "No se pudo subir la fotografía." }, { status: 500 });
  }
}
