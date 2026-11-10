// A single Vercel invocation must never process an unbounded number of
// recipients while the recovery worker is enabled. Normal publisher dispatch
// retains its existing behaviour; the recovery job can resume safely.
export const WORKER_RECIPIENT_BATCH_SIZE = 12;

export function selectDeliveryPage(pending, isWorker) {
  if (!Array.isArray(pending)) throw new TypeError("Expected pending deliveries");
  return isWorker
    ? pending.slice(0, WORKER_RECIPIENT_BATCH_SIZE)
    : pending;
}

export function summarizeDeliveryProgress({
  isWorker, pendingNotifications, notificationPage,
  pendingEmails, emailPage, emailFailures,
}) {
  const hasMore = Boolean(isWorker) &&
    (pendingNotifications > notificationPage || pendingEmails > emailPage);
  const failed = emailFailures > 0;
  return {
    complete: !hasMore && !failed,
    hasMore,
    failed,
  };
}
