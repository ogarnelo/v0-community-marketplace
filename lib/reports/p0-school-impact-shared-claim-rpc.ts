/** Candidate shared claim for manual and cron monthly school reports.
 * Do not enable either email flag until the review-only SQL is authorized,
 * applied, and the concurrency/reconciliation gates pass.
 */
export type ServiceRpc = {
  rpc: (name: string, args: Record<string, unknown>) =>
    PromiseLike<{ data: unknown; error: unknown }>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH = /^20[0-9]{2}-(0[1-9]|1[0-2])$/;

type Base = {
  admin: ServiceRpc; schoolId: string; userId: string;
  periodKey: string; email: string;
};
type Candidate = Base & (
  { source: "manual"; subscriptionId?: never; day?: never; expectedLastSent?: never }
  | { source: "cron"; subscriptionId: string; day: number; expectedLastSent: string | null }
);
export async function acquireSharedSchoolReportClaim(input: Candidate): Promise<string | null> {
  const { admin, schoolId, userId, periodKey, email, source } = input;
  if (!UUID.test(schoolId) || !UUID.test(userId) || !MONTH.test(periodKey) ||
      typeof email !== "string" || email.trim().length < 3 ||
      (source !== "manual" && source !== "cron")) {
    throw new Error("Invalid shared report claim");
  }
  if (source === "cron" &&
      (!UUID.test(input.subscriptionId) || !Number.isInteger(input.day) ||
       input.day < 1 || input.day > 28 ||
       (input.expectedLastSent !== null && !MONTH.test(input.expectedLastSent)))) {
    throw new Error("Invalid scheduled claim");
  }
  let result: {data: unknown; error: unknown};
  try {
    result = await admin.rpc("p0_school_impact_shared_claim_candidate", {
      p_school_id: schoolId, p_user_id: userId, p_period_key: periodKey,
      p_email: email, p_source: source,
      p_subscription_id: source === "cron" ? input.subscriptionId : null,
      p_day: source === "cron" ? input.day : null,
      p_expected_last_sent: source === "cron" ? input.expectedLastSent : null,
    });
  } catch {
    throw new Error("Shared report claim outcome uncertain; reconcile before retry");
  }
  if (result.error) throw new Error("Shared report claim not confirmed; reconciliation required");
  if (result.data === null) return null;
  if (typeof result.data !== "string" || !UUID.test(result.data))
    throw new Error("Ambiguous shared report claim; reconciliation required");
  return result.data;
}

export async function acknowledgeSharedSchoolReportClaim(args: {
  admin: ServiceRpc; claimId: string; providerMessageId: string;
}): Promise<void> {
  if (!UUID.test(args.claimId) || typeof args.providerMessageId !== "string" ||
      args.providerMessageId.trim().length < 1 || args.providerMessageId.trim().length > 200)
    throw new Error("Invalid shared report receipt; reconcile");
  let result: {data: unknown; error: unknown};
  try {
    result = await args.admin.rpc("p0_school_impact_shared_ack_candidate", {
      p_claim_id: args.claimId,
      p_provider_message_id: args.providerMessageId.trim(),
    });
  } catch {
    throw new Error("Shared report receipt outcome uncertain; reconcile");
  }
  if (result.error || result.data !== true)
    throw new Error("Shared report receipt not confirmed; reconcile");
}
