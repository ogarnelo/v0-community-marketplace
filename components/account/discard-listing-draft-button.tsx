"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DiscardListingDraftButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const discard = async () => {
    if (loading) return;
    if (!window.confirm("¿Descartar este borrador? Se perderán los datos y las fotos guardadas.")) return;

    setLoading(true);
    try {
      const response = await fetch("/api/marketplace/listing-draft", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preservePhotoPaths: [] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "No se pudo descartar el borrador.");
      router.refresh();
    } catch (error: any) {
      alert(error?.message || "No se pudo descartar el borrador.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full justify-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
      onClick={discard}
      disabled={loading}
    >
      <Trash2 className="h-4 w-4" />
      {loading ? "Descartando..." : "Descartar borrador"}
    </Button>
  );
}
