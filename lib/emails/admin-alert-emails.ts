import {
  EMAIL_BRAND,
  brandedEmailShell,
  emailButton,
  escapeEmailHtml,
  getEmailBaseUrl,
  sendBrandedEmail,
} from "@/lib/emails/brand";

export async function sendSupportTicketAdminEmail(params: {
  to: string;
  ticketId: string;
  senderName: string;
  senderEmail: string;
  message: string;
  idempotencyKey?: string | null;
}) {
  const url = `${getEmailBaseUrl()}/admin/super?tab=support#support-ticket-${encodeURIComponent(params.ticketId)}`;
  const safeMessage = params.message.trim();
  const preview = safeMessage.length > 180 ? `${safeMessage.slice(0, 177)}...` : safeMessage;

  return sendBrandedEmail({
    to: params.to,
    subject: `Nuevo ticket de soporte · ${params.senderName}`,
    idempotencyKey: params.idempotencyKey,
    text: `Nuevo ticket de soporte de ${params.senderName} (${params.senderEmail}).\n\n${preview}\n\nAbrir ticket: ${url}`,
    html: brandedEmailShell({
      title: "Nuevo ticket de soporte",
      preview,
      footer: `Ticket ${params.ticketId} · Aviso administrativo de Wetudy.`,
      body: `
        <h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${EMAIL_BRAND.text};">Nuevo ticket de soporte</h1>
        <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${EMAIL_BRAND.text};"><strong>${escapeEmailHtml(params.senderName)}</strong> · ${escapeEmailHtml(params.senderEmail)}</p>
        <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${EMAIL_BRAND.text};">${escapeEmailHtml(preview)}</p>
        ${emailButton("Abrir ticket", url)}
      `,
    }),
  });
}

export async function sendSchoolRegistrationAdminEmail(params: {
  to: string;
  requestId: string;
  requesterEmail: string;
  schoolName: string;
  schoolType: string;
  city: string;
  region: string;
  idempotencyKey?: string | null;
}) {
  const url = `${getEmailBaseUrl()}/admin/super?tab=schools#school-request-${encodeURIComponent(params.requestId)}`;

  return sendBrandedEmail({
    to: params.to,
    subject: `Nueva solicitud de centro · ${params.schoolName}`,
    idempotencyKey: params.idempotencyKey,
    text: `Nueva solicitud de centro: ${params.schoolName}.\n${params.schoolType} · ${params.city} · ${params.region}.\nSolicitado por ${params.requesterEmail}.\n\nEl centro no será público hasta que lo apruebes.\nRevisar: ${url}`,
    html: brandedEmailShell({
      title: "Nueva solicitud de centro",
      preview: `${params.schoolName} ha solicitado alta en Wetudy.`,
      footer: `Solicitud ${params.requestId} · El centro permanece pendiente hasta revisión.`,
      body: `
        <h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${EMAIL_BRAND.text};">Nueva solicitud de centro</h1>
        <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${EMAIL_BRAND.text};"><strong>${escapeEmailHtml(params.schoolName)}</strong></p>
        <p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:${EMAIL_BRAND.text};">${escapeEmailHtml(params.schoolType)} · ${escapeEmailHtml(params.city)} · ${escapeEmailHtml(params.region)}</p>
        <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:${EMAIL_BRAND.muted};">Solicitado por ${escapeEmailHtml(params.requesterEmail)}. El centro no será público hasta que lo apruebes.</p>
        ${emailButton("Revisar solicitud", url)}
      `,
    }),
  });
}
