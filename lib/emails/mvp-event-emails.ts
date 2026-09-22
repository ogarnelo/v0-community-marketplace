const RESEND_API_URL = "https://api.resend.com/emails";

const BRAND = {
  blue: "#2563EB",
  paleBlue: "#EFF6FF",
  text: "#111827",
  muted: "#6B7280",
  border: "#DBEAFE",
  green: "#7EBA28",
};

type EventEmailParams = {
  to: string;
  recipientName?: string | null;
  listingTitle: string;
  conversationId?: string | null;
  idempotencyKey?: string | null;
  agreementType?: "sale" | "donation" | string | null;
  amount?: number | null;
  actorName?: string | null;
  actorRole?: "buyer" | "seller" | null;
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.wetudy.com";
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
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(params.title)}</title></head><body style="margin:0;background:${BRAND.paleBlue};"><span style="display:none;font-size:1px;color:${BRAND.paleBlue};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(params.preview)}</span><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:28px 16px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#fff;border:1px solid ${BRAND.border};border-radius:20px;overflow:hidden;"><tr><td style="background:${BRAND.blue};padding:20px 24px;"><table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr><td style="padding-right:10px;vertical-align:middle;"><img src="${getBaseUrl()}/icon.svg" width="40" height="40" border="0" alt="Wetudy" style="display:block;width:40px;height:40px;border-radius:10px;" /></td><td style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#fff;vertical-align:middle;">Wetudy</td></tr></table></td></tr><tr><td style="height:4px;background:${BRAND.green};font-size:1px;line-height:4px;">&nbsp;</td></tr><tr><td style="padding:28px 24px 26px 24px;">${params.body}</td></tr><tr><td style="background:#F8FAFC;padding:18px 24px;border-top:1px solid #E5E7EB;"><p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:${BRAND.muted};">Wetudy facilita el contacto, el chat y el historial del acuerdo.</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">La entrega y el pago se acuerdan directamente entre las partes.</p></td></tr></table></td></tr></table></body></html>`;
}

async function sendEmail(params: { to: string; subject: string; html: string; text: string; idempotencyKey?: string | null }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();

  if (!apiKey || !from || !params.to) return { skipped: true as const };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (params.idempotencyKey) headers["Idempotency-Key"] = params.idempotencyKey;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers,
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
    idempotencyKey: params.idempotencyKey,
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
  const url = params.conversationId
    ? `${getBaseUrl()}/messages/${encodeURIComponent(params.conversationId)}#agreement-panel`
    : `${getBaseUrl()}/messages`;
  const name = greeting(params);
  const actorName = params.actorName?.trim() || "La otra persona";
  const isDonation = params.agreementType === "donation";
  const amount =
    typeof params.amount === "number" && Number.isFinite(params.amount)
      ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(params.amount)
      : null;
  const action = isDonation
    ? params.actorRole === "seller"
      ? `${actorName} quiere darte este artículo.`
      : `${actorName} quiere quedarse con este artículo.`
    : amount
      ? params.actorRole === "buyer"
        ? `${actorName} te ofrece ${amount}.`
        : `${actorName} te propone ${amount}.`
      : `${actorName} te ha enviado una oferta.`;

  return sendEmail({
    to: params.to,
    idempotencyKey: params.idempotencyKey,
    subject: isDonation
      ? `Solicitud de donación · ${params.listingTitle}`
      : `Nueva oferta · ${params.listingTitle}`,
    text: `${name}, ${action} Abre el chat para responder sobre "${params.listingTitle}": ${url}`,
    html: shell({
      title: isDonation ? "Nueva solicitud de donación" : "Nueva oferta",
      preview: `${action} ${params.listingTitle}`,
      body: `<h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.text};">${isDonation ? "Nueva solicitud de donación" : "Nueva oferta"}</h1><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${BRAND.text};">${escapeHtml(name)}, ${escapeHtml(action)}</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">Sobre <strong>${escapeHtml(params.listingTitle)}</strong>. Puedes responder directamente desde el chat.</p>${button("Abrir chat", url)}`,
    }),
  });
}

export async function sendAgreementConfirmedEmail(params: EventEmailParams) {
  const url = params.conversationId
    ? `${getBaseUrl()}/messages/${encodeURIComponent(params.conversationId)}#agreement-panel`
    : `${getBaseUrl()}/messages`;
  const name = greeting(params);

  return sendEmail({
    to: params.to,
    idempotencyKey: params.idempotencyKey,
    subject: `Acuerdo cerrado · ${params.listingTitle}`,
    text: `${name}, el acuerdo sobre "${params.listingTitle}" está cerrado. Seguid hablando por el chat para concretar la entrega: ${url}`,
    html: shell({
      title: "Acuerdo cerrado",
      preview: `El acuerdo sobre ${params.listingTitle} está cerrado.`,
      body: `<h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.text};">¡Hecho!</h1><p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${BRAND.text};">${escapeHtml(name)}, el acuerdo sobre <strong>${escapeHtml(params.listingTitle)}</strong> está cerrado.</p><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">Seguid hablando por el chat para concretar la entrega.</p>${button("Volver al chat", url)}`,
    }),
  });
}
