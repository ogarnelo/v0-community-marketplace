import {
  EMAIL_BRAND,
  brandedEmailShell,
  emailButton,
  escapeEmailHtml,
  getEmailBaseUrl,
  sendBrandedEmail,
} from "@/lib/emails/brand";

export async function sendSchoolAdminInviteEmail(params: {
  to: string;
  schoolName: string;
  inviteUrl: string;
  idempotencyKey?: string | null;
}) {
  const schoolName = params.schoolName.trim() || "tu centro";

  return sendBrandedEmail({
    to: params.to,
    subject: `Activa el acceso de ${schoolName} en Wetudy`,
    idempotencyKey: params.idempotencyKey,
    text:
      `Se ha aprobado el acceso de ${schoolName} en Wetudy. ` +
      `Activa la cuenta, crea una contraseña y entrarás directamente al panel del centro: ${params.inviteUrl}\n\n` +
      "La misma cuenta también puede usar Wetudy como cualquier otro usuario: publicar, chatear y acordar entregas directamente.",
    html: brandedEmailShell({
      title: "Activa el acceso de tu centro",
      preview: `Ya puedes activar el acceso de ${schoolName} y entrar al panel del centro.`,
      footer: "Wetudy combina una cuenta normal de usuario con permisos adicionales para administrar el centro.",
      body: `
        <h1 style="margin-top:0;margin-right:0;margin-bottom:14px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:27px;line-height:33px;color:${EMAIL_BRAND.text};">Tu centro ya está aprobado</h1>
        <p style="margin-top:0;margin-right:0;margin-bottom:16px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${EMAIL_BRAND.text};">
          Se ha aprobado el acceso de <strong>${escapeEmailHtml(schoolName)}</strong> en Wetudy.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${EMAIL_BRAND.paleBlue}" style="background-color:${EMAIL_BRAND.paleBlue};border-width:1px;border-style:solid;border-color:${EMAIL_BRAND.border};border-radius:14px;">
          <tr>
            <td style="padding-top:16px;padding-right:16px;padding-bottom:16px;padding-left:16px;">
              <p style="margin-top:0;margin-right:0;margin-bottom:8px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;font-weight:700;color:${EMAIL_BRAND.darkBlue};">Qué ocurrirá al entrar</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:6px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:${EMAIL_BRAND.text};">1. Activarás la cuenta asociada a este email.</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:6px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:${EMAIL_BRAND.text};">2. Crearás tu contraseña.</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:${EMAIL_BRAND.text};">3. Entrarás al panel del centro.</p>
            </td>
          </tr>
        </table>
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:20px;margin-bottom:18px;">
          <tr><td>${emailButton("Activar acceso del centro", params.inviteUrl)}</td></tr>
        </table>
        <p style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${EMAIL_BRAND.muted};">
          Esta cuenta también puede publicar anuncios, usar el chat y participar en Wetudy como cualquier otro usuario.
        </p>
      `,
    }),
  });
}

export async function sendSchoolAdminAccessGrantedEmail(params: {
  to: string;
  schoolName: string;
  idempotencyKey?: string | null;
}) {
  const schoolName = params.schoolName.trim() || "tu centro";
  const signInUrl = `${getEmailBaseUrl()}/auth?next=/admin/school`;

  return sendBrandedEmail({
    to: params.to,
    subject: `Acceso de administrador activado · ${schoolName}`,
    idempotencyKey: params.idempotencyKey,
    text: `Tu cuenta existente ya tiene acceso de administrador para ${schoolName}. Entra en ${signInUrl}`,
    html: brandedEmailShell({
      title: "Acceso de centro activado",
      preview: `Tu cuenta ya puede administrar ${schoolName}.`,
      footer: "Tu cuenta mantiene también todas las funciones normales de Wetudy.",
      body: `
        <h1 style="margin-top:0;margin-right:0;margin-bottom:14px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:27px;line-height:33px;color:${EMAIL_BRAND.text};">Acceso de centro activado</h1>
        <p style="margin-top:0;margin-right:0;margin-bottom:18px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${EMAIL_BRAND.text};">
          Tu cuenta de Wetudy ya tiene permisos para administrar <strong>${escapeEmailHtml(schoolName)}</strong>.
        </p>
        ${emailButton("Entrar al panel del centro", signInUrl)}
      `,
    }),
  });
}
