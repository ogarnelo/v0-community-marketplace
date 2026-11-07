/**
 * Re-encode user photographs before public upload.
 *
 * Canvas export produces a fresh JPEG without source EXIF/GPS metadata and
 * randomizes the stored filename. Orientation is handled when the image
 * is decoded. This protects the normal UI upload path; server-side
 * re-encoding is still required before treating arbitrary API clients
 * as trusted sources of photographs.
 */
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SOURCE_IMAGE_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_LISTING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export async function prepareListingImage(file: File): Promise<File> {
  if (!(ACCEPTED_LISTING_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("Utiliza imágenes JPG, PNG o WEBP. Los GIF no se admiten al eliminar metadatos.");
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("La fotografía original no puede superar 20 MB antes de optimizarse.");
  }
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    throw new Error("Tu navegador no permite procesar imágenes de forma segura.");
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const sourceMaxSide = Math.max(bitmap.width, bitmap.height);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 120_000_000) {
      throw new Error("La fotografía tiene dimensiones demasiado grandes.");
    }
    const sideLimit = 2400;
    const initialScale = Math.min(1, sideLimit / sourceMaxSide);
    const outputScales = [initialScale, initialScale * 0.75, initialScale * 0.5];
    for (const scale of outputScales) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("No se pudo preparar la fotografía.");
      // JPEG does not support alpha; use an opaque neutral background.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encoded = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo optimizar la fotografía.")), "image/jpeg", 0.82);
      });
      canvas.width = 0;
      canvas.height = 0;
      if (encoded.type !== "image/jpeg") {
        throw new Error("No se pudo asegurar el formato de la fotografía.");
      }
      if (encoded.size <= MAX_LISTING_IMAGE_BYTES) {
        return new File([encoded], `wetudy-${crypto.randomUUID()}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }
    throw new Error("La fotografía supera 5 MB después de optimizarla.");
  } finally {
    bitmap.close();
  }
}
