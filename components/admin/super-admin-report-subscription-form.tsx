"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialEmail: string;
  initialEnabled: boolean;
  initialFrequencyDays: number;
  initialRange: string;
  initialFormat: string;
};

export function SuperAdminReportSubscriptionForm({
  initialEmail,
  initialEnabled,
  initialFrequencyDays,
  initialRange,
  initialFormat,
}: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [frequencyDays, setFrequencyDays] = useState(String(initialFrequencyDays || 30));
  const [range, setRange] = useState(initialRange || "90d");
  const [format, setFormat] = useState(initialFormat || "both");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/super/report-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          enabled,
          frequencyDays: Number(frequencyDays),
          range,
          format,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar la configuración.");
      }

      setMessage(payload?.message || "Configuración guardada.");
    } catch (error: any) {
      setMessage(error?.message || "No se pudo guardar la configuración.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="grid gap-2 xl:col-span-2">
          <Label htmlFor="super-report-email">Email</Label>
          <Input
            id="super-report-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="super-report-frequency">Frecuencia</Label>
          <select
            id="super-report-frequency"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={frequencyDays}
            onChange={(event) => setFrequencyDays(event.target.value)}
          >
            <option value="7">Cada 7 días</option>
            <option value="15">Cada 15 días</option>
            <option value="30">Cada 30 días</option>
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="super-report-range">Rango</Label>
          <select
            id="super-report-range"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option value="30d">30 días</option>
            <option value="90d">90 días</option>
            <option value="365d">12 meses</option>
            <option value="total">Histórico</option>
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="super-report-format">Adjunto</Label>
          <select
            id="super-report-format"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
            <option value="both">PDF + CSV</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Envío periódico activo
        </label>
        <Button type="button" onClick={save} disabled={loading}>
          {loading ? "Guardando..." : "Guardar configuración"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
