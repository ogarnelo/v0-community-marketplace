
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  url: string;
};

export default function ShareListingButton({ title, url }: Props) {
  const [copying, setCopying] = useState(false);

  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title,
          text: `Mira este anuncio en Wetudy: ${title}`,
          url,
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        setCopying(true);
        await navigator.clipboard.writeText(url);
        alert("Enlace copiado");
      }
    } catch {
      // no-op
    } finally {
      setCopying(false);
    }
  };

  const shareWhatsApp = () => {
    if (typeof window === "undefined") return;
    const text = encodeURIComponent(`Mira este anuncio en Wetudy: ${title} ${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={handleShare} disabled={copying}>
        {copying ? "Copiando..." : "Compartir"}
      </Button>
      <Button type="button" variant="outline" onClick={shareWhatsApp}>
        WhatsApp
      </Button>
    </div>
  );
}
