"use client";

import { useState } from "react";
import type {
  FederationDashboardMetric,
  FederationDashboardModel,
} from "@/lib/reports/federation-dashboard-view-model";

/**
 * Read-only and presentation-only. Props MUST originate in the server-side
 * authorized reporting service and presentation allowlist, never in a browser
 * Supabase query. This component intentionally has no mutation controls.
 */
export function FederationKpiDashboard({
  model,
  onPeriodChange,
}: {
  model: FederationDashboardModel;
  /** Omit callback until the protected server route exists. */
  onPeriodChange?: (period: FederationDashboardModel["period"]) => void;
}) {
  const [selectedSchool, setSelectedSchool] = useState("all");
  const schoolIds = new Set(model.schools.map(s => s.id));
  const safeSelection = selectedSchool === "all" || schoolIds.has(selectedSchool)
    ? selectedSchool : "all";
  const visibleSchools = safeSelection === "all"
    ? model.schools
    : model.schools.filter(s => s.id === safeSelection);
  const formatter = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 1,
  });
  const euro = new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 2,
  });
  const formatMetric = (metric: FederationDashboardMetric) =>
    metric.unit === "eur" ? euro.format(metric.value)
      : metric.unit === "kg" ? `${formatter.format(metric.value)} kg`
      : formatter.format(metric.value);
  const byKey = (metrics: readonly FederationDashboardMetric[] | null,
    key: FederationDashboardMetric["key"]) =>
    metrics?.find(metric => metric.key === key);

  return (
    <section aria-label="Panel de indicadores de asociaciones representadas"
      className="mx-auto w-full max-w-7xl space-y-7">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Reporting federativo
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            Solo lectura
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Impacto de las AMPAs representadas
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {model.organization} · Estadísticas agregadas y detalle por colegio.
          No permite administrar colegios, usuarios, anuncios ni operaciones.
        </p>
      </header>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-5">
        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Periodo</span>
          <select aria-label="Filtrar por periodo"
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            value={model.period}
            disabled={!onPeriodChange}
            onChange={event => {
              const period=event.target.value;
              if (period === "90d" || period === "365d" || period === "total") {
                onPeriodChange?.(period);
              }
            }}>
            <option value="90d">Últimos 90 días</option>
            <option value="365d">Últimos 365 días</option>
            <option value="total">Histórico</option>
          </select>
          {!onPeriodChange && <span className="block text-xs font-normal text-muted-foreground">
            El cambio de periodo estará disponible al conectar la consulta autorizada.
          </span>}
        </label>

        <label className="space-y-2 text-sm font-medium text-foreground">
          <span>Colegio</span>
          <select aria-label="Filtrar por colegio"
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={safeSelection}
            onChange={event => {
              const next=event.target.value;
              if (next === "all" || schoolIds.has(next)) setSelectedSchool(next);
            }}>
            <option value="all">Todos los colegios representados</option>
            {model.schools.map(school=>
              <option key={school.id} value={school.id}>{school.name}</option>
            )}
          </select>
          <span className="block text-xs font-normal text-muted-foreground">
            Solo aparecen centros incluidos en el ámbito autorizado.
          </span>
        </label>
      </div>

      <section className="space-y-3" aria-label="Indicadores agregados">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Resumen del ámbito autorizado</h2>
          <span className="text-xs text-muted-foreground">{model.periodLabel}</span>
        </div>
        {model.totalSuppressed || !model.total ? (
          <p role="status" className="rounded-xl border border-border bg-muted/50 p-5 text-sm text-muted-foreground">
            Total protegido por confidencialidad. No se muestran cifras agregadas
            cuando podrían deducirse los resultados de colegios con pocos participantes.
          </p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {model.total.map(metric=>
              <div key={metric.key} className="rounded-xl border border-border bg-card px-4 py-5">
                <dt className="text-xs leading-5 text-muted-foreground">{metric.title}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {formatMetric(metric)}
                </dd>
              </div>
            )}
          </dl>
        )}
        <p className="text-xs text-muted-foreground">
          El resumen comprende el ámbito autorizado completo, aunque se seleccione un colegio.
        </p>
      </section>

      <section aria-label="Resultados individuales por colegio" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Resultados por colegio</h2>
          <span className="text-xs text-muted-foreground">
            {visibleSchools.length} {visibleSchools.length===1?"centro":"centros"}
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[940px] text-left text-sm">
            <caption className="sr-only">Indicadores agregados por colegio representado</caption>
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Colegio</th>
                {(model.total ?? [
                  {key:"reusedItems",title:"Reutilizados"},
                  {key:"donatedItems",title:"Donaciones"},
                  {key:"soldItems",title:"Compraventas"},
                  {key:"circularValue",title:"Valor circular"},
                  {key:"estimatedAvoidedCo2",title:"CO₂ evitado"},
                  {key:"activeListings",title:"Anuncios activos"},
                  {key:"listingViews",title:"Visualizaciones"},
                ]).map(metric=>
                  <th scope="col" key={metric.key} className="px-3 py-3 text-right font-semibold">
                    {metric.title}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleSchools.map(school=>
                <tr key={school.id} className="border-b border-border/70 last:border-b-0">
                  <th scope="row" className="px-4 py-4 font-medium text-foreground">
                    {school.name}
                  </th>
                  {school.suppressed || !school.metrics ? (
                    <td colSpan={7} className="px-4 py-4 text-sm text-muted-foreground">
                      Indicadores protegidos por confidencialidad.
                    </td>
                  ) : school.metrics.map(metric=>
                    <td key={metric.key} className="px-3 py-4 text-right tabular-nums text-foreground">
                      {formatMetric(metric)}
                    </td>
                  )}
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Las cifras de impacto ambiental son estimaciones. Los datos ocultos no
          equivalen a cero y no se facilita información personal.
        </p>
      </section>
    </section>
  );
}
