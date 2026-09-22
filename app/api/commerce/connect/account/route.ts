import { NextResponse } from "next/server";
import { ensureSellerConnectAccount } from "@/lib/commerce/connect";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: typeof ensureSellerConnectAccount === "function",
  });
}
