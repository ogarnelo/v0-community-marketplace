const RESEND_API_URL = "https://api.resend.com/emails";

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

export async function sendSavedSearchMatchEmail(params: {
  to: string;
  listingId: string;
  listingTitle: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getFromEmail();
  if (!apiKey || !from || !params.to) return { skipped: true as const };

  const url = `${getBaseUrl()}/marketplace/listing/${params.listingId}`;
  const title = escapeHtml(params.listingTitle);
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#EFF6FF;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:28px 16px;"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#fff;border:1px solid #DBEAFE;border-radius:20px;overflow:hidden;"><tr><td style="background:#2563EB;padding:22px 24px;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;color:#fff;">Wetudy</td></tr><tr><td style="padding:28px 24px;"><h1 style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:26px;color:#111827;">Ha aparecido algo que buscabas</h1><p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:#111827;">Se ha publicado <strong>${title}</strong> y coincide con uno de tus avisos guardados.</p><a href="${url}" style="display:inline-block;margin-top:18px;padding:13px 18px;background:#2563EB;border-radius:12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">Ver anuncio</a></td></tr><tr><td style="background:#F8FAFC;padding:18px 24px;border-top:1px solid #E5E7EB;"><p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6B7280;">La entrega y el pago se acuerdan directamente entre las partes.</p></td></tr></table></td></tr></table></body></html>`;
  const text = `Ha aparecido algo que buscabas: "${params.listingTitle}" coincide con uno de tus avisos guardados. Ver anuncio: ${url}\n\nLa entrega y el pago se acuerdan directamente entre las partes.`;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [params.to], subject: `Nuevo anuncio que coincide con tu búsqueda · ${params.listingTitle}`, html, text }),
  });

  if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
  return response.json();
}
