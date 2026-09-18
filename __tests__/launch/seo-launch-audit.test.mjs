import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Wetudy global SEO uses its own brand and canonical host", () => {
  const layout = read("app/layout.tsx");
  const icon = read("public/icon.svg");
  const nextConfig = read("next.config.mjs");

  assert.match(layout, /Material escolar de segunda mano entre familias/);
  assert.doesNotMatch(layout, /Marketplace escolar comunitario/);
  assert.doesNotMatch(layout, /generator:\s*['"]v0\.app/);
  assert.match(layout, /https:\/\/www\.wetudy\.com/);
  assert.match(layout, /\/icon\.svg/);
  assert.match(icon, /#2563EB/);
  assert.match(icon, /Wetudy/);
  assert.match(nextConfig, /wetudy\.com/);
  assert.match(nextConfig, /www\.wetudy\.com/);
});

test("SEO crawl controls expose only intended public surfaces", () => {
  const robots = read("app/robots.ts");
  const sitemap = read("app/sitemap.ts");

  assert.match(robots, /\/api\//);
  assert.match(robots, /\/admin\//);
  assert.match(robots, /\/checkout\//);
  assert.match(robots, /\/messages\//);
  assert.match(robots, /sitemap\.xml/);

  assert.match(sitemap, /\/marketplace/);
  assert.match(sitemap, /\/como-funciona/);
  assert.match(sitemap, /status", "available"/);
  assert.doesNotMatch(sitemap, /\/checkout/);
  assert.doesNotMatch(sitemap, /\/account/);
});

test("old fabricated impact/ranking surfaces redirect to About", () => {
  const ranking = read("app/ranking/page.tsx");
  const impact = read("app/impacto/page.tsx");

  assert.match(ranking, /permanentRedirect\("\/about"\)/);
  assert.match(impact, /permanentRedirect\("\/about"\)/);
});

test("blog content avoids unsupported promotional claims and has article SEO", () => {
  const data = read("lib/blog-data.ts");
  const post = read("app/blog/[slug]/page.tsx");
  const blog = read("components/blog/blog-page-client.tsx");

  assert.doesNotMatch(data, /342 familias|156 articulos|15 kg de CO2|ahorrar hasta un 60%|450 kg de CO2/i);
  assert.match(data, /publishedAt/);
  assert.match(post, /generateMetadata/);
  assert.match(post, /Article/);
  assert.match(post, /canonical/);
  assert.doesNotMatch(blog, /Te has suscrito correctamente|handleSubscribe/);
});

test("listing pages publish canonical metadata and structured product data", () => {
  const page = read("app/marketplace/listing/[id]/page.tsx");

  assert.match(page, /alternates: \{ canonical \}/);
  assert.match(page, /Product/);
  assert.match(page, /BreadcrumbList/);
  assert.match(page, /itemCondition/);
  assert.match(page, /images: image/);
});

test("inactive legacy commerce stays gated during MVP launch", () => {
  const gate = read("lib/launch/feature-gates.ts");
  const paths = [
    "app/api/offers/buy-now/route.ts",
    "app/api/offers/create/route.ts",
    "app/api/offers/respond/route.ts",
    "app/api/payments/create-intent/route.ts",
    "app/api/payments/quote/route.ts",
    "app/api/shipments/create-label/route.ts",
    "app/api/shipments/mark-delivered/route.ts",
    "app/api/shipments/mark-dispatched/route.ts",
    "app/api/stripe/webhook/route.ts",
    "app/actions/stripe.ts",
  ];

  assert.match(gate, /ENABLE_LEGACY_COMMERCE/);
  for (const path of paths) {
    assert.match(read(path), /isLegacyCommerceEnabled/);
  }
});
