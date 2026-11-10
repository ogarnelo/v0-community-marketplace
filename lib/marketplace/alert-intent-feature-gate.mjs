// Both the signed, lease-verified worker context AND a second explicitly
// enabled rollout flag are required. The publisher path never switches.
export function shouldUseAlertIntentDelivery(isWorkerDelivery, flagValue) {
  return isWorkerDelivery === true && flagValue === "true";
}
