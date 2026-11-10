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

  // Require BOTH explicit rollout flags. Enabling only the legacy outbox flag
  // must never trigger the older, non-intent email delivery path.
  if (process.env.WETUDY_ALERT_OUTBOX_ENABLED !== "true" ||
      process.env.WETUDY_ALERT_INTENT_DELIVERY_ENABLED !== "true") {
    return new Response(null, { status: 204 });
  }

  try {
    const admin = createAdminClient();
    // Fail closed BEFORE claiming a listing, creating a notification, or
    // contacting Resend when either migration has not been applied yet.
    // Never expose database error details or recipient identifiers in replies.
    const { error: intentsSchemaError } = await admin
      .from("marketplace_alert_email_intents")
      .select("event_key").limit(0);
    if (intentsSchemaError) {
      return Response.json({ok:false,error:"email_schema_not_ready"}, {status:503});
    }
    // The intent table alone is insufficient if a migration stopped after
    // CREATE TABLE but before installing the transition RPCs. The private
    // health function is installed at the end of that same migration.
    const { error: intentFunctionsError } = await admin.rpc(
      "marketplace_alert_email_intent_health_v1"
    );
    if (intentFunctionsError) {
      return Response.json({ok:false,error:"intent_functions_not_ready"}, {status:503});
    }
    const { error: reviewSchemaError } = await admin.rpc(
      "marketplace_alert_review_count_v1"
    );
    if (reviewSchemaError) {
      return Response.json({ok:false,error:"review_schema_not_ready"}, {status:503});
    }
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
    // Once discovery is durably complete, all subsequent invocations deliver
    // directly from persisted matches, never rescan saved_searches.
    const { data: discoveryState, error: stateError } = await admin
      .from("marketplace_alert_outbox")
      .select("discovery_completed_at")
      .eq("listing_id", job.listing_id)
      .eq("lease_token", job.lease_token)
      .eq("state", "processing")
      .maybeSingle();
    if (stateError) throw stateError;
    if (!discoveryState) {
      return Response.json({ ok: false, reason: "stale_lease" }, { status: 409 });
    }
    const stage = discoveryState.discovery_completed_at ? "deliver" : "discover";
    let success = false;
    let partialProgress = false;
    let awaitingPhotos = false;
    let reviewRequired = false;
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
          awaitingPhotos = true;
        } else {
          const response = await fetch(MATCH_ENDPOINT, {
            method: "POST",
            headers: {
              "authorization": `Bearer ${cronSecret}`,
              "x-wetudy-alert-outbox": "1",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              listingId: job.listing_id, leaseToken: job.lease_token, stage,
            }),
            cache: "no-store",
            redirect: "manual",
            signal: AbortSignal.timeout(25000),
          });
          if (response.ok) {
            const body = await response.json();
            success = body?.ok === true && body?.complete === true;
            partialProgress = body?.ok === true && body?.complete === false;
            if (!success && !partialProgress) errorCode = "unexpected_matcher_body";
          } else if (response.status === 409) {
            const body = await response.json().catch(() => null);
            if (body?.review_required === true &&
                body?.reason === "email_outcome_ambiguous") {
              reviewRequired = true;
            } else {
              errorCode = "matcher_http_409";
            }
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

    if (reviewRequired) {
      // Final quarantine: do not retry an outcome that Resend may already
      // have accepted. The RPC uses the CURRENT lease as fencing token.
      const { data: held, error: holdError } = await admin.rpc(
        "marketplace_alert_hold_for_review_v1", {
          p_listing_id: job.listing_id,
          p_lease_token: job.lease_token,
        }
      );
      if (holdError) throw holdError;
      if (held !== true) {
        return Response.json({ok:false,reason:"stale_lease"},{status:409});
      }
      return Response.json({
        ok:false, claimed:1, outcome:"review_required",
      }, {status:202,headers:{"Cache-Control":"no-store"}});
    }

    if (awaitingPhotos) {
      // Uploading the first image is normal publishing progress, not an
      // email-delivery failure. Release this exact lease, back off five
      // minutes, and retain the original 48-hour outbox expiry.
      const { data: deferred, error: deferError } = await admin.rpc(
        "marketplace_alert_defer_readiness_v1", {
          p_listing_id: job.listing_id,
          p_lease_token: job.lease_token,
        }
      );
      if (deferError) throw deferError;
      if (deferred !== true) {
        return Response.json({ ok: false, reason: "stale_lease" }, { status: 409 });
      }
      return Response.json({
        ok: true,
        complete: false,
        claimed: 1,
        outcome: "waiting_for_photos",
      }, {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (partialProgress) {
      // A bounded recipient batch made progress. Requeue WITHOUT consuming
      // any of the four failure attempts, using the current fencing token.
      const { data: requeued, error: requeueError } = await admin.rpc(
        "marketplace_alert_requeue_progress_v1", {
          p_listing_id: job.listing_id,
          p_lease_token: job.lease_token,
        }
      );
      if (requeueError) throw requeueError;
      if (requeued !== true) {
        return Response.json({ ok: false, reason: "stale_lease" }, { status: 409 });
      }
      return Response.json({
        ok: true,
        complete: false,
        claimed: 1,
        attempts: job.attempts,
        outcome: "progress_saved",
      }, {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      });
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
