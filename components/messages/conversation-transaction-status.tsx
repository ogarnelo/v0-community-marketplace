import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ListingOfferRow, PaymentIntentRow, ShipmentRow } from "@/lib/types/marketplace";
import { formatPrice } from "@/lib/marketplace/formatters";
import { ShipmentStatusCard } from "@/components/shipments/shipment-status-card";

function getOfferAmount(offer?: ListingOfferRow | null) {
  if (!offer) return null;
  return offer.accepted_amount ?? offer.current_amount ?? offer.counter_price ?? offer.offered_price;
}

function getStatusLabel(payment?: PaymentIntentRow | null, offer?: ListingOfferRow | null) {
  if (payment?.status === "paid") return "Pago confirmado";
  if (payment?.status === "processing") return "Pago en proceso";
  if (payment?.status === "requires_payment_method") return "Pendiente de pago";
  if (payment?.status === "failed") return "Pago fallido";
  if (payment?.status === "cancelled") return "Pago cancelado";
  if (offer?.status === "accepted") return "Oferta aceptada";
  return "Negociación activa";
}

function getStatusClass(status?: string | null) {
  switch (status) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "processing":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "requires_payment_method":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function ConversationTransactionStatus({
  offer,
  payment,
  shipment,
  isBuyer,
  currentUserId,
}: {
  offer?: ListingOfferRow | null;
  payment?: PaymentIntentRow | null;
  shipment?: ShipmentRow | null;
  isBuyer: boolean;
  currentUserId: string;
}) {
  if (!offer) return null;

  const amount = getOfferAmount(offer);
  const deliveryMethod = String(payment?.metadata?.delivery_method || "in_person");
  const shippingSelected = deliveryMethod === "shipping";
  const buyerCanPay =
    isBuyer &&
    (offer.status === "accepted" ||
      payment?.status === "requires_payment_method" ||
      payment?.status === "failed" ||
      payment?.status === "cancelled");

  return (
    <div className="mb-4 space-y-4">
      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Estado de la operación</p>
              <p className="text-sm text-muted-foreground">
                {amount !== null ? `Importe acordado: ${formatPrice(amount)}` : "Importe acordado en el chat"}
              </p>
            </div>
            <Badge variant="outline" className={getStatusClass(payment?.status || offer.status)}>
              {getStatusLabel(payment, offer)}
            </Badge>
          </div>

          {payment?.status === "paid" ? (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {shippingSelected
                ? "Pago confirmado. El siguiente paso es preparar el envío y compartir el seguimiento cuando esté disponible."
                : "Pago confirmado. Ya podéis cerrar la entrega en mano desde este chat."}
            </div>
          ) : buyerCanPay ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-3">
              <div className="text-sm text-amber-800">
                La oferta ya está aceptada. Solo falta completar el pago dentro de Wetudy para cerrar la compra.
              </div>
              <Link href={`/checkout/${offer.id}`}>
                <Button className="bg-[#7EBA28] text-white hover:bg-[#6da122]">Ir al pago</Button>
              </Link>
            </div>
          ) : payment?.status === "failed" || payment?.status === "cancelled" ? (
            <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              El intento de pago no se completó. El comprador puede volver a intentarlo desde el checkout.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {shippingSelected && payment?.status === "paid" && shipment ? (
        <ShipmentStatusCard shipment={shipment} currentUserId={currentUserId} compact />
      ) : null}
    </div>
  );
}
