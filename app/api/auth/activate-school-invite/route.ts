import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
};
function privateJson(payload: unknown, options: {status?:number} = {}) {
  return NextResponse.json(payload, {...options,headers:PRIVATE_HEADERS});
}
const ALLOWED_TYPES = new Set(["invite", "magiclink"]);
const MAX_TOKEN_HASH_LENGTH = 256;
const INVALID_LINK_MESSAGE = "El enlace de activación no es válido o ha caducado. Solicita uno nuevo.";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const tokenHash = typeof body?.tokenHash === "string" ? body.tokenHash.trim() : "";
    const type = typeof body?.type === "string" ? body.type.trim() : "";

    if (!tokenHash || tokenHash.length > MAX_TOKEN_HASH_LENGTH || !ALLOWED_TYPES.has(type)) {
      return privateJson({error:"El enlace de activación no es válido. Solicita uno nuevo."},
        {status:400});
    }

    const supabase = await createClient();
    const {data,error} = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (error) {
      // Invalid/expired token is a client error, but provider outages must
      // never be presented as bad credentials. Never echo error.message.
      const invalidToken = [400,401,403,422].includes(error.status ?? 0) ||
        ["otp_expired", "otp_disabled", "validation_failed"].includes(error.code ?? "");
      return privateJson({
        error: invalidToken ? INVALID_LINK_MESSAGE : "No se pudo comprobar el enlace de activación.",
      }, {status:invalidToken?400:503});
    }
    if (!data?.user) return privateJson({error:INVALID_LINK_MESSAGE},{status:400});

    return privateJson({
      ok:true,
      next:"/auth/complete-invite?next=/admin/school",
    });
  } catch {
    console.error("school_invite_activation_failed");
    return privateJson({error:"No se pudo activar el acceso del centro."},{status:503});
  }
}
