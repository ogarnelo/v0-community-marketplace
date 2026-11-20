import { NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  directoryPageUrl,
  readListedDirectoryCentre,
  VALID_OFFICIAL_SCHOOL_CODE,
} from "@/lib/schools/listed-directory-centre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  if (process.env.WETUDY_PUBLIC_SCHOOL_DIRECTORY_ENABLED !== "true") {
    return new NextResponse("Not found", { status: 404, headers: PRIVATE });
  }
  const { code } = await context.params;
  if (!VALID_OFFICIAL_SCHOOL_CODE.test(code)) {
    return new NextResponse("Not found", { status: 404, headers: PRIVATE });
  }
  try {
    // Recheck is_listed on EVERY request, including image and download.
    // A revoked editorial listing must immediately stop serving QR content.
    const centre = await readListedDirectoryCentre(code);
    if (!centre) return new NextResponse("Not found", { status: 404, headers: PRIVATE });
    const url = directoryPageUrl(centre.official_code);
    const search = new URL(request.url).searchParams;
    const png = search.get("format") === "png";
    const download = search.get("download") === "1";
    const disposition = `${download ? "attachment" : "inline"}; filename="wetudy-centro-${code}.${png ? "png" : "svg"}"`;
    if (png) {
      const bytes = await QRCode.toBuffer(url, {
        type: "png", errorCorrectionLevel: "M", margin: 2, width: 720,
      });
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: { ...PRIVATE, "Content-Type": "image/png", "Content-Disposition": disposition },
      });
    }
    const svg = await QRCode.toString(url, {
      type: "svg", errorCorrectionLevel: "M", margin: 2, width: 320,
    });
    return new NextResponse(svg, {
      status: 200,
      headers: { ...PRIVATE, "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": disposition },
    });
  } catch {
    console.error("directory_qr_unavailable");
    return new NextResponse("Directory unavailable", { status: 503, headers: PRIVATE });
  }
}
