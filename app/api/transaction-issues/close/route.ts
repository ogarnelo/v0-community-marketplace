import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const issueId = typeof body?.issueId === "string" ? body.issueId : "";

  if (!issueId) {
    return NextResponse.json({ error: "Missing issue id" }, { status: 400 });
  }

  const { data: issue } = await supabase
    .from("transaction_issues")
    .select("id, opened_by, buyer_id, seller_id, status")
    .eq("id", issueId)
    .maybeSingle();

  if (!issue) {
    return NextResponse.json({ error: "Incidencia no encontrada" }, { status: 404 });
  }

  if (issue.opened_by !== user.id) {
    return NextResponse.json({ error: "Solo quien abrió la incidencia puede cerrarla." }, { status: 403 });
  }

  if (!["open", "reviewing"].includes(issue.status)) {
    return NextResponse.json({ error: "Esta incidencia ya no se puede cerrar." }, { status: 400 });
  }

  const { error } = await supabase
    .from("transaction_issues")
    .update({
      status: "closed",
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolution_note: "Cerrada por el usuario.",
    })
    .eq("id", issue.id)
    .eq("opened_by", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counterpartId = user.id === issue.buyer_id ? issue.seller_id : issue.buyer_id;

  if (counterpartId) {
    await createNotification(supabase, {
      user_id: counterpartId,
      kind: "transaction_issue_closed",
      title: "Incidencia cerrada",
      body: "La otra parte ha cerrado la incidencia de la operación.",
      href: `/account/issues/${issue.id}`,
      metadata: { issue_id: issue.id },
    });
  }

  return NextResponse.json({ ok: true });
}
