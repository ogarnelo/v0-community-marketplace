"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { startCheckoutSession, confirmPaymentComplete, checkSessionStatus } from "@/app/actions/stripe";
import { CheckCircle } from "lucide-react";
import { BuyerProtectionCard } from "@/components/payments/buyer-protection-card";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

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
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
    if (!stripePromise) {
      toast.error("Falta NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY en el entorno.");
      return;
    }

    setSubmitting(true);
    setShowStripeCheckout(true);
  };

  const fetchClientSecret = useCallback(async () => {
    try {
      const result = await startCheckoutSession({
        offerId,
        deliveryMethod,
        shipmentTier: deliveryMethod === "shipping" ? shipmentTier : "none",
      });

      if (!result?.clientSecret) {
        toast.error("Stripe no devolvió un client secret válido.");
        throw new Error("Stripe no devolvió un client secret válido.");
      }

      setSessionId(result.sessionId);
      return result.clientSecret;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error al iniciar el pago.";
      toast.error(message);
      setShowStripeCheckout(false);
      setSubmitting(false);
      throw error;
    }
  }, [offerId, deliveryMethod, shipmentTier]);

  const handleCheckoutComplete = useCallback(async () => {
    setPaymentComplete(true);
    setSubmitting(false);

    try {
      await confirmPaymentComplete({ offerId });
      toast.success("Pago completado correctamente");
    } catch {
      toast.success("Pago procesado. Los estados se actualizarán en breve.");
    }

    setTimeout(() => {
      router.push(`/checkout/success?offer_id=${offerId}`);
    }, 2000);
  }, [offerId, router]);

  useEffect(() => {
    if (!sessionId || paymentComplete) return;

    const checkPayment = async () => {
      try {
        const result = await checkSessionStatus(sessionId);
        if (result.paymentStatus === "paid") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          handleCheckoutComplete();
        }
      } catch {
        // ignorar errores temporales de polling
      }
    };

    pollingRef.current = setInterval(checkPayment, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [sessionId, paymentComplete, handleCheckoutComplete]);

  if (paymentComplete) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="mb-4 h-16 w-16 text-emerald-600" />
          <h2 className="mb-2 text-2xl font-semibold text-emerald-900">Pago completado</h2>
          <p className="text-emerald-700">
            Tu pago se ha procesado correctamente. Redirigiendo...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
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

                <RadioGroup value={shipmentTier} onValueChange={handleShipmentTierChange} className="gap-3">
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

        <BuyerProtectionCard compact />
      </div>

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

          <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
            {deliveryMethod === "shipping"
              ? "El buyer fee ayuda a cubrir la gestión de la operación dentro de la plataforma."
              : "En entrega en mano no se aplica buyer fee ni coste de envío."}
          </div>

          {!showStripeCheckout ? (
            <Button className="w-full" size="lg" onClick={handlePreparePayment} disabled={submitting || loadingQuote}>
              {submitting ? "Preparando pago..." : loadingQuote ? "Actualizando total..." : "Continuar al pago"}
            </Button>
          ) : stripePromise ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
