"use client";

import { useEffect, useState } from "react";
import { DIRECTORY_COMMUNITIES } from "@/lib/schools/directory-search";

type Centre = {
  official_code: string;
  name: string;
  school_type: string;
  category: string;
  municipality: string;
  province: string;
  autonomous_community: string;
  postal_code: string;
  address: string | null;
};

const PAGE_SIZE = 24;

export default function CentresDirectoryPage() {
  const [search, setSearch] = useState("");
  const [community, setCommunity] = useState("");
  const [province, setProvince] = useState("");
  const [page, setPage] = useState(1);
  const [centres, setCentres] = useState<Centre[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ page: String(page) });
        if (search.trim()) params.set("q", search.trim());
        if (community) params.set("community", community);
        if (province) params.set("province", province);
        const response = await fetch(`/api/school-directory?${params}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Error de búsqueda");
        setCentres(payload.centres || []);
        setTotal(payload.total || 0);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : "No se pudo consultar el directorio.");
        setCentres([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, community, province, page]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">Directorio de centros educativos de España</h1>
        <p className="text-muted-foreground">
          Consulta centros educativos de toda España. Aparecer en este directorio no significa
          que el centro o su AMPA esté adherido a Wetudy.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 space-y-2">
          <span className="text-sm font-medium">Nombre, municipio o código oficial</span>
          <input
            type="search" value={search} maxLength={80}
            onChange={(event) => { setPage(1); setSearch(event.target.value); }}
            placeholder="Nombre, municipio, CP o código oficial"
            className="w-full rounded-lg border bg-background px-3 py-2"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Comunidad autónoma</span>
          <select value={community}
            onChange={(event) => { setPage(1); setCommunity(event.target.value); setProvince(""); }}
            className="w-full rounded-lg border bg-background px-3 py-2 sm:w-52"
          >
            <option value="">Toda España</option>
            {DIRECTORY_COMMUNITIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium">Provincia</span>
          <input type="text" value={province} maxLength={60}
            onChange={(event) => { setPage(1); setProvince(event.target.value); }}
            placeholder="Ej. Pontevedra"
            className="w-full rounded-lg border bg-background px-3 py-2 sm:w-40"
          />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div aria-live="polite" className="text-sm text-muted-foreground">
        {loading ? "Buscando centros…" : `${total} centros encontrados`}
      </div>
      {!loading && centres.length === 0 && !error ? (
        <p className="rounded-lg border p-5 text-muted-foreground">
          No hay centros disponibles con esos filtros. El directorio se publicará
          progresivamente, previa revisión de los registros.
        </p>
      ) : null}
      <ul className="space-y-3">
        {centres.map((centre) => (
          <li key={centre.official_code} className="space-y-2 rounded-lg border p-5">
            <h2 className="font-semibold">{centre.name}</h2>
            <p className="text-sm text-muted-foreground">
              {centre.municipality} · {centre.province} ({centre.autonomous_community}) · CP {centre.postal_code}
            </p>
            <p className="text-sm">
              {centre.category} · Código oficial: {centre.official_code}
            </p>
            <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs">
              Centro en directorio · adhesión a Wetudy no confirmada
            </span>
          </li>
        ))}
      </ul>
      {total > PAGE_SIZE && !error ? (
        <nav aria-label="Páginas del directorio" className="flex items-center justify-center gap-4">
          <button type="button" onClick={() => setPage((value) => Math.max(1,value-1))}
            disabled={loading || page === 1}
            className="rounded-lg border px-4 py-2 disabled:opacity-40">Anterior</button>
          <span className="text-sm">Página {page} de {Math.ceil(total / PAGE_SIZE)}</span>
          <button type="button" onClick={() => setPage((value) => value + 1)}
            disabled={loading || page * PAGE_SIZE >= total}
            className="rounded-lg border px-4 py-2 disabled:opacity-40">Siguiente</button>
        </nav>
      ) : null}
    </main>
  );
}
