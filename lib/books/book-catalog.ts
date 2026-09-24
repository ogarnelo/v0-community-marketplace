import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeIsbn } from "@/lib/books/isbn";

export type BookEdition = {
  id: string;
  canonicalIsbn: string;
  isbn10: string | null;
  isbn13: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publicationDate: string | null;
  language: string | null;
  coverUrl: string | null;
  provider: string;
  providerId: string | null;
};

export type BookLookupResult =
  | { status: "found"; source: "cache" | "provider"; book: BookEdition }
  | { status: "invalid" }
  | { status: "not_found" }
  | { status: "provider_error" };

type ProviderBook = Omit<BookEdition, "id">;

export interface BookProviderAdapter {
  id: string;
  lookup(canonicalIsbn: string, signal: AbortSignal): Promise<ProviderBook | null>;
}

type OpenLibraryEdition = {
  key?: string;
  title?: string;
  subtitle?: string;
  publishers?: string[];
  publish_date?: string;
  languages?: Array<{ key?: string }>;
  covers?: number[];
  authors?: Array<{ key?: string }>;
  isbn_10?: string[];
  isbn_13?: string[];
  last_modified?: { value?: string };
};

const LANGUAGE_NAMES: Record<string, string> = {
  spa: "Español",
  eng: "Inglés",
  cat: "Catalán",
  glg: "Gallego",
  eus: "Euskera",
  fre: "Francés",
  fra: "Francés",
  ger: "Alemán",
  deu: "Alemán",
  por: "Portugués",
};

function fromDb(row: any): BookEdition {
  return {
    id: row.id,
    canonicalIsbn: row.canonical_isbn,
    isbn10: row.isbn_10,
    isbn13: row.isbn_13,
    title: row.title,
    subtitle: row.subtitle,
    authors: Array.isArray(row.authors) ? row.authors.filter(Boolean) : [],
    publisher: row.publisher,
    publicationDate: row.publication_date,
    language: row.language,
    coverUrl: row.cover_url,
    provider: row.provider,
    providerId: row.provider_id,
  };
}

async function resolveAuthorNames(authors: OpenLibraryEdition["authors"], signal: AbortSignal) {
  const keys = (authors || [])
    .map((author) => author?.key)
    .filter((key): key is string => Boolean(key))
    .slice(0, 5);

  const names = await Promise.all(
    keys.map(async (key) => {
      try {
        const response = await fetch(`https://openlibrary.org${key}.json`, {
          signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) return null;
        const payload = await response.json();
        return typeof payload?.name === "string" ? payload.name.trim() : null;
      } catch {
        return null;
      }
    })
  );

  return names.filter((name): name is string => Boolean(name));
}

export const openLibraryAdapter: BookProviderAdapter = {
  id: "openlibrary",
  async lookup(canonicalIsbn, signal) {
    const response = await fetch(
      `https://openlibrary.org/isbn/${encodeURIComponent(canonicalIsbn)}.json`,
      {
        signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Wetudy/1.0 (book-catalog lookup)",
        },
        cache: "no-store",
      }
    );

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`openlibrary_http_${response.status}`);

    const edition = (await response.json()) as OpenLibraryEdition;
    const title = typeof edition.title === "string" ? edition.title.trim() : "";
    if (!title) throw new Error("openlibrary_missing_title");

    const authors = await resolveAuthorNames(edition.authors, signal);
    const languageKey = edition.languages?.[0]?.key?.split("/").pop() || null;
    const coverId = edition.covers?.[0];

    return {
      canonicalIsbn,
      isbn10: edition.isbn_10?.[0] || null,
      isbn13: edition.isbn_13?.[0] || canonicalIsbn,
      title,
      subtitle: typeof edition.subtitle === "string" ? edition.subtitle.trim() || null : null,
      authors,
      publisher: edition.publishers?.[0]?.trim() || null,
      publicationDate: edition.publish_date?.trim() || null,
      language: languageKey ? LANGUAGE_NAMES[languageKey] || languageKey : null,
      coverUrl: typeof coverId === "number"
        ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
        : null,
      provider: "openlibrary",
      providerId: edition.key || null,
    };
  },
};

export async function lookupBookByIsbn(
  rawIsbn: string,
  options: { provider?: BookProviderAdapter; timeoutMs?: number } = {}
): Promise<BookLookupResult> {
  const normalized = normalizeIsbn(rawIsbn);
  if (!normalized) return { status: "invalid" };

  const admin = createAdminClient();
  const { data: cached, error: cacheError } = await admin
    .from("book_editions")
    .select("id, canonical_isbn, isbn_10, isbn_13, title, subtitle, authors, publisher, publication_date, language, cover_url, provider, provider_id")
    .eq("canonical_isbn", normalized.canonicalIsbn)
    .maybeSingle();

  if (cacheError) throw cacheError;
  if (cached) return { status: "found", source: "cache", book: fromDb(cached) };

  const provider = options.provider || openLibraryAdapter;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 4500);

  try {
    const providerBook = await provider.lookup(normalized.canonicalIsbn, controller.signal);
    if (!providerBook) return { status: "not_found" };

    const { data: stored, error: storeError } = await admin
      .from("book_editions")
      .upsert(
        {
          canonical_isbn: normalized.canonicalIsbn,
          isbn_10: providerBook.isbn10 || normalized.isbn10,
          isbn_13: providerBook.isbn13 || normalized.isbn13,
          title: providerBook.title,
          subtitle: providerBook.subtitle,
          authors: providerBook.authors,
          publisher: providerBook.publisher,
          publication_date: providerBook.publicationDate,
          language: providerBook.language,
          cover_url: providerBook.coverUrl,
          provider: provider.id,
          provider_id: providerBook.providerId,
          source_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "canonical_isbn" }
      )
      .select("id, canonical_isbn, isbn_10, isbn_13, title, subtitle, authors, publisher, publication_date, language, cover_url, provider, provider_id")
      .single();

    if (storeError) throw storeError;
    return { status: "found", source: "provider", book: fromDb(stored) };
  } catch (error: any) {
    if (error?.name === "AbortError") return { status: "provider_error" };
    console.error("Error consultando el catálogo bibliográfico", error);
    return { status: "provider_error" };
  } finally {
    clearTimeout(timeout);
  }
}
