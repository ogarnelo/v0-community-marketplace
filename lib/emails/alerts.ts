const RESEND_API_URL = "https://api.resend.com/emails";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || null;
}

async function sendEmail({ to, subject, html, text }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();

  if (!apiKey || !from || !to) {
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
      to: [to],
      subject,
      html,
      text: text || subject,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Resend email error:", response.status, body);
    return { skipped: false as const, error: body };
  }

  return { skipped: false as const, ok: true as const };
}

export async function sendNewListingEmail(params: { to: string; title: string; url: string }) {
  return sendEmail({
    to: params.to,
    subject: "Nuevo anuncio disponible en Wetudy",
    text: `Nuevo anuncio: ${params.title}. ${params.url}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Nuevo anuncio en Wetudy</h2><p><strong>${params.title}</strong></p><p><a href="${params.url}">Ver anuncio</a></p></div>`,
  });
}

export async function sendSavedSearchMatchEmail(params: {
  to: string;
  searchName: string;
  listingTitle: string;
  listingId: string;
}) {
  const url = `${getAppUrl()}/marketplace/listing/${params.listingId}`;
  return sendEmail({
    to: params.to,
    subject: `Nuevo resultado para "${params.searchName}"`,
    text: `Hay un nuevo resultado para ${params.searchName}: ${params.listingTitle}. ${url}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Nuevo resultado compatible</h2><p>Tu búsqueda guardada <strong>${params.searchName}</strong> tiene un nuevo resultado:</p><p><strong>${params.listingTitle}</strong></p><p><a href="${url}">Ver anuncio</a></p></div>`,
  });
}

export async function sendFavoriteSavedEmail(params: { to: string; listingTitle: string; listingId: string }) {
  const url = `${getAppUrl()}/marketplace/listing/${params.listingId}`;
  return sendEmail({
    to: params.to,
    subject: "Alguien ha guardado tu anuncio",
    text: `Alguien ha guardado ${params.listingTitle}. ${url}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Tu anuncio está generando interés</h2><p>Alguien ha guardado <strong>${params.listingTitle}</strong> en favoritos.</p><p><a href="${url}">Ver anuncio</a></p></div>`,
  });
}

export async function sendPriceDropEmail(params: { to: string; listingTitle: string; listingId: string }) {
  const url = `${getAppUrl()}/marketplace/listing/${params.listingId}`;
  return sendEmail({
    to: params.to,
    subject: "Un anuncio guardado ha cambiado de precio",
    text: `${params.listingTitle} ha cambiado de precio. ${url}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Precio actualizado</h2><p>El anuncio <strong>${params.listingTitle}</strong> ha cambiado de precio.</p><p><a href="${url}">Ver anuncio</a></p></div>`,
  });
}
