"use client";

import { useEffect, useState } from "react";
import {
  metricLabels, schoolMetricLabels, metricText, validReport, validSchoolOptions,
  type Report, type SchoolOption,
} from "@/lib/fanpa/federation-dashboard-contract";

type ScopeState = "loading" | "ready" | "unavailable";
type ReportState = "loading" | "ready" | "unavailable";
const REQUEST = { cache: "no-store" as const, credentials: "same-origin" as const };

export function FederationReportingDashboard({ federationId }: { federationId: string }) {
  const [scopeStatus, setScopeStatus] = useState<ScopeState>("loading");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [reportStatus, setReportStatus] = useState<ReportState>("loading");
  const [report, setReport] = useState<Report | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Never reuse previously authorized school names between federation changes.
  useEffect(() => {
    const controller = new AbortController();
    setScopeStatus("loading");
    setSchools([]);
    setSelectedSchoolId("");
    setReport(null);
    setReportStatus("loading");
    void (async () => {
      try {
        const query = new URLSearchParams({ federationId });
        const response = await fetch("/api/fanpa/scope?" + query.toString(), {
          ...REQUEST, signal: controller.signal,
        });
        if (!response.ok) throw new Error("scope_unavailable");
        const body: unknown = await response.json();
        if (!body || typeof body !== "object" ||
            !("federationId" in body) || body.federationId !== federationId ||
            !("schools" in body) || !validSchoolOptions(body.schools) ||
            body.schools.length === 0) {
          throw new Error("scope_invalid");
        }
        if (!controller.signal.aborted) {
          setSchools(body.schools);
          setScopeStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          setScopeStatus("unavailable");
          setSchools([]);
          setReport(null);
        }
      }
    })();
    return () => controller.abort();
  }, [federationId, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setReport(null);
    setReportStatus("loading");
    if (scopeStatus !== "ready") {
      return () => controller.abort();
    }
    const allowed = new Set(schools.map(s => s.id));
    if (selectedSchoolId && !allowed.has(selectedSchoolId)) {
      setReportStatus("unavailable");
      return () => controller.abort();
    }
    void (async () => {
      try {
        const query = new URLSearchParams({ federationId });
        if (selectedSchoolId) query.set("schoolId", selectedSchoolId);
        const response = await fetch("/api/fanpa/kpis?" + query.toString(), {
          ...REQUEST, signal: controller.signal,
        });
        if (!response.ok) throw new Error("report_unavailable");
        const body: unknown = await response.json();
        const expected = selectedSchoolId ? [selectedSchoolId] : schools.map(s => s.id);
        if (!body || typeof body !== "object" ||
            !("federationId" in body) || body.federationId !== federationId ||
            !("selectedSchoolId" in body) ||
            body.selectedSchoolId !== (selectedSchoolId || null) ||
            !validReport(body, expected) ||
            body.schools.length !== expected.length) {
          throw new Error("report_invalid");
        }
        if (!controller.signal.aborted) {
          setReport(body);
          setReportStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          setReport(null);
          setReportStatus("unavailable");
        }
      }
    })();
    return () => controller.abort();
  }, [federationId, schools, scopeStatus, selectedSchoolId]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-7 px-4 py-10 sm:px-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          WETUDY · Asociaciones y federaciones
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Informes de colegios representados</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Indicadores agregados de los colegios autorizados. Los valores protegidos
          aparecen como «Oculto» para preservar la privacidad de comunidades pequeñas.
          No se muestran datos de familias ni de alumnos individuales.
        </p>
      </header>

      {scopeStatus === "loading" && (
        <p role="status" className="rounded-lg border p-5">Verificando representación…</p>
      )}
      {scopeStatus === "unavailable" && (
        <section role="alert" className="space-y-3 rounded-lg border p-5">
          <p>No se puede acceder a los informes con esta sesión o representación.</p>
          <button type="button" onClick={() => setReloadKey(key => key + 1)}
            className="rounded-md border px-4 py-2 text-sm font-medium">Volver a comprobar</button>
        </section>
      )}

      {scopeStatus === "ready" && (
        <>
          <section className="flex flex-col gap-3 rounded-xl border p-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <label htmlFor="fanpa-school-filter" className="block text-sm font-semibold">
                Colegio
              </label>
              <select id="fanpa-school-filter" value={selectedSchoolId}
                onChange={event => setSelectedSchoolId(event.target.value)}
                className="w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm sm:min-w-72">
                <option value="">Todos los colegios representados</option>
                {schools.map(school => (
                  <option key={school.id} value={school.id}>{school.name}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => setReloadKey(key => key + 1)}
              className="rounded-md border px-4 py-2 text-sm font-medium">
              Actualizar y verificar permisos
            </button>
          </section>
          {reportStatus === "loading" && <p role="status">Calculando indicadores autorizados…</p>}
          {reportStatus === "unavailable" && (
            <p role="alert" className="rounded-lg border p-5">
              El informe no está disponible. Es posible que los permisos hayan cambiado.
              Actualiza para volver a verificar tu representación.
            </p>
          )}
          {reportStatus === "ready" && report && (
            <>
              <section aria-label="Indicadores agregados" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <article className="rounded-xl border p-5">
                  <p className="text-sm text-muted-foreground">Colegios representados en el filtro</p>
                  <p className="mt-2 text-3xl font-semibold">{metricText(report.totalSchools)}</p>
                </article>
                {metricLabels.map(metric => (
                  <article key={metric.key} className="rounded-xl border p-5">
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {metricText(report[metric.key])}
                    </p>
                  </article>
                ))}
              </section>
              <section className="space-y-3" aria-labelledby="fanpa-school-results">
                <h2 id="fanpa-school-results" className="text-xl font-semibold">
                  Resultados por colegio
                </h2>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-muted/60">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">Colegio</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Usuarios</th>
                        {schoolMetricLabels.map(metric => (
                          <th key={metric.key} scope="col" className="px-4 py-3 font-semibold">
                            {metric.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.schools.map(school => (
                        <tr key={school.schoolId} className="border-t">
                          <th scope="row" className="px-4 py-3 font-medium">{school.name}</th>
                          <td className="px-4 py-3">{metricText(school.users)}</td>
                          {schoolMetricLabels.map(metric => (
                            <td key={metric.key} className="px-4 py-3">
                              {metricText(school[metric.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
