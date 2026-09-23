import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const joinSchool = read("app/onboarding/join-school/page.tsx");
const accountProfile = read("components/account/account-profile-form.tsx");
const marketplacePage = read("app/marketplace/page.tsx");
const marketplaceClient = read("components/marketplace/marketplace-client.tsx");
const listingCard = read("components/listing-card.tsx");
const invitation = read("lib/admin/school-admin-invitation.ts");
const directInvite = read("app/api/admin/invite-school-admin/route.ts");
const approval = read("app/api/admin/approve-school-request/route.ts");
const resend = read("app/api/admin/resend-school-admin-access/route.ts");
const activation = read("components/auth/school-invite-activation.tsx");
const activationRoute = read("app/api/auth/activate-school-invite/route.ts");

test("join-school recognizes an existing link and supports switching or unlinking", () => {
  assert.match(joinSchool, /select\("school_id"\)/);
  assert.match(joinSchool, /Ya tienes un centro vinculado/);
  assert.match(joinSchool, /Cambiar de centro/);
  assert.match(joinSchool, /Desvincular centro/);
  assert.match(joinSchool, /update\(\{ school_id: null \}\)/);
  assert.match(joinSchool, /school_name: null/);
  assert.match(joinSchool, /school_id: null/);
});

test("account lets a regular user clear the selected school before saving", () => {
  assert.match(accountProfile, /Quitar centro educativo/);
  assert.match(accountProfile, /setSelectedSchoolId\(""\)/);
  assert.match(accountProfile, /school_id: normalizedSchoolId \|\| null/);
  assert.match(accountProfile, /dejar este campo vacío y guardar/);
});

test("marketplace distance uses account postal codes and excludes unknown locations when radius is active", () => {
  assert.match(marketplacePage, /sellerProfileMap/);
  assert.match(marketplacePage, /viewerPostalCode = typedProfile\?\.postal_code\?\.trim\(\) \|\| ""/);
  assert.match(marketplacePage, /sellerProfile\?\.postalCode/);
  assert.match(marketplacePage, /postalCode: currentSellerPostalCode/);
  assert.doesNotMatch(marketplacePage, /schoolPostalMap/);
  assert.match(marketplaceClient, /l\.distance === undefined \|\| l\.distance > maxDistanceKm/);
  assert.match(marketplaceClient, /código postal de tu cuenta como referencia aproximada/);
});

test("listing cards keep price on the same compact detail row", () => {
  assert.match(listingCard, /flex items-end justify-between gap-2/);
  assert.match(listingCard, /shrink-0 text-\[15px\] font-bold leading-none/);
});

test("school admin invitations wait for an explicit user action before consuming the OTP", () => {
  assert.match(invitation, /\/auth\/school-invite\?/);
  assert.doesNotMatch(invitation, /\/auth\/confirm\?/);
  assert.match(activation, /Activar acceso y crear contraseña/);
  assert.match(activation, /fetch\("\/api\/auth\/activate-school-invite"/);
  assert.match(activationRoute, /export async function POST/);
  assert.match(activationRoute, /verifyOtp/);
  assert.match(activationRoute, /type as EmailOtpType/);
});

test("all school-admin invitation entry points use the same public-origin flow", () => {
  assert.match(directInvite, /provisionSchoolAdminAccess/);
  assert.doesNotMatch(directInvite, /inviteUserByEmail/);
  assert.match(directInvite, /getAuthPublicOrigin/);
  assert.match(approval, /getAuthPublicOrigin/);
  assert.match(resend, /getAuthPublicOrigin/);
});
