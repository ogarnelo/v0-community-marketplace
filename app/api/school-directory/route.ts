import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDirectorySearch, SCHOOL_DIRECTORY_PAGE_SIZE } from "@/lib/schools/directory-search";

export const runtime = "nodejs";

type DirectoryRow = {
  official_code: string;
  name: string;
  school_type: string;
  category: string;
  municipality: string;
  province: string;
  postal_code: string;
  address: string | null;
};

export async function GET(request: Request) {
  const parsed = getDirectorySearch(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const first = (parsed.page - 1) * SCHOOL_DIRECTORY_PAGE_SIZE;
    let query = admin
      .from("school_directory")
      .select(
        "official_code,name,school_type,category,municipality,province,postal_code,address",
        { count: "exact" },
      )
      // Only records separately approved for publication are discoverable.
      // Importing an institution NEVER creates an operational school or AMPA.
      .eq("is_listed", true);

    if (parsed.province) query = query.eq("province", parsed.province);
    if (parsed.pattern) query = query.ilike("search_text", parsed.pattern);

    const { data, count, error } = await query
      .order("name", { ascending: true })
      .order("official_code", { ascending: true })
      .range(first, first + SCHOOL_DIRECTORY_PAGE_SIZE - 1)
      .returns<DirectoryRow[]>();

    if (error) throw error;
    return NextResponse.json(
      { centres: data || [], total: count || 0, page: parsed.page, pageSize: SCHOOL_DIRECTORY_PAGE_SIZE },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("Error consultando el directorio público de centros", error);
    return NextResponse.json({ error: "No se pudo consultar el directorio." }, { status: 503 });
  }
}
