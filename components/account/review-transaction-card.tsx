
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReviewTransactionCard({
  paymentIntentId,
  listingTitle,
  counterpartName,
  roleLabel,
}: {
  paymentIntentId: string;
  listingTitle: string;
  counterpartName: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/reviews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId, rating, comment }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result?.error || "No se pudo enviar la valoración.");
        return;
      }

      setSuccess(true);
      router.refresh();
    });
  };

  if (success) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-emerald-800">Gracias. Tu valoración ya se ha guardado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#CFE7A6] bg-[#F8FBEF]">
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-base">Valora esta operación</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cuéntanos cómo fue tu experiencia con {counterpartName} como {roleLabel} en <span className="font-medium text-foreground">{listingTitle}</span>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Puntuar con ${value} estrellas`}
              onClick={() => setRating(value)}
              className="rounded-md p-1 transition hover:bg-white"
            >
              <Star className={`h-5 w-5 ${value <= rating ? "fill-amber-400 text-amber-500" : "text-slate-300"}`} />
            </button>
          ))}
        </div>

        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Añade un comentario opcional para ayudar a otros usuarios."
          rows={4}
        />

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <Button onClick={submit} disabled={isPending}>
          {isPending ? "Enviando..." : "Enviar valoración"}
        </Button>
      </CardContent>
    </Card>
  );
}
