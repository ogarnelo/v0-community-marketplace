"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appendGrowthUtm } from "@/lib/growth/attribution";

type Props = {
  campaign: "agreement_confirmed" | "school_joined";
  title?: string;
  description?: string;
};

export function CommunityInviteCard({
  campaign,
  title = "¿Conoces a otra familia a la que le pueda servir Wetudy?",
  description = "Compártele Wetudy para que pueda buscar, publicar o donar material escolar.",
}: Props) {
  const [copying, setCopying] = useState(false);

  const buildUrl = (medium: string) =>
    appendGrowthUtm(
      "/auth?mode=signup",
      {
        source: "member",
        medium,
        campaign,
      },
      typeof window !== "undefined" ? window.location.origin : undefined
    );

  const share = async () => {
    try {
      const url = buildUrl("share");
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "Wetudy",
          text: "Únete a Wetudy para reutilizar material escolar entre familias.",
          url,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        setCopying(true);
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // El usuario puede cancelar el diálogo nativo sin que sea un error.
    } finally {
      setCopying(false);
    }
  };

  const shareWhatsApp = () => {
    const url = buildUrl("whatsapp");
    const text = encodeURIComponent(
      `Únete a Wetudy para reutilizar material escolar entre familias: ${url}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm">
          <Share2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-emerald-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-emerald-900/80">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={share} disabled={copying}>
              {copying ? "Copiando..." : "Compartir"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={shareWhatsApp}>
              WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
