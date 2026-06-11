import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OpenTransactionIssueForm from "@/components/issues/open-transaction-issue-form";

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent_id?: string }>;
}) {
  const params = await searchParams;
  const paymentIntentId = params.payment_intent_id;

  if (!paymentIntentId) notFound();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: payment } = await supabase
    .from("payment_intents")
    .select("id, listing_id, buyer_id, seller_id, amount, status, created_at")
    .eq("id", paymentIntentId)
    .maybeSingle();

  if (!payment || (payment.buyer_id !== user.id && payment.seller_id !== user.id)) {
    notFound();
  }

  const { data: listing } = payment.listing_id
    ? await supabase.from("listings").select("id, title").eq("id", payment.listing_id).maybeSingle()
    : { data: null };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link href="/account/activity" className="text-sm font-medium text-primary hover:underline">
        ← Volver a actividad
      </Link>

      <div className="mt-6 rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Abrir incidencia</h1>
        <p className="mt-2 text-muted-foreground">
          Usa este formulario si tienes un problema real con una operación pagada.
        </p>

        <div className="my-6 rounded-xl bg-muted p-4 text-sm">
          <p className="font-medium">{listing?.title || "Operación"}</p>
          <p className="mt-1 text-muted-foreground">
            Estado del pago: {payment.status}
          </p>
        </div>

        <OpenTransactionIssueForm paymentIntentId={payment.id} />
      </div>
    </div>
  );
}
