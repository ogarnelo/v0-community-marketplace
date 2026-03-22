"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FavoriteButtonProps {
  listingId: string;
  initialIsFavorite?: boolean;
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
}

export function FavoriteButton({
  listingId,
  initialIsFavorite = false,
  className = "",
  iconClassName = "h-4 w-4",
  showLabel = false,
}: FavoriteButtonProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsFavorite(initialIsFavorite);
  }, [initialIsFavorite]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/auth");
        return;
      }

      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", listingId);

        if (error) throw error;

        setIsFavorite(false);
      } else {
        const { error } = await supabase
          .from("favorites")
          .upsert(
            {
              user_id: user.id,
              listing_id: listingId,
            },
            {
              onConflict: "user_id,listing_id",
              ignoreDuplicates: true,
            }
          );

        if (error) throw error;

        setIsFavorite(true);
      }

      router.refresh();
    } catch (error: any) {
      console.error("Error actualizando favorito:", error);
      alert(
        `Error actualizando favorito: ${error?.message || "No se pudo guardar el favorito"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleFavorite}
      disabled={loading}
      className={className}
      aria-label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
    >
      <Heart
        className={`${iconClassName} transition-colors ${isFavorite ? "fill-[#7EBA28] text-[#7EBA28]" : "text-muted-foreground"
          }`}
      />
      {showLabel ? (
        <span className="text-sm font-medium">
          {isFavorite ? "Guardado" : "Guardar"}
        </span>
      ) : null}
      <span className="sr-only">
        {isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
      </span>
    </button>
  );
}