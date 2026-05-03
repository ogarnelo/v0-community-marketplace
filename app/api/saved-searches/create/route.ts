import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeApiError } from "@/lib/api/safe-error";

const MAX_SAVED_SEARCHES_PER_USER = 50;
const ALLOWED_LISTING_TYPES = new Set(["sale", "donation"]);

function normalize(value: unknown, maxLength = 120) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "all") return null;
  return text.slice(0, maxLength);
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { count } = await supabase
      .from("saved_searches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count || 0) >= MAX_SAVED_SEARCHES_PER_USER) {
      return NextResponse.json(
        { error: `Puedes guardar un máximo de ${MAX_SAVED_SEARCHES_PER_USER} búsquedas.` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);
    const query = normalize(body?.query, 120);
    const category = normalize(body?.category, 80);
    const gradeLevel = normalize(body?.gradeLevel, 80);
    const condition = normalize(body?.condition, 40);
    const rawListingType = normalize(body?.listingType, 40);
    const listingType = rawListingType && ALLOWED_LISTING_TYPES.has(rawListingType) ? rawListingType : null;
    const isbn = normalize(body?.isbn, 32);
    const minPrice = normalizeNumber(body?.minPrice);
    const maxPrice = normalizeNumber(body?.maxPrice);

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return NextResponse.json({ error: "El precio mínimo no puede ser mayor que el máximo." }, { status: 400 });
    }

    const name =
      normalize(body?.name, 120) ||
      [query, isbn ? `ISBN ${isbn}` : null, category, gradeLevel, listingType]
        .filter(Boolean)
        .join(" · ") ||
      "Búsqueda guardada";

    const { data, error } = await supabase
      .from("saved_searches")
      .insert({
        user_id: user.id,
        name,
        query,
        category,
        grade_level: gradeLevel,
        condition,
        listing_type: listingType,
        isbn,
        min_price: minPrice,
        max_price: maxPrice,
        email_enabled: Boolean(body?.emailEnabled ?? true),
        push_enabled: Boolean(body?.pushEnabled ?? true),
      })
      .select("id")
      .single();

    if (error) {
      return safeApiError(error, "No se pudo guardar la búsqueda.", 500);
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    return safeApiError(error, "No se pudo guardar la búsqueda.", 500);
  }
}
