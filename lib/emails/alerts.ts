
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendNewListingEmail(to: string, title: string, url: string) {
  if (!process.env.RESEND_API_KEY) return;

  await resend.emails.send({
    from: "Wetudy <no-reply@wetudy.com>",
    to,
    subject: "Nuevo anuncio disponible",
    html: `<p>Nuevo anuncio: ${title}</p><a href="${url}">Ver anuncio</a>`,
  });
}
