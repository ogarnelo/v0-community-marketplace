
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { appendGrowthUtm } from "@/lib/growth/attribution";

type Props = {
  title: string;
  url: string;
};

export default function ShareListingButton({ title, url }: Props) {
  const [copying, setCopying] = useState(false);

  const buildShareUrl = (medium: string) =>
    appendGrowthUtm(
      url,
      {
        source: "member",
        medium,
        campaign: "listing_share",
      },
      typeof window !== "undefined" ? window.location.origin : undefined
    );

  const handleShare = async () => {
    try {
      const shareUrl = buildShareUrl("share");

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title,
          text: `Mira este anuncio en Wetudy: ${title}`,
          url: shareUrl,
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        setCopying(true);
        await navigator.clipboard.writeText(shareUrl);
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
    const shareUrl = buildShareUrl("whatsapp");
    const text = encodeURIComponent(`Mira este anuncio en Wetudy: ${title} ${shareUrl}`);
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
