"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus || "available");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(currentStatus || "available");
  }, [currentStatus]);

  const hasChanges = status !== (currentStatus || "available");

  const handleSave = async () => {
    if (loading || isPending || !hasChanges) return;

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("listings")
        .update({ status })
        .eq("id", listingId);

      if (error) {
        throw error;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error: any) {
      console.error("Error actualizando estado:", error);
      alert(
        `Error actualizando estado: ${error?.message || "No se pudo actualizar el anuncio"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        disabled={loading || isPending}
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
        disabled={loading || isPending || !hasChanges}
      >
        {loading || isPending ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}