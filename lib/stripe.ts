import "server-only";

import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY. Add it to Vercel environment variables before using Stripe routes."
    );
  }

  if (!cachedStripe) {
    cachedStripe = new Stripe(secretKey);
  }

  return cachedStripe;
}

/**
 * Backwards-compatible Stripe export.
 *
 * Important: this is intentionally lazy. Creating `new Stripe(undefined)` at
 * module import time breaks `next build` while collecting route/page data in
 * environments where secrets are not injected into the build sandbox.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, property) {
    return (getStripe() as any)[property];
  },
});
