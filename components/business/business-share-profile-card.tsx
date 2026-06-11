"use client";

import { Button } from "@/components/ui/button";

export default function BusinessShareProfileCard({ profileUrl }: { profileUrl: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(profileUrl);
    alert("Enlace copiado");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Mira mi perfil profesional en Wetudy: ${profileUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Comparte tu perfil profesional</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Cuantos más usuarios sigan tu perfil, más alcance tendrán tus nuevos productos.
      </p>
      <div className="mt-4 rounded-lg bg-muted p-3 text-sm break-all">{profileUrl}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={copy}>Copiar enlace</Button>
        <Button type="button" variant="outline" onClick={shareWhatsApp}>WhatsApp</Button>
      </div>
    </div>
  );
}
