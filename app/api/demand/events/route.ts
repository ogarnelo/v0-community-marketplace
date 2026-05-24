import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMAND_EVENT_TYPES, getUserDemandContext, recordDemandEvent } from "@/lib/demand/events";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json().catch(() => null);
  const eventType = typeof body?.eventType === "string" ? body.eventType.trim() : "";

  if (!DEMAND_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: "Invalid demand event" }, { status: 400 });
  }

  const context = await getUserDemandContext(user?.id || null);

  await recordDemandEvent({
    eventType,
    userId: user?.id || null,
    query: body?.query,
    category: body?.category,
    gradeLevel: body?.gradeLevel,
    condition: body?.condition,
    listingType: body?.listingType,
    isbn: body?.isbn,
    resultCount: body?.resultCount,
    postalCode: context.postalCode,
    region: context.region,
    schoolId: context.schoolId,
    source: body?.source || "web",
    metadata: {
      route: body?.route || null,
      reason: body?.reason || null,
    },
  });

  return NextResponse.json({ ok: true });
}
