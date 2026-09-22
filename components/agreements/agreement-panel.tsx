"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Handshake, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type Agreement = {
  id: string;
  listing_id: string;
  conversation_id?: string | null;
  buyer_id: string;
  seller_id: string;
  agreement_type: "sale" | "donation" | string;
  status: string;
  amount?: number | null;
  buyer_confirmed_at?: string | null;
  seller_confirmed_at?: string | null;
  confirmed_at?: string | null;
  updated_at?: string | null;
};

type Review = {
  id: string;
  reviewer_id: string;
  reviewed_user_id: string;
  rating: number;
  comment?: string | null;
};

type AgreementPanelProps = {
  conversationId: string;
  currentUserId: string;
  buyerId: string;
  sellerId: string;
  otherName?: string | null;
  listingStatus?: string | null;
  listingPrice?: number | null;
  listingType?: string | null;
  initialAgreement?: Agreement | null;
  initialReviews?: Review[];
};

function formatPrice(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function parseAmount(value: string) {
  const amount = Number(value.trim().replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

const INCIDENT_REASONS = [
  { value: "delivery_missing", label: "No se ha realizado la entrega" },
  { value: "item_not_as_agreed", label: "El artículo no coincide con lo acordado" },
  { value: "payment_problem", label: "Problema con el pago acordado" },
  { value: "inappropriate_behavior", label: "Trato inapropiado" },
  { value: "other", label: "Otro problema" },
] as const;

export default function AgreementPanel({
  conversationId,
  currentUserId,
  buyerId,
  sellerId,
  otherName,
  listingStatus,
  listingPrice,
  listingType,
  initialAgreement = null,
  initialReviews = [],
}: AgreementPanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [agreement, setAgreement] = useState<Agreement | null>(initialAgreement);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [showCounter, setShowCounter] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDetails, setDisputeDetails] = useState("");
  const [amountInput, setAmountInput] = useState(
    typeof initialAgreement?.amount === "number"
      ? String(initialAgreement.amount)
      : typeof listingPrice === "number"
        ? String(listingPrice)
        : ""
  );

  useEffect(() => {
    setAgreement(initialAgreement);
  }, [initialAgreement]);

  useEffect(() => {
    const nextAmount =
      typeof agreement?.amount === "number"
        ? agreement.amount
        : typeof listingPrice === "number"
          ? listingPrice
          : null;

    if (nextAmount != null) setAmountInput(String(nextAmount));
  }, [agreement?.amount, listingPrice]);

  useEffect(() => {
    const channel = supabase
      .channel(`agreement-panel:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agreements",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setAgreement(null);
          } else {
            setAgreement(payload.new as Agreement);
          }
          setShowCounter(false);
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, router, supabase]);

  const isBuyer = currentUserId === buyerId;
  const isSeller = currentUserId === sellerId;
  const isDonation = listingType === "donation" || agreement?.agreement_type === "donation";
  const hasReviewed = reviews.some((review) => review.reviewer_id === currentUserId);
  const activeAgreement =
    agreement && !["confirmed", "cancelled", "disputed"].includes(agreement.status);
  const canPropose =
    (!agreement || agreement.status === "cancelled") &&
    ["available", "reserved", null, undefined].includes(listingStatus || undefined);
  const myConfirmed = agreement
    ? isBuyer
      ? Boolean(agreement.buyer_confirmed_at)
      : Boolean(agreement.seller_confirmed_at)
    : false;
  const otherConfirmed = agreement
    ? isBuyer
      ? Boolean(agreement.seller_confirmed_at)
      : Boolean(agreement.buyer_confirmed_at)
    : false;
  const iMadeCurrentProposal = Boolean(activeAgreement && myConfirmed && !otherConfirmed);
  const iNeedToRespond = Boolean(activeAgreement && !myConfirmed && otherConfirmed);
  const friendlyOtherName = otherName?.trim() || "La otra persona";

  async function runAction(
    endpoint: string,
    body: Record<string, unknown>,
    actionName: string
  ) {
    if (loadingAction) return false;
    setLoadingAction(actionName);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "No se pudo completar la acción.");

      if (payload?.agreement) {
        setAgreement(payload.agreement);
        if (typeof payload.agreement.amount === "number") {
          setAmountInput(String(payload.agreement.amount));
        }
      }

      if (payload?.review) {
        setReviews((prev) => [...prev, payload.review]);
        setComment("");
        setRating(5);
        setShowReview(false);
      }

      if (["propose", "counter"].includes(actionName)) {
        setShowCounter(false);
      }

      if (actionName === "dispute") {
        setShowDispute(false);
        setDisputeReason("");
        setDisputeDetails("");
      }

      router.refresh();
      return true;
    } catch (error: any) {
      alert(error?.message || "No se pudo completar la acción.");
      return false;
    } finally {
      setLoadingAction(null);
    }
  }

  const propose = () => {
    const amount = isDonation ? null : parseAmount(amountInput);

    if (!isDonation && amount == null) {
      alert("Introduce un precio válido.");
      return;
    }

    void runAction(
      "/api/agreements/propose",
      { conversationId, amount },
      "propose"
    );
  };

  const counter = () => {
    if (!agreement) return;
    const amount = parseAmount(amountInput);

    if (amount == null) {
      alert("Introduce un precio válido.");
      return;
    }

    void runAction(
      "/api/agreements/counter",
      { agreementId: agreement.id, amount },
      "counter"
    );
  };

  if (agreement?.status === "disputed") {
    return (
      <section id="agreement-panel" className="scroll-mt-24 border-t px-3 py-3 sm:px-5">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-amber-950">Hay una incidencia abierta</p>
            <p className="mt-1 text-sm text-amber-900">
              Podéis seguir hablando por el chat mientras se revisa.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (agreement?.status === "confirmed") {
    return (
      <section id="agreement-panel" className="scroll-mt-24 border-t px-3 py-3 sm:px-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-emerald-950">
                {isDonation ? "Donación acordada" : "¡Hecho! Venta acordada"}
              </p>
              {!isDonation && formatPrice(agreement.amount) ? (
                <p className="mt-0.5 text-lg font-bold text-emerald-950">
                  {formatPrice(agreement.amount)}
                </p>
              ) : null}
              <p className="mt-1 text-sm text-emerald-900">
                Seguid hablando por aquí para concretar la entrega.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {!hasReviewed ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowReview((value) => !value)}
              >
                <Star className="mr-1.5 h-4 w-4" />
                Valorar experiencia
              </Button>
            ) : (
              <span className="text-sm text-emerald-900">Valoración enviada</span>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-rose-700 hover:text-rose-800"
              onClick={() => setShowDispute((value) => !value)}
              disabled={!!loadingAction}
            >
              {showDispute ? "Cancelar reporte" : "Reportar problema"}
            </Button>
          </div>

          {showDispute ? (
            <div className="mt-3 space-y-3 rounded-xl border border-rose-200 bg-white p-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Cuéntanos qué ha ocurrido</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Esta información la verá el equipo de Wetudy para poder revisar el acuerdo y el chat.
                </p>
              </div>

              <select
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={disputeReason}
                onChange={(event) => setDisputeReason(event.target.value)}
                aria-label="Motivo de la incidencia"
              >
                <option value="">Selecciona un motivo</option>
                {INCIDENT_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>

              <Textarea
                value={disputeDetails}
                onChange={(event) => setDisputeDetails(event.target.value.slice(0, 1000))}
                placeholder="Explica brevemente qué ha pasado y qué necesitas que revisemos."
                rows={4}
              />

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {disputeDetails.trim().length}/1000
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void runAction(
                      "/api/agreements/dispute",
                      {
                        agreementId: agreement.id,
                        reason: disputeReason,
                        details: disputeDetails,
                      },
                      "dispute"
                    )
                  }
                  disabled={
                    !!loadingAction ||
                    !disputeReason ||
                    disputeDetails.trim().length < 10
                  }
                >
                  {loadingAction === "dispute" ? "Enviando..." : "Enviar incidencia"}
                </Button>
              </div>
            </div>
          ) : null}

          {showReview && !hasReviewed ? (
            <div className="mt-3 space-y-2 rounded-xl bg-white p-3">
              <select
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              >
                <option value={5}>5 estrellas</option>
                <option value={4}>4 estrellas</option>
                <option value={3}>3 estrellas</option>
                <option value={2}>2 estrellas</option>
                <option value={1}>1 estrella</option>
              </select>
              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Comentario opcional"
              />
              <Button
                size="sm"
                onClick={() =>
                  void runAction(
                    "/api/agreements/review",
                    { agreementId: agreement.id, rating, comment },
                    "review"
                  )
                }
                disabled={!!loadingAction}
              >
                {loadingAction === "review" ? "Guardando..." : "Enviar valoración"}
              </Button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section id="agreement-panel" className="scroll-mt-24 border-t px-3 py-3 sm:px-5">
      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        {activeAgreement ? (
          <>
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-sky-50 p-2 text-sky-700">
                <Handshake className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                {isDonation ? (
                  <>
                    <p className="font-semibold text-slate-950">
                      {iMadeCurrentProposal
                        ? isBuyer
                          ? "Has pedido esta donación"
                          : "Has ofrecido esta donación"
                        : isSeller
                          ? `${friendlyOtherName} quiere quedarse con este artículo`
                          : `${friendlyOtherName} quiere darte este artículo`}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {iMadeCurrentProposal
                        ? `Esperando respuesta de ${friendlyOtherName}.`
                        : "Responde cuando lo tengas claro. Podéis seguir hablando por el chat."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {iMadeCurrentProposal ? "Tu oferta" : `Oferta de ${friendlyOtherName}`}
                    </p>
                    <p className="text-2xl font-bold tracking-tight text-slate-950">
                      {formatPrice(agreement.amount) || "—"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {iMadeCurrentProposal
                        ? `Esperando respuesta de ${friendlyOtherName}.`
                        : "Puedes aceptarla o proponer otro precio."}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {iNeedToRespond ? (
                <Button
                  type="button"
                  onClick={() =>
                    void runAction(
                      "/api/agreements/confirm",
                      { agreementId: agreement.id },
                      "confirm"
                    )
                  }
                  disabled={!!loadingAction}
                >
                  {loadingAction === "confirm"
                    ? "Aceptando..."
                    : isDonation
                      ? "Aceptar donación"
                      : "Aceptar oferta"}
                </Button>
              ) : null}

              {!isDonation ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCounter((value) => !value)}
                  disabled={!!loadingAction}
                >
                  {showCounter
                    ? "Cerrar"
                    : iMadeCurrentProposal
                      ? "Cambiar oferta"
                      : "Proponer otro precio"}
                </Button>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                className="text-rose-700 hover:text-rose-800"
                onClick={() =>
                  void runAction(
                    "/api/agreements/cancel",
                    { agreementId: agreement.id },
                    "cancel"
                  )
                }
                disabled={!!loadingAction}
              >
                {loadingAction === "cancel"
                  ? "Cerrando..."
                  : iMadeCurrentProposal
                    ? isDonation
                      ? "Retirar solicitud"
                      : "Retirar oferta"
                    : "Rechazar"}
              </Button>
            </div>

            {showCounter && !isDonation ? (
              <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  aria-label="Nuevo precio"
                  placeholder="Nuevo precio"
                />
                <Button
                  type="button"
                  onClick={counter}
                  disabled={!!loadingAction}
                >
                  {loadingAction === "counter" ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            ) : null}
          </>
        ) : canPropose ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-semibold text-slate-950">
                {isDonation
                  ? isBuyer
                    ? "¿Te interesa esta donación?"
                    : "¿Quieres reservarla para esta persona?"
                  : isBuyer
                    ? "¿Quieres hacer una oferta?"
                    : "¿Quieres proponer un precio?"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isDonation
                  ? "La otra persona podrá aceptarla desde este mismo chat."
                  : "La otra persona podrá aceptar o proponerte otro precio."}
              </p>
            </div>

            {!isDonation ? (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,180px)_auto]">
                <Input
                  type="text"
                  inputMode="decimal"
                  enterKeyHint="done"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  aria-label="Precio de la oferta"
                  placeholder={typeof listingPrice === "number" ? String(listingPrice) : "Precio"}
                />
                <Button type="button" onClick={propose} disabled={!!loadingAction}>
                  {loadingAction === "propose"
                    ? "Enviando..."
                    : isBuyer
                      ? "Hacer oferta"
                      : "Proponer precio"}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={propose}
                disabled={!!loadingAction}
                className="w-full sm:w-auto"
              >
                {loadingAction === "propose"
                  ? "Enviando..."
                  : isBuyer
                    ? "Pedir esta donación"
                    : "Proponer donación"}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
