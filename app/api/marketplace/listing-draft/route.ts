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

  const { data: existing } = await admin
    .from("listing_drafts")
    .select("photos")
    .eq("user_id", user.id)
    .maybeSingle();

  const previousPhotos = cleanPhotos(existing?.photos, user.id);
  const nextPaths = new Set(photos.map((photo) => photo.path));
  const removedPaths = previousPhotos
    .map((photo) => photo.path)
    .filter((path) => !nextPaths.has(path));

  if (removedPaths.length > 0) {
    const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(removedPaths);
    if (storageError) {
      console.error("No se pudieron limpiar fotos retiradas del borrador", storageError);
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
    return NextResponse.json({ error: error?.message || "No se pudo guardar el borrador." }, { status: 500 });
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
  const { data: existing } = await admin
    .from("listing_drafts")
    .select("photos")
    .eq("user_id", user.id)
    .maybeSingle();

  const existingPhotos = cleanPhotos(existing?.photos, user.id);
  const pathsToRemove = existingPhotos
    .map((photo) => photo.path)
    .filter((path) => !preservePaths.has(path));

  if (pathsToRemove.length > 0) {
    const { error: storageError } = await admin.storage.from(STORAGE_BUCKET).remove(pathsToRemove);
    if (storageError) {
      return NextResponse.json(
        { error: storageError.message || "No se pudieron limpiar las fotos del borrador." },
        { status: 500 }
      );
    }
  }

  const { error } = await admin.from("listing_drafts").delete().eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message || "No se pudo descartar el borrador." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
