import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendGrowthUtm } from "@/lib/growth/attribution";
import { getAuthPublicOrigin } from "@/lib/auth/public-origin";
import { resolveUniqueSchoolAdminSchoolId } from "@/lib/marketplace/unique-school-admin-context";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      const absent = authError.name === "AuthSessionMissingError" ||
        authError.code === "session_not_found";
      return new NextResponse(
        absent ? "No autenticado." : "No se pudo comprobar tu sesión.",
        { status: absent ? 401 : 503, headers: { "Cache-Control": "private, no-store" } }
      );
    }
    const user = authData?.user ?? null;

    if (!user) {
      return new NextResponse("No autenticado.", { status: 401, headers: { "Cache-Control": "private, no-store" } });
    }

    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("school_id")
      .eq("user_id", user.id)
      .eq("role", "school_admin")
      .limit(2);

    if (roleError || !Array.isArray(roles)) {
      return new NextResponse("No se pudo comprobar tu permiso.",
        {status:503,headers:{"Cache-Control":"private, no-store"}});
    }
    // A QR link must not expose or enrol a centre chosen by the first of
    // two contradictory or duplicated administrator grants.
    let schoolId: string | null;
    try {
      schoolId = resolveUniqueSchoolAdminSchoolId(roles);
    } catch {
      return new NextResponse("Permisos de centro ambiguos.",
        {status:403,headers:{"Cache-Control":"private, no-store"}});
    }
    if (!schoolId) {
      return new NextResponse("No autorizado.",
        {status:403,headers:{"Cache-Control":"private, no-store"}});
    }

    // Do not generate new share codes/QR links for deactivated or missing
    // school communities. The session role is checked above; this privileged
    // lookup is limited to that school ID and never returns other school data.
    const admin = createAdminClient();
    const { data: school, error: schoolError } = await admin
      .from("schools")
      .select("id, is_active")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolError) throw schoolError;
    if (!school || school.is_active !== true) {
      return new NextResponse("Centro no disponible.", {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    // Always encode the trusted public domain, never the request Host.
    const origin = getAuthPublicOrigin();
    const baseShareUrl = new URL("/onboarding/join-school", origin);
    baseShareUrl.searchParams.set("school", schoolId);
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
          "Cache-Control": "private, no-store",
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
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'inline; filename="wetudy-centro-qr.svg"',
      },
    });
  } catch (error) {
    console.error("Error generando QR del centro:", error);
    return new NextResponse("No se pudo generar el QR.", { status: 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
