"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface ContactSellerButtonProps {
  listingId: string;
  sellerId: string;
}

export function ContactSellerButton({
  listingId,
  sellerId,
}: ContactSellerButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleContact = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign(`/auth?next=/marketplace/listing/${listingId}`);
        return;
      }

      if (user.id === sellerId) {
        alert("No puedes iniciar una conversación contigo mismo.");
        return;
      }

      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .select("id, status")
        .eq("id", listingId)
        .maybeSingle();

      if (listingError) {
        throw listingError;
      }

      if (!listing) {
        throw new Error("El anuncio ya no está disponible.");
      }

      const { data: existingConversation, error: existingError } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", listingId)
        .eq("buyer_id", user.id)
        .eq("seller_id", sellerId)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingConversation?.id) {
        window.location.assign(`/messages/${existingConversation.id}`);
        return;
      }

      if (listing.status !== "available") {
        throw new Error(
          "No puedes iniciar una conversación nueva porque este anuncio ya no está disponible."
        );
      }

      const { data: newConversation, error: insertConversationError } = await supabase
        .from("conversations")
        .insert({
          listing_id: listingId,
          buyer_id: user.id,
          seller_id: sellerId,
        })
        .select("id")
        .single();

      if (insertConversationError) {
        throw insertConversationError;
      }

      if (!newConversation?.id) {
        throw new Error("No se pudo abrir la conversación.");
      }

      const { error: updateConversationError } = await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", newConversation.id);

      if (updateConversationError) {
        throw updateConversationError;
      }

      window.location.assign(`/messages/${newConversation.id}`);
    } catch (error: any) {
      console.error("Error creando conversación:", error);

      const message =
        error?.message ||
        error?.error_description ||
        error?.details ||
        "No se pudo abrir la conversación.";

      alert(`Error creando conversación: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="lg"
      className="mt-6 w-full"
      onClick={handleContact}
      disabled={loading}
      type="button"
    >
      {loading ? "Abriendo chat..." : "Contactar"}
    </Button>
  );
}

