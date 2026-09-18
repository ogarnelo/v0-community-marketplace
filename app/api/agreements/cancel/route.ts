import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeRpcRow<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const agreementId =
      typeof body?.agreementId === "string" ? body.agreementId.trim() : "";
    const note =
      typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

    if (!agreementId) {
      return NextResponse.json({ error: "Falta el acuerdo." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("server_cancel_agreement", {
      p_actor_id: user.id,
      p_agreement_id: agreementId,
      p_note: note,
    });

    if (error) {
      const message = error.message || "No se pudo cancelar.";
      const lower = message.toLowerCase();

      if (lower.includes("agreement not found")) {
        return NextResponse.json({ error: "No se encontró el acuerdo." }, { status: 404 });
      }
      if (lower.includes("not allowed")) {
        return NextResponse.json({ error: "No puedes cancelar este acuerdo." }, { status: 403 });
      }
      if (lower.includes("confirmed agreements")) {
        return NextResponse.json(
          { error: "Un acuerdo confirmado no se cancela. Puedes reportar una incidencia." },
          { status: 409 }
        );
      }
      if (lower.includes("disputed agreements")) {
        return NextResponse.json(
          { error: "Un acuerdo con una incidencia abierta no se puede cancelar." },
          { status: 409 }
        );
      }

      throw error;
    }

    const agreement = normalizeRpcRow<any>(data);
    return NextResponse.json({ ok: true, agreement });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo cancelar el acuerdo." },
      { status: 500 }
    );
  }
}
