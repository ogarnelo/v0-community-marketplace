const RESEND_API_URL = "https://api.resend.com/emails";

const BRAND = {
  name: "Wetudy",
  blue: "#2563EB",
  darkBlue: "#1D4ED8",
  paleBlue: "#EFF6FF",
  green: "#7EBA28",
  text: "#111827",
  muted: "#6B7280",
  border: "#DBEAFE",
};

type PaymentEmailParams = {
  to: string;
  recipientName?: string | null;
  listingTitle: string;
  amount: number;
  paymentId?: string | null;
  conversationId?: string | null;
};

type WelcomeEmailParams = {
  to: string;
  recipientName?: string | null;
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.wetudy.com";
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || null;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && getFromEmail());
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function button(label: string, href: string, variant: "primary" | "secondary" = "primary") {
  const background = variant === "primary" ? BRAND.blue : BRAND.text;
  return `
    <table cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td bgcolor="${background}" style="background-color:${background};border-radius:12px;">
          <a href="${href}" style="display:inline-block;padding-top:13px;padding-right:18px;padding-bottom:13px;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${label}</a>
        </td>
      </tr>
    </table>
  `;
}

function wordmark() {
  const logoUrl = `${getBaseUrl()}/icon.svg`;
  return `
    <table cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td style="padding-right:10px;vertical-align:middle;">
          <img src="${logoUrl}" width="40" height="40" border="0" alt="Wetudy" style="display:block;width:40px;height:40px;border-radius:10px;" />
        </td>
        <td style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:24px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;vertical-align:middle;">Wetudy</td>
      </tr>
    </table>
  `;
}

function emailShell(params: { preview: string; title: string; body: string }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;background-color:${BRAND.paleBlue};">
  <span style="display:none;font-size:1px;color:${BRAND.paleBlue};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(params.preview)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${BRAND.paleBlue}" style="background-color:${BRAND.paleBlue};">
    <tr>
      <td align="center" style="padding-top:28px;padding-right:16px;padding-bottom:28px;padding-left:16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;background-color:#ffffff;border-width:1px;border-style:solid;border-color:${BRAND.border};border-radius:20px;overflow:hidden;">
          <tr>
            <td bgcolor="${BRAND.blue}" style="background-color:${BRAND.blue};padding-top:22px;padding-right:24px;padding-bottom:22px;padding-left:24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="vertical-align:middle;">${wordmark()}</td>
                  <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#DBEAFE;vertical-align:middle;">Comunidad educativa</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="${BRAND.green}" style="height:4px;background-color:${BRAND.green};font-size:1px;line-height:4px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding-top:28px;padding-right:24px;padding-bottom:26px;padding-left:24px;">
              ${params.body}
            </td>
          </tr>
          <tr>
            <td bgcolor="#F8FAFC" style="background-color:#F8FAFC;padding-top:18px;padding-right:24px;padding-bottom:18px;padding-left:24px;border-top-width:1px;border-top-style:solid;border-top-color:#E5E7EB;">
              <p style="margin-top:0;margin-right:0;margin-bottom:6px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:${BRAND.muted};">Wetudy facilita el contacto, el chat y el historial del acuerdo.</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BRAND.muted};">La entrega y el pago se acuerdan directamente entre las partes.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();

  if (!apiKey || !from || !params.to) {
    return { skipped: true as const };
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error ${response.status}: ${body}`);
  }

  return response.json();
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const firstName = params.recipientName?.trim() || "Hola";
  const safeFirstName = escapeHtml(firstName);
  const marketplaceUrl = `${getBaseUrl()}/marketplace`;
  const joinSchoolUrl = `${getBaseUrl()}/onboarding/join-school`;
  const helpUrl = `${getBaseUrl()}/help`;

  return sendEmail({
    to: params.to,
    subject: "Bienvenido/a a Wetudy",
    text: `${firstName}, bienvenida/o a Wetudy. Ya puedes vincular tu centro, buscar material escolar, publicar anuncios con foto y contactar por chat con otras familias. Marketplace: ${marketplaceUrl}. Vincular centro: ${joinSchoolUrl}. Ayuda: ${helpUrl}`,
    html: emailShell({
      title: "Bienvenido/a a Wetudy",
      preview: "Empieza vinculando tu centro, buscando material o publicando tu primer anuncio.",
      body: `
        <h1 style="margin-top:0;margin-right:0;margin-bottom:14px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:34px;color:${BRAND.text};">Bienvenido/a a Wetudy</h1>
        <p style="margin-top:0;margin-right:0;margin-bottom:16px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:${BRAND.text};">${safeFirstName}, ya tienes tu espacio para comprar, vender o donar material escolar dentro de una comunidad educativa de confianza.</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${BRAND.paleBlue}" style="background-color:${BRAND.paleBlue};border-width:1px;border-style:solid;border-color:${BRAND.border};border-radius:16px;">
          <tr>
            <td style="padding-top:18px;padding-right:18px;padding-bottom:18px;padding-left:18px;">
              <p style="margin-top:0;margin-right:0;margin-bottom:10px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;font-weight:700;color:${BRAND.darkBlue};">Primeros pasos recomendados</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:7px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND.text};">1. Vincula tu centro educativo cuando tengas el código o quieras priorizar tu comunidad.</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:7px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND.text};">2. Busca libros, uniformes, mochilas o material escolar.</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:7px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND.text};">3. Publica anuncios con fotos claras si quieres vender o donar.</p>
              <p style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:${BRAND.text};">4. Usa el chat para acordar la entrega y el pago directamente con la otra persona.</p>
            </td>
          </tr>
        </table>
        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:20px;margin-bottom:18px;">
          <tr>
            <td style="padding-right:10px;">${button("Ir al marketplace", marketplaceUrl)}</td>
            <td>${button("Añadir centro", joinSchoolUrl, "secondary")}</td>
          </tr>
        </table>
        <p style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${BRAND.muted};">¿Necesitas ayuda? Entra en <a href="${helpUrl}" style="color:${BRAND.darkBlue};text-decoration:underline;">Ayuda</a>.</p>
      `,
    }),
  });
}

export async function sendPaymentSucceededEmail(params: PaymentEmailParams) {
  const amount = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(params.amount || 0);
  const firstName = params.recipientName?.trim() || "Hola";
  const activityUrl = params.conversationId
    ? `${getBaseUrl()}/messages/${encodeURIComponent(params.conversationId)}`
    : `${getBaseUrl()}/account/activity`;

  return sendEmail({
    to: params.to,
    subject: `Pago confirmado · ${params.listingTitle}`,
    text: `${firstName}, tu pago de ${amount} para "${params.listingTitle}" se ha confirmado. Puedes revisar el estado de la operación en ${activityUrl}`,
    html: emailShell({
      title: "Pago confirmado",
      preview: `Tu pago de ${amount} se ha confirmado correctamente.`,
      body: `
        <h1 style="margin-top:0;margin-right:0;margin-bottom:14px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.text};">Pago confirmado</h1>
        <p style="margin-top:0;margin-right:0;margin-bottom:12px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${BRAND.text};">${escapeHtml(firstName)}, tu pago para <strong>${escapeHtml(params.listingTitle)}</strong> se ha confirmado correctamente.</p>
        <p style="margin-top:0;margin-right:0;margin-bottom:20px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">Importe: <strong>${amount}</strong></p>
        ${button("Ver actividad", activityUrl)}
      `,
    }),
  });
}

export async function sendPaymentFailedEmail(params: PaymentEmailParams) {
  const amount = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(params.amount || 0);
  const firstName = params.recipientName?.trim() || "Hola";
  const activityUrl = params.conversationId
    ? `${getBaseUrl()}/messages/${encodeURIComponent(params.conversationId)}`
    : `${getBaseUrl()}/account/activity`;

  return sendEmail({
    to: params.to,
    subject: `Pago fallido · ${params.listingTitle}`,
    text: `${firstName}, no se pudo completar el pago de ${amount} para "${params.listingTitle}". Puedes intentarlo de nuevo desde ${activityUrl}`,
    html: emailShell({
      title: "No se pudo completar el pago",
      preview: "Revisa la operación para continuar.",
      body: `
        <h1 style="margin-top:0;margin-right:0;margin-bottom:14px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${BRAND.text};">No se pudo completar el pago</h1>
        <p style="margin-top:0;margin-right:0;margin-bottom:12px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${BRAND.text};">${escapeHtml(firstName)}, hubo un problema al procesar el pago para <strong>${escapeHtml(params.listingTitle)}</strong>.</p>
        <p style="margin-top:0;margin-right:0;margin-bottom:20px;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${BRAND.text};">Importe pendiente: <strong>${amount}</strong></p>
        ${button("Revisar operación", activityUrl, "secondary")}
      `,
    }),
  });
}
