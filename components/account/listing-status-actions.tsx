"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface ListingStatusActionsProps {
  listingId: string;
  currentStatus: string | null;
}

const STATUS_OPTIONS = [
  { value: "available", label: "Disponible" },
  { value: "reserved", label: "Reservado" },
  { value: "sold", label: "Vendido" },
  { value: "archived", label: "Archivado" },
] as const;

export function ListingStatusActions({
  listingId,
  currentStatus,
}: ListingStatusActionsProps) {
  const [status, setStatus] = useState(currentStatus || "available");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(currentStatus || "available");
  }, [currentStatus]);

  const initialStatus = currentStatus || "available";
  const hasChanges = status !== initialStatus;

  const handleSave = async () => {
    if (saving || !hasChanges) return;

    setSaving(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("listings")
        .update({ status })
        .eq("id", listingId)
        .select("id, status")
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error("No se pudo actualizar el estado del anuncio.");
      }

      window.location.reload();
    } catch (error: any) {
      console.error("Error actualizando estado:", error);

      const message =
        error?.message ||
        error?.details ||
        error?.error_description ||
        "No se pudo actualizar el anuncio.";

      alert(`Error actualizando estado: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 flex items-center gap-2">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        disabled={saving}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <Button
        type="button"
        variant="outline"
        onClick={handleSave}
        disabled={saving || !hasChanges}
      >
        {saving ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}

