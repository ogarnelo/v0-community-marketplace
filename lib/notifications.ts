import type { SupabaseClient } from "@supabase/supabase-js";

type NotificationInsert = {
  user_id: string;
  kind: string;
  title: string;
  body?: string | null;
  href?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AppNotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export async function createNotification(
  supabase: SupabaseClient,
  payload: NotificationInsert
) {
  return supabase.from("notifications").insert({
    user_id: payload.user_id,
    kind: payload.kind,
    title: payload.title,
    body: payload.body || null,
    href: payload.href || null,
    metadata: payload.metadata || null,
  });
}

export async function createNotifications(
  supabase: SupabaseClient,
  payloads: NotificationInsert[]
) {
  if (payloads.length === 0) {
    return { error: null };
  }

  return supabase.from("notifications").insert(
    payloads.map((payload) => ({
      user_id: payload.user_id,
      kind: payload.kind,
      title: payload.title,
      body: payload.body || null,
      href: payload.href || null,
      metadata: payload.metadata || null,
    }))
  );
}


function metadataString(
  notification: Pick<AppNotificationRow, "metadata">,
  key: string
) {
  const value = notification.metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function getNotificationDestination(
  notification: Pick<AppNotificationRow, "kind" | "href" | "metadata">
) {
  if (notification.kind === "school_registration_requested") {
    const requestId = metadataString(notification, "school_request_id");
    return requestId
      ? `/admin/super?tab=schools#school-request-${encodeURIComponent(requestId)}`
      : "/admin/super?tab=schools";
  }

  if (notification.kind === "support_ticket_created") {
    const ticketId = metadataString(notification, "support_ticket_id");
    return ticketId
      ? `/admin/super?tab=support#support-ticket-${encodeURIComponent(ticketId)}`
      : "/admin/super?tab=support";
  }

  if (
    notification.kind === "moderation_report_created" ||
    notification.kind === "report_created"
  ) {
    const reportId = metadataString(notification, "report_id");
    return reportId
      ? `/admin/super?tab=reports#report-${encodeURIComponent(reportId)}`
      : "/admin/super?tab=reports";
  }

  if (notification.kind === "saved_search_match") {
    const listingId = metadataString(notification, "listing_id");
    if (listingId) {
      return `/marketplace/listing/${encodeURIComponent(listingId)}`;
    }
  }

  const href = notification.href?.trim();
  if (!href || !href.startsWith("/") || href.startsWith("//")) {
    return "/account/activity";
  }

  return href;
}
