import { prepareListingImage } from "@/lib/marketplace/photo-sanitizer";

type SanitizedImageDestination = "draft" | "listing" | "chat";

export type SanitizedUploadResult = {
  path: string;
  publicUrl: string | null;
  name: string;
  contentType: "image/jpeg" | "image/webp";
  size: number;
  sourceBytes: number;
};

export async function uploadSanitizedPhoto(
  file: File,
  destination: SanitizedImageDestination,
  resourceId?: string
): Promise<SanitizedUploadResult> {
  const payload = new FormData();
  // The browser prepares a bounded transfer; the server independently decodes
  // and re-encodes untrusted bytes before any Storage write.
  payload.set("file", await prepareListingImage(file));
  payload.set("destination", destination);
  if (resourceId) payload.set("resourceId", resourceId);
  const response = await fetch("/api/uploads/sanitized-photo", {
    method: "POST",
    body: payload,
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok || typeof data.path !== "string") {
    throw new Error(data?.error || "No se pudo subir la fotografía.");
  }
  return data as SanitizedUploadResult;
}


// Preserve rollback after direct browser INSERT permissions are removed.
// The server checks ownership and references before removing any object.
export async function cleanupSanitizedPhotoUploads(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const response = await fetch("/api/uploads/sanitized-photo", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths }),
  });
  if (!response.ok) throw new Error("sanitized_photo_cleanup_failed");
}
