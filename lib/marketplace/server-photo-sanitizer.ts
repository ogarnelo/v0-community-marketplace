import sharp from "sharp";

const MAX_STORED_BYTES = 5 * 1024 * 1024;
const TARGET_STORED_BYTES = 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;

export type OptimizedPhoto = {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/webp";
  extension: "jpg" | "webp";
  sourceBytes: number;
};

type Candidate = Omit<OptimizedPhoto, "sourceBytes">;

/**
 * Automatically normalize user photographs for inexpensive Supabase Free storage.
 * One (and only one) re-encoded photo is persisted. Sharp drops source EXIF, GPS,
 * XMP and ICC metadata by default. rotate() applies EXIF orientation first.
 *
 * Prefer a readable, high-resolution image (soft 1 MB target), choose the
 * smaller of JPEG or WebP, and only reduce dimensions further if necessary.
 * Images with unusually high detail may exceed the soft target; the hard
 * Storage limit remains 5 MB.
 */
export async function normalizePhoto(source: Buffer): Promise<OptimizedPhoto> {
  if (source.byteLength === 0) throw new Error("La fotografía está vacía.");

  const input = sharp(source, {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
    animated: false,
  });
  const metadata = await input.metadata();
  if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format || "")) {
    throw new Error("La imagen no tiene un formato válido.");
  }

  let fallback: Candidate | undefined;
  for (const config of [
    { side: 2000, jpegQuality: 83, webpQuality: 81 },
    { side: 1800, jpegQuality: 80, webpQuality: 78 },
    { side: 1600, jpegQuality: 77, webpQuality: 75 },
  ]) {
    const pixels = sharp(source, {
      failOn: "error",
      limitInputPixels: MAX_INPUT_PIXELS,
      animated: false,
    })
      .rotate()
      .resize({ width: config.side, height: config.side, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" });

    const [jpeg, webp] = await Promise.all([
      pixels.clone().jpeg({ quality: config.jpegQuality, mozjpeg: true }).toBuffer(),
      pixels.clone().webp({ quality: config.webpQuality, effort: 4 }).toBuffer(),
    ]);
    const chosen: Candidate = webp.byteLength < jpeg.byteLength
      ? { bytes: webp, extension: "webp", contentType: "image/webp" }
      : { bytes: jpeg, extension: "jpg", contentType: "image/jpeg" };

    if (chosen.bytes.byteLength <= MAX_STORED_BYTES &&
        (!fallback || chosen.bytes.byteLength < fallback.bytes.byteLength)) {
      fallback = chosen;
    }
    if (chosen.bytes.byteLength <= TARGET_STORED_BYTES) {
      return { ...chosen, sourceBytes: source.byteLength };
    }
  }

  if (!fallback) {
    throw new Error("La fotografía supera 5 MB incluso después de optimizarla.");
  }
  return { ...fallback, sourceBytes: source.byteLength };
}
