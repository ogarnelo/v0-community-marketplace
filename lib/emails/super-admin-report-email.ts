import {
  EMAIL_BRAND,
  brandedEmailShell,
  emailButton,
  escapeEmailHtml,
  getEmailBaseUrl,
  sendBrandedEmail,
} from "@/lib/emails/brand";
import type { SuperAdminReport } from "@/lib/reports/super-admin-report";
import {
  renderSuperAdminCsv,
  renderSuperAdminPdf,
} from "@/lib/reports/super-admin-report";

export type SuperAdminReportFormat = "pdf" | "csv" | "both";

export async function sendSuperAdminReportEmail(params: {
  to: string;
  subscriptionId: string;
  report: SuperAdminReport;
  format: SuperAdminReportFormat;
  scheduledFor: string;
}) {
  const dashboardUrl = `${getEmailBaseUrl()}/admin/super/sustainability?range=${params.report.range}`;
  const attachments: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }> = [];

  if (params.format === "pdf" || params.format === "both") {
    attachments.push({
      filename: `wetudy-informe-global-${params.report.range}.pdf`,
      content: Buffer.from(renderSuperAdminPdf(params.report)).toString("base64"),
      contentType: "application/pdf",
    });
  }

  if (params.format === "csv" || params.format === "both") {
    attachments.push({
      filename: `wetudy-informe-global-${params.report.range}.csv`,
      content: Buffer.from(renderSuperAdminCsv(params.report), "utf8").toString("base64"),
      contentType: "text/csv; charset=utf-8",
    });
  }

  return sendBrandedEmail({
    to: params.to,
    subject: `Informe global Wetudy · ${params.report.periodLabel}`,
    idempotencyKey: `super-admin-report-${params.subscriptionId}-${params.scheduledFor}`,
    attachments,
    text:
      `Informe global Wetudy (${params.report.periodLabel}).\n\n` +
      `Reutilizaciones confirmadas: ${params.report.impact.confirmedReuses}.\n` +
      `CO2e potencialmente evitado: ${params.report.impact.estimatedAvoidedCo2.toFixed(1)} kg.\n` +
      `Búsquedas: ${params.report.demand.searches}.\n` +
      `Búsquedas sin resultado: ${params.report.demand.zeroResultSearches}.\n\n` +
      `Dashboard: ${dashboardUrl}`,
    html: brandedEmailShell({
      title: "Informe global Wetudy",
      preview: `${params.report.periodLabel}: impacto, actividad e insights de demanda.`,
      footer:
        "Informe agregado para Super Admin. No incluye contenido de conversaciones ni actividad individual detallada.",
      body: `
        <h1 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:32px;color:${EMAIL_BRAND.text};">Informe global Wetudy</h1>
        <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:${EMAIL_BRAND.muted};">
          ${escapeEmailHtml(params.report.periodLabel)}
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:18px;">
          <tr>
            <td style="width:50%;padding:10px;background:#F8FAFC;border:1px solid #E5E7EB;">
              <strong style="font-family:Arial;font-size:22px;color:${EMAIL_BRAND.text};">${params.report.impact.confirmedReuses}</strong><br />
              <span style="font-family:Arial;font-size:12px;color:${EMAIL_BRAND.muted};">reutilizaciones confirmadas</span>
            </td>
            <td style="width:50%;padding:10px;background:#F8FAFC;border:1px solid #E5E7EB;">
              <strong style="font-family:Arial;font-size:22px;color:${EMAIL_BRAND.text};">${params.report.demand.zeroResultSearches}</strong><br />
              <span style="font-family:Arial;font-size:12px;color:${EMAIL_BRAND.muted};">búsquedas sin resultado</span>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:${EMAIL_BRAND.text};">
          Se adjunta el informe en el formato elegido.
        </p>
        ${emailButton("Abrir dashboard global", dashboardUrl)}
      `,
    }),
  });
}
