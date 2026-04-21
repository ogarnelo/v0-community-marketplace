
"use client";

import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  url: string;
};

export default function ShareListingButton({ title, url }: Props) {
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Mira este anuncio en Wetudy: ${title}`,
          url,
        });
        return;
      } catch { }
    }

    await navigator.clipboard.writeText(url);
    alert("Enlace copiado");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Mira este anuncio en Wetudy: ${title} ${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={share}>
        Compartir
      </Button>
      <Button type="button" variant="outline" onClick={shareWhatsApp}>
        WhatsApp
      </Button>
    </div>
  );
}
