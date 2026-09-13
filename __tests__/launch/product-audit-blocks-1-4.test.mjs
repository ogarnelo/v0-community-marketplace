import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const marketplacePage = fs.readFileSync("app/marketplace/page.tsx", "utf8");
const marketplaceClient = fs.readFileSync("components/marketplace/marketplace-client.tsx", "utf8");
const searchEventsRoute = fs.readFileSync("app/api/marketplace/search-events/route.ts", "utf8");
const demandPage = fs.readFileSync("app/admin/super/demand/page.tsx", "utf8");
const transactional = fs.readFileSync("lib/emails/transactional.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260913200000_marketplace_search_events.sql", "utf8");

describe("MVP product audit blocks 1-4", () => {
  it("loads marketplace data server-first instead of waiting for client hydration", () => {
    assert.doesNotMatch(marketplacePage, /^"use client"/);
    assert.match(marketplacePage, /createClient/);
    assert.match(marketplacePage, /MarketplaceClient/);
    assert.match(marketplacePage, /initialListings/);
    assert.match(marketplaceClient, /initialListings/);
  });

  it("keeps community as a filter instead of a hard visibility wall", () => {
    assert.match(marketplaceClient, /onlyMyCommunity/);
    assert.match(marketplaceClient, /Solo mi comunidad/);
    assert.match(marketplaceClient, /Wetudy también puede mostrar anuncios útiles de otras comunidades/);
  });

  it("improves marketplace UX filters and removes price number spinners locally", () => {
    assert.match(marketplaceClient, /inputMode="decimal"/);
    assert.match(marketplaceClient, /type="text"/);
    assert.match(marketplaceClient, /Qué es el ISBN/);
    assert.match(marketplaceClient, /normalizeText/);
  });

  it("captures demand intelligence from searches and zero-result filters", () => {
    assert.match(searchEventsRoute, /marketplace_search_events/);
    assert.match(searchEventsRoute, /results_count/);
    assert.match(migration, /create table if not exists public\.marketplace_search_events/);
    assert.match(migration, /marketplace_demand_summary/);
    assert.match(demandPage, /Demand intelligence/);
  });

  it("brands transactional emails with a reusable Wetudy shell", () => {
    assert.match(transactional, /BRAND/);
    assert.match(transactional, /emailShell/);
    assert.match(transactional, /getLogoUrl/);
    assert.match(transactional, /#2563EB/);
    assert.doesNotMatch(transactional, /fuera de Wetudy/i);
  });
});
