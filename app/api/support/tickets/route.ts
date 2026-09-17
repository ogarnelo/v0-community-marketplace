import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TICKETS_PER_HOUR = 2;
const MIN_ACCOUNT_AGE_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Debes iniciar sesión para contactar con soporte." }, { status: 401 });
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: "Confirma tu email antes de contactar con soporte." },
        { status: 403 }
      );
    }

    const accountCreatedAt = Date.parse(user.created_at || "");
    if (!Number.isFinite(accountCreatedAt) || Date.now() - accountCreatedAt < MIN_ACCOUNT_AGE_MS) {
      return NextResponse.json(
        {
          error:
            "Por seguridad, las cuentas recién creadas pueden contactar con soporte unos minutos después de registrarse.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (message.length < 10) {
      return NextResponse.json({ error: "Describe tu consulta con un poco más de detalle." }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `La consulta no puede superar ${MAX_MESSAGE_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: recentTicketCount, error: rateLimitError } = await admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (rateLimitError) throw rateLimitError;

    if ((recentTicketCount || 0) >= MAX_TICKETS_PER_HOUR) {
      return NextResponse.json(
        { error: "Has enviado varias consultas recientemente. Espera un poco antes de enviar otra." },
        { status: 429 }
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const email = user.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Tu cuenta no tiene un email válido." }, { status: 400 });
    }

    const name =
      profile?.full_name?.trim() ||
      (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") ||
      "Usuario";

    const { data: ticket, error: insertError } = await admin
      .from("support_tickets")
      .insert({
        user_id: user.id,
        name,
        email,
        message,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, ticketId: ticket.id });
  } catch (error: any) {
    console.error("Error creando support ticket:", error);
    return NextResponse.json(
      { error: error?.message || "No se pudo enviar tu consulta. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
