import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/notifications";

const VALID_TYPES = new Set([
  "item_not_received",
  "item_not_as_described",
  "payment_problem",
  "shipping_problem",
  "seller_unresponsive",
  "buyer_unresponsive",
  "other",
]);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getIssueTypeLabel(type: string) {
  switch (type) {
    case "item_not_received":
      return "No he recibido el producto";
    case "item_not_as_described":
      return "El producto no coincide con la descripción";
    case "payment_problem":
      return "Problema con el pago";
    case "shipping_problem":
      return "Problema con el envío";
    case "seller_unresponsive":
      return "El vendedor no responde";
    case "buyer_unresponsive":
      return "El comprador no responde";
    default:
      return "Otra incidencia";
  }
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
  const paymentIntentId = cleanText(body?.paymentIntentId);
  const issueType = cleanText(body?.issueType);
  const description = cleanText(body?.description);

  if (!paymentIntentId) {
    return NextResponse.json({ error: "Missing payment intent id" }, { status: 400 });
  }

  if (!VALID_TYPES.has(issueType)) {
    return NextResponse.json({ error: "Tipo de incidencia no válido" }, { status: 400 });
  }

  if (description.length < 20) {
    return NextResponse.json(
      { error: "Describe el problema con al menos 20 caracteres." },
      { status: 400 }
    );
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payment_intents")
    .select("id, listing_id, conversation_id, buyer_id, seller_id, status")
    .eq("id", paymentIntentId)
    .maybeSingle();

  if (paymentError || !payment) {
    return NextResponse.json({ error: "Operación no encontrada" }, { status: 404 });
  }

  const isParticipant = payment.buyer_id === user.id || payment.seller_id === user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: existingOpenIssue } = await supabase
    .from("transaction_issues")
    .select("id")
    .eq("payment_intent_id", paymentIntentId)
    .in("status", ["open", "reviewing"])
    .limit(1)
    .maybeSingle();

  if (existingOpenIssue) {
    return NextResponse.json(
      {
        error: "Ya hay una incidencia abierta para esta operación.",
        issueId: existingOpenIssue.id,
      },
      { status: 400 }
    );
  }

  const title = getIssueTypeLabel(issueType);

  const { data: issue, error } = await supabase
    .from("transaction_issues")
    .insert({
      payment_intent_id: payment.id,
      listing_id: payment.listing_id,
      conversation_id: payment.conversation_id,
      opened_by: user.id,
      buyer_id: payment.buyer_id,
      seller_id: payment.seller_id,
      issue_type: issueType,
      title,
      description,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counterpartId = user.id === payment.buyer_id ? payment.seller_id : payment.buyer_id;

  if (counterpartId) {
    await createNotification(supabase, {
      user_id: counterpartId,
      kind: "transaction_issue_opened",
      title: "Nueva incidencia en una operación",
      body: title,
      href: `/account/issues/${issue.id}`,
      metadata: {
        issue_id: issue.id,
        payment_intent_id: payment.id,
      },
    });
  }

  await createNotification(supabase, {
    user_id: user.id,
    kind: "transaction_issue_opened",
    title: "Incidencia creada",
    body: "Hemos registrado tu incidencia. Puedes seguirla desde tu cuenta.",
    href: `/account/issues/${issue.id}`,
    metadata: {
      issue_id: issue.id,
      payment_intent_id: payment.id,
    },
  });

  return NextResponse.json({ ok: true, issueId: issue.id });
}
