import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getPublicDirectorySchool } from "@/lib/schools/directory-public";
import { getSchoolDirectoryUrl } from "@/lib/schools/directory-identity";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    // This lookup requires is_listed=true. Unpublished entries have no QR endpoint.
    const centre = await getPublicDirectorySchool(code);
    if (!centre) return new NextResponse("Centro no disponible.", { status: 404 });

    // QR is a public discovery link and MUST NOT embed school_access_codes,
    // session secrets, student data, or a direct authenticated join URL.
    const url = getSchoolDirectoryUrl(centre.official_code);
    const search = new URL(request.url).searchParams;
    const wantsPng = search.get("format") === "png";
    const download = search.get("download") === "1";

    const headers = {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="wetudy-centro-${code}.${wantsPng ? "png" : "svg"}"`,
    };

    if (wantsPng) {
      const data = await QRCode.toBuffer(url, {
        type: "png", errorCorrectionLevel: "M", margin: 2, width: 720,
        color: { dark: "#103A46", light: "#FFFFFF" },
      });
      return new NextResponse(new Uint8Array(data), {
        headers: { ...headers, "Content-Type": "image/png" },
      });
    }
    const svg = await QRCode.toString(url, {
      type: "svg", errorCorrectionLevel: "M", margin: 2, width: 320,
      color: { dark: "#103A46", light: "#FFFFFF" },
    });
    return new NextResponse(svg, {
      headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error generando el QR público del directorio", error);
    return new NextResponse("No se pudo generar el QR.", { status: 503 });
  }
}
