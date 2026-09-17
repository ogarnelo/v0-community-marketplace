"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, LockKeyhole } from "lucide-react";

type HelpContactFormProps = {
  initialName?: string;
  initialEmail?: string;
  isLoggedIn?: boolean;
};

export function HelpContactForm({
  initialName = "",
  initialEmail = "",
  isLoggedIn = false,
}: HelpContactFormProps) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const normalizedMessage = message.trim();

    if (normalizedMessage.length < 10) {
      setErrorMessage("Describe tu consulta con un poco más de detalle.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: normalizedMessage }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo enviar tu consulta.");
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error("Error creando support ticket:", error);
      setErrorMessage(error?.message || "No se pudo enviar tu consulta. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Inicia sesión para contactar con soporte</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Así podemos asociar la consulta a una cuenta real y reducir el spam automatizado.
            </p>
            <Button asChild className="mt-4">
              <Link href="/auth?next=/help">Iniciar sesión</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/15">
          <CheckCircle2 className="h-7 w-7 text-secondary" />
        </div>
        <p className="mt-4 font-semibold text-foreground">Mensaje enviado</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hemos registrado tu consulta correctamente.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" value={initialName} readOnly className="bg-muted/40" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={initialEmail} readOnly className="bg-muted/40" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Mensaje *</Label>
        <Textarea
          id="message"
          placeholder="Describe tu consulta..."
          rows={5}
          minLength={10}
          maxLength={4000}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Máximo 4000 caracteres.</p>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <Button type="submit" className="w-fit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enviar mensaje
      </Button>
    </form>
  );
}
