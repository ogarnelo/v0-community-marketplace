import {
  EMAIL_BRAND,
  brandedEmailShell,
  emailButton,
  escapeEmailHtml,
  getEmailBaseUrl,
  sendBrandedEmail,
} from "@/lib/emails/brand";
import type { SchoolImpactReport } from "@/lib/reports/school-impact-report";

export async function sendMonthlySchoolImpactEmail(params: {
  to: string;
  report: SchoolImpactReport;
  pdf: Uint8Array;
}) {
  const { report } = params;
  const dashboardUrl = `${getEmailBaseUrl()}/admin/school`;

  return sendBrandedEmail({
    to: params.to,
    subject: `Informe mensual de impacto · ${report.school.name} · ${report.periodLabel}`,
    idempotencyKey: `school-impact-${report.school.id}-${report.periodKey}-${params.to.toLowerCase()}`,
    attachments: [
      {
        filename: `wetudy-impacto-${report.periodKey}.pdf`,
        content: Buffer.from(params.pdf).toString("base64"),
        contentType: "application/pdf",
      },
    ],
    text:
      `Informe mensual de impacto de ${report.school.name} (${report.periodLabel}).\n\n` +
      `Artículos reutilizados: ${report.reusedItems}.\n` +
      `Donaciones: ${report.donatedItems}.\n` +
      `Ventas: ${report.soldItems}.\n` +
      `CO2e potencialmente evitado estimado: ${report.estimatedAvoidedCo2.toFixed(1)} kg.\n\n` +
      `Adjuntamos el PDF del informe. Dashboard: ${dashboardUrl}`,
    html: brandedEmailShell({
      title: "Informe mensual de impacto",
      preview: `${report.school.name}: resumen de impacto de ${report.periodLabel}.`,
      footer:
        "Las emisiones potencialmente evitadas son una estimación separada de la huella propia del centro y de Wetudy.",
      body: `
        <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${EMAIL_BRAND.text};">Informe mensual de impacto</h1>
        <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${EMAIL_BRAND.muted};">
          ${escapeEmailHtml(report.school.name)} · ${escapeEmailHtml(report.periodLabel)}
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:18px;">
          <tr>
            <td style="width:50%;padding:10px;background:#F8FAFC;border:1px solid #E5E7EB;">
              <strong style="font-family:Arial;font-size:22px;color:${EMAIL_BRAND.text};">${report.reusedItems}</strong><br />
              <span style="font-family:Arial;font-size:12px;color:${EMAIL_BRAND.muted};">artículos reutilizados</span>
            </td>
            <td style="width:50%;padding:10px;background:#F8FAFC;border:1px solid #E5E7EB;">
              <strong style="font-family:Arial;font-size:22px;color:${EMAIL_BRAND.text};">${report.estimatedAvoidedCo2.toFixed(1)} kg</strong><br />
              <span style="font-family:Arial;font-size:12px;color:${EMAIL_BRAND.muted};">CO₂e potencialmente evitado</span>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:${EMAIL_BRAND.text};">
          Se adjunta el informe completo en PDF con metodología, alcance y fuentes.
        </p>
        ${emailButton("Abrir dashboard del centro", dashboardUrl)}
      `,
    }),
  });
}
