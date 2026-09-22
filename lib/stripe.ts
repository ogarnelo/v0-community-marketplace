import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripeClient() {
  if (client) return client;

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Falta STRIPE_SECRET_KEY en el entorno.");
  }

  client = new Stripe(secretKey);
  return client;
}

// Compatibility surface for existing server code. The SDK is instantiated only
// when a Stripe property is actually used, never while Next.js is building routes.
export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    const activeClient = getStripeClient();
    const value = (activeClient as any)[property];
    return typeof value === "function" ? value.bind(activeClient) : value;
  },
});
