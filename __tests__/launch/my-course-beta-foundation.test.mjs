import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const page = read("app/beta/mi-curso/page.tsx");
const client = read("components/my-course/my-course-beta-client.tsx");
const navbar = read("components/navbar.tsx");
const marketplacePage = read("app/marketplace/page.tsx");
const marketplaceClient = read("components/marketplace/marketplace-client.tsx");
const landingPage = read("app/page.tsx");
const hero = read("components/landing/hero-section.tsx");
const howItWorks = read("components/landing/how-it-works.tsx");
const accountPage = read("app/account/page.tsx");
const authPage = read("app/auth/page.tsx");
const betaLayout = read("app/beta/layout.tsx");

test("Mi curso remains preview-only and requires a user except for the explicit preview demo", () => {
  assert.match(page, /VERCEL_ENV === "preview"/);
  assert.match(page, /WETUDY_MY_COURSE_BETA_ENABLED === "true"/);
  assert.match(page, /params\.profile_demo === "1"/);
  assert.match(page, /if \(!user && !previewProfileDemo\)/);
  assert.match(page, /redirect\("\/auth\?next=\/beta\/mi-curso"\)/);
});

test("Beta 0 performs no Supabase writes and stores experiment data locally", () => {
  assert.match(client, /localStorage/);
  assert.match(client, /wetudy_my_course_beta_v0/);
  assert.doesNotMatch(client, /fetch\("\/api\/beta/);
  assert.doesNotMatch(page, /\.insert\(/);
  assert.doesNotMatch(page, /\.update\(/);
  assert.doesNotMatch(page, /\.delete\(/);
});

test("logged-in users reuse school and grade from their profile", () => {
  assert.match(page, /select\("school_id, grade_level"\)/);
  assert.match(client, /profileContext\.schoolId/);
  assert.match(client, /profileContext\.gradeLevel/);
  assert.match(client, /label: "Mi curso"/);
  assert.match(client, /Ya conocemos tu centro y curso/);
});

test("preview can simulate a configured profile without weakening real auth", () => {
  assert.match(authPage, /Probar interfaz autenticada/);
  assert.match(authPage, /\/marketplace\?profile_demo=1/);
  assert.match(page, /isDemoProfile: true/);
  assert.match(client, /Perfil de prueba/);
});

test("landing contains no Mi curso acquisition CTA", () => {
  assert.doesNotMatch(hero, /Mi curso|Preparar mi curso|Prepara el curso/);
  assert.doesNotMatch(howItWorks, /Mi curso|Prepara tu curso/);
  assert.doesNotMatch(landingPage, /beta\/mi-curso/);
});

test("Mi curso is a logged-in navigation destination directly after Marketplace", () => {
  assert.match(navbar, /href: "\/marketplace", label: "Marketplace"[\s\S]*href: "\/beta\/mi-curso", label: "Mi curso"/);
  assert.match(navbar, /GraduationCap/);
  assert.match(navbar, /if \(href === "\/beta\/mi-curso"\)/);
  assert.match(navbar, /previewDemoLoggedIn/);
  assert.match(navbar, /Perfil de prueba/);
  assert.match(betaLayout, /<Navbar/);
  assert.match(betaLayout, /getNavbarData/);
  assert.match(betaLayout, /<Footer \/>/);
});

test("Marketplace shows Mi curso only for authenticated preview users and beside Publicar anuncio", () => {
  assert.match(marketplacePage, /Boolean\(user\) \|\| previewProfileDemo/);
  assert.match(marketplacePage, /myCourseHref=/);
  assert.match(marketplaceClient, /href=\{myCourseHref\}/);
  assert.match(marketplaceClient, />Mi curso<\/Link>/);
  assert.match(marketplaceClient, /Mi curso[\s\S]*Publicar anuncio/);
  assert.doesNotMatch(marketplaceClient, /MaterialModeSwitch/);
});

test("Mi cuenta does not duplicate the Mi curso entry point", () => {
  assert.doesNotMatch(accountPage, /href: "\/beta\/mi-curso"/);
});

test("course metrics distinguish covered needs from visible product options", () => {
  assert.match(client, /coveredNeeds/);
  assert.match(client, /visibleOptions/);
  assert.match(client, /sameSchoolOptions/);
  assert.match(client, /Necesidades cubiertas/);
  assert.match(client, /Opciones en tu centro/);
  assert.match(client, /slice\(0, 3\)/);
  assert.match(client, /mejores opciones de/);
  assert.doesNotMatch(client, />Con opciones</);
});

test("mobile reset uses in-page confirmation", () => {
  assert.match(client, /confirmingReset/);
  assert.match(client, /Sí, borrar/);
  assert.match(client, /Cancelar/);
  assert.doesNotMatch(client, /window\.confirm/);
});

test("Mi curso and Marketplace preserve the user's need in both directions", () => {
  assert.match(client, /\/marketplace\?isbn=/);
  assert.match(client, /\/marketplace\?q=/);
  assert.match(marketplaceClient, /params\.get\("q"\)/);
  assert.match(marketplaceClient, /params\.get\("isbn"\)/);
  assert.match(marketplaceClient, /Añadir a Mi curso/);
  assert.match(marketplaceClient, /\/beta\/mi-curso\?add=/);
  assert.match(client, /Has llegado buscando esto/);
});
