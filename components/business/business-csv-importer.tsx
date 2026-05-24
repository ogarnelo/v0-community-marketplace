"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";

type ParsedListing = {
  title: string;
  description: string;
  price: number;
  photo_url: string;
  category?: string;
  condition?: string;
  grade_level?: string;
  isbn?: string;
  listing_type?: string;
};

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
  const rows: ParsedListing[] = [];

  for (const line of lines.slice(1)) {
    const values = line.split(",").map((value) => value.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    if (!row.title && !row.titulo) continue;

    rows.push({
      title: row.title || row.titulo,
      description: row.description || row.descripcion || row.title || row.titulo,
      price: Number(row.price || row.precio || 0),
      photo_url: row.photo_url || row.foto || row.image_url || row.imagen || "",
      category: row.category || row.categoria || undefined,
      condition: row.condition || row.estado || undefined,
      grade_level: row.grade_level || row.curso || undefined,
      isbn: row.isbn || undefined,
      listing_type: row.listing_type || row.tipo || "sale",
    });
  }

  return rows;
}

function isValidPhotoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function BusinessCsvImporter() {
  const [csv, setCsv] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => parseCsv(csv), [csv]);
  const validRows = rows.filter(
    (row) => row.title && Number.isFinite(row.price) && row.price >= 0 && isValidPhotoUrl(row.photo_url)
  );
  const rowsWithoutPhoto = rows.filter((row) => row.title && !isValidPhotoUrl(row.photo_url)).length;

  async function submit() {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/listings/bulk-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listings: validRows }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "No se pudo importar.");

      setStatus("done");
      setMessage(`${validRows.length} productos creados con foto obligatoria.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo importar.");
    }
  }

  return (
    <div className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
          <UploadCloud className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Importar CSV rápido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La foto es obligatoria. Añade una columna <strong>photo_url</strong> con una URL pública por producto.
          </p>
        </div>
      </div>

      <textarea
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        className="mt-4 min-h-56 w-full rounded-2xl border bg-background p-3 text-sm"
        placeholder={`title,description,price,photo_url,category,condition,grade_level,isbn
Libro Matemáticas,Libro en buen estado,12,https://ejemplo.com/foto-libro.jpg,Libros de texto,good,3 ESO,9780000000000
Calculadora científica,Casio usada,18,https://ejemplo.com/calculadora.jpg,Calculadoras,good,4 ESO,`}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={status === "loading" || validRows.length === 0}>
          {status === "loading" ? "Importando..." : `Crear ${validRows.length} anuncios`}
        </Button>
        <p className="text-sm text-muted-foreground">
          Filas detectadas: {rows.length}. Válidas: {validRows.length}. Sin foto válida: {rowsWithoutPhoto}.
        </p>
      </div>

      {message ? (
        <p className={`mt-3 text-sm ${status === "error" ? "text-rose-600" : "text-emerald-700"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
