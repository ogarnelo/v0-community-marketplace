"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

type HideConversationButtonProps = {
  conversationId: string;
  onHidden?: (conversationId: string) => void;
  iconOnly?: boolean;
  variant?: "ghost" | "outline";
  size?: "sm" | "icon";
  className?: string;
};

export function HideConversationButton({
  conversationId,
  onHidden,
  iconOnly = false,
  variant = "ghost",
  size = "sm",
  className,
}: HideConversationButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleHideConversation = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.assign("/auth?next=/messages");
        return;
      }

      const { data: conversation, error: conversationError } = await supabase
        .from("conversations")
        .select("id, buyer_id, seller_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (conversationError) {
        throw conversationError;
      }

      if (
        !conversation ||
        (conversation.buyer_id !== user.id && conversation.seller_id !== user.id)
      ) {
        throw new Error("No tienes permisos sobre esta conversación.");
      }

      const { error: hideError } = await supabase
        .from("hidden_conversations")
        .upsert(
          {
            user_id: user.id,
            conversation_id: conversationId,
          },
          { onConflict: "user_id,conversation_id" }
        );

      if (hideError) {
        throw hideError;
      }

      onHidden?.(conversationId);

      if (pathname === `/messages/${conversationId}`) {
        router.push("/messages");
        return;
      }

      router.refresh();
    } catch (error: any) {
      console.error("Error ocultando conversación:", error);
      setErrorMessage(
        error?.message ||
        error?.details ||
        "No se pudo eliminar el chat."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          aria-label="Eliminar chat"
          title="Eliminar chat"
        >
          <Trash2 className="h-4 w-4" />
          {!iconOnly ? <span className="ml-2">Eliminar chat</span> : null}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar chat</AlertDialogTitle>
          <AlertDialogDescription>
            Este chat se ocultará solo para ti. La otra persona seguirá viendo la conversación y su historial.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={loading} onClick={handleHideConversation}>
            {loading ? "Eliminando..." : "Eliminar chat"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}