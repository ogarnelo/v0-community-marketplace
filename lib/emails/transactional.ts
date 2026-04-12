const RESEND_API_URL = "https://api.resend.com/emails";

type PaymentEmailParams = {
  to: string;
  recipientName?: string | null;
  listingTitle: string;
  amount: number;
  paymentId?: string | null;
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || null;
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
