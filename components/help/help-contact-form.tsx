"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2 } from "lucide-react";

type HelpContactFormProps = {
  initialName?: string;
  initialEmail?: string;
};

export function HelpContactForm({
  initialName = "",
  initialEmail = "",
}: HelpContactFormProps) {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedMessage = message.trim();

    if (!normalizedName) {
      setErrorMessage("Debes indicar tu nombre.");
      setLoading(false);
      return;
    }

    if (!normalizedEmail) {
      setErrorMessage("Debes indicar tu email.");
      setLoading(false);
      return;
    }

    if (!normalizedMessage) {
      setErrorMessage("Debes escribir tu consulta.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("support_tickets").insert({
        user_id: user?.id || null,
        name: normalizedName,
        email: normalizedEmail,
        message: normalizedMessage,
      });

      if (error) {
        throw error;
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error("Error creando support ticket:", error);
      setErrorMessage(
        error?.message ||
        error?.details ||
        "No se pudo enviar tu consulta. Inténtalo de nuevo."
      );
    } finally {
      setLoading(false);
    }
  };

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
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            placeholder="Tu nombre"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Mensaje *</Label>
        <Textarea
          id="message"
          placeholder="Describe tu consulta..."
          rows={5}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
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