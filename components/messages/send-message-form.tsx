"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface SendMessageFormProps {
  conversationId: string;
}

export function SendMessageForm({ conversationId }: SendMessageFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

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

      const messageText = body.trim();

      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: messageText,
        read_at: null,
      });

      if (insertError) {
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      if (updateError) {
        throw updateError;
      }

      setBody("");
      router.refresh();
    } catch (error: any) {
      console.error("Error enviando mensaje:", error);

      const message =
        error?.message ||
        error?.error_description ||
        error?.details ||
        JSON.stringify(error);

      alert(`Error enviando mensaje: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="space-y-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Escribe tu mensaje..."
        rows={4}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !body.trim()}>
          {loading ? "Enviando..." : "Enviar mensaje"}
        </Button>
      </div>
    </form>
  );
}
