import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PublicSchool = {
  id: string;
  name: string;
  city: string | null;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    const query = url.searchParams.get("q")?.trim();
    // Build the PostgREST OR expression only from a constrained search term.
    // Commas, parentheses, wildcard signs, and quotes are filter operators.
    if (query && (query.length > 80 || !/^[\p{L}\p{N} .-]+$/u.test(query))) {
      return NextResponse.json({ error: "Búsqueda incorrecta." }, {
        status: 400, headers: { "Cache-Control": "private, no-store" },
      });
    }

    const admin = createAdminClient();

    if (id) {
      const { data, error } = await admin
        .from("schools")
        .select("id, name, city")
        .eq("id", id)
        .eq("is_active", true)
        .eq("is_test", false)
        .maybeSingle<PublicSchool>();

      if (error) throw error;

      return NextResponse.json(
        { school: data || null },
        {
          headers: {
            // A QR link is checked immediately before saving a school profile.
          // Do not serve a stale active school after deactivation.
          "Cache-Control": "private, no-store, max-age=0",
          },
        }
      );
    }

    let builder = admin
      .from("schools")
      .select("id, name, city")
      .eq("is_active", true)
      .eq("is_test", false)
      .order("name", { ascending: true })
      .limit(100);

    if (query) {
      builder = builder.or(`name.ilike.%${query}%,city.ilike.%${query}%`);
    }

    const { data, error } = await builder.returns<PublicSchool[]>();

    if (error) throw error;

    return NextResponse.json(
      { schools: data || [] },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=300",
        },
      }
    );
  } catch {
    console.error("public_schools_lookup_failed");
    return NextResponse.json(
      { error: "No se pudieron cargar los centros." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }
}
