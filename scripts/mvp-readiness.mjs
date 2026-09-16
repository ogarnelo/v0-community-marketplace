const baseUrl = (process.argv[2] || "https://www.wetudy.com").replace(/\/$/, "");
const routes = ["/", "/marketplace", "/auth", "/help", "/privacy", "/terms"];
const requiredCopy = "La entrega y el pago se acuerdan directamente entre las partes.";
const forbiddenCopy = [/Apple Pay/i, /Correos/i, /wallet/i, /checkout/i];

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "user-agent": "wetudy-mvp-readiness/1.0" } });
  } finally {
    clearTimeout(timeout);
  }
}

let failed = false;
for (const route of routes) {
  const url = `${baseUrl}${route}`;
  try {
    const response = await fetchWithTimeout(url);
    const ok = response.status >= 200 && response.status < 400;
    console.log(`${ok ? "PASS" : "FAIL"} ${response.status} ${url}`);
    if (!ok) failed = true;

    if (route === "/" && ok) {
      const html = await response.text();
      if (!html.includes(requiredCopy)) {
        console.error(`FAIL homepage missing required MVP copy: ${requiredCopy}`);
        failed = true;
      }
      for (const pattern of forbiddenCopy) {
        if (pattern.test(html)) {
          console.error(`FAIL homepage contains forbidden MVP term: ${pattern}`);
          failed = true;
        }
      }
    }
  } catch (error) {
    console.error(`FAIL ${url}: ${error?.message || error}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("MVP readiness smoke check passed.");
