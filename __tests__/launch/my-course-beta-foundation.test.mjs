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
const onboardingPage = read("app/beta/onboarding/page.tsx");
const onboardingClient = read("components/my-course/onboarding-beta-client.tsx");
const accountBetaPage = read("app/beta/cuenta/page.tsx");
const accountBetaClient = read("components/my-course/account-students-beta-client.tsx");

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
  assert.match(onboardingClient, /wetudy_onboarding_beta_v1/);
  assert.doesNotMatch(client, /fetch\("\/api\/beta/);
  assert.doesNotMatch(page, /\.insert\(/);
  assert.doesNotMatch(page, /\.update\(/);
  assert.doesNotMatch(page, /\.delete\(/);
});

test("logged-in users reuse school grade and account type from their profile", () => {
  assert.match(page, /select\("school_id, grade_level, user_type"\)/);
  assert.match(client, /profileContext\.schoolId/);
  assert.match(client, /profileContext\.gradeLevel/);
  assert.match(client, /profileContext\.userType/);
  assert.match(client, /Ya conocemos tu centro y curso/);
});

test("preview onboarding is two short steps with optional student aliases", () => {
  assert.match(onboardingPage, /VERCEL_ENV !== "preview"/);
  assert.match(onboardingClient, /1 · Cuenta/);
  assert.match(onboardingClient, /2 ·/);
  assert.match(onboardingClient, /Código postal/);
  assert.match(onboardingClient, /Soy estudiante/);
  assert.match(onboardingClient, /Familia \/ tutor/);
  assert.match(onboardingClient, /Nombre o alias/);
  assert.match(onboardingClient, /\+ Añadir otro estudiante|Añadir otro estudiante/);
  assert.match(onboardingClient, /Entrar en Wetudy/);
  assert.doesNotMatch(onboardingClient, /Fecha de nacimiento/);
});

test("preview auth links to the new onboarding without weakening real auth", () => {
  assert.match(authPage, /Probar nuevo onboarding/);
  assert.match(authPage, /\/beta\/onboarding/);
  assert.match(page, /isDemoProfile: true/);
});

test("Mi cuenta manages students later without repeating the onboarding", () => {
  assert.match(accountBetaPage, /VERCEL_ENV !== "preview"/);
  assert.match(accountBetaClient, /Mi contexto educativo/);
  assert.match(accountBetaClient, /Estudiantes/);
  assert.match(accountBetaClient, /Añadir estudiante/);
  assert.match(accountBetaClient, /Código postal/);
  assert.match(accountBetaClient, /wetudy_onboarding_beta_v1/);
  assert.match(navbar, /accountHref/);
  assert.match(navbar, /\/beta\/cuenta\?profile_demo=1/);
});

test("student and family accounts get different Mi curso behavior", () => {
  assert.match(client, /accountType === "student"/);
  assert.match(client, /Estudiante \{index \+ 1\}/);
  assert.match(client, /\+ Añadir otro estudiante/);
  assert.match(client, /Esta cuenta de estudiante gestiona únicamente su propio contexto educativo/);
  assert.doesNotMatch(client, /"Hijo\/a|>Hijo\/a|hijo\/a o|otro hijo|otra hija/i);
});

test("Mi curso metrics and needs are scoped to the active student", () => {
  assert.match(client, /activeLearnerId/);
  assert.match(client, /activeLearner/);
  assert.match(client, /visibleLearners/);
  assert.match(client, /activeMetrics/);
  assert.match(client, /setActiveLearnerId/);
});

test("landing contains no Mi curso acquisition CTA", () => {
  assert.doesNotMatch(hero, /Mi curso|Preparar mi curso|Prepara el curso/);
  assert.doesNotMatch(howItWorks, /Mi curso|Prepara tu curso/);
  assert.doesNotMatch(landingPage, /beta\/mi-curso/);
});

test("Mi curso is a logged-in navigation destination directly after Marketplace", () => {
  assert.match(navbar, /href: "\/marketplace", label: "Marketplace"[\s\S]*href: myCourseHref, label: "Mi curso"/);
  assert.match(navbar, /GraduationCap/);
  assert.match(navbar, /if \(href === "\/beta\/mi-curso"\)/);
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


test("mobile onboarding avoids CP zoom and returns the next step to the top", () => {
  assert.match(onboardingClient, /inputMode="numeric"/);
  assert.match(onboardingClient, /text-base/);
  assert.match(onboardingClient, /document\.activeElement\.blur\(\)/);
  assert.match(onboardingClient, /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
});

test("finishing onboarding persists a complete student still in draft", () => {
  assert.match(onboardingClient, /hasDraftStudent/);
  assert.match(onboardingClient, /studentsToPersist/);
  assert.match(onboardingClient, /student\.alias\.trim\(\) \|\| "Estudiante "/);
});

test("student aliases survive into Mi curso and Mi cuenta", () => {
  assert.match(accountBetaClient, /Nombre o alias/);
  assert.match(accountBetaClient, /alias\.trim\(\) \|\| "Estudiante "/);
  assert.match(client, /formData\.get\("alias"\)/);
  assert.match(client, /learner\.label \|\| "Estudiante "/);
});
