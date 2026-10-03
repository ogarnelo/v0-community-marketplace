import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshEmailHealthMonitoring } from "@/lib/admin/email-health-monitoring";
import {
  loadActiveResendWebhookSecrets,
  processResendWebhookEvent,
  verifyResendWebhookSignature,
  type ResendWebhookEvent,
} from "@/lib/emails/resend-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const admin = createAdminClient();

  try {
    const signingSecrets = await loadActiveResendWebhookSecrets(admin);
    if (signingSecrets.length === 0) {
      console.error("Resend webhook received before a signing secret was configured");
      return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
    }

    const verified = verifyResendWebhookSignature({
      rawBody,
      headers: request.headers,
      signingSecrets,
    });

    let event: ResendWebhookEvent;
    try {
      event = JSON.parse(rawBody) as ResendWebhookEvent;
    } catch {
      return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const result = await processResendWebhookEvent(admin, {
      eventId: verified.messageId,
      event,
    });

    if (event.type === "email.bounced" || event.type === "email.complained") {
      try {
        await refreshEmailHealthMonitoring(admin);
      } catch (monitoringError) {
        console.error("Email health monitoring refresh failed", monitoringError);
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    const message = error?.message || "Webhook processing failed.";
    const invalidSignature =
      message.includes("signature") ||
      message.includes("timestamp") ||
      message.includes("Missing webhook");

    if (invalidSignature) {
      return NextResponse.json({ error: "Invalid webhook." }, { status: 400 });
    }

    console.error("Resend webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
