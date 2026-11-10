import { createAdminClient } from "@/lib/supabase/admin";

// No Vercel cron is registered for this route during the pilot QA phase.
// The worker is inert unless BOTH a signed request and the explicit feature
// flag are present. Never send emails as a side effect of deploying it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Deliberately fixed production origin; do not derive this from the request's
// Host header (a forged host must never receive our CRON_SECRET).
const MATCH_ENDPOINT =
  "https://www.wetudy.com/api/marketplace/listings/match-saved-searches";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new Response(null, { status: 204 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (process.env.WETUDY_ALERT_OUTBOX_ENABLED !== "true") {
    return new Response(null, { status: 204 });
  }

  try {
    const admin = createAdminClient();
    // One listing per invocation keeps workload bounded before real-volume QA.
    const { data: jobs, error: claimError } = await admin.rpc(
      "marketplace_alert_claim_outbox_v1", { p_limit: 1, p_lease_seconds: 240 }
    );
    if (claimError) throw claimError;
    if (!jobs?.length) {
      return Response.json({ ok: true, claimed: 0 }, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const job = jobs[0];
    let success = false;
    let errorCode = "unknown";

    try {
      const { data: listing, error: listingError } = await admin
        .from("listings").select("id,status,is_demo")
        .eq("id", job.listing_id).maybeSingle();
      if (listingError) throw listingError;

      if (!listing || listing.is_demo === true || listing.status !== "available") {
        // Never email for a deleted/reserved/sold/demo listing.
        success = true;
      } else {
        const { count, error: photosError } = await admin
          .from("listing_photos").select("id", { head: true, count: "exact" })
          .eq("listing_id", job.listing_id);
        if (photosError) throw photosError;
        if (!count) {
          // The seller's listing INSERT and photo rows are not atomic.
          // Only alert for a fully published listing with at least one photo.
          errorCode = "photos_pending";
        } else {
          const response = await fetch(MATCH_ENDPOINT, {
            method: "POST",
            headers: {
              "authorization": `Bearer ${cronSecret}`,
              "x-wetudy-alert-outbox": "1",
              "content-type": "application/json",
            },
            body: JSON.stringify({ listingId: job.listing_id }),
            cache: "no-store",
            redirect: "manual",
            signal: AbortSignal.timeout(25000),
          });
          if (response.ok) {
            const body = await response.json();
            success = body?.ok === true;
            if (!success) errorCode = "unexpected_matcher_body";
          } else {
            errorCode = response.status >= 500
              ? "matcher_5xx" : "matcher_http_" + response.status;
          }
        }
      }
    } catch (processingError) {
      errorCode = "matcher_exception";
      // Do not log recipient addresses or provider error bodies.
      console.error("El procesamiento de una alerta pendiente falló", processingError instanceof Error
        ? processingError.name : "unknown");
    }

    const { data: settled, error: settleError } = await admin.rpc(
      "marketplace_alert_settle_outbox_v1", {
        p_listing_id: job.listing_id,
        p_lease_token: job.lease_token,
        p_success: success,
        p_error_code: success ? null : errorCode,
      }
    );
    if (settleError) throw settleError;
    // A false settle is a stale lease. Never overwrite the newer worker.
    if (settled !== true) {
      return Response.json({ ok: false, reason: "stale_lease" }, { status: 409 });
    }
    return Response.json({
      ok: success,
      claimed: 1,
      attempts: job.attempts,
      outcome: success ? "completed" : "retry_scheduled",
    }, {
      status: success ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("No se pudo reconciliar la cola de avisos", error instanceof Error
      ? error.name : "unknown");
    return Response.json({ ok: false, error: "worker_failed" }, { status: 500 });
  }
}
