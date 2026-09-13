const RESEND_API_URL = "https://api.resend.com/emails";

type PaymentEmailParams = {
  to: string;
  recipientName?: string | null;
  listingTitle: string;
  amount: number;
  paymentId?: string | null;
};

type WelcomeEmailParams = {
  to: string;
  recipientName?: string | null;
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || null;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && getFromEmail());
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
  const marketplaceUrl = `${getBaseUrl()}/marketplace`;
  const joinSchoolUrl = `${getBaseUrl()}/onboarding/join-school`;
  const helpUrl = `${getBaseUrl()}/help`;

  return sendEmail({
    to: params.to,
    subject: "Bienvenido/a a Wetudy",
    text: `${firstName}, bienvenida/o a Wetudy. Ya puedes vincular tu centro, buscar material escolar, publicar anuncios con foto y contactar por chat con otras familias. Marketplace: ${marketplaceUrl}. Vincular centro: ${joinSchoolUrl}. Ayuda: ${helpUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;background:#ffffff">
        <div style="border:1px solid #e5e7eb;border-radius:18px;padding:24px">
          <p style="margin:0 0 8px;color:#6b7280;font-size:14px">Wetudy</p>
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2">Bienvenido/a a Wetudy</h1>
          <p style="margin:0 0 16px;line-height:1.6">${firstName}, ya tienes tu espacio para comprar, vender o donar material escolar dentro de una comunidad educativa de confianza.</p>
          <div style="background:#f3f8ea;border:1px solid #dcefc4;border-radius:14px;padding:16px;margin:18px 0">
            <p style="margin:0 0 8px;font-weight:700">Primeros pasos recomendados</p>
            <ol style="margin:0;padding-left:20px;line-height:1.7">
              <li>Vincula tu centro educativo.</li>
              <li>Busca material en el marketplace.</li>
              <li>Publica anuncios con fotos claras cuando quieras vender o donar.</li>
              <li>Usa el chat para acordar la entrega y el pago directamente con la otra persona.</li>
            </ol>
          </div>
          <p style="margin:0 0 20px;line-height:1.6">Wetudy facilita el contacto, el chat y el historial del acuerdo para que todo quede ordenado.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <a href="${marketplaceUrl}" style="display:inline-block;background:#7EBA28;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Ir al marketplace</a>
            <a href="${joinSchoolUrl}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Vincular centro</a>
          </div>
          <p style="margin:20px 0 0;color:#6b7280;font-size:13px;line-height:1.5">¿Necesitas ayuda? Entra en <a href="${helpUrl}" style="color:#111827">Ayuda</a>.</p>
        </div>
      </div>
    `,
  });
}

export async function sendPaymentSucceededEmail(params: PaymentEmailParams) {
  const amount = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(params.amount || 0);
  const firstName = params.recipientName?.trim() || "Hola";
  const activityUrl = `${getBaseUrl()}/account/activity`;

  return sendEmail({
    to: params.to,
    subject: `Pago confirmado · ${params.listingTitle}`,
    text: `${firstName}, tu pago de ${amount} para "${params.listingTitle}" se ha confirmado. Puedes revisar el estado de la operación en ${activityUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="margin:0 0 16px">Pago confirmado</h2>
        <p style="margin:0 0 12px">${firstName}, tu pago para <strong>${params.listingTitle}</strong> se ha confirmado correctamente.</p>
        <p style="margin:0 0 20px">Importe: <strong>${amount}</strong></p>
        <a href="${activityUrl}" style="display:inline-block;background:#7EBA28;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">Ver actividad</a>
      </div>
    `,
  });
}

export async function sendPaymentFailedEmail(params: PaymentEmailParams) {
  const amount = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(params.amount || 0);
  const firstName = params.recipientName?.trim() || "Hola";
  const activityUrl = `${getBaseUrl()}/account/activity`;

  return sendEmail({
    to: params.to,
    subject: `Pago fallido · ${params.listingTitle}`,
    text: `${firstName}, no se pudo completar el pago de ${amount} para "${params.listingTitle}". Puedes intentarlo de nuevo desde ${activityUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="margin:0 0 16px">No se pudo completar el pago</h2>
        <p style="margin:0 0 12px">${firstName}, hubo un problema al procesar el pago para <strong>${params.listingTitle}</strong>.</p>
        <p style="margin:0 0 20px">Importe pendiente: <strong>${amount}</strong></p>
        <a href="${activityUrl}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">Revisar operación</a>
      </div>
    `,
  });
}
