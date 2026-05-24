import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cleanDemandMetadata,
  normalizeDemandOptional,
  normalizeDemandText,
  normalizeIsbn,
  postalPrefix,
} from "@/lib/demand/normalize";
import { getUserDemandContext, recordDemandEvent } from "@/lib/demand/events";

export const dynamic = "force-dynamic";

function cleanTitle(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Inicia sesión para guardar esta demanda." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const title = cleanTitle(body?.title || body?.query || body?.category);

  if (title.length < 2) {
    return NextResponse.json(
      { error: "Indica qué material estás buscando." },
      { status: 400 }
    );
  }

  const context = await getUserDemandContext(user.id);
  const admin = createAdminClient();

  const normalizedQuery = normalizeDemandText(body?.query || title, 120);
  const category = normalizeDemandOptional(body?.category, 80);
  const gradeLevel = normalizeDemandOptional(body?.gradeLevel, 80);
  const isbn = normalizeIsbn(body?.isbn);
  const region = normalizeDemandOptional(body?.region || context.region, 80);
  const prefix = postalPrefix(body?.postalCode || context.postalCode);

  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data: recentDuplicate } = await admin
    .from("demand_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("title", title)
    .gte("created_at", since)
    .maybeSingle();

  if (recentDuplicate) {
    return NextResponse.json({
      ok: true,
      id: recentDuplicate.id,
      duplicate: true,
      message: "Ya habíamos registrado esta demanda recientemente.",
    });
  }

  const { data, error } = await admin
    .from("demand_requests")
    .insert({
      user_id: user.id,
      title,
      normalized_query: normalizedQuery,
      category,
      grade_level: gradeLevel,
      isbn,
      postal_prefix: prefix,
      region,
      school_id: context.schoolId,
      source: normalizeDemandOptional(body?.source, 40) || "zero_result_search",
      metadata: cleanDemandMetadata({
        route: body?.route,
        result_count: body?.resultCount,
      }),
    })
    .select("id")
    .single();

  if (error) {
    console.error("demand_request_create_error", error);
    return NextResponse.json(
      { error: "No se pudo registrar la demanda." },
      { status: 500 }
    );
  }

  await recordDemandEvent({
    eventType: "zero_result_search",
    userId: user.id,
    query: normalizedQuery || title,
    category,
    gradeLevel,
    isbn,
    resultCount: Number(body?.resultCount || 0),
    postalCode: context.postalCode,
    region: context.region,
    schoolId: context.schoolId,
    source: "explicit_demand_request",
    metadata: {
      demand_request_id: data.id,
      title,
    },
  });

  return NextResponse.json({
    ok: true,
    id: data.id,
    message: "Demanda registrada. La usaremos para detectar qué productos faltan.",
  });
}
