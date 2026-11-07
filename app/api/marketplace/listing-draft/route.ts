import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ListingDraftPhoto } from "@/lib/marketplace/listing-draft";

const STORAGE_BUCKET = "listing-photos";
const MAX_DRAFT_PHOTOS = 8;
const MAX_PAYLOAD_BYTES = 32_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanPhotos(value: unknown, userId: string): ListingDraftPhoto[] {
  if (!Array.isArray(value)) return [];

  const prefix = `${userId}/drafts/`;
  return value
    .slice(0, MAX_DRAFT_PHOTOS)
    .map((item) => {
      if (!isPlainObject(item)) return null;
      const url = typeof item.url === "string" ? item.url.trim() : "";
      const path = typeof item.path === "string" ? item.path.trim() : "";
      if (!url || !path || !path.startsWith(prefix)) return null;
      return { url, path };
    })
    .filter((item): item is ListingDraftPhoto => Boolean(item));
}

// Some published listings retain their photo in the owner's former draft
// folder. A draft must never delete a photo that a live listing still uses.
// Fail closed on lookup errors: leave a harmless unused object rather than
// risk breaking an existing publication.
async function unusedDraftPhotoPaths(
  admin: ReturnType<typeof createAdminClient>,
  candidatePhotos: ListingDraftPhoto[],
  ownerId: string
): Promise<string[]> {
  // A second tab could have restored a photo after this request saved or
  // deleted its draft. Re-read the latest draft before any Storage cleanup.
  const { data: latestDraft, error: latestError } = await admin
    .from("listing_drafts")
    .select("photos")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (latestError) {
    console.error("No se pudo verificar el borrador actualizado", latestError);
    return [];
  }
  const currentPaths = new Set(
    cleanPhotos(latestDraft?.photos, ownerId).map((photo) => photo.path)
  );
  const unused: string[] = [];
  for (const photo of candidatePhotos) {
    if (currentPaths.has(photo.path)) continue;
    const { data: linkedListing, error } = await admin
      .from("listings")
      .select("id")
      .contains("photos", [photo.url])
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("No se pudo verificar si la foto del borrador sigue publicada", error);
      continue;
    }
    if (!linkedListing) unused.push(photo.path);
  }
  return [...new Set(unused)];
}

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listing_drafts")
    .select("id, payload, photos, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message || "No se pudo cargar el borrador." }, { status: 500 });
  }

  return NextResponse.json({ draft: data || null });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const payload = isPlainObject(body?.payload) ? body.payload : null;
  if (!payload) {
    return NextResponse.json({ error: "El borrador no es válido." }, { status: 400 });
  }

  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "El borrador es demasiado grande." }, { status: 413 });
  }

  const photos = cleanPhotos(body?.photos, user.id);
  const admin = createAdminClient();

  const { data: existing, error: draftReadError } = await admin
    .from("listing_drafts")
    .select("photos")
    .eq("user_id", user.id)
    .maybeSingle();

  // A failed read must not be treated as an empty draft. It could otherwise
  // permit overwriting valid references or losing track of photos to clean.
  if (draftReadError) {
    console.error("No se pudo comprobar el borrador anterior", draftReadError);
    return NextResponse.json(
      { error: "No se pudo comprobar el estado del borrador. Inténtalo más tarde." },
      { status: 503 }
    );
  }

  const previousPhotos = cleanPhotos(existing?.photos, user.id);
  const nextPaths = new Set(photos.map((photo) => photo.path));
  const removedPhotos = previousPhotos
    .filter((photo) => !nextPaths.has(photo.path));

  const { data, error } = await admin
    .from("listing_drafts")
    .upsert(
      {
        user_id: user.id,
        payload,
        photos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("id, payload, photos, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "No se pudo guardar el borrador." }, { status: 500 });
  }

  // Delete obsolete photos only after the new draft is durably saved.
  // A failed upsert must never leave the existing draft pointing to deleted files.
  if (removedPhotos.length > 0) {
    const safePaths = await unusedDraftPhotoPaths(admin, removedPhotos, user.id);
    if (safePaths.length > 0) {
      const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(safePaths);
      if (storageError) {
        console.error("No se pudieron limpiar fotos retiradas del borrador", storageError);
      }
    }
  }

  return NextResponse.json({ draft: data });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const preservePaths = new Set(
    Array.isArray(body?.preservePhotoPaths)
      ? body.preservePhotoPaths.filter(
          (path: unknown): path is string =>
            typeof path === "string" && path.startsWith(`${user.id}/drafts/`)
        )
      : []
  );

  const admin = createAdminClient();
  const { data: existing, error: draftReadError } = await admin
    .from("listing_drafts")
    .select("photos")
    .eq("user_id", user.id)
    .maybeSingle();

  // A failed read must not be treated as an empty draft. It could otherwise
  // permit overwriting valid references or losing track of photos to clean.
  if (draftReadError) {
    console.error("No se pudo comprobar el borrador anterior", draftReadError);
    return NextResponse.json(
      { error: "No se pudo comprobar el estado del borrador. Inténtalo más tarde." },
      { status: 503 }
    );
  }

  const existingPhotos = cleanPhotos(existing?.photos, user.id);
  const photosToRemove = existingPhotos
    .filter((photo) => !preservePaths.has(photo.path));

  // Delete the record first; otherwise an unsuccessful DB delete would leave
  // a saved draft whose referenced photos were already destroyed.
  const { error } = await admin.from("listing_drafts").delete().eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message || "No se pudo descartar el borrador." }, { status: 500 });
  }

  if (photosToRemove.length > 0) {
    const safePaths = await unusedDraftPhotoPaths(admin, photosToRemove, user.id);
    if (safePaths.length > 0) {
      const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(safePaths);
      if (storageError) {
        // Keep the successful draft deletion; log any unused objects left.
        console.error("No se pudieron limpiar las fotos del borrador descartado", storageError);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
