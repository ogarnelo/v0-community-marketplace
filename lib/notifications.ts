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
