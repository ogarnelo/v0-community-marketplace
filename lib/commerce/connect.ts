import "server-only";
import { stripe } from "@/lib/stripe";

export async function ensureSellerConnectAccount() {
  return { diagnostic: typeof stripe === "object" };
}
