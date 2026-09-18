import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("Wetudy global SEO uses its own brand and canonical host", () => {
  const layout = read("app/layout.tsx");
  const icon = read("public/icon.svg");
  const nextConfig = read("next.config.mjs");

  assert.match(layout, /Reutiliza material escolar entre familias/);
  assert.doesNotMatch(layout, /Marketplace escolar comunitario/);
  assert.doesNotMatch(layout, /generator:\s*['"]v0\.app/);
  assert.match(layout, /https:\/\/www\.wetudy\.com/);
  assert.match(layout, /\/favicon\.ico/);
  assert.match(layout, /\/icon\.svg/);
  assert.match(layout, /\/apple-icon\.png/);
  assert.match(icon, /#2563EB/);
  assert.match(icon, /Wetudy/);
  assert.match(nextConfig, /wetudy\.com/);
  assert.match(nextConfig, /www\.wetudy\.com/);
});

test("SEO crawl controls expose only intended public surfaces", () => {
  const robots = read("app/robots.ts");
  const sitemap = read("app/sitemap.ts");
  const manifest = read("app/manifest.ts");

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
  assert.match(sitemap, /seoRefresh/);
  assert.match(manifest, /wetudy-icon-192\.png/);
  assert.match(manifest, /wetudy-icon-512\.png/);
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

test("listing pages publish canonical metadata and truthful structured product data", () => {
  const page = read("app/marketplace/listing/[id]/page.tsx");
  const structured = read("lib/seo/structured-data.ts");

  assert.match(page, /alternates: \{ canonical \}/);
  assert.match(page, /Product/);
  assert.match(page, /buildBreadcrumbJsonLd/);
  assert.match(structured, /BreadcrumbList/);
  assert.match(page, /itemCondition/);
  assert.match(page, /hasExplicitPrice/);
  assert.doesNotMatch(page, /Number\(listing\.price \|\| 0\)/);
  assert.match(page, /SEO_SITE_URL/);
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
    "app/api/reviews/create/route.ts",
    "app/actions/stripe.ts",
  ];

  assert.match(gate, /ENABLE_LEGACY_COMMERCE/);
  for (const path of paths) {
    assert.match(read(path), /isLegacyCommerceEnabled/);
  }
});


test("public SEO pages publish their own canonical social metadata and breadcrumb graph", () => {
  const metadataBuilder = read("lib/seo/metadata.ts");
  const structured = read("lib/seo/structured-data.ts");
  const pages = [
    "app/about/page.tsx",
    "app/help/page.tsx",
    "app/como-funciona/page.tsx",
    "app/vende-tus-libros/page.tsx",
    "app/blog/page.tsx",
  ];

  assert.match(metadataBuilder, /openGraph/);
  assert.match(metadataBuilder, /twitter/);
  assert.match(structured, /SEO_ORGANIZATION_ID/);
  assert.match(structured, /SEO_WEBSITE_ID/);
  assert.match(structured, /BreadcrumbList/);

  for (const path of pages) {
    const source = read(path);
    assert.match(source, /buildPublicMetadata/);
    assert.match(source, /buildBreadcrumbJsonLd/);
  }
});

test("homepage entity graph links Wetudy organization, logo and website", () => {
  const home = read("app/page.tsx");

  assert.match(home, /SEO_ORGANIZATION_ID/);
  assert.match(home, /SEO_WEBSITE_ID/);
  assert.match(home, /ImageObject/);
  assert.match(home, /contentUrl/);
  assert.match(home, /publisher: \{ "@id": SEO_ORGANIZATION_ID \}/);
});


test("active chat hides legacy commerce reads and actions unless explicitly enabled", () => {
  const page = read("app/messages/[id]/page.tsx");
  const realtime = read("components/messages/realtime-chat-messages.tsx");

  assert.match(page, /isLegacyCommerceEnabled/);
  assert.match(page, /legacyCommerceEnabled[\s\S]*listing_offers/);
  assert.match(page, /legacyCommerceEnabled[\s\S]*payment_intents/);
  assert.match(page, /legacyCommerceEnabled[\s\S]*shipments/);
  assert.match(page, /legacyCommerceEnabled=\{legacyCommerceEnabled\}/);
  assert.match(realtime, /legacyCommerceEnabled = false/);
  assert.match(realtime, /resolvedOffer && parsedOffer && legacyCommerceEnabled/);
  assert.match(realtime, /getOfferChatPreview\(message\.body\)/);
});
