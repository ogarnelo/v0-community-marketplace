import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("application emails use Wetudy corporate branding", () => {
  const brand = read("lib/emails/brand.ts");
  const transactional = read("lib/emails/transactional.ts");
  const mvp = read("lib/emails/mvp-event-emails.ts");
  const admin = read("lib/emails/admin-alert-emails.ts");
  const savedSearch = read("lib/emails/saved-search-match-email.ts");
  const schoolInvite = read("lib/emails/school-admin-invite-email.ts");

  assert.match(brand, /#2563EB/);
  assert.match(brand, /#7EBA28/);
  assert.match(brand, /\/icon\.svg/);
  assert.match(brand, />Wetudy</);

  assert.match(transactional, /\/icon\.svg/);
  assert.match(mvp, /\/icon\.svg/);
  assert.match(admin, /brandedEmailShell/);
  assert.match(savedSearch, /brandedEmailShell/);
  assert.match(schoolInvite, /sendSchoolAdminInviteEmail/);
  assert.match(schoolInvite, /Activar acceso del centro/);
});

test("school admin onboarding uses custom TokenHash-style activation and password setup", () => {
  const invitation = read("lib/admin/school-admin-invitation.ts");
  const approval = read("app/api/admin/approve-school-request/route.ts");
  const resend = read("app/api/admin/resend-school-admin-access/route.ts");
  const confirm = read("app/auth/confirm/route.ts");
  const complete = read("components/auth/complete-school-invite-form.tsx");

  assert.match(invitation, /auth\.admin\.generateLink/);
  assert.match(invitation, /properties\.hashed_token/);
  assert.match(invitation, /type: "invite"/);
  assert.match(invitation, /type: "magiclink"/);\n  assert.match(invitation, /cameFromSchoolInvite/);\n  assert.match(invitation, /school_admin_onboarding_complete/);
  assert.doesNotMatch(approval, /inviteUserByEmail/);
  assert.match(approval, /provisionSchoolAdminAccess/);
  assert.match(resend, /provisionSchoolAdminAccess/);
  assert.match(confirm, /\/auth\/complete-invite\?next=\/admin\/school/);
  assert.match(complete, /school_admin_onboarding_complete: true/);
  assert.match(complete, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(complete, /type=\{showRepeatPassword \? "text" : "password"\}/);
  assert.match(complete, /Mostrar contraseña/);
  assert.match(complete, /Ocultar contraseña/);
  assert.match(complete, /aria-pressed=\{showPassword\}/);
  assert.match(complete, /Esta misma cuenta también funciona como una cuenta normal de Wetudy/);
});
