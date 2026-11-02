import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isWhatsappPilotConfigured, isWhatsappPilotUserAllowed } from "@/lib/whatsapp/pilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** Same-origin, authenticated image response avoids third-party signed links
 * in browser history and enables redaction via same-origin canvas. */
export async function GET(request: Request) {
  if (!isWhatsappPilotConfigured() ||
      process.env.WHATSAPP_PUBLISH_ENABLED !== "true" ||
      process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }
  const draftId = new URL(request.url).searchParams.get("draft") || "";
  if (!UUID.test(draftId)) return new Response(null, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email_confirmed_at || !isWhatsappPilotUserAllowed(user.id)) {
    return new Response(null, { status: 403 });
  }
  const admin = createAdminClient();
  const { data: linked, error: linkError } = await admin
    .from("whatsapp_account_links")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (linkError || !linked) return new Response(null, { status: 403 });

  const { data: session, error } = await admin
    .from("whatsapp_listing_sessions")
    .select("step,payload,draft_photo_path,updated_at")
    .eq("user_id", user.id).maybeSingle();
  if (error || !session ||
      !["review_photo", "form"].includes(session.step) ||
      session.payload?.listingId !== draftId ||
      typeof session.draft_photo_path !== "string" ||
      !session.draft_photo_path.startsWith(`${user.id}/`) ||
      Date.now() - new Date(session.updated_at).getTime() > 24 * 3600_000) {
    return new Response(null, { status: 404 });
  }

  const { data: photo, error: downloadError } = await admin.storage
    .from("whatsapp-draft-photos").download(session.draft_photo_path);
  if (downloadError || !photo || photo.size > 3 * 1024 * 1024) {
    return new Response(null, { status: 404 });
  }
  const extension = session.draft_photo_path.split(".").pop()?.toLowerCase();
  const type = extension === "png" ? "image/png" : extension === "webp"
    ? "image/webp" : extension === "jpg" ? "image/jpeg" : null;
  if (!type) return new Response(null, { status: 415 });
  return new NextResponse(Buffer.from(await photo.arrayBuffer()), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
