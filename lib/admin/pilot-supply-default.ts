// Server-only configuration. An empty or malformed allowlist disables defaults.
import "server-only";
export function pilotSupplySchoolIds(flag: string | undefined, ids: string | undefined): string[] {
  if (flag !== "true" || !ids) return [];
  const values = [...new Set(ids.split(",").map(x=>x.trim().toLowerCase()))];
  return values.length <= 20 && values.every(x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)) ? values : [];
}
