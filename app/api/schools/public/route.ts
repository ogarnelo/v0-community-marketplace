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

    const admin = createAdminClient();

    if (id) {
      const { data, error } = await admin
        .from("schools")
        .select("id, name, city")
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle<PublicSchool>();

      if (error) throw error;

      return NextResponse.json(
        { school: data || null },
        {
          headers: {
            "Cache-Control": "public, max-age=60, s-maxage=300",
          },
        }
      );
    }

    let builder = admin
      .from("schools")
      .select("id, name, city")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(100);

    if (query) {
      const escaped = query.replace(/[%_]/g, "");
      builder = builder.or(`name.ilike.%${escaped}%,city.ilike.%${escaped}%`);
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
  } catch (error) {
    console.error("Error cargando centros públicos:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los centros." },
      { status: 500 }
    );
  }
}
