import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupBookByIsbn } from "@/lib/books/book-catalog";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_LOOKUPS_PER_WINDOW = 20;
const lookupWindows = new Map<string, { count: number; resetAt: number }>();

function allowLookup(userId: string) {
  const now = Date.now();
  const current = lookupWindows.get(userId);
  if (!current || current.resetAt <= now) {
    lookupWindows.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_LOOKUPS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ isbn: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "auth_required" }, { status: 401 });
  }

  if (!allowLookup(user.id)) {
    return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  }

  const { isbn } = await context.params;
  const result = await lookupBookByIsbn(isbn);

  if (result.status === "invalid") {
    return NextResponse.json(result, { status: 400 });
  }
  if (result.status === "not_found") {
    return NextResponse.json(result, { status: 404 });
  }
  if (result.status === "provider_error") {
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json({
    status: "found",
    source: result.source,
    book: result.book,
  });
}
