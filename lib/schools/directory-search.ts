export const SCHOOL_DIRECTORY_PAGE_SIZE = 24;
export const DIRECTORY_COMMUNITIES = [
  "Andalucía", "Aragón", "Principado de Asturias", "Illes Balears",
  "Canarias", "Cantabria", "Castilla y León", "Castilla-La Mancha",
  "Cataluña", "Comunitat Valenciana", "Extremadura", "Galicia",
  "Comunidad de Madrid", "Región de Murcia", "Comunidad Foral de Navarra",
  "País Vasco", "La Rioja", "Ceuta", "Melilla",
] as const;
export type DirectoryCommunity = typeof DIRECTORY_COMMUNITIES[number];

export function getDirectorySearch(params: URLSearchParams):
  | {
      ok: true;
      query: string;
      community: DirectoryCommunity | null;
      province: string | null;
      page: number;
      pattern: string | null;
    }
  | { ok: false; error: string } {
  const query = (params.get("q") || "").trim();
  const communityRaw = (params.get("community") || "").trim();
  const provinceRaw = (params.get("province") || "").trim();
  const pageValue = (params.get("page") || "1").trim();

  if (query.length > 80 || /[\x00-\x1F]/.test(query)) {
    return { ok: false, error: "La búsqueda no puede superar 80 caracteres ni contener caracteres de control." };
  }
  if (communityRaw && !DIRECTORY_COMMUNITIES.includes(communityRaw as DirectoryCommunity)) {
    return { ok: false, error: "Comunidad autónoma no válida." };
  }
  if (provinceRaw && (provinceRaw.length > 60 || !/^[\p{L} .()/\-]{2,60}$/u.test(provinceRaw))) {
    return { ok: false, error: "Provincia no válida." };
  }
  // 34,845 entries require more than the 100-page cap used for Galicia.
  if (!/^[1-9][0-9]{0,3}$/.test(pageValue) || Number(pageValue) > 2000) {
    return { ok: false, error: "Página no válida." };
  }
  const escaped = query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return {
    ok: true,
    query,
    community: communityRaw ? communityRaw as DirectoryCommunity : null,
    province: provinceRaw || null,
    page: Number(pageValue),
    pattern: query ? `%${escaped.toLowerCase()}%` : null,
  };
}
