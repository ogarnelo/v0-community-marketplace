const RESEND_API_URL = "https://api.resend.com/emails";

const BRAND = {
  blue: "#2563EB",
  paleBlue: "#EFF6FF",
  text: "#111827",
  muted: "#6B7280",
  border: "#DBEAFE",
};

type EventEmailParams = {
  to: string;
  recipientName?: string | null;
  listingTitle: string;
  conversationId?: string | null;
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

function button(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:18px;padding:13px 18px;background:${BRAND.blue};border-radius:12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function shell(params: { title: string; preview: string; body: string }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(params.title)}</title></head><body style="margin:0;background:${BRAND.paleBlue};"><span style="display:none;font-size:1px;color:${BRAND.paleBlue};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(params.preview)}</span><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:28px 16px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#fff;border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;"><tr><td style="background:${BRAND.blue};padding:22px 24px;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#fff;">Wetudy</span></td></tr><tr><td style="padding:28px 24px 26px 24px;">${params.body}</td></tr><tr><td style="background:#F8FAFC;padding:18px 24px;border-top:1px solid #E5E7EB;"><p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:${BRAND.muted};">Wetudy facilita el contacto, el chat y el historial del acuerdo.</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">La entrega y el pago se acuerdan directamente entre las partes.</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendEmail(params: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();

  if (!apiKey || !from || !params.to) return { skipped: true as const };

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [params.to], subject: params.subject, html: params.html, text: params.text }),
  });

  if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
  return response.json();
}

function greeting(params: EventEmailParams) {
  return params.recipientName?.trim() || "Hola";
}

export async function sendFirstMessageEmail(params: EventEmailParams) {
  const url = `${getBaseUrl()}/messages/${params.conversationId || ""}`;
  const name = greeting(params);
  return sendEmail({
    to: params.to,
    subject: `Nuevo mensaje sobre ${params.listingTitle}`,
    text: `${name}, tienes un nuevo mensaje sobre "${params.listingTitle}". Responde en Wetudy para acordar los detalles por chat: ${url}`,
    html: shell({
      title: "Nuevo mensaje en Wetudy",
      preview: `Tienes un nuevo mensaje sobre ${params.listingTitle}.`,
      body: `<h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.text};">Nuevo mensaje</h1><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${BRAND.text};">${escapeHtml(name)}, tienes un nuevo mensaje sobre <strong>${escapeHtml(params.listingTitle)}</strong>.</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">Responde en Wetudy para acordar los detalles por chat.</p>${button("Abrir conversación", url)}`,
    }),
  });
}

export async function sendAgreementProposedEmail(params: EventEmailParams) {
  const url = `${getBaseUrl()}/account/activity`;
  const name = greeting(params);
  return sendEmail({
    to: params.to,
    subject: `Propuesta de acuerdo · ${params.listingTitle}`,
    text: `${name}, tienes una propuesta de acuerdo sobre "${params.listingTitle}". Revísala en Wetudy: ${url}`,
    html: shell({
      title: "Propuesta de acuerdo",
      preview: `Tienes una propuesta de acuerdo sobre ${params.listingTitle}.`,
      body: `<h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.text};">Propuesta de acuerdo</h1><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${BRAND.text};">${escapeHtml(name)}, tienes una propuesta de acuerdo sobre <strong>${escapeHtml(params.listingTitle)}</strong>.</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">Revísala en Wetudy y usa el chat para acordar los detalles.</p>${button("Ver actividad", url)}`,
    }),
  });
}

export async function sendAgreementConfirmedEmail(params: EventEmailParams) {
  const url = `${getBaseUrl()}/account/activity`;
  const name = greeting(params);
  return sendEmail({
    to: params.to,
    subject: `Acuerdo confirmado · ${params.listingTitle}`,
    text: `${name}, el acuerdo sobre "${params.listingTitle}" se ha confirmado. La entrega y el pago se acuerdan directamente entre las partes. Actividad: ${url}`,
    html: shell({
      title: "Acuerdo confirmado",
      preview: `El acuerdo sobre ${params.listingTitle} se ha confirmado.`,
      body: `<h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.text};">Acuerdo confirmado</h1><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${BRAND.text};">${escapeHtml(name)}, el acuerdo sobre <strong>${escapeHtml(params.listingTitle)}</strong> se ha confirmado.</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">La entrega y el pago se acuerdan directamente entre las partes.</p>${button("Ver actividad", url)}`,
    }),
  });
}
