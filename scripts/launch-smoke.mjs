#!/usr/bin/env node

const inputBaseUrl = (process.argv[2] || process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

if (!inputBaseUrl) {
  console.error("Missing base URL. Use: node scripts/launch-smoke.mjs https://your-domain.com");
  process.exit(1);
}

const routes = [
  { path: "/", expected: [200] },
  { path: "/marketplace", expected: [200] },
  { path: "/seguridad", expected: [200] },
  { path: "/negocios", expected: [200] },
  { path: "/impacto", expected: [200] },
  { path: "/legal/privacidad", expected: [200] },
  { path: "/legal/terminos", expected: [200] },
  { path: "/api/health/ready", expected: [200, 503] },
  { path: "/api/health/supabase-keepalive", expected: [200, 401, 503] },
  { path: "/api/health/full", expected: [200, 401, 503] },
  { path: "/account", expected: [200, 302, 307, 308] },
  { path: "/messages", expected: [200, 302, 307, 308] },
  { path: "/favorites", expected: [200, 302, 307, 308] },
  { path: "/feed", expected: [200, 302, 307, 308] },
];

let failed = 0;

console.log(`\nWetudy launch smoke test: ${inputBaseUrl}\n`);

for (const route of routes) {
  const url = `${inputBaseUrl}${route.path}`;
  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": "wetudy-launch-smoke/1.2" },
    });

    const ms = Date.now() - start;
    const ok = route.expected.includes(response.status);
    const finalUrl = response.url && response.url !== url ? ` → ${response.url}` : "";

    console.log(`${ok ? "✅" : "❌"} ${response.status} ${route.path} ${ms}ms${finalUrl}`);

    if (!ok) failed += 1;
  } catch (error) {
    failed += 1;
    console.log(`❌ ERR ${route.path} ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed > 0) {
  console.error(`\n❌ Smoke test failed: ${failed} route(s) need attention.\n`);
  process.exit(1);
}

console.log("\n✅ Smoke test passed.\n");
