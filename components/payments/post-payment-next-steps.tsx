import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PostPaymentNextSteps({
  conversationId,
  paymentIntentId,
  deliveryMethod,
}: {
  conversationId?: string | null;
  paymentIntentId?: string | null;
  deliveryMethod?: string | null;
}) {
  const isShipping = deliveryMethod === "shipping";

  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardHeader>
        <CardTitle className="text-emerald-950">Qué pasa ahora</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-emerald-900">
        <ol className="list-decimal space-y-2 pl-5">
          <li>El vendedor recibe la confirmación de pago en Wetudy.</li>
          <li>
            {isShipping
              ? "El vendedor prepara el envío y añade el seguimiento cuando esté listo."
              : "Comprador y vendedor acuerdan la entrega en mano desde el chat."}
          </li>
          <li>Si algo falla, puedes abrir una incidencia desde tu actividad.</li>
          <li>Cuando termine la operación, deja una valoración para reforzar la confianza de la comunidad.</li>
        </ol>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          {conversationId ? (
            <Button asChild>
              <Link href={`/messages/${conversationId}`}>Ir al chat</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/account/activity">Ver actividad</Link>
          </Button>
          {paymentIntentId ? (
            <Button asChild variant="outline">
              <Link href={`/account/issues/new?payment_intent_id=${paymentIntentId}`}>Tengo un problema</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
