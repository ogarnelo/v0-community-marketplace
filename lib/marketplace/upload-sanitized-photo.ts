type SanitizedImageDestination = "draft" | "listing" | "chat";

export type SanitizedUploadResult = {
  path: string;
  publicUrl: string | null;
  name: string;
  contentType: "image/jpeg";
  size: number;
};

export async function uploadSanitizedPhoto(
  file: File,
  destination: SanitizedImageDestination,
  resourceId?: string
): Promise<SanitizedUploadResult> {
  const payload = new FormData();
  payload.set("file", file);
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
