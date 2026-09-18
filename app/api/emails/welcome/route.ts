import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmailAddress } from "@/lib/emails/address";
import { isEmailConfigured, sendWelcomeEmail } from "@/lib/emails/transactional";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id || !user.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const requiresWetudyEmailConfirmation =
    user.user_metadata?.wetudy_email_confirmation_required === true;

  if (requiresWetudyEmailConfirmation && !user.email_confirmed_at) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "email_not_verified",
    });
  }

  const recipientEmail = normalizeEmailAddress(user.email);
  if (!recipientEmail) {
    console.warn("Welcome email omitido: destinatario inválido", { userId: user.id });
    return NextResponse.json({ ok: true, skipped: true, reason: "invalid_recipient" });
  }

  const adminSupabase = createAdminClient();
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, full_name, welcome_email_sent_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Error consultando perfil para welcome email", profileError);
    return NextResponse.json({ error: "No se pudo preparar el email de bienvenida" }, { status: 500 });
  }

  if (profile?.welcome_email_sent_at) {
    return NextResponse.json({ ok: true, skipped: true, reason: "already_sent" });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "email_not_configured" });
  }

  await sendWelcomeEmail({
    to: recipientEmail,
    recipientName: profile?.full_name || user.user_metadata?.full_name || null,
  });

  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) {
    console.error("Email de bienvenida enviado, pero no se pudo marcar como enviado", updateError);
  }

  return NextResponse.json({ ok: true });
}
