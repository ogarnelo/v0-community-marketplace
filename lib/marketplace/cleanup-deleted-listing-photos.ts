import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "listing-photos";
const PREFIX_MARKER = "__wetudy_storage_prefix_marker__";

type Admin = ReturnType<typeof createAdminClient>;

function ownedPhotoPath(
  admin: Admin,
  url: string,
  ownerId: string,
  deletedListingId: string,
): string | null {
  try {
    const markerUrl = admin.storage.from(BUCKET).getPublicUrl(PREFIX_MARKER).data.publicUrl;
    if (!markerUrl.endsWith(PREFIX_MARKER)) return null;
    const root = new URL(markerUrl.slice(0, -PREFIX_MARKER.length));
    const photo = new URL(url);
    if (photo.origin !== root.origin || !photo.pathname.startsWith(root.pathname) ||
        photo.search || photo.hash) return null;

    const path = decodeURIComponent(photo.pathname.slice(root.pathname.length));
    const listingPrefix = `${ownerId}/${deletedListingId}/`;
    // Only the deleted listing's dedicated directory can be reclaimed.
    // Shared draft folders are intentionally retained until independently
    // reconciled: another active draft or listing may still reference them.
    const filename = path.startsWith(listingPrefix)
      ? path.slice(listingPrefix.length) : "";

    // Recognize the two actually used upload naming schemes: UUID.jpg
    // (new server sanitizer) and Date.now()-index-sanitizedName.jpg
    // (existing web listing form). Unknown/legacy/foreign paths are retained.
    const generatedPhotoName = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9]{13}-[0-7]-[A-Za-z0-9][A-Za-z0-9._-]{0,150})\.(?:jpg|jpeg|png|webp)$/i;
    if (!generatedPhotoName.test(filename)) return null;
    if (path.includes("..") || path.includes("//") || path.includes("\\")) return null;
    // Do not trust a serialized listing URL as the Storage origin: it must
    // equal the canonical URL for precisely this owner's validated object.
    const canonical = admin.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl;
    if (!canonical || canonical !== url) return null;
    return path;
  } catch {
    return null;
  }
}

async function stillReferenced(admin: Admin, url: string, path: string): Promise<boolean> {
  const checks = await Promise.all([
    admin.from("listings").select("id").contains("photos", [url]).limit(1).maybeSingle(),
    admin.from("listing_photos").select("id").eq("url", url).limit(1).maybeSingle(),
    admin.from("listing_drafts").select("id").contains("photos", [{ url }]).limit(1).maybeSingle(),
    admin.from("listing_drafts").select("id").contains("photos", [{ path }]).limit(1).maybeSingle(),
  ]);

  // Fail closed on any database error: a leftover file is safer than a broken
  // published listing. The error label is an INTERNAL, fixed identifier;
  // never log a provider message, SQL diagnostics, URL, or user information.
  const referenceChecks = ["listing_array", "photo_rows", "draft_url", "draft_path"] as const;
  const firstFailure = checks.findIndex(({ error }) => Boolean(error));
  if (firstFailure !== -1) {
    throw new Error("PHOTO_REF_" + referenceChecks[firstFailure]);
  }
  return checks.some(({ data }) => Boolean(data));
}

/**
 * Best-effort physical cleanup after the parent listing DELETE succeeds.
 * No client can supply the paths to remove: only saved photo URLs from the
 * deleted listing, constrained to its owner's recognized storage folders.
 * This never runs on archived or failed-deletion listings.
 */
export async function cleanupDeletedListingPhotos(
  admin: Admin,
  params: { ownerId: string; listingId: string; urls: string[] },
): Promise<void> {
  const candidates = new Map<string, string>();
  for (const url of params.urls) {
    if (typeof url !== "string") continue;
    const path = ownedPhotoPath(admin, url, params.ownerId, params.listingId);
    if (path) candidates.set(path, url);
  }

  for (const [path, url] of candidates) {
    try {
      if (await stillReferenced(admin, url, path)) continue;
      const { error } = await admin.storage.from(BUCKET).remove([path]);
      if (error) console.error("listing_photo_orphan_cleanup_storage_failed");
    } catch (error) {
      // A fixed, server-owned code identifies which query failed, without
      // exposing provider errors, listing IDs, URLs, or school/user details.
      const diagnostic = error instanceof Error &&
        /^PHOTO_REF_(?:listing_array|photo_rows|draft_url|draft_path)$/.test(error.message)
          ? error.message : "PHOTO_REF_UNKNOWN";
      console.error("listing_photo_orphan_cleanup_reference_unavailable", diagnostic);
      // Never roll back a successful parent deletion because GC failed.
    }
  }
}
