const RESEND_API_URL = "https://api.resend.com/emails";

export const EMAIL_BRAND = {
  blue: "#2563EB",
  darkBlue: "#1D4ED8",
  paleBlue: "#EFF6FF",
  green: "#7EBA28",
  text: "#111827",
  muted: "#6B7280",
  border: "#DBEAFE",
  white: "#FFFFFF",
};

export function getEmailBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.wetudy.com";
}

export function getEmailFrom() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || null;
}

export function escapeEmailHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function emailButton(label: string, href: string, variant: "primary" | "secondary" = "primary") {
  const background = variant === "primary" ? EMAIL_BRAND.blue : EMAIL_BRAND.text;

  return `
    <table cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td bgcolor="${background}" style="background-color:${background};border-radius:12px;">
          <a href="${href}" style="display:inline-block;padding-top:13px;padding-right:18px;padding-bottom:13px;padding-left:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeEmailHtml(label)}</a>
        </td>
      </tr>
    </table>
  `;
}

function brandHeader() {
  const logoUrl = `${getEmailBaseUrl()}/icon.svg`;

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td style="vertical-align:middle;">
          <table cellpadding="0" cellspacing="0" border="0" role="presentation">
            <tr>
              <td style="padding-right:10px;vertical-align:middle;">
                <img src="${logoUrl}" width="40" height="40" border="0" alt="Wetudy" style="display:block;width:40px;height:40px;border-radius:10px;" />
              </td>
              <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:26px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;">Wetudy</td>
            </tr>
          </table>
        </td>
        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#DBEAFE;vertical-align:middle;">Comunidad educativa</td>
      </tr>
    </table>
  `;
}

export function brandedEmailShell(params: {
  title: string;
  preview: string;
  body: string;
  footer?: string;
}) {
  const footer =
    params.footer ||
    "La entrega y el pago se acuerdan directamente entre las partes.";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeEmailHtml(params.title)}</title>
</head>
<body style="margin:0;background-color:${EMAIL_BRAND.paleBlue};">
  <span style="display:none;font-size:1px;color:${EMAIL_BRAND.paleBlue};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeEmailHtml(params.preview)}</span>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" bgcolor="${EMAIL_BRAND.paleBlue}" style="background-color:${EMAIL_BRAND.paleBlue};">
    <tr>
      <td align="center" style="padding-top:28px;padding-right:16px;padding-bottom:28px;padding-left:16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:600px;background-color:#ffffff;border-width:1px;border-style:solid;border-color:${EMAIL_BRAND.border};border-radius:20px;overflow:hidden;">
          <tr>
            <td bgcolor="${EMAIL_BRAND.blue}" style="background-color:${EMAIL_BRAND.blue};padding-top:20px;padding-right:24px;padding-bottom:20px;padding-left:24px;">
              ${brandHeader()}
            </td>
          </tr>
          <tr>
            <td bgcolor="${EMAIL_BRAND.green}" style="height:4px;background-color:${EMAIL_BRAND.green};font-size:1px;line-height:4px;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding-top:28px;padding-right:24px;padding-bottom:26px;padding-left:24px;">
              ${params.body}
            </td>
          </tr>
          <tr>
            <td bgcolor="#F8FAFC" style="background-color:#F8FAFC;padding-top:18px;padding-right:24px;padding-bottom:18px;padding-left:24px;border-top-width:1px;border-top-style:solid;border-top-color:#E5E7EB;">
              <p style="margin-top:0;margin-right:0;margin-bottom:0;margin-left:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${EMAIL_BRAND.muted};">${escapeEmailHtml(footer)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendBrandedEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string | null;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getEmailFrom();

  if (!apiKey || !from || !params.to) {
    return { skipped: true as const };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (params.idempotencyKey) {
    headers["Idempotency-Key"] = params.idempotencyKey;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        content_type: attachment.contentType,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}
