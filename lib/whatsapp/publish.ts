import { createAdminClient } from "@/lib/supabase/admin";
import { isValidWhatsappDraft, type WhatsappDraft } from "@/lib/whatsapp/conversation";

const PUBLIC_BUCKET = "listing-photos";
const PRIVATE_BUCKET = "whatsapp-draft-photos";

export async function publishWhatsappConfirmedListing(
  userId: string,
  draft: WhatsappDraft,
  privatePath: string | null
): Promise<string> {
  if (!isValidWhatsappDraft(draft, privatePath) ||
      !privatePath?.startsWith(`${userId}/`) ||
      !draft.listingId) {
    throw new Error("El anuncio no está completo o no se ha confirmado.");
  }

  const admin = createAdminClient();

  // A deterministic listing UUID (set when the draft begins) makes retries safe.
  const { data: existing, error: existingError } = await admin
    .from("listings")
    .select("id, seller_id")
    .eq("id", draft.listingId)
    .maybeSingle();
  if (existingError) throw new Error("No se pudo comprobar el anuncio");

  if (existing) {
    if (existing.seller_id !== userId) throw new Error("La cuenta no es propietaria del anuncio");
    const { data: photo, error: photoError } = await admin
      .from("listing_photos").select("id").eq("listing_id", draft.listingId).limit(1);
    if (photoError) throw new Error("No se pudieron comprobar las fotografías");
    if (photo && photo.length > 0) return draft.listingId;
  }

  const { data: photoBlob, error: photoDownloadError } =
    await admin.storage.from(PRIVATE_BUCKET).download(privatePath);
  if (photoDownloadError || !photoBlob || photoBlob.size > 3 * 1024 * 1024 || photoBlob.size < 100) {
    throw new Error("No se pudo recuperar la fotografía privada");
  }
  const extension = privatePath.split(".").pop()?.toLowerCase();
  if (!extension || !["jpg","png","webp"].includes(extension)) throw new Error("Formato inválido");
  const mime = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  const photoPath = `${userId}/${draft.listingId}/whatsapp-main.${extension}`;

  const { error: uploadError } = await admin.storage.from(PUBLIC_BUCKET)
    .upload(photoPath, photoBlob, {
      cacheControl: "3600", contentType: mime, upsert: true,
    });
  if (uploadError) throw new Error("No se pudo preparar la foto del anuncio");

  const { data: publicUrlData } = admin.storage.from(PUBLIC_BUCKET).getPublicUrl(photoPath);
  const url = publicUrlData?.publicUrl;
  if (!url) throw new Error("No se pudo obtener la URL de la fotografía");

  if (!existing) {
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("school_id").eq("id", userId).maybeSingle();
    if (profileError) throw new Error("No se pudo recuperar el perfil");
    const { error: insertError } = await admin.from("listings").insert({
      id: draft.listingId,
      title: draft.title!.trim(),
      description: draft.description!.trim(),
      category: draft.category,
      grade_level: draft.gradeLevel || "Varios cursos",
      condition: draft.condition,
      type: draft.kind,
      listing_type: draft.kind,
      price: draft.kind === "donation" ? null : draft.price,
      original_price: draft.kind === "sale" ? draft.originalPrice ?? null : null,
      isbn: draft.isbn || null,
      author: draft.author || null,
      publisher: draft.publisher || null,
      format: draft.format || null,
      language: draft.language || null,
      subject: draft.category === "Libros de texto" ? draft.subject || null : null,
      specific_type: draft.specificType || null,
      size_label: draft.sizeLabel || null,
      brand: draft.brand || null,
      model: draft.model || null,
      season: draft.season || null,
      seller_id: userId,
      school_id: profile?.school_id || null,
      status: "available",
      photos: [url],
    });
    if (insertError) {
      // A concurrent/previous attempt can have inserted the deterministic ID.
      const { data: afterConflict, error: checkError } = await admin
        .from("listings").select("seller_id").eq("id", draft.listingId).maybeSingle();
      if (checkError || afterConflict?.seller_id !== userId) throw new Error("No se pudo publicar el anuncio");
    }
  }
  const { data: photoRows, error: rowsError } = await admin
    .from("listing_photos").select("id").eq("listing_id", draft.listingId).limit(1);
  if (rowsError) throw new Error("No se pudo comprobar la fotografía publicada");
  if (!photoRows?.length) {
    const { error: photoInsertError } = await admin.from("listing_photos")
      .insert({ listing_id: draft.listingId, url, sort_order: 0 });
    if (photoInsertError) throw new Error("La fotografía no quedó vinculada al anuncio");
  }
  return draft.listingId;
}
