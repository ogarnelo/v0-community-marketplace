import sharp from "sharp";

const MAX_STORED_BYTES = 5 * 1024 * 1024;

export async function normalizePhoto(bytes: Buffer): Promise<Buffer> {
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
