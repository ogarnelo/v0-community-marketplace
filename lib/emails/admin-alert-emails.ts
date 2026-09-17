const RESEND_API_URL = "https://api.resend.com/emails";

const BRAND = {
  blue: "#2563EB",
  paleBlue: "#EFF6FF",
  text: "#111827",
  muted: "#6B7280",
  border: "#DBEAFE",
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendSupportTicketAdminEmail(params: {
  to: string;
  ticketId: string;
  senderName: string;
  senderEmail: string;
  message: string;
  idempotencyKey?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();

  if (!apiKey || !from || !params.to) return { skipped: true as const };

  const url = `${getBaseUrl()}/admin/super`;
  const safeMessage = params.message.trim();
  const preview = safeMessage.length > 180 ? `${safeMessage.slice(0, 177)}...` : safeMessage;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (params.idempotencyKey) headers["Idempotency-Key"] = params.idempotencyKey;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Nuevo ticket de soporte</title></head><body style="margin:0;background:${BRAND.paleBlue};"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:28px 16px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#fff;border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;"><tr><td style="background:${BRAND.blue};padding:22px 24px;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#fff;">Wetudy</span></td></tr><tr><td style="padding:28px 24px 26px 24px;"><h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.text};">Nuevo ticket de soporte</h1><p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};"><strong>${escapeHtml(params.senderName)}</strong> · ${escapeHtml(params.senderEmail)}</p><p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">${escapeHtml(preview)}</p><a href="${url}" style="display:inline-block;padding:13px 18px;background:${BRAND.blue};border-radius:12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Abrir panel de soporte</a></td></tr><tr><td style="background:#F8FAFC;padding:18px 24px;border-top:1px solid #E5E7EB;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">Ticket ${escapeHtml(params.ticketId)} · Aviso administrativo de Wetudy.</p></td></tr></table></td></tr></table></body></html>`;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: `Nuevo ticket de soporte · ${params.senderName}`,
      html,
      text: `Nuevo ticket de soporte de ${params.senderName} (${params.senderEmail}).\n\n${preview}\n\nAbrir panel: ${url}`,
    }),
  });

  if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
  return response.json();
}
