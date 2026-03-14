"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface ContactSellerButtonProps {
  listingId: string;
  sellerId: string;
}

export function ContactSellerButton({
  listingId,
  sellerId,
}: ContactSellerButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleContact = async () => {
    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/auth");
        return;
      }

      if (user.id === sellerId) {
        router.push("/messages");
        router.refresh();
        return;
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

      if (existingConversation) {
        router.push(`/messages/${existingConversation.id}`);
        router.refresh();
        return;
      }

      const { data: newConversation, error: insertConversationError } =
        await supabase
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

      const { error: updateConversationError } = await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", newConversation.id);

      if (updateConversationError) {
        throw updateConversationError;
      }

      router.push(`/messages/${newConversation.id}`);
      router.refresh();
    } catch (error: any) {
      console.error("Error creando conversación:", error);

      const message =
        error?.message ||
        error?.error_description ||
        error?.details ||
        JSON.stringify(error);

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
    >
      {loading ? "Abriendo chat..." : "Contactar"}
    </Button>
  );
}
