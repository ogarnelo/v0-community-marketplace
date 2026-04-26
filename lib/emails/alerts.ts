type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

async function sendEmail({ to, subject, html }: SendEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Wetudy <no-reply@wetudy.com>";

  if (!apiKey || !to) {
    return { ok: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("Resend email error:", response.status, text);
    return { ok: false, skipped: false };
  }

  return { ok: true, skipped: false };
}

export async function sendNewListingEmail({
  to,
  title,
  listingId,
}: {
  to: string;
  title: string;
  listingId: string;
}) {
  const url = `${getAppUrl()}/marketplace/listing/${listingId}`;

  return sendEmail({
    to,
    subject: "Nuevo anuncio de un perfil que sigues",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Nuevo anuncio en Wetudy</h2>
        <p>Un perfil que sigues ha publicado: <strong>${title}</strong></p>
        <p><a href="${url}">Ver anuncio</a></p>
      </div>
    `,
  });
}

export async function sendSavedSearchMatchEmail({
  to,
  searchName,
  listingTitle,
  listingId,
}: {
  to: string;
  searchName: string;
  listingTitle: string;
  listingId: string;
}) {
  const url = `${getAppUrl()}/marketplace/listing/${listingId}`;

  return sendEmail({
    to,
    subject: `Nuevo resultado para "${searchName}"`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Hay un nuevo anuncio compatible</h2>
        <p>Tu búsqueda guardada <strong>${searchName}</strong> tiene un nuevo resultado:</p>
        <p><strong>${listingTitle}</strong></p>
        <p><a href="${url}">Ver anuncio</a></p>
      </div>
    `,
  });
}

export async function sendFavoriteSavedEmail({
  to,
  listingTitle,
  listingId,
}: {
  to: string;
  listingTitle: string;
  listingId: string;
}) {
  const url = `${getAppUrl()}/marketplace/listing/${listingId}`;

  return sendEmail({
    to,
    subject: "Alguien ha guardado tu anuncio",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Tu anuncio ha recibido interés</h2>
        <p>Alguien ha guardado <strong>${listingTitle}</strong> en favoritos.</p>
        <p><a href="${url}">Ver anuncio</a></p>
      </div>
    `,
  });
}

export async function sendPriceDropEmail({
  to,
  listingTitle,
  listingId,
}: {
  to: string;
  listingTitle: string;
  listingId: string;
}) {
  const url = `${getAppUrl()}/marketplace/listing/${listingId}`;

  return sendEmail({
    to,
    subject: "Un anuncio guardado ha cambiado de precio",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Precio actualizado</h2>
        <p>El anuncio <strong>${listingTitle}</strong> ha cambiado de precio.</p>
        <p><a href="${url}">Ver anuncio</a></p>
      </div>
    `,
  });
}
