export type PrivateMetric =
  | "uniqueUsers" | "students" | "activeListings" | "totalListings"
  | "openDemands" | "confirmedExchanges";
export const metricLabels: ReadonlyArray<{ key: PrivateMetric; label: string }> = [
  { key: "uniqueUsers", label: "Usuarios únicos" },
  { key: "students", label: "Alumnos vinculados" },
  { key: "activeListings", label: "Anuncios activos" },
  { key: "totalListings", label: "Anuncios totales" },
  { key: "openDemands", label: "Necesidades abiertas" },
  { key: "confirmedExchanges", label: "Intercambios confirmados" },
];
export type SchoolOption = { id: string; name: string };
export type SchoolReport = {
  schoolId: string;
  name: string;
  users: number | null;
  students: number | null;
  activeListings: number | null;
  totalListings: number | null;
  openDemands: number | null;
  confirmedExchanges: number | null;
};
export type Report = {
  totalSchools: number;
  uniqueUsers: number | null;
  students: number | null;
  activeListings: number | null;
  totalListings: number | null;
  openDemands: number | null;
  confirmedExchanges: number | null;
  schools: SchoolReport[];
};
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function metricText(value: unknown): string {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value.toLocaleString("es-ES") : "Oculto";
}
export function validSchoolOptions(value: unknown): value is SchoolOption[] {
  return Array.isArray(value) && value.length <= 100 &&
    value.every(row => row && typeof row === "object" &&
      typeof row.id === "string" && UUID.test(row.id) &&
      typeof row.name === "string" && row.name.length <= 240) &&
    new Set(value.map(row => row.id)).size === value.length;
}
export function validReport(value: unknown, allowedSchoolIds: readonly string[]): value is Report {
  if (!value || typeof value !== "object") return false;
  const report = value as Record<string, unknown>;
  if (!Array.isArray(report.schools) || report.schools.length === 0 ||
      report.schools.length > 100 || report.totalSchools !== report.schools.length) return false;
  const allowed = new Set(allowedSchoolIds);
  const seen = new Set<string>();
  return report.schools.every(item => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    if (typeof row.schoolId !== "string" || !allowed.has(row.schoolId) ||
        seen.has(row.schoolId) || typeof row.name !== "string" ||
        row.name.length > 240) return false;
    seen.add(row.schoolId);
    return ["users", "students", "activeListings", "totalListings",
      "openDemands", "confirmedExchanges"].every(key => {
        const n = row[key];
        return n === null || (typeof n === "number" &&
          Number.isSafeInteger(n) && n >= 0);
      });
  }) && metricLabels.every(({ key }) => {
    const n = report[key];
    return n === null || (typeof n === "number" &&
      Number.isSafeInteger(n) && n >= 0);
  });
}
