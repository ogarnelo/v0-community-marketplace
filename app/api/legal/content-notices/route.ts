import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendIllegalContentNoticeReceiptEmail,
  sendSupportTicketAdminEmail,
} from "@/lib/emails/admin-alert-emails";

const MAX_EXPLANATION_LENGTH = 4000;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_ORIGIN = "https://www.wetudy.com";

function normalizeWetudyContentUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim(), SITE_ORIGIN);
    if (!["wetudy.com", "www.wetudy.com"].includes(url.hostname)) return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;

    url.protocol = "https:";
    url.hostname = "www.wetudy.com";
    url.port = "";
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = await request.json().catch(() => ({}));
    const website = typeof body?.website === "string" ? body.website.trim() : "";
    const contentUrl = normalizeWetudyContentUrl(body?.contentUrl);
    const explanation =
      typeof body?.explanation === "string" ? body.explanation.trim() : "";
    const identityOmitted = body?.identityOmitted === true;
    const goodFaith = body?.goodFaith === true;
    const submittedName =
      typeof body?.name === "string" ? body.name.trim() : "";
    const submittedEmail =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (website) {
      return NextResponse.json({ ok: true });
    }

    if (!contentUrl) {
      return NextResponse.json(
        { error: "Indica la URL exacta del contenido de Wetudy que quieres notificar." },
        { status: 400 }
      );
    }

    if (explanation.length < 20 || explanation.length > MAX_EXPLANATION_LENGTH) {
      return NextResponse.json(
        {
          error:
            "Explica con suficiente detalle por qué consideras ilícito el contenido (entre 20 y 4000 caracteres).",
        },
        { status: 400 }
      );
    }

    if (!goodFaith) {
      return NextResponse.json(
        {
          error:
            "Debes confirmar de buena fe que la información de la notificación es precisa y completa.",
        },
        { status: 400 }
      );
    }

    let name: string | null = submittedName || null;
    let email: string | null = submittedEmail || null;

    if (!identityOmitted) {
      if (!name || name.length < 2 || name.length > MAX_NAME_LENGTH) {
        return NextResponse.json({ error: "Indica un nombre válido." }, { status: 400 });
      }

      if (
        !email ||
        email.length > MAX_EMAIL_LENGTH ||
        !EMAIL_PATTERN.test(email)
      ) {
        return NextResponse.json(
          { error: "Indica un email válido para poder tramitar la notificación." },
          { status: 400 }
        );
      }
    } else {
      name = null;
      email = null;
    }

    const admin = createAdminClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let recentCount = 0;

    if (email) {
      const { count, error } = await admin
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("kind", "illegal_content_notice")
        .eq("email", email)
        .gte("created_at", oneHourAgo);

      if (error) throw error;
      recentCount = count || 0;

      if (recentCount >= 4) {
        return NextResponse.json(
          {
            error:
              "Has enviado varias notificaciones recientemente. Revisa si puedes agrupar el contenido relacionado en una sola notificación.",
          },
          { status: 429 }
        );
      }
    } else {
      const { count, error } = await admin
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("kind", "illegal_content_notice")
        .eq("identity_omitted", true)
        .gte("created_at", oneHourAgo);

      if (error) throw error;
      recentCount = count || 0;

      if (recentCount >= 20) {
        return NextResponse.json(
          { error: "No se puede tramitar otra notificación anónima en este momento." },
          { status: 429 }
        );
      }
    }

    const { data: ticket, error: insertError } = await admin
      .from("support_tickets")
      .insert({
        user_id: identityOmitted ? null : user?.id || null,
        name,
        email,
        message: explanation,
        kind: "illegal_content_notice",
        content_url: contentUrl,
        good_faith: true,
        identity_omitted: identityOmitted,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    if (email) {
      try {
        await sendIllegalContentNoticeReceiptEmail({
          to: email,
          noticeId: ticket.id,
          contentUrl,
          idempotencyKey: `illegal-content-notice-receipt-${ticket.id}`,
        });
      } catch (receiptError) {
        console.error("Error enviando acuse de notificación legal:", receiptError);
      }
    }

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
            senderName: name || "Identidad omitida por excepción legal",
            senderEmail: email || "hola@wetudy.com",
            message: `NOTIFICACIÓN DE CONTENIDO PRESUNTAMENTE ILÍCITO\nURL: ${contentUrl}\n\n${explanation}`,
            idempotencyKey: `illegal-content-notice-${ticket.id}-${superAdminUserId}`,
          });
        })
      );

      deliveries.forEach((delivery) => {
        if (delivery.status === "rejected") {
          console.error(
            "Error enviando aviso de notificación legal:",
            delivery.reason
          );
        }
      });
    } catch (notificationError) {
      console.error(
        "Error preparando avisos de notificación legal:",
        notificationError
      );
    }

    return NextResponse.json({ ok: true, noticeId: ticket.id });
  } catch (error: any) {
    console.error("Error creando notificación de contenido ilícito:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          "No se pudo registrar la notificación. Inténtalo de nuevo.",
      },
      { status: 500 }
    );
  }
}
