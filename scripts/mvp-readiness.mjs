const baseUrl = (process.argv[2] || "https://www.wetudy.com").replace(/\/$/, "");
const publicRoutes = ["/", "/marketplace", "/auth", "/help", "/privacy", "/terms"];
const requiredCopy = "La entrega y el pago se acuerdan directamente entre las partes.";
const forbiddenHomeCopy = /fuera de Wetudy|fuera de la plataforma|miles de familias/i;

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
    console.log(`[ok] ${pathname} → HTTP ${response.status}`);
    return response.text();
  } catch (error) {
    failed = true;
    console.error(`[fail] ${pathname} → ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const homeHtml = await checkRoute("/");
for (const pathname of publicRoutes.slice(1)) await checkRoute(pathname);

if (homeHtml) {
  if (!homeHtml.includes("Wetudy")) {
    failed = true;
    console.error("[fail] La home no contiene la marca Wetudy.");
  }
  if (!homeHtml.includes(requiredCopy)) {
    failed = true;
    console.error("[fail] La home no contiene el copy MVP de entrega y pago.");
  }
  if (forbiddenHomeCopy.test(homeHtml)) {
    failed = true;
    console.error("[fail] La home contiene copy antiguo o una métrica de lanzamiento no validada.");
  }
}

if (failed) process.exitCode = 1;
else console.log("[ok] Readiness público del MVP completado.");
