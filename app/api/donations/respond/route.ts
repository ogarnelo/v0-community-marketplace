import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { respondToDonationFlow, type DonationAction } from "@/lib/services/donations.service";

function isDonationAction(value: unknown): value is DonationAction {
  return value === "accept" || value === "reject";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
    const action = isDonationAction(body?.action) ? body.action : null;

    if (!requestId || !action) {
      return NextResponse.json({ error: "Petición no válida." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await respondToDonationFlow({
      supabase: adminSupabase,
      requestId,
      action,
      actorUserId: user.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo responder a la solicitud." },
      { status: 500 }
    );
  }
}
