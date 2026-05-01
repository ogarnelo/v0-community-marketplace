import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const listingId = body?.listingId;

  if (!listingId) {
    return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  }

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/marketplace/listing/${listingId}`;

  return NextResponse.json({ url });
}
