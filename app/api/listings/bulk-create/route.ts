import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeApiError } from "@/lib/api/safe-error";

const MAX_BUSINESS_BULK_LISTINGS = 50;
const ALLOWED_CATEGORIES = new Set([
  "Libros",
  "Uniformes",
  "Material escolar",
  "Calculadoras",
  "Tecnología",
  "Apuntes",
  "Otros",
]);
const ALLOWED_CONDITIONS = new Set(["new", "like_new", "good", "fair", "poor"]);
const ALLOWED_LISTING_TYPES = new Set(["sale", "donation"]);

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanOptionalString(value: unknown, maxLength: number) {
  const cleaned = cleanString(value, maxLength);
  return cleaned || null;
}

function cleanMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100) / 100;
}

async function canUseBulkUpload(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .maybeSingle();

  let role: { role: string } | null = null;

  try {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["super_admin", "school_admin"])
      .limit(1)
      .maybeSingle();
    role = data;
  } catch {
    role = null;
  }

  return profile?.user_type === "business" || Boolean(role);
}

function normalizeListing(raw: any, sellerId: string, index: number) {
  const title = cleanString(raw?.title, 120);
  if (!title) throw new Error(`El producto ${index + 1} no tiene título válido.`);

  const listingType = ALLOWED_LISTING_TYPES.has(String(raw?.listing_type || raw?.type))
    ? String(raw?.listing_type || raw?.type)
    : "sale";

  const category = cleanOptionalString(raw?.category, 80) || "Otros";
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error(`La categoría del producto ${index + 1} no es válida.`);
  }

  const condition = cleanOptionalString(raw?.condition, 40) || "good";
  if (!ALLOWED_CONDITIONS.has(condition)) {
    throw new Error(`El estado del producto ${index + 1} no es válido.`);
  }

  const price = cleanMoney(raw?.price);
  const originalPrice = cleanMoney(raw?.original_price ?? raw?.originalPrice);

  if (listingType === "sale" && (!price || price <= 0)) {
    throw new Error(`El producto ${index + 1} necesita un precio mayor que 0.`);
  }

  if (price !== null && price < 0) {
    throw new Error(`El precio del producto ${index + 1} no puede ser negativo.`);
  }

  return {
    title,
    description: cleanOptionalString(raw?.description, 2000),
    category,
    grade_level: cleanOptionalString(raw?.grade_level ?? raw?.gradeLevel, 80),
    condition,
    type: listingType,
    listing_type: listingType,
    price: listingType === "donation" ? 0 : price,
    original_price: originalPrice && originalPrice > 0 ? originalPrice : null,
    isbn: cleanOptionalString(raw?.isbn, 32),
    seller_id: sellerId,
    status: "available",
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canUseBulkUpload(supabase, user.id))) {
      return NextResponse.json(
        { error: "La subida masiva está disponible para perfiles profesionales verificados o administradores." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const listings = Array.isArray(body?.listings) ? body.listings : [];

    if (!listings.length) {
      return NextResponse.json({ error: "No listings provided" }, { status: 400 });
    }

    if (listings.length > MAX_BUSINESS_BULK_LISTINGS) {
      return NextResponse.json(
        { error: `Puedes subir un máximo de ${MAX_BUSINESS_BULK_LISTINGS} productos por lote.` },
        { status: 400 }
      );
    }

    const payload = listings.map((listing: any, index: number) => normalizeListing(listing, user.id, index));
    const { error } = await supabase.from("listings").insert(payload);

    if (error) {
      return safeApiError(error, "No se pudo subir el lote de productos.", 500);
    }

    return NextResponse.json({ ok: true, inserted: payload.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo subir el lote de productos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
