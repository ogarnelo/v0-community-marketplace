import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { appendGrowthUtm } from "@/lib/growth/attribution";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse("No autenticado.", { status: 401 });
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user.id);

    if (roleError) throw roleError;

    const schoolRole = (roles || []).find(
      (role) => role.role === "school_admin" && role.school_id
    );

    if (!schoolRole?.school_id) {
      return new NextResponse("No autorizado.", { status: 403 });
    }

    const origin = new URL(request.url).origin;
    const baseShareUrl = new URL("/onboarding/join-school", origin);
    baseShareUrl.searchParams.set("school", schoolRole.school_id);
    const shareUrl = new URL(
      appendGrowthUtm(
        baseShareUrl.toString(),
        {
          source: "school",
          medium: "qr",
          campaign: "school_invite",
        },
        origin
      )
    );

    const format = new URL(request.url).searchParams.get("format");
    const download = new URL(request.url).searchParams.get("download") === "1";

    if (format === "png") {
      const png = await QRCode.toBuffer(shareUrl.toString(), {
        type: "png",
        errorCorrectionLevel: "M",
        margin: 2,
        width: 720,
        color: {
          dark: "#111827",
          light: "#FFFFFF",
        },
      });

      return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=300",
          "Content-Disposition": `${download ? "attachment" : "inline"}; filename="wetudy-centro-qr.png"`,
        },
      });
    }

    const svg = await QRCode.toString(shareUrl.toString(), {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: {
        dark: "#111827",
        light: "#FFFFFF",
      },
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": 'inline; filename="wetudy-centro-qr.svg"',
      },
    });
  } catch (error) {
    console.error("Error generando QR del centro:", error);
    return new NextResponse("No se pudo generar el QR.", { status: 500 });
  }
}
