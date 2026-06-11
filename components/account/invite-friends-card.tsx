
"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  appUrl: string;
  referralCode: string;
};

export default function InviteFriendsCard({ appUrl, referralCode }: Props) {
  const inviteUrl = useMemo(() => `${appUrl}/invite?ref=${referralCode}`, [appUrl, referralCode]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    alert("Enlace copiado");
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(
      `Únete a Wetudy. Estoy usando la app para comprar y vender libros y material educativo: ${inviteUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="space-y-2">
        <h3 className="text-base font-semibold">Invita a otros usuarios</h3>
        <p className="text-sm text-muted-foreground">
          Cuantos más usuarios entren, más fácil será encontrar libros, uniformes y material útil.
        </p>
        <div className="rounded-lg bg-muted p-3 text-sm break-all">{inviteUrl}</div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copyLink}>Copiar enlace</Button>
          <Button type="button" variant="outline" onClick={shareWhatsApp}>Compartir por WhatsApp</Button>
        </div>
      </div>
    </div>
  );
}
