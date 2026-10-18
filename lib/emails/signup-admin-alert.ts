import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { brandedEmailShell, emailButton, EMAIL_BRAND, getEmailBaseUrl, sendBrandedEmail } from "@/lib/emails/brand";

type AccountType = "parent" | "student" | "business" | "unknown";

// Runs only after successful email-confirmation code exchange, never on login.
// No user-identifying information is included in the outgoing message.
export async function notifySuperadminsOfConfirmedSignup(params: {
  userId: string;
  accountType: AccountType;
}) {
  try {
    const admin = createAdminClient();
    const { data: roles, error } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");

    if (error) throw error;

    const recipients = await Promise.allSettled(
      [...new Set((roles || []).map((role) => role.user_id))]
        .filter((id) => id !== params.userId)
        .map(async (adminId) => {
          const { data, error: lookupError } = await admin.auth.admin.getUserById(adminId);
          if (lookupError) throw lookupError;
          if (!data.user?.email) return;
          const url = `${getEmailBaseUrl()}/admin/super/mvp`;
          await sendBrandedEmail({
            to: data.user.email,
            subject: "Nuevo usuario registrado · Wetudy",
            idempotencyKey: `confirmed-signup-${params.userId}-${adminId}`,
            text: `Se ha confirmado un nuevo registro en Wetudy. Tipo de cuenta: ${params.accountType}.\n\nConsultar actividad: ${url}`,
            html: brandedEmailShell({
              title: "Nuevo usuario registrado",
              preview: "Se ha confirmado una nueva cuenta en Wetudy.",
              footer: "Aviso de actividad para superadministradores de Wetudy.",
              body: `
                <h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:26px;color:${EMAIL_BRAND.text};">Nuevo usuario registrado</h1>
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${EMAIL_BRAND.text};">Se ha confirmado un nuevo registro en Wetudy.</p>
                <p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${EMAIL_BRAND.muted};">Tipo de cuenta: ${params.accountType}</p>
                ${emailButton("Consultar actividad", url)}
              `,
            }),
          });
        })
    );
    for (const result of recipients) {
      if (result.status === "rejected") {
        console.error("No se pudo enviar aviso de nuevo registro al superadmin", result.reason);
      }
    }
  } catch (error) {
    // This auxiliary email must never affect signup or email confirmation.
    console.error("No se pudieron preparar los avisos de alta de usuario", error);
  }
}
