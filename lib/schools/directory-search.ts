const PROVINCES = ["A Coruña", "Lugo", "Ourense", "Pontevedra"] as const;
export const SCHOOL_DIRECTORY_PAGE_SIZE = 24;
export type DirectoryProvince = typeof PROVINCES[number];

export function getDirectorySearch(params: URLSearchParams):
  | { ok: true; query: string; province: DirectoryProvince | null; page: number; pattern: string | null }
  | { ok: false; error: string } {
  const query = (params.get("q") || "").trim();
  const provinceText = (params.get("province") || "").trim();
  const pageValue = (params.get("page") || "1").trim();

  if (query.length > 80 || /[\x00-\x1F]/.test(query)) {
    return { ok: false, error: "La búsqueda no puede superar 80 caracteres ni contener caracteres de control." };
  }
  if (provinceText && !PROVINCES.includes(provinceText as DirectoryProvince)) {
    return { ok: false, error: "Provincia no válida." };
  }
  if (!/^[1-9][0-9]{0,2}$/.test(pageValue) || Number(pageValue) > 100) {
    return { ok: false, error: "Página no válida." };
  }
  // Escape SQL LIKE wildcards even though PostgREST parameterizes the filter:
  // searches should match literal user text, not wildcard patterns.
  const escaped = query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return {
    ok: true,
    query,
    province: provinceText ? provinceText as DirectoryProvince : null,
    page: Number(pageValue),
    pattern: query ? `%${escaped.toLowerCase()}%` : null,
  };
}
