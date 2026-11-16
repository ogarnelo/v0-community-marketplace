import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    ...options,
    headers: { ...PRIVATE_HEADERS, ...(options.headers || {}) },
  });
}

import { sendSupportTicketAdminEmail } from "@/lib/emails/admin-alert-emails";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_TICKETS_PER_HOUR = 2;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    // These forms intentionally accept guests. Only a genuinely absent
    // session is a guest; a provider outage must never use a stale identity.
    let authResult;
    try {
      const supabase = await createClient();
      authResult = await supabase.auth.getUser();
    } catch {
      return privateJson({ error: "No se pudo comprobar tu sesión." }, { status: 503 });
    }
    const authError = authResult.error;
    const missingSession = authError?.name === "AuthSessionMissingError" ||
      authError?.code === "session_not_found";
    if (authError && !missingSession) {
      return privateJson({ error: "No se pudo comprobar tu sesión." }, { status: 503 });
    }
    const user = authError ? null : authResult.data?.user ?? null;

    const body = await request.json().catch(() => ({}));
    const submittedName = typeof body?.name === "string" ? body.name.trim() : "";
    const submittedEmail =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const website = typeof body?.website === "string" ? body.website.trim() : "";

    if (website) {
      return privateJson({ ok: true });
    }

    if (message.length < 10) {
      return privateJson({ error: "Describe tu consulta con un poco más de detalle." }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return privateJson(
        { error: `La consulta no puede superar ${MAX_MESSAGE_LENGTH} caracteres.` },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    let name = submittedName;
    let email = submittedEmail;

    if (user) {
      if (!user.email_confirmed_at) {
        return privateJson(
          { error: "Confirma tu email antes de contactar con soporte desde tu cuenta." },
          { status: 403 }
        );
      }

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      email = user.email?.trim().toLowerCase() || "";
      name =
        profile?.full_name?.trim() ||
        (typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "") ||
        submittedName ||
        "Usuario";
    }

    if (name.length < 2 || name.length > MAX_NAME_LENGTH) {
      return privateJson({ error: "Indica un nombre válido." }, { status: 400 });
    }

    if (
      !email ||
      email.length > MAX_EMAIL_LENGTH ||
      !EMAIL_PATTERN.test(email)
    ) {
      return privateJson(
        { error: "Indica un email válido para poder responderte." },
        { status: 400 }
      );
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentTicketCount, error: rateLimitError } = await admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", oneHourAgo);

    if (rateLimitError) throw rateLimitError;

    if ((recentTicketCount || 0) >= MAX_TICKETS_PER_HOUR) {
      return privateJson(
        { error: "Has enviado varias consultas recientemente. Espera un poco antes de enviar otra." },
        { status: 429 }
      );
    }

    const { data: ticket, error: insertError } = await admin
      .from("support_tickets")
      .insert({
        user_id: user?.id || null,
        name,
        email,
        message,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    try {
      const { data: superAdminRoles, error: rolesError } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      if (rolesError) throw rolesError;

      const deliveries = await Promise.allSettled(
        (superAdminRoles || []).map(async ({ user_id: superAdminUserId }) => {
          const {
            data: { user: superAdminUser },
            error: adminUserError,
          } = await admin.auth.admin.getUserById(superAdminUserId);

          if (adminUserError) throw adminUserError;

          const to = superAdminUser?.email?.trim();
          if (!to) return;

          await sendSupportTicketAdminEmail({
            to,
            ticketId: ticket.id,
            senderName: name,
            senderEmail: email,
            message,
            idempotencyKey: `support-ticket-${ticket.id}-${superAdminUserId}`,
          });
        })
      );

      deliveries.forEach((delivery) => {
        if (delivery.status === "rejected") {
          console.error("Error enviando aviso por email de support ticket:", delivery.reason);
        }
      });
    } catch (notificationError) {
      console.error("Error preparando avisos por email de support ticket:", notificationError);
    }

    return privateJson({ ok: true, ticketId: ticket.id });
  } catch {
    console.error("support_ticket_submission_failed");
    return privateJson({ error: "No se pudo enviar tu consulta. Inténtalo de nuevo." }, { status: 500 });
  }
}
