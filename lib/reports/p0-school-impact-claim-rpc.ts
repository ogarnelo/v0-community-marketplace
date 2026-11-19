/**
 * Dormant, service-only adapters for Education Marketplace's durable monthly
 * email claim SQL (version 20261119081627). No production cron/API calls these.
 * The caller must revalidate the recipient, school-admin role and email just
 * before claiming; an unknown provider result must never be auto-retried.
 */
export type PrivilegedRpc = {
  rpc: (name: string, args: Record<string, unknown>) =>
    PromiseLike<{ data: unknown; error: unknown }>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^20[0-9]{2}-(0[1-9]|1[0-2])$/;

export async function acquireDurableSchoolReportClaim({
  admin, subscriptionId, userId, schoolId, periodKey, day, email, expectedLastSent,
}: {
  admin: PrivilegedRpc;
  subscriptionId: string; userId: string; schoolId: string;
  periodKey: string; day: number; email: string;
  expectedLastSent: string | null;
}): Promise<string | null> {
  if (!UUID.test(subscriptionId) || !UUID.test(userId) ||
      !UUID.test(schoolId) || !MONTH.test(periodKey) ||
      !Number.isInteger(day) || day < 1 || day > 28 ||
      typeof email !== "string" || email.trim().length < 3 ||
      (expectedLastSent !== null && !MONTH.test(expectedLastSent))) {
    throw new Error("Solicitud de claim mensual inválida.");
  }
  let result;
  try {
    result = await admin.rpc("p0_school_impact_claim_candidate", {
      p_subscription_id: subscriptionId,
      p_period_key: periodKey,
      p_user_id: userId,
      p_school_id: schoolId,
      p_day: day,
      p_email: email,
      p_expected_last_sent: expectedLastSent,
    });
  } catch {
    throw new Error("Claim de informe con resultado incierto; requiere conciliación.");
  }
  if (result.error) throw new Error("Claim de informe no confirmado; requiere conciliación.");
  if (result.data === null) return null; // ineligible or already claimed; DO NOT email
  if (typeof result.data !== "string" || !UUID.test(result.data))
    throw new Error("Claim de informe ambiguo; requiere conciliación.");
  return result.data;
}

export async function acknowledgeDurableSchoolReportClaim({
  admin, claimId, providerMessageId,
}: {
  admin: PrivilegedRpc; claimId: string; providerMessageId: string;
}): Promise<void> {
  if (!UUID.test(claimId) || typeof providerMessageId !== "string" ||
      providerMessageId.trim().length < 1 || providerMessageId.trim().length > 200) {
    throw new Error("Acuse de informe inválido.");
  }
  let result;
  try {
    result = await admin.rpc("p0_school_impact_ack_candidate", {
      p_claim_id: claimId,
      p_provider_message_id: providerMessageId.trim(),
    });
  } catch {
    throw new Error("Acuse del proveedor incierto; requiere conciliación.");
  }
  if (result.error || result.data !== true)
    throw new Error("Acuse no confirmado; requiere conciliación.");
}
