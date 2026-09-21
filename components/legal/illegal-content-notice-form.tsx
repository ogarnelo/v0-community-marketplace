"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2 } from "lucide-react";

export function IllegalContentNoticeForm({
  initialContentUrl = "",
}: {
  initialContentUrl?: string;
}) {
  const [contentUrl, setContentUrl] = useState(initialContentUrl);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [explanation, setExplanation] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [identityOmitted, setIdentityOmitted] = useState(false);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/legal/content-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentUrl,
          name,
          email,
          explanation,
          goodFaith,
          identityOmitted,
          website,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error || "No se pudo registrar la notificación."
        );
      }

      setSubmitted(true);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "No se pudo registrar la notificación."
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
        <p className="mt-3 font-semibold text-emerald-900">
          Notificación registrada
        </p>
        <p className="mt-1 text-sm leading-6 text-emerald-800">
          Wetudy revisará la información facilitada. Si has indicado un email,
          podremos utilizarlo para confirmar la recepción o comunicarte la
          decisión cuando corresponda.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="legal-content-url">URL exacta del contenido *</Label>
        <Input
          id="legal-content-url"
          type="text"
          required
          maxLength={1000}
          placeholder="https://www.wetudy.com/marketplace/listing/..."
          value={contentUrl}
          onChange={(event) => setContentUrl(event.target.value)}
        />
        <p className="text-xs leading-5 text-muted-foreground">
          Debe ser una URL de Wetudy que permita localizar con precisión el
          contenido que consideras ilícito.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="legal-explanation">
          Motivos por los que consideras ilícito el contenido *
        </Label>
        <Textarea
          id="legal-explanation"
          required
          minLength={20}
          maxLength={4000}
          rows={7}
          placeholder="Explica qué contenido señalas y por qué consideras que infringe la ley. Incluye el contexto necesario para poder revisarlo."
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
        />
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <label className="flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={identityOmitted}
            onChange={(event) => setIdentityOmitted(event.target.checked)}
          />
          <span>
            La notificación se refiere a posibles delitos sexuales contra
            menores y necesito utilizar la excepción legal que permite omitir
            nombre y email.
          </span>
        </label>
      </div>

      {!identityOmitted ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="legal-name">Nombre *</Label>
            <Input
              id="legal-name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legal-email">Email *</Label>
            <Input
              id="legal-email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <Label htmlFor="legal-website">Web</Label>
        <Input
          id="legal-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          required
          className="mt-1 h-4 w-4"
          checked={goodFaith}
          onChange={(event) => setGoodFaith(event.target.checked)}
        />
        <span>
          Confirmo de buena fe que la información y las alegaciones incluidas
          en esta notificación son precisas y completas según mi conocimiento.
        </span>
      </label>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Enviar notificación
      </Button>
    </form>
  );
}
