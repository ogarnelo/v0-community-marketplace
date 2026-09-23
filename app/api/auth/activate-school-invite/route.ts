import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set(["invite", "magiclink"]);

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { tokenHash?: string; type?: string }
      | null;

    const tokenHash = body?.tokenHash?.trim() || "";
    const type = body?.type?.trim() || "";

    if (!tokenHash || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { error: "El enlace de activación no es válido. Solicita uno nuevo." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "El enlace de activación no es válido o ha caducado. Solicita uno nuevo." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      next: "/auth/complete-invite?next=/admin/school",
    });
  } catch (cause: any) {
    return NextResponse.json(
      {
        error:
          cause?.message ||
          "No se pudo activar el acceso del centro.",
      },
      { status: 500 }
    );
  }
}
