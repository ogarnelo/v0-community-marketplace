"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/marketplace/formatters";
import type { DeliveryMethod, ShipmentTier } from "@/lib/payments/pricing";
import { startCheckoutSession } from "@/app/actions/stripe";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type QuoteResponse = {
  itemAmount: number;
  buyerFeeAmount: number;
  shippingAmount: number;
  totalBuyerAmount: number;
  deliveryMethod: DeliveryMethod;
  shipmentTier: ShipmentTier;
  sellerNetAmount: number;
};

interface CheckoutSummaryProps {
  offerId: string;
  listingTitle: string;
  acceptedAmount: number;
}

const SHIPPING_OPTIONS: Array<{ value: ShipmentTier; label: string; help: string }> = [
  { value: "small", label: "Pequeño", help: "Libros individuales o material ligero" },
  { value: "medium", label: "Mediano", help: "Varios libros o lote medio" },
  { value: "large", label: "Grande", help: "Lotes amplios o artículos voluminosos" },
];

export function CheckoutSummary({
  offerId,
  listingTitle,
  acceptedAmount,
}: CheckoutSummaryProps) {
  const router = useRouter();
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("shipping");
  const [shipmentTier, setShipmentTier] = useState<ShipmentTier>("small");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    try {
      return await startCheckoutSession({
        offerId,
        deliveryMethod,
        shipmentTier: deliveryMethod === "shipping" ? shipmentTier : "none",
      });
    } catch (error: any) {
      const message = error?.message || "No se pudo abrir el checkout.";
      toast.error(message);
      setShowStripeCheckout(false);
      setSubmitting(false);
      throw error;
    }
  }, [offerId, deliveryMethod, shipmentTier]);

  const effectiveQuote = useMemo(() => {
    if (quote) return quote;

    return {
      itemAmount: acceptedAmount,
      buyerFeeAmount: deliveryMethod === "shipping" ? Math.round((acceptedAmount * 0.05 + 0.7) * 100) / 100 : 0,
      shippingAmount:
        deliveryMethod === "shipping"
          ? shipmentTier === "small"
            ? 2.99
            : shipmentTier === "medium"
              ? 4.49
              : 6.99
          : 0,
      totalBuyerAmount: 0,
      deliveryMethod,
      shipmentTier,
      sellerNetAmount: acceptedAmount,
    };
  }, [acceptedAmount, deliveryMethod, shipmentTier, quote]);

  const totalBuyerAmount = useMemo(() => {
    return (
      quote?.totalBuyerAmount ??
      Math.round(
        (effectiveQuote.itemAmount + effectiveQuote.buyerFeeAmount + effectiveQuote.shippingAmount) * 100
      ) / 100
    );
  }, [effectiveQuote, quote]);

  const refreshQuote = async (nextDeliveryMethod: DeliveryMethod, nextShipmentTier: ShipmentTier) => {
    setLoadingQuote(true);
    try {
      const response = await fetch("/api/payments/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, deliveryMethod: nextDeliveryMethod, shipmentTier: nextShipmentTier }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo calcular el total.");
      }

      setQuote(payload.quote);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo calcular el total.");
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleDeliveryMethodChange = async (value: string) => {
    const nextDeliveryMethod = value === "in_person" ? "in_person" : "shipping";
    const nextShipmentTier = nextDeliveryMethod === "shipping" ? shipmentTier : "none";
    setDeliveryMethod(nextDeliveryMethod);
    await refreshQuote(nextDeliveryMethod, nextShipmentTier);
  };

  const handleShipmentTierChange = async (value: string) => {
    const nextShipmentTier = value === "medium" || value === "large" ? value : "small";
    setShipmentTier(nextShipmentTier);
    await refreshQuote("shipping", nextShipmentTier);
  };

  const handlePreparePayment = async () => {
    setSubmitting(true);
    setShowStripeCheckout(true);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Cómo quieres recibirlo</CardTitle>
          <CardDescription>
            Elige si vais a quedar en persona o si quieres preparar el envío desde la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={deliveryMethod}
            onValueChange={handleDeliveryMethodChange}
            className="gap-4"
            disabled={showStripeCheckout}
          >
            <Label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
              <RadioGroupItem value="in_person" className="mt-1" />
              <div>
                <p className="font-medium">Entrega en mano</p>
                <p className="text-sm text-slate-600">
                  Sin comisión ni coste de envío. Ideal si estáis cerca.
                </p>
              </div>
            </Label>

            <Label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
              <RadioGroupItem value="shipping" className="mt-1" />
              <div>
                <p className="font-medium">Envío</p>
                <p className="text-sm text-slate-600">
                  El comprador paga envío y buyer fee. El vendedor recibe el importe del artículo.
                </p>
              </div>
            </Label>
          </RadioGroup>

          {deliveryMethod === "shipping" ? (
            <div className="space-y-3">
              <div>
                <p className="font-medium">Tamaño estimado del envío</p>
                <p className="text-sm text-slate-600">
                  Esto se usa para calcular el coste logístico de forma aproximada.
                </p>
              </div>

              <RadioGroup
                value={shipmentTier}
                onValueChange={handleShipmentTierChange}
                className="gap-3"
                disabled={showStripeCheckout}
              >
                {SHIPPING_OPTIONS.map((option) => (
                  <Label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4">
                    <RadioGroupItem value={option.value} className="mt-1" />
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-slate-600">{option.help}</p>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Resumen del pedido</CardTitle>
          <CardDescription>{listingTitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Artículo</span>
              <span className="font-medium">{formatPrice(effectiveQuote.itemAmount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>Buyer fee</span>
              <span className="font-medium">{formatPrice(effectiveQuote.buyerFeeAmount)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>Envío</span>
              <span className="font-medium">{formatPrice(effectiveQuote.shippingAmount)}</span>
            </div>
            <div className="mt-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total comprador</span>
                <span className="text-lg font-semibold">{formatPrice(totalBuyerAmount)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            El vendedor recibirá <strong>{formatPrice(effectiveQuote.sellerNetAmount)}</strong>.
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={handlePreparePayment}
            disabled={submitting || loadingQuote || showStripeCheckout}
          >
            {submitting
              ? "Preparando pago..."
              : loadingQuote
                ? "Actualizando importe..."
                : "Preparar pago"}
          </Button>

          <p className="text-xs text-slate-500">
            Pago seguro procesado por Stripe.
          </p>
        </CardContent>
      </Card>

      {showStripeCheckout ? (
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader>
            <CardTitle>Completar pago</CardTitle>
            <CardDescription>
              Introduce tus datos de pago de forma segura con Stripe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div id="checkout">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret,
                  onComplete: () => {
                    router.push(`/checkout/success?offerId=${offerId}`);
                  },
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
