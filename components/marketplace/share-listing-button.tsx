"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareListingButtonProps {
  title: string;
}

export function ShareListingButton({ title }: ShareListingButtonProps) {
  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Mira este anuncio en Wetudy: ${title}`,
          url,
        });
        return;
      } catch {
        // fallback a copiar enlace
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      toast.error("No se pudo compartir el anuncio");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full"
      onClick={handleShare}
    >
      <Share2 className="h-4 w-4" />
      Compartir
    </Button>
  );
}
