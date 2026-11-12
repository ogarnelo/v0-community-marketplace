const baseUrl = (process.argv[2] || "https://www.wetudy.com").replace(/\/$/, "");
const publicRoutes = ["/", "/marketplace", "/auth", "/help", "/privacy", "/terms", "/about"];
const legacyCommerceRoutes = ["/checkout/cancel", "/checkout/success", "/checkout/readiness-probe"];
const requiredCopy = "La entrega y el pago se acuerdan directamente entre las partes.";
const savingsCopy =
  "En libros de texto, comprar de segunda mano puede suponer un ahorro de entre el 50% y el 75% frente a comprarlos nuevos.";
const forbiddenPublicCopy = /fuera de Wetudy|fuera de la plataforma|miles de familias|precio orientativo/i;
const forbiddenSavingsSource = /Fuente:|\b(?:Wallapop|Telemadrid|RTVE|EFE)\b/i;
const forbiddenCommerceCopy = /Preparar pago|Stripe|Pago trazable|checkout solo está disponible/i;

let failed = false;

async function checkRoute(pathname) {
  const url = `${baseUrl}${pathname}`;
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
      failed = true;
      console.error(`[fail] ${pathname} → HTTP ${response.status}`);
      return null;
    }
    const html = await response.text();
    console.log(`[ok] ${pathname} → HTTP ${response.status}`);
    // Marketplace includes user-generated listing descriptions (including demo prices).
    // Check our own landing copy elsewhere, not arbitrary listing text.
    if (pathname !== "/marketplace" && forbiddenPublicCopy.test(html)) {
      failed = true;
      console.error(`[fail] ${pathname} contiene copy antiguo o una métrica de lanzamiento no validada.`);
    }
    return html;
  } catch (error) {
    failed = true;
    console.error(`[fail] ${pathname} → ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function checkLegacyCommerceRoute(pathname) {
  const url = `${baseUrl}${pathname}`;
  try {
    const response = await fetch(url, { redirect: "follow" });
    const html = await response.text();
    const finalPathname = new URL(response.url).pathname;

    if (!response.ok) {
      failed = true;
      console.error(`[fail] ${pathname} → HTTP ${response.status}`);
      return;
    }

    if (finalPathname.startsWith("/checkout")) {
      failed = true;
      console.error(`[fail] ${pathname} sigue accesible en el flujo legacy de checkout.`);
      return;
    }

    if (forbiddenCommerceCopy.test(html)) {
      failed = true;
      console.error(`[fail] ${pathname} expone copy de pagos/checkout fuera del MVP.`);
      return;
    }

    console.log(`[ok] ${pathname} bloqueado → ${finalPathname}`);
  } catch (error) {
    failed = true;
    console.error(`[fail] ${pathname} → ${error instanceof Error ? error.message : String(error)}`);
  }
}

const pages = new Map();
for (const pathname of publicRoutes) pages.set(pathname, await checkRoute(pathname));

const homeHtml = pages.get("/");
if (homeHtml) {
  if (!homeHtml.includes("Wetudy")) {
    failed = true;
    console.error("[fail] La home no contiene la marca Wetudy.");
  }
  if (!homeHtml.includes(requiredCopy)) {
    failed = true;
    console.error("[fail] La home no contiene el copy MVP de entrega y pago.");
  }
  if (!homeHtml.includes(savingsCopy)) {
    failed = true;
    console.error("[fail] La home no contiene el dato final de ahorro del 50%-75% en libros de texto.");
  }
  if (forbiddenSavingsSource.test(homeHtml)) {
    failed = true;
    console.error("[fail] La home vuelve a mostrar una fuente o marca junto al dato de ahorro.");
  }
}

for (const pathname of legacyCommerceRoutes) await checkLegacyCommerceRoute(pathname);


async function checkLegacyImpactRedirect(pathname) {
  try {
    const response = await fetch(`${baseUrl}${pathname}`, { redirect: "manual" });
    const destination = response.headers.get("location") || "";
    if (![301, 302, 307, 308].includes(response.status) || !new URL(destination, baseUrl).pathname.startsWith("/about")) {
      failed = true;
      console.error(`[fail] ${pathname} debe redirigir a /about sin mostrar métricas ficticias (HTTP ${response.status}).`);
      return;
    }
    console.log(`[ok] ${pathname} → /about (HTTP ${response.status})`);
  } catch (error) {
    failed = true;
    console.error(`[fail] ${pathname} → ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Read-only smoke tests: protect against old cached or redeployed demo success stories.
for (const pathname of ["/ranking", "/impacto"]) await checkLegacyImpactRedirect(pathname);
const ampaHtml = await checkRoute("/blog/ampas-transformando-economia-escolar");
if (ampaHtml) {
  if (!ampaHtml.includes("Ideas para que un AMPA impulse la reutilización de material escolar")) {
    failed = true;
    console.error("[fail] La guía AMPA no muestra el título editorial corregido.");
  }
  if (/El caso del CEIP San Miguel|342 familias participaron|Feria de Reutilización|En Wetudy hemos medido/i.test(ampaHtml)) {
    failed = true;
    console.error("[fail] La guía AMPA contiene afirmaciones de adopción no verificadas.");
  }
}

if (failed) process.exitCode = 1;
else console.log("[ok] Readiness público del MVP completado.");
