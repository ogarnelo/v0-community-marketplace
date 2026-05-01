import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MarketplaceEvents } from "@/lib/analytics/events";

function clean(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
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

  const title = clean(body?.title);
  const gradeLevel = clean(body?.gradeLevel);
  const subject = clean(body?.subject);
  const isbn = clean(body?.isbn);
  const category = clean(body?.category);

  if (!title || !gradeLevel) {
    return NextResponse.json(
      { error: "Título y curso son obligatorios." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("course_materials")
    .insert({
      created_by: user.id,
      title,
      grade_level: gradeLevel,
      subject,
      isbn,
      category,
      source: "crowdsourced",
      confidence_score: 1,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("marketplace_events").insert({
    user_id: user.id,
    event_name: MarketplaceEvents.CourseMaterialCreated,
    entity_type: "course_material",
    entity_id: data.id,
    properties: {
      title,
      grade_level: gradeLevel,
      subject,
      isbn,
      category,
    },
  });

  return NextResponse.json({ ok: true, id: data.id });
}
