-- Authenticated users may read their own notifications under RLS, but
-- should only be able to acknowledge them. Notification content (kind, body,
-- title, href, metadata, event_key, user_id) is server-controlled.
--
-- Without this grant narrowing the notifications_update_own RLS policy
-- lets a user edit arbitrary columns of their own notification rows.
-- Service-role writers/trigger functions keep their existing permissions.
REVOKE UPDATE ON TABLE public.notifications FROM authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;

COMMENT ON COLUMN public.notifications.read_at IS
  'Authenticated recipients may acknowledge own notifications; other fields remain server-controlled.';
