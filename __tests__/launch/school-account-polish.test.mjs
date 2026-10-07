import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("school invitation passwords are masked by default with explicit visibility controls", () => {
  const form = read("components/auth/complete-school-invite-form.tsx");

  assert.match(form, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(form, /type=\{showRepeatPassword \? "text" : "password"\}/);
  assert.match(form, /Mostrar contraseña/);
  assert.match(form, /Ocultar contraseña/);
  assert.match(form, /EyeOff/);
});

test("school admins see their own centre code instead of centre-linking controls", () => {
  const page = read("app/account/page.tsx");
  const form = read("components/account/account-profile-form.tsx");

  assert.match(page, /role === "school_admin"/);
  assert.match(page, /managedSchoolAccessCode/);
  assert.match(page, /from\("school_access_codes"\)/);

  assert.match(form, /isSchoolAdmin \?/);
  assert.match(form, /Tu centro en Wetudy/);
  assert.match(form, /Código de tu centro/);
  assert.match(form, /Comparte el código con familias y usuarios/);
  assert.match(form, /Copiar código/);
  assert.match(form, /Compartir código/);
  assert.match(form, /isSchoolAdmin\s*\?\s*managedSchoolId\.trim\(\)/);
});

test("impact PDF opens separately and adds charts only when data exists", () => {
  const dashboard = read("components/admin/school-admin-dashboard.tsx");
  const route = read("app/api/school/impact-report/route.ts");
  const report = read("lib/reports/school-impact-report.ts");

  assert.match(dashboard, /target="_blank"/);
  assert.match(dashboard, /noopener noreferrer/);
  assert.match(route, /inline; filename/);
  assert.match(report, /const hasChartData/);
  assert.match(report, /Gráficos de impacto/);
  assert.match(report, /Acuerdos confirmados/);
  assert.match(report, /Actividad y alcance/);
  assert.match(report, /drawHorizontalBars/);
  assert.match(report, /if \(hasChartData\)/);
});


test("school admins use a centre-first account and navigation", () => {
  const navbar = read("components/navbar.tsx");
  const account = read("app/account/page.tsx");
  const form = read("components/account/account-profile-form.tsx");
  const roles = read("lib/admin/roles.ts");

  assert.match(navbar, /schoolAdminNavigation[\s\S]*Código del centro/);
  assert.match(navbar, /schoolAdminNavigation[\s\S]*Panel del centro/);
  assert.match(navbar, /schoolAdminNavigation[\s\S]*\/marketplace/);
  assert.match(navbar, /schoolAdminNavigation[\s\S]*\/messages/);
  assert.match(account, /!managedSchoolId && \(userType === "parent" \|\| userType === "student"\)/);
  assert.match(account, /managedSchoolId \? "AMPA \/ centro"/);
  assert.match(form, /AMPA \/ centro educativo/);
  assert.match(form, /No necesita curso ni estudiantes asociados/);
  assert.match(roles, /const isSchoolAdmin = Boolean/);
  assert.match(roles, /schoolAdminRole\?\.school_id/);
});

test("school admin listings keep the managed centre but make course optional", () => {
  const page = read("app/marketplace/new/page.tsx");
  const form = read("components/marketplace/new-listing-form.tsx");

  assert.match(page, /managedSchoolId \|\|[\s\S]*primaryStudentContext\?\.school_id/);
  assert.match(page, /isSchoolAdmin=\{Boolean\(managedSchoolId\)\}/);
  assert.match(form, /const courseRequired = !isSchoolAdmin && isCourseRequired/);
  assert.match(form, /el anuncio queda vinculado a este centro/);
  assert.match(form, /podrás comprar y contactar con usuarios de cualquier centro/);
});

test("Mi curso and Commerce Lab keep the shared navigation shell", () => {
  const myCourse = read("app/mi-curso/page.tsx");
  const commerceLab = read("app/admin/super/commerce-lab/page.tsx");

  assert.match(myCourse, /<Navbar \{\.\.\.navbarData\} \/>/);
  assert.match(myCourse, /navbarData\.isSchoolAdmin[\s\S]*redirect\("\/admin\/school"\)/);
  assert.match(commerceLab, /<Navbar \{\.\.\.navbarData\} \/>/);
  assert.match(commerceLab, /<Footer \/>/);
});


test("school dashboard community uses account_students as the canonical educational context", () => {
  const page = read("app/admin/school/page.tsx");

  assert.match(page, /from\("account_students"\)/);
  assert.match(page, /ownersWithActiveEducationalContext/);
  assert.match(page, /schoolContextOwnerIds/);
  assert.match(page, /context\.school_id === effectiveSchoolId/);
  assert.match(page, /!ownersWithActiveEducationalContext\.has\(member\.id\)/);
  assert.match(page, /safeSchoolAdminRoles[\s\S]*schoolContextOwnerIds\.add/);
});


test("school admin identity overrides legacy profile user type on public surfaces", () => {
  const profile = read("app/profile/[id]/page.tsx");
  const messages = read("app/messages/[id]/page.tsx");

  assert.match(profile, /isSchoolAdminProfile/);
  assert.match(profile, /AMPA \/ centro educativo/);
  assert.match(messages, /schoolAdminUserIds/);
  assert.match(messages, /AMPA \/ centro educativo/);
});


test("marketplace keeps canonical school context for viewers and listings", () => {
  const marketplace = read("app/marketplace/page.tsx");

  assert.match(marketplace, /from\("user_roles"\)[\s\S]*role", "school_admin"/);
  assert.match(marketplace, /from\("account_students"\)[\s\S]*eq\("active", true\)/);
  assert.match(
    marketplace,
    /viewerSchoolId\s*=\s*[\s\S]*schoolAdminRole\?\.school_id[\s\S]*primaryStudentContext\?\.school_id[\s\S]*typedProfile\?\.school_id/
  );
  assert.match(
    marketplace,
    /const currentSellerSchoolId = item\.school_id \|\| sellerProfile\?\.schoolId \|\| null/
  );
});
