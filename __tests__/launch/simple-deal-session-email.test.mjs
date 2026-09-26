import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const panel = read("components/agreements/agreement-panel.tsx");
const detail = read("app/messages/[id]/page.tsx");
const state = read("components/messages/conversation-listing-state.tsx");
const eventEmails = read("lib/emails/mvp-event-emails.ts");
const transactionalEmails = read("lib/emails/transactional.ts");
const guard = read("components/auth/session-inactivity-guard.tsx");
const origin = read("lib/auth/public-origin.ts");
const authForm = read("components/auth/auth-form.tsx");
const bell = read("components/notifications/navbar-notifications-bell.tsx");
const contact = read("components/messages/contact-seller-button.tsx");
const navbarData = read("lib/navbar/get-navbar-data.ts");
const messages = read("app/messages/page.tsx");
const vercelConfig = read("vercel.json");
const conversationsSidebar = read("components/messages/conversations-sidebar.tsx");
const account = read("app/account/page.tsx");
const listings = read("app/account/listings/page.tsx");
const activity = read("app/account/activity/page.tsx");
const favorites = read("app/favorites/page.tsx");
const favoriteButton = read("components/favorites/favorite-button.tsx");
const sendMessage = read("components/messages/send-message-form.tsx");
const hideConversation = read("components/messages/hide-conversation-button.tsx");
const newListingForm = read("components/marketplace/new-listing-form.tsx");
const listingDetail = read("app/marketplace/listing/[id]/page.tsx");
const mobileListingActions = read("components/marketplace/mobile-listing-actions.tsx");
const realtimeMessages = read("components/messages/realtime-chat-messages.tsx");
const savedSearchEmail = read("lib/emails/saved-search-match-email.ts");
const adminAlertEmails = read("lib/emails/admin-alert-emails.ts");
const schoolAdminEmails = read("lib/emails/school-admin-invite-email.ts");

test("agreement UX reads like a simple marketplace proposal", () => {
  assert.match(panel, /Has pedido esta donación/);
  assert.match(panel, /quiere quedarse con este artículo/);
  assert.match(panel, /Aceptar donación/);
  assert.match(panel, /Aceptar oferta/);
  assert.match(panel, /Proponer otro precio/);
  assert.match(panel, /Retirar oferta/);
  assert.match(panel, /Rechazar/);
  assert.doesNotMatch(panel, /Comprador confirmado/);
  assert.doesNotMatch(panel, /Vendedor pendiente/);
  assert.doesNotMatch(panel, /Confirmar mi parte/);
});

test("negotiating never disables messaging or duplicates reserved status", () => {
  assert.match(detail, /Boolean\(latestAgreement\)/);
  assert.match(detail, /hideStatusBanner=\{Boolean\(latestAgreement\)\}/);
  assert.match(state, /hideStatusBanner/);
});

test("agreement emails deep-link to the exact chat", () => {
  assert.match(eventEmails, /\/messages\/\$\{encodeURIComponent\(params\.conversationId\)\}#agreement-panel/);
  assert.match(eventEmails, /button\("Abrir chat", url\)/);
  assert.match(eventEmails, /button\("Volver al chat", url\)/);
  assert.match(eventEmails, /Solicitud de donación/);
  assert.match(eventEmails, /Nueva oferta/);
  assert.match(eventEmails, /params\.actorRole === "seller"/);
  assert.match(eventEmails, /quiere darte este artículo/);
  assert.match(eventEmails, /params\.actorRole === "buyer"/);
  assert.match(eventEmails, /te ofrece/);
  assert.doesNotMatch(eventEmails, /http:\/\/localhost:3000/);
  assert.doesNotMatch(transactionalEmails, /http:\/\/localhost:3000/);
});

test("page refresh cannot revive a session that already exceeded the inactivity limit", () => {
  assert.match(guard, /const storedActivity = window\.localStorage\.getItem\(activityKey\)/);
  assert.match(guard, /now - parsedActivity >= timeoutMs/);
  assert.match(guard, /await signOutForInactivity\(\)/);
  assert.match(guard, /lastWriteAt = now/);
  assert.match(guard, /localStorage\.setItem\(activityKey, String\(now\)\)/);
});

test("browser auth callbacks remain on the current host and recover an existing login", () => {
  assert.match(origin, /return window\.location\.origin/);
  assert.match(authForm, /continueExistingSession/);
  assert.match(authForm, /router\.replace\(nextPath \|\| "\/account"\)/);
});

test("protected destinations survive a required login", () => {
  assert.match(messages, /\/auth\?next=\/messages/);
  assert.match(detail, /\/auth\?next=\/messages\//);
  assert.match(account, /\/auth\?next=\/account/);
  assert.match(listings, /\/auth\?next=\/account\/listings/);
  assert.match(activity, /\/auth\?next=\/account\/activity/);
  assert.match(favorites, /\/auth\?next=\/favorites/);
});


test("common client navigation avoids full document reloads", () => {
  assert.match(bell, /router\.push\(getNotificationDestination\(notification\)\)/);
  assert.doesNotMatch(bell, /window\.location\.assign\(getNotificationDestination/);
  assert.match(contact, /router\.push\(\`\/messages\/\$\{existingConversation\.id\}\`\)/);
  assert.match(contact, /router\.push\(\`\/messages\/\$\{newConversation\.id\}\`\)/);
});

test("navbar no longer blocks navigation on notification list queries", () => {
  assert.match(navbarData, /const typedNotifications: AppNotificationRow\[\] = \[\]/);
  assert.match(navbarData, /unreadNotificationsCount: 0/);
  assert.doesNotMatch(navbarData, /\.from\("notifications"\)/);
});


test("core signed-in actions reuse the server-validated user instead of rechecking Safari auth", () => {
  assert.match(contact, /currentUserId/);
  assert.doesNotMatch(contact, /supabase\.auth\.getUser\(\)/);
  assert.match(favoriteButton, /currentUserId/);
  assert.doesNotMatch(favoriteButton, /supabase\.auth\.getUser\(\)/);
  assert.match(sendMessage, /currentUserId: string/);
  assert.doesNotMatch(sendMessage, /supabase\.auth\.getUser\(\)/);
  assert.match(hideConversation, /currentUserId/);
  assert.doesNotMatch(hideConversation, /supabase\.auth\.getUser\(\)/);
  assert.match(newListingForm, /currentUserId: string/);
  assert.doesNotMatch(newListingForm, /supabase\.auth\.getUser\(\)/);
  assert.match(listingDetail, /currentUserId=\{currentUserId\}/);
  assert.match(mobileListingActions, /currentUserId=\{currentUserId\}/);
});

test("legacy cold agreement messages render with friendly marketplace copy", () => {
  assert.match(realtimeMessages, /Me interesa esta donación\. ¿Te parece bien que me la quede\?/);
  assert.match(realtimeMessages, /Te he enviado una oferta\. ¿Te parece bien\?/);
  assert.match(realtimeMessages, /Perfecto, por mi parte está bien\./);
  assert.match(realtimeMessages, /¡Hecho! Ya podemos concretar la entrega por aquí\./);
});

test("actionable email templates deep-link to the exact destination", () => {
  assert.match(eventEmails, /\/messages\/\$\{encodeURIComponent\(params\.conversationId\)\}#agreement-panel/);
  assert.match(eventEmails, /\/messages\/\$\{params\.conversationId \|\| ""\}/);
  assert.match(savedSearchEmail, /\/marketplace\/listing\/\$\{params\.listingId\}/);
  assert.match(adminAlertEmails, /support-ticket-\$\{encodeURIComponent\(params\.ticketId\)\}/);
  assert.match(adminAlertEmails, /school-request-\$\{encodeURIComponent\(params\.requestId\)\}/);
  assert.match(schoolAdminEmails, /\/auth\?next=\/admin\/school/);
  assert.match(transactionalEmails, /\/messages\/\$\{encodeURIComponent\(params\.conversationId\)\}/);
});


test("conversation sidebar does not prefetch every chat at once", () => {
  assert.match(conversationsSidebar, /prefetch=\{false\}/);
});


// Performance regression guard for the Spain/EU deployment path.
test("server functions run next to Supabase and messages fan out independent reads in parallel", () => {
  assert.match(vercelConfig, /"regions": \[/);
  assert.match(vercelConfig, /"dub1"/);
  assert.match(messages, /Promise\.all\(\[/);
  assert.match(messages, /from\("listings"\)/);
  assert.match(messages, /from\("profiles"\)/);
  assert.match(messages, /from\("messages"\)/);
});
