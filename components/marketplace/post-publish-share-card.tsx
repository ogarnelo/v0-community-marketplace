
"use client";

import { Button } from "@/components/ui/button";

export default function PostPublishShareCard({ title, url }: { title: string; url: string }) {
  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    alert("Enlace copiado");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`He publicado en Wetudy: ${title} ${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title,
        text: `He publicado este anuncio en Wetudy: ${title}`,
        url,
      });
      return;
    }

    await copyLink();
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Anuncio publicado</p>
          <p className="mt-1 text-sm text-emerald-700">
            Compártelo en tu grupo de WhatsApp o comunidad para conseguir visitas más rápido.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={nativeShare}>Compartir</Button>
          <Button type="button" variant="outline" onClick={shareWhatsApp}>WhatsApp</Button>
          <Button type="button" variant="outline" onClick={copyLink}>Copiar enlace</Button>
        </div>
      </div>
    </div>
  );
}
