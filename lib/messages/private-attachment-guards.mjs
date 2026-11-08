// Guard for path-only chat attachments; no auth or signed URLs are carried here.
// The route must separately check the session, message ownership and Storage RLS.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SAFE_INLINE_IMAGES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function validChatAttachmentPath(path, conversationId) {
  if (typeof path !== "string" || typeof conversationId !== "string") return false;
  const segments = path.split("/");
  return (
    UUID.test(conversationId) &&
    segments.length >= 3 &&
    segments[0].toLowerCase() === conversationId.toLowerCase() &&
    UUID.test(segments[1]) &&
    segments.slice(2).every((part) =>
      !!part && part !== "." && part !== ".." && !/[\\\r\n]/.test(part)
    )
  );
}

export function safeAttachmentType(type) {
  return SAFE_INLINE_IMAGES.has(type) ? type : "application/octet-stream";
}

export function dispositionForAttachment(type) {
  return SAFE_INLINE_IMAGES.has(type) ? 'inline; filename="wetudy-attachment"' : 'attachment; filename="wetudy-attachment"';
}
