type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function sendEmail({ to, subject, html }: SendEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) return;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Error enviando email con Resend:", text);
  }
}

function paymentStatusCopy(deliveryMethod?: string | null) {
  if (deliveryMethod === "shipping") {
    return "Tu pago se ha confirmado. El siguiente paso es preparar el envío y compartir el seguimiento en Wetudy.";
  }

  return "Tu pago se ha confirmado. Ya podéis coordinar la entrega en mano desde el chat de Wetudy.";
}

export async function sendPaymentConfirmedEmails(params: {
  buyerEmail?: string | null;
  sellerEmail?: string | null;
  buyerName?: string | null;
  sellerName?: string | null;
  listingTitle: string;
  amount: number;
  offerId?: string | null;
  deliveryMethod?: string | null;
}) {
  if (!isEmailConfigured()) return;

  const checkoutUrl = params.offerId ? `${getBaseUrl()}/checkout/${params.offerId}` : `${getBaseUrl()}/account/activity`;
  const activityUrl = `${getBaseUrl()}/account/activity`;
  const summary = paymentStatusCopy(params.deliveryMethod);

  if (params.buyerEmail) {
    await sendEmail({
      to: params.buyerEmail,
      subject: `Pago confirmado · ${params.listingTitle}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin:0 0 12px">Pago confirmado</h2>
          <p>Hola ${params.buyerName || ""},</p>
          <p>Tu pago por <strong>${params.listingTitle}</strong> se ha confirmado por <strong>${params.amount.toFixed(2)} €</strong>.</p>
          <p>${summary}</p>
          <p><a href="${activityUrl}">Ver mi actividad</a></p>
        </div>
      `,
    });
  }

  if (params.sellerEmail) {
    await sendEmail({
      to: params.sellerEmail,
      subject: `Has vendido ${params.listingTitle}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2 style="margin:0 0 12px">Venta confirmada</h2>
          <p>Hola ${params.sellerName || ""},</p>
          <p>Se ha confirmado el pago de <strong>${params.listingTitle}</strong> por <strong>${params.amount.toFixed(2)} €</strong>.</p>
          <p>${summary}</p>
          <p><a href="${activityUrl}">Ver mi actividad</a> · <a href="${checkoutUrl}">Ver detalle</a></p>
        </div>
      `,
    });
  }
}

export async function sendPaymentFailedEmail(params: {
  buyerEmail?: string | null;
  buyerName?: string | null;
  listingTitle: string;
  offerId?: string | null;
}) {
  if (!isEmailConfigured() || !params.buyerEmail) return;

  const retryUrl = params.offerId ? `${getBaseUrl()}/checkout/${params.offerId}` : `${getBaseUrl()}/account/activity`;

  await sendEmail({
    to: params.buyerEmail,
    subject: `No se pudo completar tu pago · ${params.listingTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin:0 0 12px">Pago no completado</h2>
        <p>Hola ${params.buyerName || ""},</p>
        <p>No hemos podido completar el pago de <strong>${params.listingTitle}</strong>.</p>
        <p>Puedes volver a intentarlo desde Wetudy cuando quieras.</p>
        <p><a href="${retryUrl}">Reintentar pago</a></p>
      </div>
    `,
  });
}
