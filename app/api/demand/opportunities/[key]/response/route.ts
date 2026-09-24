import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const { key } = await context.params;
    const body = await request.json().catch(() => ({}));
    const response = body?.response;
    if (response !== "have_one" && response !== "dont_have") {
      return NextResponse.json({ error: "Respuesta no válida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: action } = await admin
      .from("demand_opportunity_actions")
      .select("id")
      .eq("opportunity_key", key)
      .eq("target_user_id", user.id)
      .eq("action_type", "seller_contacted")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!action) return NextResponse.json({ error: "Activación no encontrada." }, { status: 404 });

    const { error } = await admin
      .from("demand_opportunity_actions")
      .update({
        responded_at: new Date().toISOString(),
        response,
      })
      .eq("id", action.id);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      publishHref: response === "have_one"
        ? `/marketplace/new?opportunity=${encodeURIComponent(key)}`
        : null,
    });
  } catch (error: any) {
    console.error("Error registrando respuesta de activación:", error);
    return NextResponse.json({ error: error?.message || "No se pudo guardar la respuesta." }, { status: 500 });
  }
}
