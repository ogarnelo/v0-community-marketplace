import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const buckets = new Map<string, { count: number; resetAt: number }>();

const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  create_listing: { limit: 20, windowMs: 60 * 60 * 1000 },
  send_message: { limit: 120, windowMs: 60 * 60 * 1000 },
  create_offer: { limit: 40, windowMs: 60 * 60 * 1000 },
  default: { limit: 100, windowMs: 60 * 60 * 1000 },
};

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ allowed: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "default";
  const config = LIMITS[action] || LIMITS.default;
  const key = `${user.id}:${action}`;
  const now = Date.now();

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return NextResponse.json({
      allowed: true,
      remaining: config.limit - 1,
      resetAt: now + config.windowMs,
    });
  }

  if (bucket.count >= config.limit) {
    return NextResponse.json(
      {
        allowed: false,
        remaining: 0,
        resetAt: bucket.resetAt,
        error: "Demasiadas acciones. Inténtalo más tarde.",
      },
      { status: 429 }
    );
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  return NextResponse.json({
    allowed: true,
    remaining: Math.max(0, config.limit - bucket.count),
    resetAt: bucket.resetAt,
  });
}
