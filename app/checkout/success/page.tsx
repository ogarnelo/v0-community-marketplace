import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostPaymentNextSteps } from "@/components/payments/post-payment-next-steps";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ offer_id?: string }>;
}) {
  const params = await searchParams;
  const offerId = params.offer_id;
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();

  let payment: any = null;
  let listing: any = null;

  if (user && offerId) {
    const { data } = await admin
      .from("payment_intents")
      .select("id, listing_id, conversation_id, buyer_id, seller_id, amount, status, metadata")
      .eq("offer_id", offerId)
      .eq("buyer_id", user.id)
      .maybeSingle();
    payment = data;

    if (payment?.listing_id) {
      const { data: listingRow } = await admin.from("listings").select("id, title, status").eq("id", payment.listing_id).maybeSingle();
      listing = listingRow;
    }
  }

  const deliveryMethod = payment?.metadata?.delivery_method || null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="border-emerald-200">
          <CardHeader className="items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-7" />
            </div>
            <CardTitle className="text-2xl">Pago confirmado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-slate-600">
              Hemos recibido tu pago correctamente. {listing?.title ? `Operación: ${listing.title}.` : "Puedes seguir la operación desde tus mensajes."}
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              {payment?.conversation_id ? <Button asChild><Link href={`/messages/${payment.conversation_id}`}>Ir al chat</Link></Button> : <Button asChild><Link href="/messages">Ir a mensajes</Link></Button>}
              <Button asChild variant="outline"><Link href="/account/activity">Ver actividad</Link></Button>
            </div>
          </CardContent>
        </Card>

        <PostPaymentNextSteps conversationId={payment?.conversation_id} paymentIntentId={payment?.id} deliveryMethod={deliveryMethod} />
      </div>
    </main>
  );
}
