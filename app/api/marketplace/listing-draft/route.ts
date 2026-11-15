import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ListingDraftPhoto } from "@/lib/marketplace/listing-draft";

const STORAGE_BUCKET = "listing-photos";
const MAX_DRAFT_PHOTOS = 8;
const MAX_PAYLOAD_BYTES = 32_000;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

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
    return privateJson({ error: "Debes iniciar sesión." }, 401);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("listing_drafts")
    .select("id, payload, photos, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return privateJson({ error: "No se pudo cargar el borrador." }, 500);
  }

  return privateJson({ draft: data || null });
}

export async function PUT(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return privateJson({ error: "Debes iniciar sesión." }, 401);
  }

  const body = await request.json().catch(() => null);
  const payload = isPlainObject(body?.payload) ? body.payload : null;
  if (!payload) {
    return privateJson({ error: "El borrador no es válido." }, 400);
  }

  if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_PAYLOAD_BYTES) {
    return privateJson({ error: "El borrador es demasiado grande." }, 413);
  }

  const photos = cleanPhotos(body?.photos, user.id);
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("listing_drafts")
    .select("photos")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) return privateJson({ error: "No se pudo guardar el borrador." }, 503);
  const previousPhotos = cleanPhotos(existing?.photos, user.id);
  const nextPaths = new Set(photos.map((photo) => photo.path));
  const removedPaths = previousPhotos
    .map((photo) => photo.path)
    .filter((path) => !nextPaths.has(path));

  if (removedPaths.length > 0) {
    const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(removedPaths);
    if (storageError) {
      console.error("draft_photo_cleanup_failed");
    }
  }

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
    return privateJson({ error: "No se pudo guardar el borrador." }, 500);
  }

  return privateJson({ draft: data });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return privateJson({ error: "Debes iniciar sesión." }, 401);
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
  const { data: existing } = await admin
    .from("listing_drafts")
    .select("photos")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) return privateJson({ error: "No se pudo descartar el borrador." }, 503);
  const existingPhotos = cleanPhotos(existing?.photos, user.id);
  const pathsToRemove = existingPhotos
    .map((photo) => photo.path)
    .filter((path) => !preservePaths.has(path));

  if (pathsToRemove.length > 0) {
    const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
    if (storageError) {
      return privateJson({ error: "No se pudieron limpiar las fotos del borrador." }, 500);
    }
  }

  const { error } = await admin.from("listing_drafts").delete().eq("user_id", user.id);
  if (error) {
    return privateJson({ error: "No se pudo descartar el borrador." }, 500);
  }

  return privateJson({ ok: true });
}
