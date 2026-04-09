import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestDonationFlow } from "@/lib/services/donations.service";

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
    const listingId = typeof body?.listingId === "string" ? body.listingId.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    const schoolId = typeof body?.schoolId === "string" ? body.schoolId.trim() : null;

    if (!listingId) {
      return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const result = await requestDonationFlow({
      supabase: adminSupabase,
      listingId,
      actorUserId: user.id,
      schoolId,
      note,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || error?.details || "No se pudo crear la solicitud." },
      { status: 500 }
    );
  }
}
