import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

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
    const shareUrl = new URL("/onboarding/join-school", origin);
    shareUrl.searchParams.set("school", schoolRole.school_id);

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
