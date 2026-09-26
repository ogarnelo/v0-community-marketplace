"use client";

import { useState } from "react";
import { BookSearch, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeIsbn } from "@/lib/books/isbn";

export type BookLookupBook = {
  id: string;
  canonicalIsbn: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publicationDate: string | null;
  language: string | null;
  coverUrl: string | null;
};

type Props = {
  isbn: string;
  disabled?: boolean;
  onApply: (book: BookLookupBook) => void;
};

export function BookIsbnLookup({ isbn, disabled = false, onApply }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "not_found" | "error">("idle");
  const [book, setBook] = useState<BookLookupBook | null>(null);

  const lookup = async () => {
    const normalized = normalizeIsbn(isbn);
    if (!normalized) {
      setBook(null);
      setStatus("error");
      return;
    }

    setStatus("loading");
    setBook(null);

    try {
      const response = await fetch(`/api/books/isbn/${encodeURIComponent(normalized.canonicalIsbn)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 404) {
        setStatus("not_found");
        return;
      }
      if (!response.ok || payload?.status !== "found" || !payload?.book) {
        setStatus("error");
        return;
      }

      setBook(payload.book);
      setStatus("found");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
        Si tienes el ISBN, introdúcelo primero. Wetudy buscará los datos bibliográficos disponibles para que puedas revisarlos antes de completar el anuncio.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || status === "loading" || !isbn.trim()}
          onClick={() => void lookup()}
          className="gap-2"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookSearch className="h-4 w-4" />}
          {status === "loading" ? "Buscando..." : "Buscar datos del libro"}
        </Button>
        {status === "found" ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> ISBN reconocido
          </span>
        ) : null}
      </div>

      {status === "not_found" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No hemos encontrado este ISBN. Puedes completar los datos manualmente.
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No hemos podido consultar el catálogo ahora. Puedes seguir completando y publicando manualmente.
        </p>
      ) : null}

      {status === "found" && book ? (
        <div className="mt-3 rounded-xl border bg-background p-3">
          <p className="text-sm font-semibold">{book.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[book.authors.join(", "), book.publisher, book.language].filter(Boolean).join(" · ") || "Datos bibliográficos disponibles"}
          </p>
          <Button type="button" size="sm" className="mt-3" onClick={() => onApply(book)}>
            Usar datos encontrados
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Revisa los datos antes de aplicarlos. Si ya hay datos bibliográficos distintos, Wetudy te pedirá confirmación antes de sustituirlos.
          </p>
        </div>
      ) : null}
    </div>
  );
}
