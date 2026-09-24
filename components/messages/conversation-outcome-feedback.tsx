"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type FeedbackRole = "buyer" | "seller";

type ConversationOutcomeFeedbackProps = {
  conversationId: string;
  role: FeedbackRole;
};

type FeedbackOption = {
  value: string;
  label: string;
};

const BUYER_OPTIONS: FeedbackOption[] = [
  { value: "bought_here", label: "Lo compré / me lo quedé" },
  { value: "unavailable", label: "Ya no estaba disponible" },
  { value: "seller_no_response", label: "El vendedor no respondió" },
  { value: "price", label: "No acordamos el precio" },
  { value: "distance", label: "Estaba demasiado lejos" },
  { value: "found_other", label: "Encontré otro" },
  { value: "no_longer_needed", label: "Ya no lo necesito" },
  { value: "other", label: "Otro motivo" },
];

const SELLER_OPTIONS: FeedbackOption[] = [
  { value: "sold_here", label: "Lo vendí / entregué a esta persona" },
  { value: "sold_elsewhere", label: "Lo vendí por otro medio" },
  { value: "still_available", label: "Sigue disponible" },
  { value: "buyer_no_response", label: "El comprador dejó de responder" },
  { value: "price", label: "No acordamos el precio" },
  { value: "decided_not_to_sell", label: "Decidí no venderlo" },
  { value: "other", label: "Otro motivo" },
];

export function ConversationOutcomeFeedback({
  conversationId,
  role,
}: ConversationOutcomeFeedbackProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [showOther, setShowOther] = useState(false);
  const [details, setDetails] = useState("");

  const options = role === "buyer" ? BUYER_OPTIONS : SELLER_OPTIONS;

  const submit = async (reason: string, extraDetails = "") => {
    if (status === "saving" || status === "done") return;

    if (reason === "other" && !extraDetails.trim()) {
      setShowOther(true);
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch("/api/conversations/outcome-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          reason,
          details: extraDetails.trim() || null,
        }),
      });

      if (!response.ok) throw new Error("feedback_failed");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        <div>
          <p className="text-sm font-medium text-emerald-950">Gracias por contárnoslo</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
            Esta respuesta nos ayuda a entender por qué algunas conversaciones no terminan en acuerdo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <p className="text-sm font-medium text-amber-950">¿Qué ocurrió con esta conversación?</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            Han pasado varios días sin actividad. Una respuesta rápida nos ayuda a mejorar el marketplace.
          </p>
        </div>
      </div>

      {!showOther ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              size="sm"
              disabled={status === "saving"}
              onClick={() => void submit(option.value)}
              className="h-auto min-h-8 whitespace-normal bg-white text-left"
            >
              {option.label}
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={500}
            placeholder="Cuéntanos brevemente qué ocurrió..."
            className="min-h-20 bg-white"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={status === "saving" || !details.trim()}
              onClick={() => void submit("other", details)}
            >
              {status === "saving" ? "Guardando..." : "Enviar respuesta"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={status === "saving"}
              onClick={() => {
                setShowOther(false);
                setDetails("");
                setStatus("idle");
              }}
            >
              Volver
            </Button>
          </div>
        </div>
      )}

      {status === "error" ? (
        <p className="mt-2 text-xs text-destructive">
          No se pudo guardar la respuesta. Puedes probar de nuevo.
        </p>
      ) : null}
    </div>
  );
}
