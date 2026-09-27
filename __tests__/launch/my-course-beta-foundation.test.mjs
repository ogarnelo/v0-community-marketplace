import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const page = read("app/beta/mi-curso/page.tsx");
const client = read("components/my-course/my-course-beta-client.tsx");
const optionsPage = read("app/beta/page.tsx");
const optionsClient = read("components/my-course/beta-journey-home.tsx");
const accountPage = read("app/account/page.tsx");
const marketplacePage = read("app/marketplace/page.tsx");
const marketplaceClient = read("components/marketplace/marketplace-client.tsx");
const landingPage = read("app/page.tsx");
const hero = read("components/landing/hero-section.tsx");

test("Mi curso Beta 0 is preview-only unless explicitly enabled", () => {
  assert.match(page, /VERCEL_ENV === "preview"/);
  assert.match(page, /WETUDY_MY_COURSE_BETA_ENABLED === "true"/);
  assert.match(page, /notFound\(\)/);
  assert.match(optionsPage, /VERCEL_ENV === "preview"/);
  assert.match(optionsPage, /notFound\(\)/);
});

test("Beta 0 performs no Supabase writes and stores experiment data locally", () => {
  assert.match(client, /localStorage/);
  assert.match(client, /wetudy_my_course_beta_v0/);
  assert.doesNotMatch(client, /fetch\("\/api\/beta/);
  assert.doesNotMatch(page, /\.insert\(/);
  assert.doesNotMatch(page, /\.update\(/);
  assert.doesNotMatch(page, /\.delete\(/);
});

test("Beta 0 only reads the minimum production data required for matching and profile context", () => {
  assert.match(page, /from\("schools"\)/);
  assert.match(page, /from\("listings"\)/);
  assert.match(page, /from\("profiles"\)/);
  assert.match(page, /select\("school_id, grade_level"\)/);
  assert.match(page, /eq\("status", "available"\)/);
  assert.match(page, /safeListings/);
  assert.doesNotMatch(page, /seller_id/);
  assert.doesNotMatch(page, /postal_code/);
});

test("logged-in users reuse school and grade from their profile instead of reconfiguring", () => {
  assert.match(client, /profileContext\.isLoggedIn/);
  assert.match(client, /profileContext\.schoolId/);
  assert.match(client, /profileContext\.gradeLevel/);
  assert.match(client, /label: "Mi curso"/);
  assert.match(client, /Ya conocemos tu centro y curso/);
  assert.match(client, /Solo tienes que rellenarlo si quieres añadir otro hijo\/a/);
});

test("Mi curso surfaces the value proposition before backend persistence", () => {
  assert.match(client, /de la lista con opciones/);
  assert.match(client, /Ahorro potencial/);
  assert.match(client, /Tu centro/);
  assert.match(client, /Mejor opción/);
  assert.match(client, /Wetudy debería buscarlo por ti/);
  assert.match(client, /1 · Tu curso/);
  assert.match(client, /2 · Lo que necesitas/);
  assert.match(client, /3 · Wetudy busca/);
});

test("mobile reset uses an in-page confirmation instead of browser confirm", () => {
  assert.match(client, /confirmingReset/);
  assert.match(client, /Sí, borrar/);
  assert.match(client, /Cancelar/);
  assert.doesNotMatch(client, /window\.confirm/);
});

test("the options page is expressed as plain user intentions", () => {
  assert.match(optionsClient, /¿Qué quieres resolver hoy\?/);
  assert.match(optionsClient, /Preparar el curso/);
  assert.match(optionsClient, /Encontrar algo concreto/);
  assert.match(optionsClient, /Vender o donar/);
  assert.match(optionsClient, /Continuar Mi curso/);
  assert.doesNotMatch(optionsClient, /Journey Beta/);
  assert.doesNotMatch(optionsClient, /Principio de integración/);
});

test("the zero-cost beta includes a real-data demo and existing marketplace completion path", () => {
  assert.match(client, /function loadDemo/);
  assert.match(client, /Ver ejemplo/);
  assert.match(client, /anuncios reales/);
  assert.match(client, /\/marketplace\/listing\//);
  assert.match(client, /Ver y contactar/);
});

test("preview integration makes Mi curso discoverable without replacing current journeys", () => {
  assert.match(landingPage, /showMyCourseBeta=\{process\.env\.VERCEL_ENV === "preview"\}/);
  assert.match(landingPage, /isLoggedIn=\{navbarProps\.isLoggedIn\}/);
  assert.match(hero, /Prepara el curso completo/);
  assert.match(hero, /Organiza todo lo que necesitas/);
  assert.match(hero, /href="\/beta\/mi-curso"/);
  assert.match(accountPage, /href: "\/beta\/mi-curso"/);
  assert.match(marketplacePage, /showMyCourseBeta=\{process\.env\.VERCEL_ENV === "preview"\}/);
  assert.match(marketplaceClient, /¿Preparando todo el curso\?/);
  assert.match(marketplaceClient, /Abrir Mi curso/);
});

test("Mi curso can return to simple alternatives without technical wording", () => {
  assert.match(client, /href="\/beta"/);
  assert.match(client, /Otras opciones/);
});
