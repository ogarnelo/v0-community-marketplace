import {
  EMAIL_BRAND,
  brandedEmailShell,
  emailButton,
  escapeEmailHtml,
  getEmailBaseUrl,
  sendBrandedEmail,
} from "@/lib/emails/brand";

export async function sendSavedSearchMatchEmail(params: {
  to: string;
  listingId: string;
  listingTitle: string;
  idempotencyKey?: string | null;
}) {
  const url = `${getEmailBaseUrl()}/marketplace/listing/${params.listingId}`;
  const title = escapeEmailHtml(params.listingTitle);

  return sendBrandedEmail({
    to: params.to,
    subject: `Nuevo anuncio que coincide con tu búsqueda · ${params.listingTitle}`,
    idempotencyKey: params.idempotencyKey,
    text: `Ha aparecido algo que buscabas: "${params.listingTitle}" coincide con uno de tus avisos guardados. Ver anuncio: ${url}\n\nLa entrega y el pago se acuerdan directamente entre las partes.`,
    html: brandedEmailShell({
      title: "Ha aparecido algo que buscabas",
      preview: `${params.listingTitle} coincide con uno de tus avisos guardados.`,
      body: `
        <h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${EMAIL_BRAND.text};">Ha aparecido algo que buscabas</h1>
        <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${EMAIL_BRAND.text};">Se ha publicado <strong>${title}</strong> y coincide con uno de tus avisos guardados.</p>
        ${emailButton("Ver anuncio", url)}
      `,
    }),
  });
}
