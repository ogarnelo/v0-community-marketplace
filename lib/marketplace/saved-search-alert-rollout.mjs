// Fail closed: only the literal string "true" enables saved-search notifications.
export function savedSearchAlertsEnabled(env = process.env) {
  return env.WETUDY_SAVED_SEARCH_ALERTS_ENABLED === "true";
}
export function alertOutboxWorkerEnabled(env = process.env) {
  return savedSearchAlertsEnabled(env) &&
    env.WETUDY_ALERT_OUTBOX_ENABLED === "true" &&
    env.WETUDY_ALERT_INTENT_DELIVERY_ENABLED === "true";
}
