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

export function filenameForAttachment(filename) {
  let name = typeof filename === "string" ? filename.split(/[\\/]/).pop() || "" : "";
  name = name.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 120);
  return name && !/^\.+$/.test(name) ? name : "wetudy-attachment";
}

export function dispositionForAttachment(type, filename) {
  const original = filenameForAttachment(filename);
  const fallback = original.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 80) || "wetudy-attachment";
  const encoded = encodeURIComponent(original).replace(/['()*]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase()
  );
  const disposition = SAFE_INLINE_IMAGES.has(type) ? "inline" : "attachment";
  return disposition + '; filename="' + fallback + '"; filename*=UTF-8' + "''" + encoded;
}
