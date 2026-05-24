import { createAdminClient } from "@/lib/supabase/admin";

export type AutomationJobId =
  | "health.ready"
  | "health.full"
  | "supabase.keepalive"
  | "seo.autogenerate"
  | "demand.tables.check"
  | "seo.pages.check"
  | "autopilot.growth"
  | "moderation.scan"
  | "seo.maintenance"
  | "conversion.generate"
  | "demand.match_existing";

export type AutomationJobDefinition = {
  id: AutomationJobId;
  name: string;
  description: string;
  risk: "low" | "medium";
  recommendedCadence: string;
  privateResult?: boolean;
};

export const AUTOMATION_JOBS: AutomationJobDefinition[] = [
  {
    id: "health.ready",
    name: "Readiness check",
    description: "Comprueba que la app responde y que la ruta pública de readiness está operativa.",
    risk: "low",
    recommendedCadence: "Cada hora",
  },
  {
    id: "health.full",
    name: "Full healthcheck",
    description: "Comprueba variables, Supabase, tablas críticas y Stripe. Requiere secreto.",
    risk: "low",
    recommendedCadence: "Cada 6 horas",
    privateResult: true,
  },
  {
    id: "supabase.keepalive",
    name: "Supabase keepalive",
    description: "Hace una consulta segura para evitar pausa por inactividad en proyectos free.",
    risk: "low",
    recommendedCadence: "Cada 24 horas",
  },
  {
    id: "seo.autogenerate",
    name: "SEO autogenerate",
    description: "Genera o actualiza páginas SEO controladas a partir de demanda e inventario.",
    risk: "medium",
    recommendedCadence: "Diario",
  },
  {
    id: "demand.tables.check",
    name: "Demand tables check",
    description: "Revisa si las tablas de inteligencia de demanda existen y tienen datos recientes.",
    risk: "low",
    recommendedCadence: "Diario",
  },
  {
    id: "seo.pages.check",
    name: "SEO pages check",
    description: "Revisa cuántas páginas SEO están publicadas, en draft, noindex o archivadas.",
    risk: "low",
    recommendedCadence: "Diario",
  },
  {
    id: "autopilot.growth",
    name: "Autopilot Growth",
    description: "Genera recomendaciones automáticas de crecimiento, liquidez, captación y conversión.",
    risk: "medium",
    recommendedCadence: "Diario",
  },
  {
    id: "moderation.scan",
    name: "Moderation scan",
    description: "Escanea anuncios recientes para detectar señales de riesgo o baja calidad.",
    risk: "medium",
    recommendedCadence: "Diario",
  },
  {
    id: "seo.maintenance",
    name: "SEO maintenance",
    description: "Recalcula inventario de páginas SEO y marca noindex cuando una página pierde oferta suficiente.",
    risk: "medium",
    recommendedCadence: "Diario",
  },
  {
    id: "conversion.generate",
    name: "Conversion nudges",
    description: "Genera recomendaciones para vendedores: demanda activa, precio, compartir y publicar productos similares.",
    risk: "medium",
    recommendedCadence: "Diario",
  },
  {
    id: "demand.match_existing",
    name: "Demand matching",
    description: "Empareja demandas abiertas con anuncios existentes y avisa a usuarios interesados.",
    risk: "medium",
    recommendedCadence: "Diario",
  },
];

export function getAutomationJob(jobId: string) {
  return AUTOMATION_JOBS.find((job) => job.id === jobId) || null;
}

function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

function withSecret(path: string) {
  const secret = process.env.LAUNCH_HEALTH_SECRET;
  if (!secret) return path;

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}secret=${encodeURIComponent(secret)}`;
}

async function fetchJson(path: string, options?: { secret?: boolean }) {
  const url = `${appUrl()}${options?.secret ? withSecret(path) : path}`;
  const start = Date.now();

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  });

  const text = await response.text();
  let json: unknown = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 1000) };
  }

  return {
    ok: response.ok,
    status: response.status,
    latencyMs: Date.now() - start,
    url: url.replace(/secret=[^&]+/g, "secret=***"),
    data: json,
  };
}

async function tableCount(table: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    return { table, ok: false, count: 0, error: error.message };
  }

  return { table, ok: true, count: count || 0 };
}

export async function runAutomationJob(jobId: string) {
  const job = getAutomationJob(jobId);

  if (!job) {
    return {
      ok: false,
      message: "Automation job not found.",
      result: { jobId },
    };
  }

  if (job.id === "health.ready") {
    const result = await fetchJson("/api/health/ready");
    return {
      ok: result.ok,
      message: result.ok ? "Readiness OK." : `Readiness failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "health.full") {
    const result = await fetchJson("/api/health/full", { secret: true });
    return {
      ok: result.ok,
      message: result.ok ? "Full healthcheck OK." : `Full healthcheck failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "supabase.keepalive") {
    const result = await fetchJson("/api/health/supabase-keepalive", { secret: true });
    return {
      ok: result.ok,
      message: result.ok ? "Supabase keepalive OK." : `Supabase keepalive failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "seo.autogenerate") {
    const result = await fetchJson("/api/seo/autogenerate", { secret: true });
    return {
      ok: result.ok,
      message: result.ok ? "SEO autogeneration completed." : `SEO autogeneration failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "demand.tables.check") {
    const tables = await Promise.all([
      tableCount("demand_events"),
      tableCount("demand_requests"),
      tableCount("demand_opportunity_actions"),
      tableCount("demand_match_notifications"),
    ]);

    const ok = tables.every((table) => table.ok);

    return {
      ok,
      message: ok ? "Demand tables OK." : "Some demand tables are missing or not readable.",
      result: { tables },
    };
  }

  if (job.id === "autopilot.growth") {
    const result = await fetchJson("/api/autopilot/run", { secret: true });
    return {
      ok: result.ok,
      message: result.ok ? "Autopilot Growth completed." : `Autopilot Growth failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "moderation.scan") {
    const result = await fetchJson("/api/moderation/scan", { secret: true });
    return {
      ok: result.ok,
      message: result.ok ? "Moderation scan completed." : `Moderation scan failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "seo.maintenance") {
    const result = await fetchJson("/api/seo/maintenance", { secret: true });
    return {
      ok: result.ok,
      message: result.ok ? "SEO maintenance completed." : `SEO maintenance failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "conversion.generate") {
    const result = await fetchJson("/api/conversion/generate", { secret: true });
    return {
      ok: result.ok,
      message: result.ok ? "Conversion nudges generated." : `Conversion nudges failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "demand.match_existing") {
    const result = await fetchJson("/api/demand/match-existing", { secret: true });
    return {
      ok: result.ok,
      message: result.ok ? "Demand matching completed." : `Demand matching failed with ${result.status}.`,
      result,
    };
  }

  if (job.id === "seo.pages.check") {
    const admin = createAdminClient();

    const statuses = ["published", "draft", "noindex", "archived"];
    const counts = await Promise.all(
      statuses.map(async (status) => {
        const { count, error } = await admin
          .from("seo_programmatic_pages")
          .select("id", { count: "exact", head: true })
          .eq("status", status);

        return {
          status,
          ok: !error,
          count: count || 0,
          error: error?.message,
        };
      })
    );

    const ok = counts.every((item) => item.ok);

    return {
      ok,
      message: ok ? "SEO pages table OK." : "SEO pages table has issues.",
      result: { counts },
    };
  }

  return {
    ok: false,
    message: "Unhandled automation job.",
    result: { jobId },
  };
}

export const DAILY_AUTOMATION_JOB_IDS: AutomationJobId[] = [
  "health.ready",
  "supabase.keepalive",
  "seo.autogenerate",
  "seo.maintenance",
  "demand.tables.check",
  "seo.pages.check",
  "autopilot.growth",
  "conversion.generate",
  "demand.match_existing",
  "moderation.scan",
];
