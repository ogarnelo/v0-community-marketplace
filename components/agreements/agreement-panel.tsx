"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Handshake, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CommunityInviteCard } from "@/components/growth/community-invite-card";

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
  listingStatus?: string | null;
  listingPrice?: number | null;
  listingType?: string | null;
  initialAgreement?: Agreement | null;
  initialReviews?: Review[];
};

function statusCopy(status?: string | null) {
  switch (status) {
    case "buyer_confirmed":
      return "Confirmado por comprador";
    case "seller_confirmed":
      return "Confirmado por vendedor";
    case "confirmed":
      return "Acuerdo cerrado";
    case "cancelled":
      return "Cancelado";
    case "disputed":
      return "Incidencia abierta";
    default:
      return "Pendiente de acuerdo";
  }
}

function formatPrice(value?: number | null) {
  if (typeof value !== "number") return null;
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

export default function AgreementPanel({
  conversationId,
  currentUserId,
  buyerId,
  sellerId,
  listingStatus,
  listingPrice,
  listingType,
  initialAgreement = null,
  initialReviews = [],
}: AgreementPanelProps) {
  const [agreement, setAgreement] = useState<Agreement | null>(initialAgreement);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const isBuyer = currentUserId === buyerId;
  const isSeller = currentUserId === sellerId;
  const isDonation = listingType === "donation" || agreement?.agreement_type === "donation";
  const hasReviewed = reviews.some((review) => review.reviewer_id === currentUserId);
  const canPropose = !agreement && ["available", "reserved", null, undefined].includes(listingStatus || undefined);
  const canConfirm = agreement && !["confirmed", "cancelled", "disputed"].includes(agreement.status);
  const myConfirmed = agreement
    ? isBuyer
      ? Boolean(agreement.buyer_confirmed_at)
      : Boolean(agreement.seller_confirmed_at)
    : false;

  const title = useMemo(() => {
    if (agreement?.status === "confirmed") return isDonation ? "Donación confirmada" : "Acuerdo confirmado";
    if (agreement?.status === "disputed") return "Incidencia abierta";
    if (agreement) return "Acuerdo en curso";
    return isDonation ? "Confirmar donación" : "Confirmar acuerdo entre partes";
  }, [agreement, isDonation]);

  async function runAction(endpoint: string, body: Record<string, unknown>, actionName: string) {
    if (loadingAction) return;
    setLoadingAction(actionName);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "No se pudo completar la acción.");
      if (payload?.agreement) setAgreement(payload.agreement);
      if (payload?.review) setReviews((prev) => [...prev, payload.review]);
      if (actionName === "review") {
        setComment("");
        setRating(5);
      }
    } catch (error: any) {
      alert(error?.message || "No se pudo completar la acción.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section className="border-b bg-sky-50/60 px-5 py-4">
      <div className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-sky-100 p-2 text-sky-800">
              {agreement?.status === "disputed" ? <AlertTriangle className="h-5 w-5" /> : <Handshake className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-slate-950">{title}</h2>
                <Badge variant={agreement?.status === "confirmed" ? "default" : "secondary"}>{statusCopy(agreement?.status)}</Badge>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Wetudy conserva el historial del chat y del acuerdo. La entrega y el pago se acuerdan directamente entre las partes.
              </p>
              {!isDonation && formatPrice(agreement?.amount ?? listingPrice) ? (
                <p className="mt-1 text-sm font-medium text-slate-800">Precio: {formatPrice(agreement?.amount ?? listingPrice)}</p>
              ) : null}
            </div>
          </div>
        </div>

        {!agreement && canPropose ? (
          <div className="mt-4 space-y-3">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional: lugar, hora o condiciones acordadas" />
            <Button onClick={() => runAction("/api/agreements/propose", { conversationId, note }, "propose")} disabled={!!loadingAction} className="w-full sm:w-auto">
              {loadingAction === "propose" ? "Creando acuerdo..." : isDonation ? "Proponer donación" : "Proponer acuerdo"}
            </Button>
          </div>
        ) : null}

        {agreement ? (
          <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={agreement.buyer_confirmed_at ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-slate-300"} />
              Comprador {agreement.buyer_confirmed_at ? "confirmado" : "pendiente"}
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={agreement.seller_confirmed_at ? "h-4 w-4 text-emerald-600" : "h-4 w-4 text-slate-300"} />
              Vendedor {agreement.seller_confirmed_at ? "confirmado" : "pendiente"}
            </div>
          </div>
        ) : null}

        {canConfirm ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {!myConfirmed ? (
              <Button onClick={() => runAction("/api/agreements/confirm", { agreementId: agreement.id }, "confirm")} disabled={!!loadingAction}>
                {loadingAction === "confirm" ? "Confirmando..." : "Confirmar mi parte"}
              </Button>
            ) : (
              <div className="rounded-xl border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">Ya has confirmado tu parte. Falta la otra persona.</div>
            )}
            <Button variant="outline" onClick={() => runAction("/api/agreements/cancel", { agreementId: agreement.id }, "cancel")} disabled={!!loadingAction}>Cancelar acuerdo</Button>
          </div>
        ) : null}

        {agreement?.status === "confirmed" ? (
          <div className="mt-4 rounded-2xl border bg-white p-3">
            <div className="flex items-center gap-2 font-medium"><Star className="h-4 w-4 text-yellow-500" /> Valorar este acuerdo</div>
            {hasReviewed ? (
              <p className="mt-2 text-sm text-muted-foreground">Ya has enviado tu valoración.</p>
            ) : (
              <div className="mt-3 space-y-3">
                <select className="w-full rounded-xl border bg-background px-3 py-2 text-sm" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                  <option value={5}>5 estrellas</option>
                  <option value={4}>4 estrellas</option>
                  <option value={3}>3 estrellas</option>
                  <option value={2}>2 estrellas</option>
                  <option value={1}>1 estrella</option>
                </select>
                <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Comentario opcional" />
                <Button variant="secondary" onClick={() => runAction("/api/agreements/review", { agreementId: agreement.id, rating, comment }, "review")} disabled={!!loadingAction}>
                  {loadingAction === "review" ? "Guardando..." : "Enviar valoración"}
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {agreement?.status === "confirmed" ? (
          <div className="mt-4">
            <CommunityInviteCard campaign="agreement_confirmed" />
          </div>
        ) : null}

        {agreement?.status === "confirmed" ? (
          <div className="mt-3">
            <Button variant="ghost" size="sm" className="text-rose-700 hover:text-rose-800" onClick={() => runAction("/api/agreements/dispute", { agreementId: agreement.id, note: "Incidencia reportada desde el chat" }, "dispute")} disabled={!!loadingAction}>
              Reportar incidencia del acuerdo confirmado
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
