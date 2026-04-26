import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalize(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "all") return null;
  return text;
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const query = normalize(body?.query);
  const category = normalize(body?.category);
  const gradeLevel = normalize(body?.gradeLevel);
  const condition = normalize(body?.condition);
  const listingType = normalize(body?.listingType);
  const isbn = normalize(body?.isbn);
  const minPrice = normalizeNumber(body?.minPrice);
  const maxPrice = normalizeNumber(body?.maxPrice);

  const name =
    normalize(body?.name) ||
    [
      query,
      isbn ? `ISBN ${isbn}` : null,
      category,
      gradeLevel,
      listingType,
    ]
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
