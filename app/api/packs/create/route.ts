import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeApiError } from "@/lib/api/safe-error";

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function cleanMoney(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 100) / 100;
}

function cleanInteger(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return null;
  return Math.min(number, 500);
}

async function canCreatePack(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
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

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canCreatePack(supabase, user.id))) {
      return NextResponse.json(
        { error: "Los packs están disponibles para perfiles profesionales o administradores." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const title = cleanString(body?.title, 120);
    const description = cleanString(body?.description, 1000);
    const price = cleanMoney(body?.price);
    const totalItems = cleanInteger(body?.totalItems ?? body?.total_items);

    if (!title) {
      return NextResponse.json({ error: "El pack necesita un título." }, { status: 400 });
    }

    if (price === null || price <= 0) {
      return NextResponse.json({ error: "El pack necesita un precio mayor que 0." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("listing_packs")
      .insert({
        seller_id: user.id,
        title,
        description,
        price,
        total_items: totalItems,
      })
      .select("id")
      .single();

    if (error) {
      return safeApiError(error, "No se pudo crear el pack.", 500);
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    return safeApiError(error, "No se pudo crear el pack.", 500);
  }
}
