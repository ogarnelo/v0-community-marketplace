
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "Wetudy <no-reply@wetudy.app>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://www.wetudy.com";

type TransactionalEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function sendTransactionalEmail(params: TransactionalEmailParams) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !params.to) {
    return { ok: false, skipped: true } as const;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text || stripHtml(params.html),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "No se pudo enviar el email transaccional.");
  }

  return { ok: true } as const;
}

function wrapEmail(title: string, intro: string, ctaLabel: string, ctaHref: string, extra?: string) {
  return `
    <div style="font-family: Inter, Arial, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden;">
        <div style="padding:24px 24px 8px;">
          <p style="margin:0 0 8px; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#7EBA28; font-weight:700;">Wetudy</p>
          <h1 style="margin:0 0 12px; font-size:24px; line-height:1.2;">${title}</h1>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#334155;">${intro}</p>
          ${extra ? `<div style="margin:0 0 20px; padding:14px 16px; border-radius:12px; background:#f8fafc; color:#334155; font-size:14px; line-height:1.6; border:1px solid #e2e8f0;">${extra}</div>` : ""}
          <a href="${ctaHref}" style="display:inline-block; background:#7EBA28; color:#fff; text-decoration:none; padding:12px 18px; border-radius:12px; font-weight:600;">${ctaLabel}</a>
        </div>
        <div style="padding:16px 24px 24px; font-size:12px; color:#64748b;">
          También puedes abrir Wetudy aquí: <a href="${SITE_URL}" style="color:#7EBA28;">${SITE_URL}</a>
        </div>
      </div>
    </div>
  `;
}

export function buildPaymentPaidEmail(params: {
  role: "buyer" | "seller";
  listingTitle: string;
  counterpartyName: string;
  amountLabel: string;
  href: string;
}) {
  if (params.role === "buyer") {
    return {
      subject: `Pago confirmado · ${params.listingTitle}`,
      html: wrapEmail(
        "Tu pago se ha confirmado",
        `Ya puedes seguir la operación de <strong>${params.listingTitle}</strong> desde tus mensajes en Wetudy.`,
        "Ver operación",
        params.href,
        `Importe del artículo: <strong>${params.amountLabel}</strong><br/>Vendedor: <strong>${params.counterpartyName}</strong><br/>Tu compra queda protegida al pagar dentro de la plataforma.`
      ),
    };
  }

  return {
    subject: `Has vendido ${params.listingTitle}`,
    html: wrapEmail(
      "Has recibido una compra confirmada",
      `La operación de <strong>${params.listingTitle}</strong> ya tiene el pago confirmado en Wetudy.`,
      "Abrir conversación",
      params.href,
      `Comprador: <strong>${params.counterpartyName}</strong><br/>Importe del artículo: <strong>${params.amountLabel}</strong>`
    ),
  };
}

export function buildPaymentFailedEmail(params: {
  listingTitle: string;
  href: string;
}) {
  return {
    subject: `No se pudo completar el pago · ${params.listingTitle}`,
    html: wrapEmail(
      "Tu pago no se pudo completar",
      `No hemos podido confirmar el cobro de <strong>${params.listingTitle}</strong>. Puedes volver a intentarlo desde la conversación o desde tu actividad.`,
      "Revisar operación",
      params.href
    ),
  };
}

export function buildOfferAcceptedEmail(params: {
  listingTitle: string;
  amountLabel: string;
  href: string;
}) {
  return {
    subject: `Tu oferta ha sido aceptada · ${params.listingTitle}`,
    html: wrapEmail(
      "Tu oferta ha sido aceptada",
      `Ya puedes cerrar la compra de <strong>${params.listingTitle}</strong> en Wetudy.`,
      "Ir al chat",
      params.href,
      `Importe aceptado: <strong>${params.amountLabel}</strong>`
    ),
  };
}
